-- Credencial que o QR Code da ficha carrega, e a trilha de quem já conferiu.
--
-- O token NÃO é o id da inscrição nem o CPF: o id vaza a estrutura interna e
-- o CPF é adivinhável. São 128 bits aleatórios em hexadecimal — hex, e não
-- base64, porque base64 termina em '=' e pode conter '+', que numa URL são
-- ambíguos: o token que chega ao servidor deixa de ser o do banco e a
-- credencial válida é recusada.

alter table public.inscricoes
  add column token_validacao text not null default encode(gen_random_bytes(16), 'hex');

create unique index inscricoes_token_validacao_idx on public.inscricoes (token_validacao);

comment on column public.inscricoes.token_validacao is 'Segredo aleatorio de 128 bits em hexadecimal, carregado pelo QR Code da ficha.';

-- Quem foi conferido, quando e em qual ponto da instituição.
create table public.validacoes (
  id           uuid primary key default gen_random_uuid(),
  inscricao_id uuid not null references public.inscricoes (id) on delete cascade,
  posto        text,
  criado_em    timestamptz not null default now()
);

create index validacoes_inscricao_idx on public.validacoes (inscricao_id, criado_em desc);

comment on table public.validacoes is 'Registro de cada leitura do QR Code, para saber por onde o aluno passou.';
comment on column public.validacoes.posto is 'Ponto da instituicao onde a leitura aconteceu (recepcao, sala, secretaria).';

alter table public.validacoes enable row level security;
alter table public.validacoes force row level security;

-- Consulta pelo token e registra a leitura, num passo só.
create or replace function public.validar_credencial(p_token text, p_posto text default null)
returns table (
  encontrada       boolean,
  nome             text,
  numero_inscricao text,
  cpf_mascarado    text,
  status           text,
  passos           integer,
  inscrito_em      timestamptz,
  leituras         integer
)
language plpgsql
set search_path = ''
as $$
declare
  v_id      uuid;
  v_nome    text;
  v_numero  text;
  v_cpf     text;
  v_status  text;
  v_criado  timestamptz;
  v_passos  integer;
  v_leituras integer;
begin
  -- Aliases obrigatórios: os nomes de retorno colidem com as colunas.
  select i.id, i.nome, i.numero_inscricao, i.cpf, i.status::text, i.criado_em
    into v_id, v_nome, v_numero, v_cpf, v_status, v_criado
  from public.inscricoes i
  where i.token_validacao = p_token;

  if v_id is null then
    return query select false, null::text, null::text, null::text, null::text, null::integer, null::timestamptz, null::integer;
    return;
  end if;

  insert into public.validacoes (inscricao_id, posto)
  values (v_id, nullif(btrim(p_posto), ''));

  select count(*)::integer into v_passos
  from public.triagem_respostas t where t.inscricao_id = v_id;

  select count(*)::integer into v_leituras
  from public.validacoes v where v.inscricao_id = v_id;

  return query select
    true, v_nome, v_numero,
    -- só o miolo do CPF, o bastante para conferir com o documento
    '***.' || substr(v_cpf, 4, 3) || '.' || substr(v_cpf, 7, 3) || '-**',
    v_status, v_passos, v_criado, v_leituras;
end;
$$;

comment on function public.validar_credencial is 'Consulta a inscricao pelo token do QR e registra a leitura. Devolve apenas o necessario para conferir o aluno na portaria.';
