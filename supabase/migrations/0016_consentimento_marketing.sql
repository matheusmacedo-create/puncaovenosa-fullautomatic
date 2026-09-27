-- Consentimento de marketing guardado na inscrição.
--
-- O Pixel do Meta e a Conversions API só podem rodar com consentimento de
-- marketing (LGPD; Guia de Cookies da ANPD). No navegador, a escolha está no
-- cookie `cvrj_consentimento` (m=1/0), compartilhado com o site principal, e
-- o servidor lê esse cookie nas requisições do próprio aluno. Mas o evento
-- mais importante, o Purchase, muitas vezes nasce do postback da Únicopag
-- (app/api/webhooks/unicopag/route.ts), uma requisição do servidor deles:
-- sem navegador, sem cookie, sem como saber o que a pessoa escolheu. O mesmo
-- vale para o reenvio manual em /secretaria e para o público de remarketing
-- sincronizado pelo cron (lib/meta-audiencia.ts).
--
-- A escolha precisa viajar com a inscrição. Nenhuma coluna existente serve:
-- `variante` guarda o histórico das duas páginas de venda e alimenta
-- funil_por_origem; `pagamentos.itens` é a composição do preço, conferida
-- por constraint e exibida no comprovante. Por isso duas colunas novas.
--
-- Nulo é "nunca soubemos" — toda inscrição anterior a esta migration e toda
-- requisição sem escolha feita — e vale como NÃO, em todo lugar que decide.
--
-- A gravação é da aplicação (lib/consentimento-servidor.ts): no cadastro, na
-- abertura de cobrança e a cada escolha feita no aviso de cookies com a
-- sessão aberta (POST /api/consentimento). Sem `upsert_inscricao` nova de
-- propósito: o código publicado antes desta migration continua chamando a
-- função de sempre, e o código novo publicado antes dela só deixa de gravar
-- (e de mandar ao Meta o que depende da escolha gravada) — nada quebra.

alter table public.inscricoes
  add column consentimento_marketing    boolean,
  add column consentimento_marketing_em timestamptz;

comment on column public.inscricoes.consentimento_marketing is
  'Escolha de marketing (m do cookie cvrj_consentimento) do navegador que agiu por ultimo nesta inscricao. Nulo = nunca informada = sem consentimento. Libera a Conversions API e o publico de remarketing quando nao ha navegador (postback, reenvio manual, cron).';
comment on column public.inscricoes.consentimento_marketing_em is
  'Quando a escolha foi feita (t do cookie) ou, sem ele, quando foi gravada aqui.';
