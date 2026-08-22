/**
 * Consulta de CEP, usada para mostrar ao aluno onde ele está antes de ele
 * seguir na triagem — e para a secretaria saber de que região é cada turma.
 *
 * A consulta é feita pelo servidor, e não pelo navegador, pelo mesmo motivo
 * de todo o resto aqui: quem fala com terceiro é o servidor. Assim o IP do
 * aluno não vai para a ViaCEP, a CSP continua com `connect-src 'self'`, e
 * trocar de provedor um dia é mexer num arquivo só.
 */

export type Endereco = {
  cep: string
  logradouro: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
}

/** Resposta da ViaCEP. CEP inexistente vem como 200 com `erro`, não como 404. */
type RespostaViaCep = {
  cep?: string
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  erro?: boolean | string
}

export const CEP_VALIDO = /^\d{8}$/

export class CepNaoEncontrado extends Error {
  constructor() {
    super('CEP não encontrado.')
    this.name = 'CepNaoEncontrado'
  }
}

/** "Tijuca, Rio de Janeiro/RJ" — o que o aluno lê para confirmar o lugar. */
export function resumoDoEndereco(endereco: Endereco): string {
  const lugar = [endereco.bairro, endereco.cidade].filter(Boolean).join(', ')
  return endereco.uf ? `${lugar}/${endereco.uf}` : lugar
}

/**
 * A resposta do passo 1 da triagem.
 *
 * Já foi só o CEP digitado, em texto. Passou a guardar o endereço junto para
 * a secretaria saber a região de cada aluno sem ter que consultar CEP a CEP.
 * Os leitores aceitam as duas formas: há rascunhos em `localStorage` no
 * navegador de quem começou a triagem antes desta mudança.
 */
export type RespostaDeCep = string | { cep?: string; bairro?: string | null; cidade?: string | null; uf?: string | null }

export function cepDaResposta(resposta: unknown): string {
  if (typeof resposta === 'string') return resposta
  if (resposta && typeof resposta === 'object' && 'cep' in resposta) {
    const { cep } = resposta as { cep?: unknown }
    return typeof cep === 'string' ? cep : ''
  }
  return ''
}

/** O que a secretaria lê na coluna de CEP: o número e, se houver, o lugar. */
export function resumoDaResposta(resposta: unknown): string {
  const cep = cepDaResposta(resposta)
  if (typeof resposta !== 'object' || resposta === null) return cep || '—'
  const { bairro, cidade, uf } = resposta as { bairro?: string; cidade?: string; uf?: string }
  const lugar = [bairro, cidade].filter(Boolean).join(', ')
  if (!lugar) return cep || '—'
  return `${cep} · ${lugar}${uf ? `/${uf}` : ''}`
}

export async function buscarEndereco(cepEmDigitos: string): Promise<Endereco> {
  if (!CEP_VALIDO.test(cepEmDigitos)) throw new CepNaoEncontrado()

  const resposta = await fetch(`https://viacep.com.br/ws/${cepEmDigitos}/json/`, {
    // CEP não muda: um mês de cache poupa a ViaCEP e devolve na hora para o
    // segundo aluno do mesmo bairro.
    next: { revalidate: 60 * 60 * 24 * 30 },
    signal: AbortSignal.timeout(5_000),
  })

  if (!resposta.ok) throw new Error(`ViaCEP respondeu ${resposta.status}`)

  const dados = (await resposta.json()) as RespostaViaCep
  // `erro` chega como boolean ou como a string "true", dependendo da versão.
  if (dados.erro === true || dados.erro === 'true' || !dados.cep) throw new CepNaoEncontrado()

  return {
    cep: dados.cep,
    logradouro: dados.logradouro || null,
    bairro: dados.bairro || null,
    cidade: dados.localidade || null,
    uf: dados.uf || null,
  }
}
