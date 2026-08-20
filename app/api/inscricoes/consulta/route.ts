import { NextResponse } from 'next/server'
import { digits, isValidCpf } from '@/lib/enrollment'
import { erro, rota } from '@/lib/http'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Diz se um CPF já tem inscrição, para o formulário exibir "já temos seu
 * cadastro".
 *
 * PRIVACIDADE: devolve apenas o primeiro nome e os últimos 2 dígitos do
 * telefone. CPF é previsível o suficiente para ser varrido em massa, então
 * devolver nome e telefone completos aqui seria um vazamento de dados de
 * aluno para qualquer um que chutasse números.
 */
const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? ''
const finalTelefone = (tel: string) => `••••-••${tel.slice(-2)}`

export function GET(request: Request) {
  return rota(async () => {
    const bruto = new URL(request.url).searchParams.get('cpf') ?? ''
    const cpf = digits(bruto)
    if (!isValidCpf(cpf)) return erro('CPF inválido.', 422)

    const { data, error } = await supabaseServer()
      .from('inscricoes')
      .select('nome, telefone, status')
      .eq('cpf', cpf)
      .maybeSingle()

    if (error) {
      console.error('[funil] consulta por CPF falhou:', error)
      return erro('Não foi possível consultar agora.', 502)
    }
    if (!data) return NextResponse.json({ existe: false })

    return NextResponse.json({
      existe: true,
      primeiroNome: primeiroNome(data.nome),
      telefoneFinal: finalTelefone(data.telefone),
      jaPaga: data.status === 'paga' || data.status === 'triagem_concluida',
    })
  })
}
