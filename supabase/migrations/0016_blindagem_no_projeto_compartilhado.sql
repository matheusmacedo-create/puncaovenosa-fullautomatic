-- O funil passou a morar no projeto Supabase da redação (RedacaoCruzVermelha-Rj,
-- ref wlbbfkudeibalkaqphpo), no mesmo schema `public` das tabelas dela.
--
-- Até aqui a proteção era só a RLS forçada sem policy: a chave publicável
-- não enxerga linha nenhuma. Continua valendo. Mas num projeto compartilhado
-- a chave publicável da redação está no bundle do navegador dela, e por
-- padrão o Postgres concede EXECUTE a todo mundo em função nova — então
-- `confirmar_pagamento` e `upsert_inscricao` seriam chamáveis por qualquer
-- visitante do site da redação. As funções são SECURITY INVOKER e a RLS
-- barraria a escrita, mas não há por que deixar a porta encostada.
--
-- Esta migration tira anon/authenticated de tudo que é do funil e dá ao
-- service_role, explicitamente, o que o servidor precisa. É idempotente e
-- vale também para o projeto antigo (lqpnbqislaxzhqkszijg), onde já foi
-- aplicada.

revoke all on table
  public.inscricoes, public.pagamentos, public.triagem_respostas, public.validacoes,
  public.webhook_entregas, public.meta_capi_entregas, public.visitas_landing,
  public.meta_publico_membros, public.email_entregas
from anon, authenticated;

revoke all on sequence public.inscricao_seq from anon, authenticated;

revoke execute on function
  public.upsert_inscricao(text, text, text, boolean, text),
  public.upsert_inscricao(text, text, text, boolean, text, text, text, text, text),
  public.confirmar_pagamento(uuid),
  public.concluir_triagem_se_completa(uuid),
  public.validar_credencial(text, text),
  public.funil_por_origem(text),
  public.soma_itens(jsonb),
  public.gerar_numero_inscricao(),
  public.toca_atualizado_em()
from public, anon, authenticated;

grant all on table
  public.inscricoes, public.pagamentos, public.triagem_respostas, public.validacoes,
  public.webhook_entregas, public.meta_capi_entregas, public.visitas_landing,
  public.meta_publico_membros, public.email_entregas
to service_role;

grant usage, select, update on sequence public.inscricao_seq to service_role;

grant execute on function
  public.upsert_inscricao(text, text, text, boolean, text),
  public.upsert_inscricao(text, text, text, boolean, text, text, text, text, text),
  public.confirmar_pagamento(uuid),
  public.concluir_triagem_se_completa(uuid),
  public.validar_credencial(text, text),
  public.funil_por_origem(text),
  public.soma_itens(jsonb),
  public.gerar_numero_inscricao(),
  public.toca_atualizado_em()
to service_role;
