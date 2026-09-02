-- Matrícula e curso passam a ser cobrados em duas etapas.
--
-- A landing sempre vendeu a oferta assim ("FAZER MINHA MATRÍCULA POR R$ 99",
-- e o quadro de investimento separando matrícula de curso), mas o checkout
-- abria um PIX único de R$ 249: quem clicava no botão prometendo R$ 99
-- recebia uma cobrança de R$ 249. Esta coluna é o que permite as duas
-- cobranças conviverem na mesma inscrição sem uma ser confundida com a
-- outra — era a peça que faltava para o que a página já anunciava.
--
-- É a continuação natural de `itens` (migration 0005), que já guardava a
-- composição por cobrança justamente para "cobrar matrícula e curso em
-- momentos diferentes sem reescrever o histórico".

create type cobranca_etapa as enum ('matricula', 'curso', 'integral');

comment on type cobranca_etapa is 'Que parte do preco uma cobranca cobre. integral e a forma antiga: matricula e curso num PIX so.';

alter table public.pagamentos
  add column etapa public.cobranca_etapa not null default 'matricula';

-- Tudo que já existe foi cobrado junto, antes da separação.
update public.pagamentos set etapa = 'integral';

comment on column public.pagamentos.etapa is 'Parte do preco coberta por esta cobranca. Ver COBRANCAS em lib/enrollment.ts.';

-- A tela de pagamento pergunta pela última cobrança de uma etapa específica.
create index pagamentos_inscricao_etapa_idx
  on public.pagamentos (inscricao_id, etapa, criado_em desc);

-- Deliberadamente SEM índice único por (inscricao_id, etapa) entre as
-- confirmadas. Seria a barreira óbvia contra cobrar a mesma etapa duas
-- vezes, mas reintroduziria o defeito que a migration 0008 removeu: uma
-- cobrança expira, o aluno abre outra e então paga a primeira: as duas
-- viram confirmadas e a segunda esbarraria na restrição — recusaríamos, no
-- banco, dinheiro que já entrou. A guarda fica na aplicação, que não abre
-- cobrança para etapa já paga, e o raro pagamento em duplicidade é
-- resolvido pela secretaria, não pelo Postgres.
