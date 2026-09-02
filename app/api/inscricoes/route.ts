import { NextResponse } from 'next/server'
import { digits, fieldError, EnrollmentData } from '@/lib/enrollment'
import { corpo, erro, rota } from '@/lib/http'
import { contextoDoNavegador, enviarConversaoMeta } from '@/lib/meta-capi'
import { espelharNaPlanilha } from '@/lib/planilha'
import { gravarInscricaoId } from '@/lib/session'
import { supabaseServer } from '@/lib/supabase/server'
import { notificarSecretaria } from '@/lib/webhook-secretaria'

type Payload = {
  name?: string; phone?: string; cpf?: string; email?: string; highSchool?: boolean
  utmSource?: string; utmMedium?: string; utmCampaign?: string
}

/**
 * A atribuição é rótulo de relatório, não dado de negócio: vem da URL, então
 * qualquer um pode escrever o que quiser nela. Cortar no tamanho evita que um
 * link forjado encha a coluna — e nada aqui é validado além disso de
 * propósito, porque uma UTM inesperada tem que aparecer no painel como veio,
 * não virar erro que impede a matrícula.
 */
const rotulo = (valor?: string) => valor?.trim().slice(0, 120) || null

/**
 * Cria ou atualiza a inscrição a partir do CPF e abre a sessão do funil.
 *
 * A validação é refeita aqui, e não só no formulário: o cliente pode ser
 * contornado, e as constraints do banco devolveriam um erro cru.
 */
export function POST(request: Request) {
  return rota(async () => {
    const body = await corpo<Payload>(request)
    if (!body) return erro('Corpo da requisição inválido.', 400)

    const dados: EnrollmentData = {
      name: (body.name ?? '').trim(),
      phone: body.phone ?? '',
      cpf: body.cpf ?? '',
      email: (body.email ?? '').trim(),
      highSchool: body.highSchool === true,
    }

    const campos = ['name', 'phone', 'cpf', 'email', 'highSchool'] as const
    for (const campo of campos) {
      const mensagem = fieldError(campo, dados)
      if (mensagem) return erro(mensagem, 422)
    }

    const { data, error } = await supabaseServer()
      .rpc('upsert_inscricao', {
        p_cpf: digits(dados.cpf),
        p_nome: dados.name,
        p_telefone: digits(dados.phone),
        p_ensino_medio: dados.highSchool,
        p_email: dados.email,
        // A coluna guarda o histórico das duas páginas de venda que já
        // existiram; com uma página só, linha nova nasce sem variante.
        p_variante: null,
        p_utm_source: rotulo(body.utmSource),
        p_utm_medium: rotulo(body.utmMedium),
        p_utm_campaign: rotulo(body.utmCampaign),
      })
      .single<{ id: string; status: string; numero_inscricao: string | null; ja_paga: boolean }>()

    if (error || !data) {
      console.error('[funil] upsert_inscricao falhou:', error)
      return erro('Não foi possível salvar sua inscrição. Tente novamente.', 502)
    }

    await gravarInscricaoId(data.id)
    espelharNaPlanilha(data.id)
    notificarSecretaria(data.id, 'inscricao_recebida')
    enviarConversaoMeta(data.id, 'dados', { contexto: contextoDoNavegador(request) })
    return NextResponse.json({
      id: data.id,
      status: data.status,
      numeroInscricao: data.numero_inscricao,
      jaPaga: data.ja_paga,
    })
  })
}
