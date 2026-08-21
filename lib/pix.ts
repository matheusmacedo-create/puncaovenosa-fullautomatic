/**
 * Geração do "PIX Copia e Cola" (BR Code, padrão EMV MPM do Banco Central).
 *
 * Por que isto existe: o payload precisa ser montado programaticamente, e
 * não escrito à mão. O formato é uma sequência de campos no esquema
 * TLV — Tag (2 dígitos), Length (2 dígitos) e Value. Se um único Length não
 * bater com o tamanho real do Value, o leitor desalinha e passa a
 * interpretar os bytes seguintes como se fossem outro campo.
 *
 * O sintoma disso no app do banco é justamente o valor sumir: sem conseguir
 * ler a tag 54, o pagamento vira "PIX de valor aberto" e quem paga digita a
 * quantia que quiser. Foi o que aconteceu com o código estático anterior,
 * que declarava 36 numa chave de 24 caracteres e 58 num campo de 46.
 */

/** Monta um campo TLV, com o tamanho calculado a partir do próprio valor. */
const campo = (tag: string, valor: string) => `${tag}${String(valor.length).padStart(2, '0')}${valor}`

/**
 * CRC16/CCITT-FALSE — polinômio 0x1021, valor inicial 0xFFFF, sem reflexão.
 * É o que o Banco Central especifica para a tag 63.
 */
export function crc16(payload: string): string {
  let crc = 0xffff
  for (const byte of new TextEncoder().encode(payload)) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Remove acentos e caracteres fora do ASCII imprimível.
 * Nome e cidade do recebedor não aceitam acentuação no BR Code.
 */
const normalizar = (texto: string, limite: number) =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '').trim().slice(0, limite).trim()

/** O txid aceita apenas letras e números, com no máximo 25 caracteres. */
const normalizarTxid = (texto: string) => texto.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'

export type DadosPix = {
  /** [INTEGRAÇÃO] Chave PIX real da Cruz Vermelha (CNPJ, e-mail ou chave aleatória). */
  chave: string
  nome: string
  cidade: string
  valorCentavos: number
  /** Identificador da cobrança, para conciliar o pagamento recebido. */
  txid: string
}

/**
 * Monta o payload completo. O valor entra na tag 54 e passa a ser fixo:
 * o app do banco exibe a quantia e não deixa o pagador alterá-la.
 */
export function gerarPixCopiaCola({ chave, nome, cidade, valorCentavos, txid }: DadosPix): string {
  if (!Number.isInteger(valorCentavos) || valorCentavos <= 0) {
    throw new Error(`Valor inválido para cobrança PIX: ${valorCentavos}`)
  }

  const contaDoRecebedor =
    campo('00', 'BR.GOV.BCB.PIX') +
    campo('01', chave)

  const dadosAdicionais = campo('05', normalizarTxid(txid))

  const semCrc =
    campo('00', '01') +                                       // versão do payload
    campo('26', contaDoRecebedor) +                           // conta do recebedor
    campo('52', '0000') +                                     // categoria do estabelecimento
    campo('53', '986') +                                      // moeda: BRL
    campo('54', (valorCentavos / 100).toFixed(2)) +           // VALOR — o campo que estava ilegível
    campo('58', 'BR') +                                       // país
    campo('59', normalizar(nome, 25)) +                       // nome do recebedor
    campo('60', normalizar(cidade, 15)) +                     // cidade
    campo('62', dadosAdicionais) +                            // identificador da cobrança
    '6304'                                                    // abertura da tag do CRC

  return semCrc + crc16(semCrc)
}

/**
 * Desmonta um payload em campos. Usado nos testes para provar que o que
 * geramos é legível — em especial que a tag 54 carrega o valor certo.
 */
export function lerPixCopiaCola(payload: string): Record<string, string> {
  const campos: Record<string, string> = {}
  let i = 0
  while (i + 4 <= payload.length) {
    const tag = payload.slice(i, i + 2)
    const tamanho = Number(payload.slice(i + 2, i + 4))
    if (!Number.isInteger(tamanho)) throw new Error(`Tamanho inválido na posição ${i}`)
    const valor = payload.slice(i + 4, i + 4 + tamanho)
    if (valor.length !== tamanho) throw new Error(`Campo ${tag} declara ${tamanho} mas tem ${valor.length}`)
    campos[tag] = valor
    i += 4 + tamanho
  }
  if (i !== payload.length) throw new Error('Sobraram bytes soltos no fim do payload')
  return campos
}

/** Confere o CRC declarado contra o recalculado. */
export function pixValido(payload: string): boolean {
  if (payload.length < 8) return false
  const corpo = payload.slice(0, -4)
  return corpo.endsWith('6304') && crc16(corpo) === payload.slice(-4)
}
