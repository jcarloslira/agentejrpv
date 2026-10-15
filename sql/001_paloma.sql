-- Paloma: tudo dela mora no schema "paloma". Nada aqui altera tabelas de outros projetos;
-- das tabelas jrpv_* (espelho do SGA mantido pelo JRPV-DATA.BI) ela só LÊ.

create schema if not exists paloma;

-- Quem pode falar com a Paloma e com que papel
create table if not exists paloma.usuarios (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  apelido          text,
  telefone         text not null unique,          -- só dígitos, com 55
  papel            text not null check (papel in ('consultor','cadastro','gerencia','diretoria','admin')),
  codigo_voluntario integer,                      -- SGA: limita o consultor aos veículos dele
  powercrm_email   text,                          -- Power CRM: limita o consultor às cotações dele
  codigo_regional  integer,
  ativo            boolean not null default true,
  preferencias     jsonb not null default '{}'::jsonb,  -- ex.: {"voz": true}
  criado_em        timestamptz not null default now()
);

-- Conversa (texto já transcrito; mídia referenciada em arquivos)
create table if not exists paloma.mensagens (
  id          bigserial primary key,
  telefone    text not null,
  usuario_id  uuid references paloma.usuarios(id),
  papel       text not null check (papel in ('user','assistant','aviso')),
  texto       text not null,
  arquivo_id  uuid,
  wa_id       text unique,
  criado_em   timestamptz not null default now()
);
create index if not exists mensagens_tel_idx on paloma.mensagens (telefone, criado_em desc);

-- Memória: o que a Paloma sabe da JRPV (procedimentos, regras, aprendizados) e de cada pessoa
create table if not exists paloma.memorias (
  id            bigserial primary key,
  escopo        text not null check (escopo in ('jrpv','pessoa')),
  usuario_id    uuid references paloma.usuarios(id),
  tipo          text not null default 'fato',     -- procedimento | regra | fato | preferencia | caso
  texto         text not null,
  busca         tsvector generated always as (to_tsvector('portuguese', texto)) stored,
  ativo         boolean not null default true,
  origem        text,
  criado_por    uuid references paloma.usuarios(id),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (escopo = 'jrpv' or usuario_id is not null)
);
create index if not exists memorias_busca_idx on paloma.memorias using gin (busca);

-- Toda ação que grava algo no SGA ou no Power CRM nasce pendente e só roda depois do "confirma"
create table if not exists paloma.acoes (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references paloma.usuarios(id),
  sistema      text not null check (sistema in ('sga','powercrm')),
  metodo       text not null,
  rota         text not null,
  corpo        jsonb,
  resumo       text not null,
  status       text not null default 'pendente' check (status in ('pendente','executada','cancelada','erro','expirada')),
  resultado    jsonb,
  criado_em    timestamptz not null default now(),
  executado_em timestamptz
);
create index if not exists acoes_usuario_idx on paloma.acoes (usuario_id, criado_em desc);

-- Arquivos recebidos pelo WhatsApp (fotos, PDFs, áudios)
create table if not exists paloma.arquivos (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid references paloma.usuarios(id),
  telefone    text not null,
  wa_id       text,
  mime        text not null,
  nome        text,
  tamanho     integer,
  conteudo    bytea not null,
  descricao   text,                                -- o que a Paloma viu no arquivo
  criado_em   timestamptz not null default now()
);

-- Espelho do Power CRM (relatório /api/report/db + webhooks)
create table if not exists paloma.pcrm_cotacoes (
  quotation_code   text primary key,
  cliente_nome     text,
  cliente_cpf      text,
  cliente_celular  text,
  placa            text,
  consultor_nome   text,
  consultor_email  text,
  cooperativa      text,
  card_status      text,
  arquivada        boolean,
  criado_no_crm    timestamptz,
  dados            jsonb not null,
  atualizado_em    timestamptz not null default now()
);
create index if not exists pcrm_cotacoes_consultor_idx on paloma.pcrm_cotacoes (lower(consultor_email));
create index if not exists pcrm_cotacoes_placa_idx on paloma.pcrm_cotacoes (upper(placa));
create index if not exists pcrm_cotacoes_cpf_idx on paloma.pcrm_cotacoes (cliente_cpf);

create table if not exists paloma.pcrm_webhooks (
  id          bigserial primary key,
  evento      text,
  payload     jsonb not null,
  processado  boolean not null default false,
  recebido_em timestamptz not null default now()
);

create table if not exists paloma.config (
  chave     text primary key,
  valor     jsonb not null,
  atualizado_em timestamptz not null default now()
);

create table if not exists paloma.uso_ia (
  id          bigserial primary key,
  usuario_id  uuid,
  modelo      text,
  entrada     integer,
  saida       integer,
  cache_lido  integer,
  criado_em   timestamptz not null default now()
);

-- Ninguém de fora (anon/authenticated da API pública) enxerga o schema da Paloma
revoke all on schema paloma from public;
alter default privileges in schema paloma revoke all on tables from public;
