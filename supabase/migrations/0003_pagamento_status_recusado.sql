-- 'recusado' passa a ser um desfecho possível de pagamento, que o PIX
-- sozinho não tinha — cartão é recusado pelo emissor.
--
-- Vai numa migration separada de propósito: o Postgres não deixa usar um
-- valor de enum na mesma transação em que ele foi adicionado.

alter type pagamento_status add value if not exists 'recusado';
