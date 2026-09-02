-- Log de e-mails transacionais enviados ao aluno.
--
-- O formulário de cadastro diz, na própria validação do campo, que "o
-- comprovante do pagamento é enviado" no e-mail informado — e até aqui nada
-- era enviado. Esta tabela é a contrapartida de `webhook_entregas` (migration
-- 0009) para o outro lado da comunicação: lá é o que a secretaria recebe,
-- aqui é o que o aluno recebe.
--
-- Existe pelo mesmo motivo: sem registro, um e-mail que a Resend recusou (
-- domínio não verificado, endereço em lista de supressão, cota estourada)
-- não deixaria rastro nenhum, e a promessa continuaria quebrada sem ninguém
-- saber. É o que /secretaria lê para mostrar o que não chegou.

create type email_tipo as enum (
  'cobranca_aberta',
  'matricula_paga',
  'curso_pago',
  'triagem_concluida'
);

comment on type email_tipo is 'Momento do funil que disparou o e-mail. Ver EMAILS em lib/email.ts.';

create table public.email_entregas (
  id            uuid primary key default gen_random_uuid(),
  inscricao_id  uuid not null references public.inscricoes (id) on delete cascade,
  tipo          email_tipo not null,
  -- Guardado como foi enviado: o e-mail da inscrição pode mudar depois, e o
  -- log precisa dizer para onde a mensagem de fato saiu.
  destinatario  text not null,
  assunto       text not null,
  sucesso       boolean not null,
  -- Id da mensagem na Resend, quando ela aceitou. É por ele que se rastreia
  -- a entrega no painel do provedor.
  provedor_id   text,
  erro          text,
  criado_em     timestamptz not null default now()
);

comment on table public.email_entregas is 'Log de cada tentativa de e-mail transacional ao aluno. Existe para o painel /secretaria mostrar falha de entrega, nao so o estado da inscricao.';
comment on column public.email_entregas.provedor_id is 'Id da mensagem no provedor. Nulo quando a tentativa falhou antes de ser aceita.';

create index email_entregas_inscricao_idx on public.email_entregas (inscricao_id);
create index email_entregas_criado_idx    on public.email_entregas (criado_em desc);

-- Um tipo de e-mail por inscrição, entre os que deram certo: os disparos são
-- de transição, mas `/api/pagamentos/atual` roda a cada 10s e um postback
-- repetido da Únicopag existe — sem esta barreira, uma corrida entre os dois
-- mandaria o mesmo comprovante duas vezes para a mesma pessoa. Parcial
-- porque a falha pode e deve se repetir: é o que permite uma nova tentativa.
create unique index email_entregas_uma_por_tipo
  on public.email_entregas (inscricao_id, tipo)
  where sucesso;

alter table public.email_entregas enable row level security;
alter table public.email_entregas force row level security;
