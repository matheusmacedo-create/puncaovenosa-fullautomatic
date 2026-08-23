-- Acompanhamento de quem está no público de remarketing "abandonou o
-- funil" (lib/meta-audiencia.ts).
--
-- Uma linha por inscrição adicionada ao público personalizado do Meta.
-- `removido_em` é preenchido quando a inscrição paga e a rotina de
-- confirmação de pagamento remove a pessoa do público em tempo real — sem
-- isto, continuaríamos pagando anúncio de remarketing para quem já comprou.
-- Também é o que impede a rotina diária (POST /api/meta-audiencia/sync) de
-- tentar adicionar a mesma inscrição duas vezes.

create table public.meta_publico_membros (
  id            uuid primary key default gen_random_uuid(),
  inscricao_id  uuid not null unique references public.inscricoes (id) on delete cascade,
  adicionado_em timestamptz not null default now(),
  removido_em   timestamptz,
  erro          text,
  criado_em     timestamptz not null default now()
);

comment on table public.meta_publico_membros is 'Uma linha por inscricao ja enviada ao publico personalizado de remarketing do Meta. removido_em marca quem ja pagou e saiu do publico.';

create index meta_publico_membros_pendentes_idx on public.meta_publico_membros (inscricao_id) where removido_em is null;

alter table public.meta_publico_membros enable row level security;
alter table public.meta_publico_membros force row level security;
