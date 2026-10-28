-- Aplicado em 28/10/2026.
-- 1) As tabelas do BI têm RLS só para 'authenticated': o paloma_app enxergava zero linhas.
--    Política somente de leitura e somente para paloma_app (nada muda para o BI).
do $$
declare t text;
begin
  foreach t in array array['jrpv_associados','jrpv_veiculos','jrpv_boletos','jrpv_eventos','jrpv_voluntarios','jrpv_regionais',
                           'jrpv_cooperativas','jrpv_kpis','jrpv_kpis_regional','jrpv_historico_mensal','jrpv_sync_control'] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='paloma_leitura') then
      execute format('create policy paloma_leitura on public.%I for select to paloma_app using (true)', t);
    end if;
  end loop;
end $$;

-- 2) Datas do funil calculadas e indexadas (o painel estourava o statement_timeout de 20s)
alter table paloma.pcrm_cotacoes
  add column if not exists criada_em timestamptz generated always as (paloma.data_power(dados->>'createdDate')) stored,
  add column if not exists aceita_em timestamptz generated always as (paloma.data_power(dados->>'dateQuotationAcceptance')) stored,
  add column if not exists pagamento_em timestamptz generated always as (paloma.data_power(dados->>'paymentConfirmedDate')) stored,
  add column if not exists vistoria_finalizada_em timestamptz generated always as (paloma.data_power(dados->>'inspectionFinalizedDate')) stored,
  add column if not exists enviada_sga_em timestamptz generated always as (paloma.data_power(dados->>'sentToHinovaDate')) stored,
  add column if not exists arquivada_em timestamptz generated always as (paloma.data_power(dados->>'quoteShelvedDate')) stored;
create index if not exists pcrm_criada_idx on paloma.pcrm_cotacoes (criada_em);
create index if not exists pcrm_enviada_idx on paloma.pcrm_cotacoes (enviada_sga_em);
create index if not exists pcrm_aceita_idx on paloma.pcrm_cotacoes (aceita_em);
create index if not exists pcrm_status_idx on paloma.pcrm_cotacoes (card_status);

create or replace view paloma.pcrm_funil as
select quotation_code, cliente_nome, placa, consultor_nome, consultor_email, cooperativa, card_status, arquivada,
       criada_em, aceita_em, pagamento_em, vistoria_finalizada_em, dados->>'statusInspection' as status_vistoria,
       enviada_sga_em, arquivada_em,
       dados->>'namePlan' as plano, dados->>'monthlyPaymentsPrice' as mensalidade, dados->>'acquisitionPrice' as adesao,
       dados->>'vehicleModel' as modelo, dados->>'vehicleFipeValue' as fipe, dados->>'quotationOrigin' as origem
  from paloma.pcrm_cotacoes;
