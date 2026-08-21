-- Suporte a cartão além do PIX.
--
-- IMPORTANTE (PCI-DSS): número completo do cartão, CVV e data de validade
-- NUNCA são gravados aqui e não devem trafegar pela nossa API. O front
-- tokeniza direto com o provedor (Único) e envia apenas o token. As
-- colunas abaixo guardam só o que é seguro exibir num comprovante.

create type pagamento_metodo as enum ('pix', 'cartao');

alter table public.pagamentos
  add column metodo         pagamento_metodo not null default 'pix',
  add column parcelas       smallint         not null default 1,
  add column bandeira       text,
  add column ultimos4       text,
  -- id da transação no provedor (Único). Distinto de txid, que é do PIX.
  add column provedor_id    text,
  add column recusa_motivo  text;

alter table public.pagamentos
  add constraint parcelas_validas check (parcelas between 1 and 12),
  add constraint ultimos4_formato check (ultimos4 is null or ultimos4 ~ '^[0-9]{4}$'),
  -- PIX é sempre à vista; parcelamento só existe no cartão.
  add constraint pix_sem_parcelamento check (metodo = 'cartao' or parcelas = 1),
  -- dados de cartão só fazem sentido quando o método é cartão
  add constraint cartao_tem_dados check (
    metodo = 'cartao' or (bandeira is null and ultimos4 is null)
  );

create unique index pagamentos_provedor_id_idx on public.pagamentos (provedor_id) where provedor_id is not null;

comment on column public.pagamentos.metodo        is 'pix ou cartao. Define quais colunas abaixo sao preenchidas.';
comment on column public.pagamentos.parcelas      is 'Sempre 1 no PIX. No cartao, 1 a 12.';
comment on column public.pagamentos.bandeira      is 'visa, mastercard, elo, amex... Apenas para exibicao.';
comment on column public.pagamentos.ultimos4      is 'Ultimos 4 digitos, para o aluno reconhecer o cartao. Nunca o numero completo.';
comment on column public.pagamentos.provedor_id   is 'Identificador da transacao no provedor (Unico).';
comment on column public.pagamentos.recusa_motivo is 'Mensagem de recusa devolvida pelo provedor, para exibir ao aluno.';
