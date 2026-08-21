import { NextResponse } from 'next/server'
import { digits, fieldError, EnrollmentData } from '@/lib/enrollment'
import { corpo, erro, rota } from '@/lib/http'
import { gravarInscricaoId } from '@/lib/session'
import { supabaseServer } from '@/lib/supabase/server'

type Payload = { name?: string; phone?: string; cpf?: string; email?: string; highSchool?: boolean }

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
      })
      .single<{ id: string; status: string; numero_inscricao: string | null; ja_paga: boolean }>()

    if (error || !data) {
      console.error('[funil] upsert_inscricao falhou:', error)
      return erro('Não foi possível salvar sua inscrição. Tente novamente.', 502)
    }

    await gravarInscricaoId(data.id)
    return NextResponse.json({
      id: data.id,
      status: data.status,
      numeroInscricao: data.numero_inscricao,
      jaPaga: data.ja_paga,
    })
  })
}
