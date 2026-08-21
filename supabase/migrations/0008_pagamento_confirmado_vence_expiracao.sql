-- Um pagamento confirmado pelo provedor vale, mesmo que a cobrança já
-- estivesse marcada como expirada aqui.
--
-- A versão anterior lançava exceção nesse caso. Como o contador da tela
-- expirava em 30 minutos e a Únicopag mantém o PIX pagável por 24 horas, um
-- aluno que pagasse depois dos 30 minutos teria o dinheiro debitado e a
-- inscrição recusada pelo nosso próprio código. Dinheiro entrando sem vaga é
-- o pior desfecho possível.
--
-- Quem chama esta função já confirmou o pagamento contra a API do provedor,
-- então aqui o pagamento é fato consumado.

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

  update public.pagamentos p
     set status = 'confirmado', confirmado_em = now()
   where p.id = p_pagamento_id;

  -- Alias obrigatório: numero_inscricao colide com a coluna de retorno.
  update public.inscricoes i
     set status           = case when i.status = 'triagem_concluida' then i.status else 'paga' end,
         numero_inscricao = coalesce(i.numero_inscricao, public.gerar_numero_inscricao())
   where i.id = v_inscricao
  returning i.numero_inscricao into v_numero;

  return query select v_inscricao, v_numero, false;
end;
$$;

comment on function public.confirmar_pagamento is 'Confirma a cobranca e promove a inscricao. Idempotente. Honra pagamento confirmado pelo provedor mesmo se a cobranca estava expirada.';

-- A versão de 4 argumentos, sem e-mail, sai de cena: o código chama com 5.
drop function if exists public.upsert_inscricao(text, text, text, boolean);
