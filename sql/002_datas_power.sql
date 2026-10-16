-- Datas do Power CRM vêm como "15/10/2026 - 14:45" (ou "-"); converte para timestamptz no fuso de Sergipe.
create or replace function paloma.data_power(t text) returns timestamptz
language sql immutable as $$
  select case when t ~ '^\d{2}/\d{2}/\d{4}'
    then to_timestamp(substring(t from '^\d{2}/\d{2}/\d{4}') || ' ' || coalesce(substring(t from '(\d{2}:\d{2})'), '00:00'), 'DD/MM/YYYY HH24:MI')::timestamp at time zone 'America/Maceio'
  end
$$;

-- Cada marco do funil como data de verdade (base do cotacoes_painel)
create or replace view paloma.pcrm_funil as
select quotation_code, cliente_nome, placa, consultor_nome, consultor_email, cooperativa, card_status, arquivada,
       paloma.data_power(dados->>'createdDate')              as criada_em,
       paloma.data_power(dados->>'dateQuotationAcceptance')  as aceita_em,
       paloma.data_power(dados->>'paymentConfirmedDate')     as pagamento_em,
       paloma.data_power(dados->>'inspectionFinalizedDate')  as vistoria_finalizada_em,
       dados->>'statusInspection'                            as status_vistoria,
       paloma.data_power(dados->>'sentToHinovaDate')         as enviada_sga_em,
       paloma.data_power(dados->>'quoteShelvedDate')         as arquivada_em,
       dados->>'namePlan' as plano, dados->>'monthlyPaymentsPrice' as mensalidade, dados->>'acquisitionPrice' as adesao,
       dados->>'vehicleModel' as modelo, dados->>'vehicleFipeValue' as fipe, dados->>'quotationOrigin' as origem
  from paloma.pcrm_cotacoes;

grant execute on function paloma.data_power(text) to paloma_app;
grant select on paloma.pcrm_funil to paloma_app;
