-- Funil de inscrição do Curso de Punção Venosa — CVB-RJ
-- Modela o que hoje vive em localStorage: dados da inscrição, respostas da
-- triagem (8 passos) e o pagamento PIX.
--
-- RLS fica ligada e forçada em todas as tabelas SEM nenhuma policy: por
-- padrão isso NEGA todo acesso via chave publicável. O acesso é feito por
-- route handlers no servidor usando SUPABASE_SECRET_KEY, que ignora RLS.
-- Nunca exponha essa chave no cliente (ver .env.example).

create extension if not exists "pgcrypto";

-- Status possíveis ------------------------------------------------------

create type inscricao_status as enum ('rascunho', 'aguardando_pagamento', 'paga', 'triagem_concluida', 'cancelada');
create type pagamento_status as enum ('pendente', 'confirmado', 'expirado', 'estornado');

-- Inscrições ------------------------------------------------------------

create table public.inscricoes (
  id                    uuid primary key default gen_random_uuid(),
  -- CPF em dígitos puros (11 chars), sem máscara: a máscara é da interface.
  cpf                   text not null unique,
  nome                  text not null,
  telefone              text not null,
  email                 text,
  ensino_medio_completo boolean not null default false,
  numero_inscricao      text unique,
  status                inscricao_status not null default 'rascunho',
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  constraint cpf_11_digitos      check (cpf ~ '^[0-9]{11}$'),
  constraint telefone_11_digitos check (telefone ~ '^[0-9]{11}$'),
  constraint nome_e_sobrenome    check (array_length(regexp_split_to_array(btrim(nome), '\s+'), 1) >= 2),
  constraint email_plausivel     check (email is null or email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')
);

comment on table  public.inscricoes is 'Uma linha por aluno inscrito. CPF e a chave natural - o funil reconhece aluno existente por ele.';
comment on column public.inscricoes.cpf is 'Somente digitos. Validacao de digito verificador e feita na aplicacao (lib/enrollment.ts).';
comment on column public.inscricoes.numero_inscricao is 'Formato CVB-<ano>-<sequencial 4 digitos>. Atribuido quando o pagamento e confirmado.';

-- Respostas da triagem --------------------------------------------------
-- 8 passos fixos. A resposta é jsonb porque o tipo varia por passo:
-- texto (CEP, e-mail), string (escolha única), array de strings (dias),
-- array de booleans (confirmações finais).

create table public.triagem_respostas (
  id           uuid primary key default gen_random_uuid(),
  inscricao_id uuid not null references public.inscricoes (id) on delete cascade,
  passo        smallint not null,
  resposta     jsonb not null,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint passo_de_1_a_8 check (passo between 1 and 8),
  constraint uma_resposta_por_passo unique (inscricao_id, passo)
);

comment on table public.triagem_respostas is 'Respostas da triagem, uma linha por passo. Ver triageQuestions em lib/enrollment.ts - mudar a quantidade de perguntas exige mexer nesta constraint tambem.';

create index triagem_respostas_inscricao_idx on public.triagem_respostas (inscricao_id);

-- Pagamentos ------------------------------------------------------------

create table public.pagamentos (
  id            uuid primary key default gen_random_uuid(),
  inscricao_id  uuid not null references public.inscricoes (id) on delete cascade,
  valor_centavos integer not null,
  status        pagamento_status not null default 'pendente',
  -- txid/e2e do provedor PIX. Único quando presente, para tornar o
  -- processamento de webhook idempotente.
  txid          text unique,
  pix_copia_cola text,
  confirmado_em timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint valor_positivo check (valor_centavos > 0),
  constraint confirmado_tem_data check (
    (status = 'confirmado') = (confirmado_em is not null)
  )
);

comment on table public.pagamentos is 'Historico de tentativas de pagamento. Hoje o funil simula: valor 24900 = R$ 249,00.';

create index pagamentos_inscricao_idx on public.pagamentos (inscricao_id);

-- Número de inscrição sequencial ----------------------------------------

create sequence public.inscricao_seq start 1;

create or replace function public.gerar_numero_inscricao()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'CVB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.inscricao_seq')::text, 4, '0');
$$;

comment on function public.gerar_numero_inscricao is 'Gera o numero exibido na ficha do aluno, no formato CVB-2026-0001.';

-- atualizado_em automático ----------------------------------------------

create or replace function public.toca_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger inscricoes_atualizado_em        before update on public.inscricoes        for each row execute function public.toca_atualizado_em();
create trigger triagem_respostas_atualizado_em before update on public.triagem_respostas for each row execute function public.toca_atualizado_em();
create trigger pagamentos_atualizado_em        before update on public.pagamentos        for each row execute function public.toca_atualizado_em();

-- RLS: nega tudo por padrão ---------------------------------------------

alter table public.inscricoes        enable row level security;
alter table public.triagem_respostas enable row level security;
alter table public.pagamentos        enable row level security;

alter table public.inscricoes        force row level security;
alter table public.triagem_respostas force row level security;
alter table public.pagamentos        force row level security;
