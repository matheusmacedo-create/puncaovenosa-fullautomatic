-- Recuperação de alunos pelo WhatsApp (número da escola na Kapso).
--
-- Duas tabelas, as duas só acrescentam: nada existente muda, e o código
-- publicado antes desta migration não lê nenhuma delas.
--
-- `whatsapp_entregas` é a contrapartida de `email_entregas` (migration 0015)
-- para o WhatsApp: cada tentativa de mensagem de recuperação, com sucesso ou
-- falha. É o que /secretaria lê para mostrar o que saiu e o que não saiu, e
-- o que impede a mesma pessoa de receber o mesmo lembrete duas vezes.
--
-- `whatsapp_bloqueios` é quem pediu para não receber mais (respondeu SAIR ao
-- número da escola, ou a secretaria tirou à mão). Por telefone, e não por
-- inscrição: o pedido é da pessoa, e vale para qualquer inscrição dela.
--
-- Enquanto WHATSAPP_RECUPERACAO_ENVIAR não for "sim", nenhuma linha nasce em
-- `whatsapp_entregas`: o painel calcula a fila na hora e mostra quem
-- receberia o quê, sem gravar nem enviar nada.

create type whatsapp_etapa as enum (
  'pix_aberto',
  'abandono',
  'triagem_pendente'
);

comment on type whatsapp_etapa is 'Momento do funil que disparou a mensagem de recuperação. Ver ETAPAS_DE_RECUPERACAO em lib/recuperacao.ts.';

create table public.whatsapp_entregas (
  id            uuid primary key default gen_random_uuid(),
  inscricao_id  uuid not null references public.inscricoes (id) on delete cascade,
  etapa         whatsapp_etapa not null,
  -- Como foi enviado (55 + DDD + número): o telefone da inscrição pode mudar
  -- depois, e o log precisa dizer para onde a mensagem de fato saiu.
  telefone      text not null,
  -- Nome do modelo aprovado na Meta que saiu. Fora da janela de 24h só sai modelo.
  modelo        text not null,
  sucesso       boolean not null,
  -- Id da mensagem na Meta (wamid), quando a Kapso aceitou.
  provedor_id   text,
  erro          text,
  criado_em     timestamptz not null default now()
);

comment on table public.whatsapp_entregas is 'Log de cada tentativa de mensagem de recuperacao pelo WhatsApp. Existe para o painel /secretaria mostrar o que saiu e para impedir lembrete repetido.';

create index whatsapp_entregas_inscricao_idx on public.whatsapp_entregas (inscricao_id);
create index whatsapp_entregas_criado_idx    on public.whatsapp_entregas (criado_em desc);

-- Uma mensagem por momento por inscrição, entre as que deram certo. Parcial
-- porque a falha pode se repetir: é o que permite tentar de novo no dia
-- seguinte. Rede de segurança contra duas rotinas rodando ao mesmo tempo.
create unique index whatsapp_entregas_uma_por_etapa
  on public.whatsapp_entregas (inscricao_id, etapa)
  where sucesso;

alter table public.whatsapp_entregas enable row level security;
alter table public.whatsapp_entregas force row level security;

create table public.whatsapp_bloqueios (
  -- 55 + DDD + celular com o nono dígito: a forma de `numeroDoWhatsapp`.
  telefone   text primary key check (telefone ~ '^55[0-9]{11}$'),
  -- 'resposta' (a pessoa respondeu SAIR) ou 'secretaria' (tirado à mão).
  origem     text not null check (origem in ('resposta', 'secretaria')),
  criado_em  timestamptz not null default now()
);

comment on table public.whatsapp_bloqueios is 'Telefones que pediram para nao receber mensagens de recuperacao. Consultado antes de todo envio.';

alter table public.whatsapp_bloqueios enable row level security;
alter table public.whatsapp_bloqueios force row level security;
