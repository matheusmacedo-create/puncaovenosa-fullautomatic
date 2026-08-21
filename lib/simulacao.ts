/**
 * Estado da simulação de pagamento.
 *
 * Enquanto não há provedor integrado, o funil trata a cobrança como
 * aprovada — senão o aluno fica preso na tela de pagamento e as etapas
 * seguintes não podem ser exercitadas.
 *
 * A regra é derivada do próprio ambiente, e não de uma chave que alguém
 * precisa lembrar de ligar:
 *
 *   sem provedor configurado  -> simula (é o único modo que funciona)
 *   com provedor configurado  -> não simula (o dinheiro é real)
 *
 * Exigir uma variável para ligar a simulação parecia mais seguro, mas não
 * era: sem provedor, ninguém consegue pagar de qualquer jeito, então a
 * variável desligada apenas travava o funil sem proteger nada. A proteção
 * de verdade aparece sozinha no dia em que a chave do provedor existir.
 *
 * `SIMULAR_PAGAMENTO` continua tendo a palavra final, para forçar qualquer
 * um dos dois lados — inclusive desligar a simulação num ambiente que ainda
 * não tem provedor.
 *
 * NÃO condicione isto a `NODE_ENV !== 'production'`. Na Vercel, todo deploy
 * roda com NODE_ENV=production, preview inclusive — essa condição desliga a
 * simulação em qualquer ambiente publicado, sem dizer por quê.
 */

/** Credenciais que indicam um provedor de pagamento de verdade. */
function provedorConfigurado(): boolean {
  return !!(
    process.env.UNICO_API_KEY?.trim() ||
    process.env.UNICO_SECRET_KEY?.trim() ||
    process.env.PAGAMENTO_PROVEDOR_CHAVE?.trim()
  )
}

export type MotivoDaSimulacao =
  | 'forçada pela variável SIMULAR_PAGAMENTO'
  | 'desligada pela variável SIMULAR_PAGAMENTO'
  | 'nenhum provedor de pagamento configurado'
  | 'provedor de pagamento configurado'

export function estadoDaSimulacao(): { ativa: boolean; motivo: MotivoDaSimulacao } {
  const explicito = (process.env.SIMULAR_PAGAMENTO ?? process.env.NEXT_PUBLIC_SIMULAR_PAGAMENTO)?.trim()
  if (explicito) {
    const ativa = explicito.toLowerCase() === 'true'
    return { ativa, motivo: ativa ? 'forçada pela variável SIMULAR_PAGAMENTO' : 'desligada pela variável SIMULAR_PAGAMENTO' }
  }
  return provedorConfigurado()
    ? { ativa: false, motivo: 'provedor de pagamento configurado' }
    : { ativa: true, motivo: 'nenhum provedor de pagamento configurado' }
}

export const simulacaoAtiva = (): boolean => estadoDaSimulacao().ativa
