-- Log de entregas da Conversions API do Meta (lib/meta-capi.ts).
--
-- Espelha webhook_entregas (migration 0009), mas para o envio server-side
-- dos eventos de conversão ao Meta — sem isto, uma entrega recusada pela
-- API do Meta (token vencido, dado mal formatado) ficaria muda: o pixel do
-- navegador continuaria disparando, e ninguém notaria que a cópia do
-- servidor parou de chegar.

create table public.meta_capi_entregas (
  id            uuid primary key default gen_random_uuid(),
  inscricao_id  uuid not null references public.inscricoes (id) on delete cascade,
  -- Nome da etapa no formato funil_N_nome (ver lib/etapas-funil.ts), não a
  -- palavra livre do webhook — assim bate direto com o que aparece no
  -- Gerenciador de Eventos do Meta.
  evento        text not null,
  -- Só para pagamento/pago: qual cobrança gerou o event_id e o valor.
  -- Guardado à parte, e não só dentro do payload, para o reenvio manual não
  -- precisar reabrir o JSON para saber qual cobrança usar.
  pagamento_id  uuid references public.pagamentos (id) on delete set null,
  payload       jsonb,
  sucesso       boolean not null,
  status_http   integer,
  erro          text,
  criado_em     timestamptz not null default now()
);

comment on table public.meta_capi_entregas is 'Log de cada tentativa de envio de evento de conversao ao Meta via Conversions API. Existe para o painel /secretaria mostrar quando a copia server-side do pixel parou de chegar.';
comment on column public.meta_capi_entregas.payload is 'O corpo enviado (ou tentado) ao Meta, sem o access_token — nunca gravar o token aqui.';

create index meta_capi_entregas_inscricao_idx on public.meta_capi_entregas (inscricao_id);
create index meta_capi_entregas_criado_idx    on public.meta_capi_entregas (criado_em desc);

alter table public.meta_capi_entregas enable row level security;
alter table public.meta_capi_entregas force row level security;
