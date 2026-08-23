-- Visitas na landing — o topo real do funil.
--
-- O pixel do Meta já sabe contar PageView (Events Manager mostra isso), mas
-- essa contagem não aparece em lugar nenhum do nosso banco: /secretaria só
-- tinha dados de quem preencheu a etapa "dados" para frente, porque é aí
-- que a primeira linha em `inscricoes` nasce. Um visitante anônimo que só
-- viu a página e saiu nunca deixava rastro nosso — só do lado do Meta.
--
-- Esta tabela existe para fechar essa lacuna: uma linha por carregamento
-- real da landing (fora do iframe do checkout), o suficiente para calcular
-- a conversão de visita para "entrou no funil" dentro do próprio painel.

create table public.visitas_landing (
  id           uuid primary key default gen_random_uuid(),
  criado_em    timestamptz not null default now(),
  variante     text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text
);

comment on table public.visitas_landing is 'Uma linha por carregamento real da landing (fora do iframe do checkout) — o topo do funil que nao tem inscricao para ancorar. Ver trackLandingView em lib/checkout.ts.';

create index visitas_landing_criado_idx on public.visitas_landing (criado_em desc);

alter table public.visitas_landing enable row level security;
alter table public.visitas_landing force row level security;
