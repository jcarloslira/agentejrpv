-- Memória de longo prazo da Paloma.

-- Busca em português em TODA a conversa (não só nas últimas mensagens)
alter table paloma.mensagens
  add column if not exists busca tsvector generated always as (to_tsvector('portuguese', texto)) stored,
  add column if not exists citada_wa_id text;
create index if not exists mensagens_busca_idx on paloma.mensagens using gin (busca);
create index if not exists mensagens_usuario_idx on paloma.mensagens (usuario_id, criado_em desc);

-- Resumo corrido de tudo que já se falou com cada pessoa (o que ficou fora da janela recente)
create table if not exists paloma.resumos (
  usuario_id    uuid primary key references paloma.usuarios(id),
  texto         text not null,
  ate           timestamptz not null,          -- mensagens até aqui já estão no resumo
  atualizado_em timestamptz not null default now()
);

-- Webhooks crus dos últimos dias, para conferir formatos (reply, mídia) quando algo sair estranho
create table if not exists paloma.webhooks_brutos (
  id          bigserial primary key,
  recebido_em timestamptz not null default now(),
  payload     jsonb not null
);
create index if not exists webhooks_brutos_quando_idx on paloma.webhooks_brutos (recebido_em);

grant select, insert, update, delete on paloma.resumos, paloma.webhooks_brutos to paloma_app;
grant usage, select on sequence paloma.webhooks_brutos_id_seq to paloma_app;
