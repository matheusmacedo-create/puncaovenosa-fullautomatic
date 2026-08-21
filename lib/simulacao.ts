/**
 * Interruptor da simulação de pagamento.
 *
 * Enquanto a Único não está integrada, o funil precisa tratar a cobrança
 * como aprovada — senão não dá para percorrer as etapas seguintes. Esse
 * atalho é, na prática, um botão de "inscrição grátis": com ele ligado,
 * qualquer visitante conclui a inscrição sem pagar. Por isso é opt-in.
 *
 * A leitura é feita NO SERVIDOR, a cada requisição, e o estado viaja para o
 * navegador dentro da resposta da cobrança. Isso é deliberado: uma variável
 * `NEXT_PUBLIC_*` é embutida no bundle em tempo de build, então mudá-la no
 * painel só teria efeito depois de um novo deploy — e foi exatamente isso
 * que fez a chave "ligada" não surtir efeito no preview.
 *
 * Como variável de servidor, ela também deixa de ser embutida no JavaScript
 * que o visitante baixa.
 */
export function simulacaoAtiva(): boolean {
  // SIMULAR_PAGAMENTO é o nome preferido. O NEXT_PUBLIC_ é aceito para não
  // quebrar quem já configurou com ele.
  const valor = process.env.SIMULAR_PAGAMENTO ?? process.env.NEXT_PUBLIC_SIMULAR_PAGAMENTO
  return valor?.trim().toLowerCase() === 'true'
}
