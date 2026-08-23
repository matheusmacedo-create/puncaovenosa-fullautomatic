-- Atribuição na inscrição: de qual variante e de qual campanha veio.
--
-- `visitas_landing` (migration 0011) já gravava variante e UTM, mas
-- `inscricoes` não — então dava para contar "a variante B teve 100 visitas" e
-- era impossível saber se ela converteu melhor ou pior que a A. O teste A/B
-- que `lib/ab-test.ts` já sorteia 50/50 em produção rodava cego: gastava
-- metade do tráfego pago e não produzia resposta.

alter table public.inscricoes
  add column variante     text,
  add column utm_source   text,
  add column utm_medium   text,
  add column utm_campaign text;

comment on column public.inscricoes.variante is 'Variante do teste A/B que a pessoa viu quando entrou. Primeiro toque: nunca sobrescrito por uma volta posterior.';

-- Sem DEFAULT nos parâmetros novos, e sem derrubar a versão de 5 argumentos:
-- entre aplicar esta migration e o deploy novo subir, o código em produção
-- ainda chama a assinatura antiga. Com default, a chamada de 5 argumentos
-- ficaria ambígua entre as duas versões e o Postgres recusaria — foi o mesmo
-- cuidado tomado em 0006. A antiga sai numa migration futura.
create or replace function public.upsert_inscricao(
  p_cpf           text,
  p_nome          text,
  p_telefone      text,
  p_ensino_medio  boolean,
  p_email         text,
  p_variante      text,
  p_utm_source    text,
  p_utm_medium    text,
  p_utm_campaign  text
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
  insert into public.inscricoes as i (
    cpf, nome, telefone, email, ensino_medio_completo, status,
    variante, utm_source, utm_medium, utm_campaign
  )
  values (
    p_cpf, p_nome, p_telefone, nullif(btrim(p_email), ''), p_ensino_medio, 'aguardando_pagamento',
    nullif(btrim(p_variante), ''), nullif(btrim(p_utm_source), ''),
    nullif(btrim(p_utm_medium), ''), nullif(btrim(p_utm_campaign), '')
  )
  on conflict (cpf) do update
    set nome                  = excluded.nome,
        telefone              = excluded.telefone,
        -- não apaga um e-mail já conhecido se o reenvio vier sem ele
        email                 = coalesce(excluded.email, i.email),
        ensino_medio_completo = excluded.ensino_medio_completo,
        -- Atribuição é de PRIMEIRO toque: o `coalesce` mantém o que já estava
        -- e só preenche quando ainda era nulo. Invertido em relação ao e-mail
        -- de propósito — quem voltou por um segundo anúncio e concluiu ali não
        -- transfere o crédito da conversão para a campanha da volta, senão o
        -- remarketing roubaria o resultado de quem trouxe a pessoa.
        variante              = coalesce(i.variante, excluded.variante),
        utm_source            = coalesce(i.utm_source, excluded.utm_source),
        utm_medium            = coalesce(i.utm_medium, excluded.utm_medium),
        utm_campaign          = coalesce(i.utm_campaign, excluded.utm_campaign),
        status = case
          when i.status in ('paga', 'triagem_concluida') then i.status
          else 'aguardando_pagamento'
        end
  returning i.id, i.status, i.numero_inscricao into v_id, v_status, v_numero;

  return query select v_id, v_status, v_numero, v_status in ('paga', 'triagem_concluida');
end;
$$;

comment on function public.upsert_inscricao(text, text, text, boolean, text, text, text, text, text) is
  'Cria ou atualiza a inscricao pelo CPF, gravando a atribuicao (variante e UTM) de primeiro toque.';

-- Funil por origem, agregado no banco.
--
-- `language sql` de propósito, e não plpgsql: numa função `returns table` em
-- plpgsql os nomes das colunas de retorno viram variáveis e colidem com
-- colunas de mesmo nome dentro da query ("column reference is ambiguous" — já
-- aconteceu em `confirmar_pagamento`). Aqui isso não existe.
--
-- Uma dimensão por parâmetro em vez de uma função por dimensão: acrescentar
-- "por conteúdo do anúncio" depois é mais um `when`, não outra função.
create or replace function public.funil_por_origem(p_dimensao text)
returns table (
  chave      text,
  visitas    bigint,
  inscricoes bigint,
  pagas      bigint,
  completas  bigint
)
language sql
stable
set search_path = ''
as $$
  with v as (
    select
      coalesce(nullif(btrim(
        case p_dimensao
          when 'variante'     then vl.variante
          when 'utm_source'   then vl.utm_source
          when 'utm_medium'   then vl.utm_medium
          when 'utm_campaign' then vl.utm_campaign
        end
      ), ''), 'sem registro') as k,
      count(*) as n
    from public.visitas_landing vl
    group by 1
  ),
  i as (
    select
      coalesce(nullif(btrim(
        case p_dimensao
          when 'variante'     then ins.variante
          when 'utm_source'   then ins.utm_source
          when 'utm_medium'   then ins.utm_medium
          when 'utm_campaign' then ins.utm_campaign
        end
      ), ''), 'sem registro') as k,
      count(*) as n,
      count(*) filter (where ins.status in ('paga', 'triagem_concluida')) as n_pagas,
      count(*) filter (where ins.status = 'triagem_concluida')            as n_completas
    from public.inscricoes ins
    group by 1
  )
  -- FULL OUTER: uma variante pode ter visita e nenhuma inscrição (o caso mais
  -- importante de todos — é uma página que não converte), e uma inscrição pode
  -- existir sem visita registrada (quem entrou direto em /inscricao pelo
  -- anúncio, sem passar pela landing).
  select
    coalesce(v.k, i.k)         as chave,
    coalesce(v.n, 0)           as visitas,
    coalesce(i.n, 0)           as inscricoes,
    coalesce(i.n_pagas, 0)     as pagas,
    coalesce(i.n_completas, 0) as completas
  from v
  full outer join i on i.k = v.k
  order by coalesce(v.n, 0) desc, coalesce(i.n, 0) desc;
$$;

comment on function public.funil_por_origem(text) is
  'Funil visita -> inscricao -> paga -> completa, agrupado por variante ou por UTM. Dimensoes: variante, utm_source, utm_medium, utm_campaign.';
