-- E-mail no cadastro.
--
-- A Únicopag exige `customer.email` para criar a cobrança, e o funil só
-- pedia e-mail na triagem — que acontece DEPOIS do pagamento. Sem isto, a
-- cobrança seria recusada com 422.
--
-- Sem DEFAULT de propósito: com default, uma chamada de 4 argumentos ficaria
-- ambígua entre esta versão e a anterior, que segue no ar até o deploy novo
-- assumir. A antiga sai em 0007.

create or replace function public.upsert_inscricao(
  p_cpf           text,
  p_nome          text,
  p_telefone      text,
  p_ensino_medio  boolean,
  p_email         text
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
  insert into public.inscricoes as i (cpf, nome, telefone, email, ensino_medio_completo, status)
  values (p_cpf, p_nome, p_telefone, nullif(btrim(p_email), ''), p_ensino_medio, 'aguardando_pagamento')
  on conflict (cpf) do update
    set nome                  = excluded.nome,
        telefone              = excluded.telefone,
        -- não apaga um e-mail já conhecido se o reenvio vier sem ele
        email                 = coalesce(excluded.email, i.email),
        ensino_medio_completo = excluded.ensino_medio_completo,
        status = case
          when i.status in ('paga', 'triagem_concluida') then i.status
          else 'aguardando_pagamento'
        end
  returning i.id, i.status, i.numero_inscricao into v_id, v_status, v_numero;

  return query select v_id, v_status, v_numero, v_status in ('paga', 'triagem_concluida');
end;
$$;

comment on function public.upsert_inscricao(text, text, text, boolean, text) is
  'Cria ou atualiza a inscricao pelo CPF, incluindo o e-mail que a Unicopag exige na cobranca.';
