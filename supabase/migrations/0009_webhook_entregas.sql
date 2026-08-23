-- Log de entregas do webhook de eventos para a secretaria.
--
-- Cada evento relevante do funil (inscrição recebida, pagamento iniciado,
-- pagamento confirmado, pagamento recusado/expirado/estornado, triagem
-- concluída) é POSTado para WEBHOOK_SECRETARIA_URL, se configurada — ver
-- lib/webhook-secretaria.ts. Esta tabela grava toda tentativa, sucesso ou
-- falha: é a fonte do bloco de checkpoint em /secretaria. Sem ela, uma
-- entrega recusada pelo outro sistema não deixaria rastro nenhum.

create type webhook_evento as enum (
  'inscricao_recebida',
  'pagamento_iniciado',
  'pagamento_confirmado',
  'pagamento_falhou',
  'triagem_concluida'
);

create table public.webhook_entregas (
  id            uuid primary key default gen_random_uuid(),
  inscricao_id  uuid not null references public.inscricoes (id) on delete cascade,
  evento        webhook_evento not null,
  payload       jsonb not null,
  sucesso       boolean not null,
  status_http   integer,
  erro          text,
  criado_em     timestamptz not null default now()
);

comment on table public.webhook_entregas is 'Log de cada tentativa de entrega do webhook da secretaria. Existe para o painel /secretaria mostrar falhas de entrega, nao so o estado atual da inscricao.';
comment on column public.webhook_entregas.payload is 'O corpo exatamente como foi enviado (ou tentado), para permitir reenvio idêntico e para auditoria.';
comment on column public.webhook_entregas.status_http is 'Nulo quando a falha foi de rede/timeout, antes de haver resposta HTTP.';

create index webhook_entregas_inscricao_idx on public.webhook_entregas (inscricao_id);
create index webhook_entregas_criado_idx    on public.webhook_entregas (criado_em desc);

alter table public.webhook_entregas enable row level security;
alter table public.webhook_entregas force row level security;
