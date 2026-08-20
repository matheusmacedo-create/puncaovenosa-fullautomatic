-- Funções que o back-end do funil chama via RPC.
--
-- Existem para manter atômico o que seria uma sequência de queries no
-- servidor: dois cliques rápidos em "já paguei" ou dois webhooks do PSP
-- para a mesma cobrança não podem gerar dois números de inscrição.

-- Cria ou atualiza a inscrição a partir do CPF ---------------------------
-- O CPF é a chave natural. Reenviar o formulário atualiza nome e telefone
-- sem rebaixar o status de quem já pagou.

create or replace function public.upsert_inscricao(
  p_cpf           text,
  p_nome          text,
  p_telefone      text,
  p_ensino_medio  boolean
)
returns table (id uuid, status inscricao_status, numero_inscricao text, ja_paga boolean)
language plpgsql
set search_path = ''
as $$
declare
  v_id     uuid;
  v_status public.inscricao_status;
  v_numero text;
begin
  insert into public.inscricoes as i (cpf, nome, telefone, ensino_medio_completo, status)
  values (p_cpf, p_nome, p_telefone, p_ensino_medio, 'aguardando_pagamento')
  on conflict (cpf) do update
    set nome                  = excluded.nome,
        telefone              = excluded.telefone,
        ensino_medio_completo = excluded.ensino_medio_completo,
        -- quem já pagou não volta para 'aguardando_pagamento'
        status = case
          when i.status in ('paga', 'triagem_concluida') then i.status
          else 'aguardando_pagamento'
        end
  returning i.id, i.status, i.numero_inscricao into v_id, v_status, v_numero;

  return query select v_id, v_status, v_numero, v_status in ('paga', 'triagem_concluida');
end;
$$;

comment on function public.upsert_inscricao is 'Cria ou atualiza a inscricao pelo CPF. ja_paga sinaliza que o funil deve seguir para a triagem em vez de cobrar de novo.';

-- Confirma um pagamento -------------------------------------------------
-- Idempotente: chamar duas vezes para a mesma cobrança nao gera um segundo
-- numero de inscricao. O lock evita corrida entre webhook e clique.

create or replace function public.confirmar_pagamento(p_pagamento_id uuid)
returns table (inscricao_id uuid, numero_inscricao text, ja_confirmado boolean)
language plpgsql
set search_path = ''
as $$
declare
  v_inscricao uuid;
  v_status    public.pagamento_status;
  v_numero    text;
begin
  select p.inscricao_id, p.status into v_inscricao, v_status
  from public.pagamentos p
  where p.id = p_pagamento_id
  for update;

  if v_inscricao is null then
    raise exception 'pagamento % nao encontrado', p_pagamento_id
      using errcode = 'no_data_found';
  end if;

  if v_status = 'confirmado' then
    select i.numero_inscricao into v_numero from public.inscricoes i where i.id = v_inscricao;
    return query select v_inscricao, v_numero, true;
    return;
  end if;

  if v_status = 'expirado' then
    raise exception 'pagamento % esta expirado', p_pagamento_id
      using errcode = 'check_violation';
  end if;

  update public.pagamentos p
     set status = 'confirmado', confirmado_em = now()
   where p.id = p_pagamento_id;

  -- O alias `i` é obrigatório: sem ele, `numero_inscricao` fica ambíguo
  -- entre a coluna da tabela e a coluna de retorno desta função, e o
  -- Postgres aborta com "column reference is ambiguous".
  update public.inscricoes i
     set status           = case when i.status = 'triagem_concluida' then i.status else 'paga' end,
         numero_inscricao = coalesce(i.numero_inscricao, public.gerar_numero_inscricao())
   where i.id = v_inscricao
  returning i.numero_inscricao into v_numero;

  return query select v_inscricao, v_numero, false;
end;
$$;

comment on function public.confirmar_pagamento is 'Confirma a cobranca e promove a inscricao, atribuindo o numero na primeira vez. Idempotente.';

-- Marca a triagem como concluida quando os 8 passos existem --------------

create or replace function public.concluir_triagem_se_completa(p_inscricao_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_total int;
begin
  select count(*) into v_total
  from public.triagem_respostas
  where inscricao_id = p_inscricao_id;

  if v_total < 8 then
    return false;
  end if;

  update public.inscricoes
     set status = 'triagem_concluida'
   where id = p_inscricao_id
     and status = 'paga';

  return true;
end;
$$;

comment on function public.concluir_triagem_se_completa is 'Promove para triagem_concluida somente quando os 8 passos foram respondidos e a inscricao ja esta paga.';
