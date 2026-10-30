-- Lembretes de recuperação por e-mail.
--
-- Os e-mails da migration 0015 são de transição: saem quando algo acontece
-- (cobrança aberta, pagamento confirmado, triagem concluída). Faltava o
-- outro lado — quem parou no meio e nada mais aconteceu:
--
--   lembrete_pagamento_1 / _2  abriu a cobrança da matrícula e não pagou
--                              (a vaga ainda está reservada)
--   lembrete_triagem           pagou a matrícula e não respondeu as 8
--                              perguntas — sem elas a secretaria não monta
--                              a turma, e a inscrição fica em `paga` para
--                              sempre
--
-- Saem de uma varredura diária (POST /api/lembretes/sync, cron da Vercel),
-- não de transição. Cada tipo sai uma vez por inscrição: a barreira é o
-- mesmo índice único parcial `email_entregas_uma_por_tipo` da 0015, que já
-- cobre qualquer valor novo do enum.
--
-- Código publicado antes desta migration não quebra: a varredura consulta
-- estes tipos e a coluna abaixo antes de enviar qualquer coisa, e sem eles
-- não envia nada.

alter type public.email_tipo add value if not exists 'lembrete_pagamento_1';
alter type public.email_tipo add value if not exists 'lembrete_pagamento_2';
alter type public.email_tipo add value if not exists 'lembrete_triagem';

-- Quem pediu para parar de receber lembretes. Os e-mails de transição
-- (comprovante, código PIX pedido agora) continuam: são resposta a algo que
-- a própria pessoa fez. Nulo é "nunca pediu".
alter table public.inscricoes
  add column lembretes_desligados_em timestamptz;

comment on column public.inscricoes.lembretes_desligados_em is 'Quando a pessoa pediu para nao receber mais lembretes de recuperacao (link no rodape do lembrete). Nao afeta comprovantes.';
