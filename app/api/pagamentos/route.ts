import { NextResponse } from 'next/server'
import { courseData } from '@/lib/course-data'
import {
  COBRA_CURSO_A_PARTE, COBRANCAS, digits, ehEtapaDeCobranca, MAX_PARCELAS,
  MINUTOS_PARA_EXPIRAR, PIX_RECEBEDOR,
} from '@/lib/enrollment'
import { corpo, erro, rota } from '@/lib/http'
import { traduzirStatus } from '@/lib/pagamento-status'
import { gerarPixCopiaCola } from '@/lib/pix'
import { lerInscricaoId } from '@/lib/session'
import { confirmacaoManualPermitida, simulacaoAtiva } from '@/lib/simulacao'
import { supabaseServer } from '@/lib/supabase/server'
import { contextoDoNavegador, enviarConversaoMeta } from '@/lib/meta-capi'
import { urlDoWebhook } from '@/lib/site-url'
import { criarPagamento, NovoPagamento, UnicopagErro } from '@/lib/unicopag'
import { enviarEmailTransacional } from '@/lib/email'
import { notificarSecretaria } from '@/lib/webhook-secretaria'

/**
 * A criação de cobrança no cartão leva por volta de 11 segundos na Únicopag,
 * e o limite padrão de uma função na Vercel é 10. Sem isto, o aluno receberia
 * erro numa cobrança que talvez tenha sido criada — o pior tipo de falha num
 * checkout. 60s dá folga confortável.
 */
export const maxDuration = 60


type Cartao = { numero?: string; nome?: string; validade?: string; cvv?: string }
type Payload = { metodo?: 'pix' | 'cartao'; parcelas?: number; cartao?: Cartao; etapa?: string }

/** Dias que a cobrança PIX aceita pagamento no provedor. O contador de 30 min da tela é da interface. */
const DIAS_PARA_EXPIRAR = 1

/**
 * Abre uma cobrança para a inscrição da sessão.
 *
 * Com a simulação ativa, a cobrança é registrada localmente e tratada como
 * aprovada — é o modo usado enquanto não há provedor. Com `UNICO_API_KEY`
 * configurada, a cobrança é criada de verdade na Únicopag.
 *
 * PCI-DSS: os dados do cartão chegam aqui porque a API da Únicopag recebe o
 * número em claro — não há tokenização no navegador. Eles são repassados e
 * descartados: nunca vão para o banco, para log ou para a resposta. Do
 * cartão, persistimos apenas bandeira e últimos 4 dígitos.
 */
