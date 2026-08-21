-- Composição do preço gravada por cobrança.
--
-- Preço muda com o tempo. Guardar a composição junto da cobrança faz o
-- comprovante refletir o que foi cobrado naquele dia, e não o preço de
-- hoje. É também o que permite, mais adiante, cobrar matrícula e curso em
-- momentos diferentes sem reescrever o histórico.

alter table public.pagamentos
  add column itens jsonb;

comment on column public.pagamentos.itens is 'Composicao do preco no momento da cobranca: [{id, rotulo, centavos}].';

-- Um CHECK não pode conter subconsulta, então a soma sai numa função
-- imutável — depende apenas do argumento.
create or replace function public.soma_itens(p_itens jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum((item->>'centavos')::int), 0)::int
  from jsonb_array_elements(p_itens) item
$$;

comment on function public.soma_itens is 'Soma o campo centavos de um array de itens de cobranca.';

-- A composição precisa fechar com o valor cobrado. Sem isto, um item
-- esquecido geraria um comprovante que não bate com o que foi pago.
alter table public.pagamentos
  add constraint itens_somam_o_valor check (
    itens is null
    or (jsonb_typeof(itens) = 'array' and public.soma_itens(itens) = valor_centavos)
  );
