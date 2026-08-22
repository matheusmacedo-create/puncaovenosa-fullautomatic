/**
 * Consulta de CEP, usada para mostrar ao aluno onde ele está antes de ele
 * seguir na triagem — e para a secretaria saber de que região é cada turma.
 *
 * A consulta é feita pelo servidor, e não pelo navegador, pelo mesmo motivo
 * de todo o resto aqui: quem fala com terceiro é o servidor. Assim o IP do
 * aluno não vai para fora, a CSP continua com `connect-src 'self'`, e trocar
 * de provedor um dia é mexer num arquivo só.
 *
 * São duas fontes, em cadeia. A BrasilAPI vem primeiro porque ela mesma
 * consulta vários serviços por baixo e só desiste quando todos falham; a
 * ViaCEP entra depois, como segunda opinião. Um CEP só é dado como
 * inexistente quando as duas concordam — antes disso, o mais provável é que
 * uma delas esteja fora do ar, e não que o aluno tenha digitado um endereço
 * que não existe.
 *
 * A busca por nome de rua fica só na ViaCEP: a BrasilAPI não tem esse
 * endpoint (verificado — responde 404).
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

// CEP não muda: um mês de cache poupa os provedores e devolve na hora para o
// segundo aluno do mesmo bairro.
const CACHE_DE_UM_MES = { revalidate: 60 * 60 * 24 * 30 }

// Duas fontes em sequência não podem somar a espera de duas: 4s cada deixa o
// pior caso em 8s, e o normal é a primeira responder em menos de um.
const PACIENCIA = 4_000

const comMascara = (cep: string) => {
  const d = cep.replace(/\D/g, '')
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep
}

/** Resposta da BrasilAPI v2. CEP inexistente vem como 404. */
type RespostaBrasilApi = {
  cep?: string
  street?: string
  neighborhood?: string
  city?: string
  state?: string
}

async function pelaBrasilApi(cepEmDigitos: string): Promise<Endereco> {
  const resposta = await fetch(`https://brasilapi.com.br/api/cep/v2/${cepEmDigitos}`, {
    next: CACHE_DE_UM_MES,
    signal: AbortSignal.timeout(PACIENCIA),
  })

  // 404 aqui significa que todos os serviços que ela consulta falharam.
  if (resposta.status === 404) throw new CepNaoEncontrado()
  if (!resposta.ok) throw new Error(`BrasilAPI respondeu ${resposta.status}`)

  const dados = (await resposta.json()) as RespostaBrasilApi
  if (!dados.cep) throw new CepNaoEncontrado()

  return {
    // Ela devolve sem máscara; a ViaCEP devolve com. Uniformiza aqui para o
    // resto do funil não precisar saber de qual das duas veio.
    cep: comMascara(dados.cep),
    logradouro: dados.street || null,
    bairro: dados.neighborhood || null,
    cidade: dados.city || null,
    uf: dados.state || null,
  }
}

async function pelaViaCep(cepEmDigitos: string): Promise<Endereco> {
  const resposta = await fetch(`https://viacep.com.br/ws/${cepEmDigitos}/json/`, {
    next: CACHE_DE_UM_MES,
    signal: AbortSignal.timeout(PACIENCIA),
  })

  // 400 é formato inválido, não indisponibilidade — o guarda de entrada já
  // deveria ter barrado, mas se passar, é erro de quem digitou.
  if (resposta.status === 400) throw new CepNaoEncontrado()
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

export async function buscarEndereco(cepEmDigitos: string): Promise<Endereco> {
  if (!CEP_VALIDO.test(cepEmDigitos)) throw new CepNaoEncontrado()

  try {
    return await pelaBrasilApi(cepEmDigitos)
  } catch (e) {
    // Mesmo um "não encontrado" da primeira fonte vale uma segunda opinião: o
    // custo é uma requisição, e o preço de errar é dizer a um aluno que o
    // endereço dele não existe.
    if (!(e instanceof CepNaoEncontrado)) console.error('[funil] BrasilAPI falhou:', e)
  }

  return pelaViaCep(cepEmDigitos)
}

/**
 * Pesquisa de CEP pelo endereço, para quem não sabe o próprio CEP.
 *
 * A ViaCEP exige UF, cidade e logradouro, com no mínimo três caracteres nos
 * dois últimos — menos que isso devolve 400, e devolveria meia cidade. O
 * limite dela é 50 resultados, ordenados por proximidade do nome.
 */
export const MINIMO_PARA_PESQUISAR = 3

export class PesquisaCurtaDemais extends Error {
  constructor() {
    super(`Cidade e rua precisam de pelo menos ${MINIMO_PARA_PESQUISAR} letras.`)
    this.name = 'PesquisaCurtaDemais'
  }
}

export function pesquisaValida(uf: string, cidade: string, logradouro: string) {
  return /^[A-Za-z]{2}$/.test(uf.trim())
    && cidade.trim().length >= MINIMO_PARA_PESQUISAR
    && logradouro.trim().length >= MINIMO_PARA_PESQUISAR
}

async function consultarPorEndereco(uf: string, cidade: string, logradouro: string): Promise<Endereco[]> {
  const caminho = [uf, cidade, logradouro].map(p => encodeURIComponent(p.trim())).join('/')
  const resposta = await fetch(`https://viacep.com.br/ws/${caminho}/json/`, {
    next: { revalidate: 60 * 60 * 24 * 30 },
    signal: AbortSignal.timeout(6_000),
  })

  if (resposta.status === 400) throw new PesquisaCurtaDemais()
  if (!resposta.ok) throw new Error(`ViaCEP respondeu ${resposta.status}`)

  const dados = await resposta.json()
  // Cidade inexistente devolve um objeto com `erro` em vez de uma lista.
  if (!Array.isArray(dados)) return []

  return (dados as RespostaViaCep[])
    .filter(d => d.cep)
    .map(d => ({
      cep: d.cep!,
      logradouro: d.logradouro || null,
      bairro: d.bairro || null,
      cidade: d.localidade || null,
      uf: d.uf || null,
    }))
}

const LIGACOES = /\b(?:da|de|do|das|dos|e)\b/gi

const semLigacoes = (texto: string) => texto.replace(LIGACOES, ' ').replace(/\s+/g, ' ').trim()

export async function pesquisarEnderecos(uf: string, cidade: string, logradouro: string): Promise<Endereco[]> {
  if (!pesquisaValida(uf, cidade, logradouro)) throw new PesquisaCurtaDemais()

  const encontrados = await consultarPorEndereco(uf, cidade, logradouro)
  if (encontrados.length) return encontrados

  /*
   * A ViaCEP casa pedaço de texto, não palavra: quem procura "Praça da Cruz
   * Vermelha" não acha "Praça Cruz Vermelha", porque o "da" não está lá. Só
   * que é assim que as pessoas falam o nome da rua.
   *
   * A segunda tentativa tira as ligações. É tentativa, e não regra, porque
   * há rua em que a ligação faz parte do nome — "Avenida das Américas" —, e
   * tirá-la de saída estragaria a busca que teria funcionado.
   */
  const enxuto = semLigacoes(logradouro)
  if (enxuto === logradouro.trim() || enxuto.length < MINIMO_PARA_PESQUISAR) return []

  return consultarPorEndereco(uf, cidade, enxuto)
}