export function POST(request: Request) {
  return rota(async () => {
    const inscricaoId = await lerInscricaoId()
    if (!inscricaoId) return erro('Preencha seus dados antes de pagar.', 401)

    const body = await corpo<Payload>(request)
    if (!body) return erro('Corpo da requisição inválido.', 400)

    const metodo = body.metodo ?? 'pix'
    if (metodo !== 'pix' && metodo !== 'cartao') return erro('Meio de pagamento inválido.', 422)

    const parcelas = metodo === 'cartao' ? Number(body.parcelas ?? 1) : 1
    if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > MAX_PARCELAS) {
      return erro(`Parcelamento deve ser entre 1 e ${MAX_PARCELAS} vezes.`, 422)
    }
    if (metodo === 'pix' && body.cartao) return erro('PIX não usa dados de cartão.', 422)

    // Que parte do preço esta cobrança cobre. O padrão é a matrícula: é ela
    // que o anúncio promete e a única que existe antes da vaga garantida.
    const etapa = body.etapa === undefined ? 'matricula' : body.etapa
    if (!ehEtapaDeCobranca(etapa)) return erro('Etapa de cobrança inválida.', 422)
    if (etapa === 'curso' && !COBRA_CURSO_A_PARTE) {
      return erro('O curso não é cobrado à parte com o preço em vigor.', 422)
    }
    const aCobrar = COBRANCAS[etapa]

    const supabase = supabaseServer()
    const { data: inscricao, error: erroInscricao } = await supabase
      .from('inscricoes')
      .select('id, nome, cpf, telefone, email')
      .eq('id', inscricaoId)
      .maybeSingle()

    if (erroInscricao) {
      console.error('[funil] leitura da inscrição falhou:', erroInscricao)
      return erro('Não foi possível abrir a cobrança.', 502)
    }
    if (!inscricao) return erro('Inscrição não encontrada.', 404)

    // Etapa já quitada não é cobrada de novo, e o curso só é oferecido
    // depois da vaga garantida. É aqui que essa garantia mora: o banco não
    // tem restrição de unicidade entre as confirmadas de propósito (ver a
    // migration 0014), justamente para nunca recusar dinheiro que entrou.
    const { data: confirmadas, error: erroConfirmadas } = await supabase
      .from('pagamentos')
      .select('etapa')
      .eq('inscricao_id', inscricaoId)
      .eq('status', 'confirmado')

    if (erroConfirmadas) {
      console.error('[funil] leitura das cobranças confirmadas falhou:', erroConfirmadas)
      return erro('Não foi possível abrir a cobrança.', 502)
    }

    // `integral` é a cobrança antiga, de quando matrícula e curso saíam num
    // PIX só: quem pagou uma dessas não deve mais nada.
    const pagas = new Set((confirmadas ?? []).map(p => p.etapa))
    if (pagas.has('integral') || pagas.has(etapa)) {
      return erro(etapa === 'curso' ? 'O curso desta inscrição já está pago.' : 'Esta inscrição já está paga.', 409)
    }
    if (etapa === 'curso' && !pagas.has('matricula')) {
      return erro('A matrícula precisa estar paga antes do curso.', 409)
    }

    const simulando = simulacaoAtiva()

    // Cobrança PIX aberta é reaproveitada, não recriada: a chamada à Únicopag
    // é o trecho lento do checkout, e o código antigo continua pagável no
    // provedor. É também o que permite ao navegador disparar a criação já no
    // envio do cadastro, sem medo de duplicar. A janela fica aquém da validade
    // real (24h na Únicopag, 30 min na simulação) para nunca entregar um
    // código que o app do banco vai recusar. Reaproveitar não redispara
    // webhook nem evento do Meta — ambos são de transição, e a transição
    // aconteceu quando a cobrança nasceu.
    if (metodo === 'pix') {
      const validaDesde = new Date(Date.now() - (simulando ? MINUTOS_PARA_EXPIRAR * 60_000 : 20 * 3_600_000)).toISOString()
      const { data: aberta } = await supabase
        .from('pagamentos')
        .select('id, metodo, etapa, parcelas, valor_centavos, itens, status, pix_copia_cola, criado_em')
        .eq('inscricao_id', inscricaoId)
        .eq('metodo', 'pix')
        .eq('etapa', etapa)
        .eq('status', 'pendente')
        .eq('valor_centavos', aCobrar.centavos)
        .not('pix_copia_cola', 'is', null)
        .gte('criado_em', validaDesde)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (aberta) {
        return NextResponse.json({
          id: aberta.id,
          metodo: aberta.metodo,
          etapa: aberta.etapa,
          parcelas: aberta.parcelas,
          valorCentavos: aberta.valor_centavos,
          itens: aberta.itens,
          status: aberta.status,
          pixCopiaCola: aberta.pix_copia_cola,
          criadoEm: aberta.criado_em,
          minutosParaExpirar: MINUTOS_PARA_EXPIRAR,
          simulacao: simulando,
          confirmacaoManual: confirmacaoManualPermitida(),
        })
      }
    }

    const txid = crypto.randomUUID().replace(/-/g, '').slice(0, 25)

    let provedorId: string | null = null
    let pixCopiaCola: string | null = null
    let bandeira: string | null = null
    let statusInicial: string = 'pendente'

    if (simulando) {
      pixCopiaCola = metodo === 'pix'
        ? gerarPixCopiaCola({ ...PIX_RECEBEDOR, valorCentavos: aCobrar.centavos, txid })
        : null
    } else {
      if (!inscricao.email) return erro('Informe seu e-mail antes de pagar.', 422)

      const cartao = body.cartao
      if (metodo === 'cartao') {
        const faltando = (['numero', 'nome', 'validade', 'cvv'] as const).filter(c => !cartao?.[c]?.trim())
        if (faltando.length) return erro('Preencha todos os dados do cartão.', 422)
      }

      const validade = digits(cartao?.validade ?? '')
      const payload: NovoPagamento = {
        amount: aCobrar.centavos,
        payment_method: metodo === 'pix' ? 'pix' : 'credit_card',
        installments: parcelas,
        customer: {
          name: inscricao.nome,
          email: inscricao.email,
          phone_number: digits(inscricao.telefone),
          document: digits(inscricao.cpf),
        },
        // O nome do curso vai na frente de cada item, e não só em `rotulo`
        // ("Matrícula", "Curso presencial"): é o que aparece na Únicopag e no
        // comprovante do PIX, e sozinho "Matrícula" não diz de qual curso.
        // Na nossa própria tela o nome já aparece no título da página, então
        // `rotulo` continua enxuto lá — só o que vai para o provedor leva o
        // prefixo.
        cart: aCobrar.itens.map(item => ({
          hash: item.id,
          title: `${courseData.courseName} — ${item.rotulo}`,
          price: item.centavos,
          quantity: 1,
        })),
        postback_url: urlDoWebhook(),
        expire_in_days: DIAS_PARA_EXPIRAR,
        origin: 'funil-puncao-venosa',
        // Reforça no dashboard da Únicopag quem comprou e o quê, além do que
        // já vai em `customer` e em `cart` — `metadata` é onde o painel deles
        // costuma mostrar informação extra sobre a transação.
        metadata: { inscricao_id: inscricaoId, referencia: txid, curso: courseData.courseName, aluno: inscricao.nome, etapa },
        ...(metodo === 'cartao' && cartao
          ? {
              card: {
                number: digits(cartao.numero ?? ''),
                holdername: (cartao.nome ?? '').trim(),
                exp_month: validade.slice(0, 2),
                exp_year: `20${validade.slice(2, 4)}`,
                cvv: digits(cartao.cvv ?? ''),
              },
            }
          : {}),
      }

      try {
        const cobranca = await criarPagamento(payload)
        provedorId = cobranca.hash
        pixCopiaCola = cobranca.pix?.pix_qr_code ?? null
        bandeira = cobranca.card_brand
        statusInicial = traduzirStatus(cobranca.payment_status)
      } catch (e) {
        if (e instanceof UnicopagErro) {
          // A mensagem do provedor é útil ao aluno ("cartão recusado"), mas o
          // payload não pode aparecer em log: carrega o número do cartão.
          console.error('[funil] Únicopag recusou a cobrança:', e.status, e.message)
          return erro(e.mensagemParaOAluno, e.status === 422 ? 422 : 502)
        }
        throw e
      }
    }

    const { data, error } = await supabase
      .from('pagamentos')
      .insert({
        inscricao_id: inscricaoId,
        valor_centavos: aCobrar.centavos,
        itens: aCobrar.itens,
        etapa,
        metodo,
        parcelas,
        status: statusInicial,
        txid: metodo === 'pix' ? (provedorId ?? txid) : null,
        provedor_id: provedorId,
        bandeira: metodo === 'cartao' ? bandeira : null,
        ultimos4: metodo === 'cartao' ? digits(body.cartao?.numero ?? '').slice(-4) || null : null,
        pix_copia_cola: pixCopiaCola,
        confirmado_em: statusInicial === 'confirmado' ? new Date().toISOString() : null,
      })
      .select('id, metodo, etapa, parcelas, valor_centavos, itens, status, pix_copia_cola, criado_em')
      .single()

    if (error || !data) {
      console.error('[funil] gravação do pagamento falhou:', error)
      return erro('Não foi possível registrar a cobrança. Tente novamente.', 502)
    }

    notificarSecretaria(inscricaoId, 'pagamento_iniciado')
    // Só o PIX, e só com código: no cartão o desfecho é imediato, e uma
    // cobrança sem copia-e-cola não daria ao aluno nada para pagar depois.
    // É o e-mail que permite voltar e concluir horas mais tarde, que é
    // exatamente onde as duas primeiras inscrições reais pararam.
    if (data.metodo === 'pix' && data.pix_copia_cola) {
      enviarEmailTransacional(inscricaoId, 'cobranca_aberta', data.id)
    }
    enviarConversaoMeta(inscricaoId, 'pagamento', { pagamentoId: data.id, contexto: contextoDoNavegador(request) })

    return NextResponse.json({
      id: data.id,
      metodo: data.metodo,
      etapa: data.etapa,
      parcelas: data.parcelas,
      valorCentavos: data.valor_centavos,
      itens: data.itens,
      status: data.status,
      pixCopiaCola: data.pix_copia_cola,
      criadoEm: data.criado_em,
      minutosParaExpirar: MINUTOS_PARA_EXPIRAR,
      simulacao: simulando,
      confirmacaoManual: confirmacaoManualPermitida(),
    })
  })
}
