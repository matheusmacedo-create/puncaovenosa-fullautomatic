import { NextResponse } from 'next/server'
import { erro, rota } from '@/lib/http'
import { lerInscricaoId } from '@/lib/session'
import { supabaseServer } from '@/lib/supabase/server'
import { siteUrl } from '@/lib/site-url'

/** Mostra só o miolo do CPF: ***.456.789-** */
const mascararCpf = (cpf: string) => `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`

/**
 * Estado atual da inscrição da sessão. Alimenta a ficha do aluno e o
 * polling da tela de pagamento.
 */
export function GET(request: Request) {
  return rota(async () => {
    const id = await lerInscricaoId()
    if (!id) return erro('Nenhuma inscrição nesta sessão.', 404)

    const supabase = supabaseServer()
    const { data, error } = await supabase
      .from('inscricoes')
      .select('id, nome, cpf, telefone, email, status, numero_inscricao, token_validacao')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[funil] leitura da inscrição falhou:', error)
      return erro('Não foi possível carregar sua inscrição.', 502)
    }
    if (!data) return erro('Inscrição não encontrada.', 404)

    const { count } = await supabase
      .from('triagem_respostas')
      .select('id', { count: 'exact', head: true })
      .eq('inscricao_id', id)

    return NextResponse.json({
      id: data.id,
      nome: data.nome,
      cpfMascarado: mascararCpf(data.cpf),
      telefone: data.telefone,
      email: data.email,
      status: data.status,
      numeroInscricao: data.numero_inscricao,
      // Endereço absoluto: é o que o QR Code da ficha carrega, e ele precisa
      // funcionar na câmera de qualquer celular, fora do nosso domínio.
      validacaoUrl: `${siteUrl() ?? new URL(request.url).origin}/validar/${data.token_validacao}`,
      passosRespondidos: count ?? 0,
    })
  })
}
