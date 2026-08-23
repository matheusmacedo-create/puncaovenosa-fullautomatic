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
  // Nenhuma das duas fontes de CEP devolve coordenada confiável — a ViaCEP
  // nunca devolve, e a BrasilAPI já devolveu a mesma coordenada errada pra
  // dois bairros diferentes (ver comentário em `pelaBrasilApi`). Sempre nulo
  // aqui: quem precisa de coordenada usa `coordenadaAproximada` (por bairro).
  latitude: number | null
  longitude: number | null
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
export type RespostaDeCep =
  | string
  | {
      cep?: string
      bairro?: string | null
      cidade?: string | null
      uf?: string | null
      latitude?: number | null
      longitude?: number | null
    }

export function cepDaResposta(resposta: unknown): string {
  if (typeof resposta === 'string') return resposta
  if (resposta && typeof resposta === 'object' && 'cep' in resposta) {
    const { cep } = resposta as { cep?: unknown }
    return typeof cep === 'string' ? cep : ''
  }
  return ''
}

/**
 * Coordenada gravada na resposta do passo 1, se houver.
 *
 * Só existe a partir de quando o passo passou a guardar `latitude`/`longitude`
 * junto do endereço — rascunhos e inscrições de antes disso não têm, e isso é
 * esperado: o mapa da secretaria simplesmente não desenha um ponto para elas,
 * em vez de adivinhar uma coordenada que ninguém confirmou.
 */
export function coordsDaResposta(resposta: unknown): { latitude: number; longitude: number } | null {
  if (typeof resposta !== 'object' || resposta === null) return null
  const { latitude, longitude } = resposta as { latitude?: unknown; longitude?: unknown }
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { latitude, longitude }
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

/**
 * Geocodificação aproximada por bairro/cidade, para quando o CEP não trouxe
 * coordenada exata — a maioria dos casos: só a BrasilAPI devolve, e nem
 * sempre, e a ViaCEP nunca devolve.
 *
 * Não é a rua do aluno, é o centro da área que ele informou — mas é o que
 * basta para o mapa da secretaria ganhar um ponto em vez de deixar a
 * inscrição de fora. Chamada pelo servidor, do mesmo jeito que o resto deste
 * arquivo: nunca do navegador direto para o Nominatim.
 */
async function pelaNominatim(bairro: string | null, cidade: string | null, uf: string | null): Promise<{ latitude: number; longitude: number } | null> {
  if (!cidade) return null

  const consulta = [bairro, cidade, uf, 'Brasil'].filter(Boolean).join(', ')

  try {
    const resposta = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(consulta)}`,
      {
        // Exigido pelo termo de uso do Nominatim: sem User-Agent identificável, bloqueia.
        headers: { 'User-Agent': 'puncaovenosa-fullautomatic (contato@cruzvermelhariodejaneiro.org)' },
        next: CACHE_DE_UM_MES,
        signal: AbortSignal.timeout(4_000),
      },
    )
    if (!resposta.ok) return null

    const dados = (await resposta.json()) as Array<{ lat?: string; lon?: string }>
    const [primeiro] = dados
    if (!primeiro?.lat || !primeiro?.lon) return null

    const latitude = Number(primeiro.lat)
    const longitude = Number(primeiro.lon)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

    return { latitude, longitude }
  } catch (e) {
    console.error('[funil] geocodificação aproximada falhou:', e)
    return null
  }
}

/** Ponto de entrada único para a geocodificação aproximada — hoje só o Nominatim, mas fica isolado caso troque. */
export function coordenadaAproximada(bairro: string | null, cidade: string | null, uf: string | null) {
  return pelaNominatim(bairro, cidade, uf)
}

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
    // A BrasilAPI v2 tem um campo `location.coordinates`, mas não dá pra
    // confiar nele: testado ao vivo, ela devolveu a MESMA coordenada para
    // dois CEPs de bairros diferentes (São Cristóvão e Jacaré, a alguns km
    // de distância) — um dos provedores internos que ela consulta ("open-
    // cep") retorna um ponto genérico em vez de recusar quando não tem o
    // dado real. Melhor não ter coordenada nenhuma do que ter uma errada:
    // a aproximada por bairro via Nominatim (`coordenadaAproximada`,
    // chamada em `PUT /api/triagem`) é a única fonte confiável hoje.
    latitude: null,
    longitude: null,
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
    // A ViaCEP não devolve coordenada — só a BrasilAPI, e nem sempre.
    latitude: null,
    longitude: null,
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
      latitude: null,
      longitude: null,
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
