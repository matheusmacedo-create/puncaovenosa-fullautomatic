import { cookies } from 'next/headers'

/**
 * A sessão do funil é só o id da inscrição, guardado num cookie httpOnly.
 *
 * Não há login: o aluno chega pelo anúncio e preenche o formulário. O
 * cookie é o que liga as etapas seguintes (pagamento, triagem, ficha) à
 * linha certa do banco. Sendo httpOnly, JavaScript de página não lê o
 * valor, o que reduz a superfície de um XSS.
 */
export const COOKIE_INSCRICAO = 'cvb_inscricao'

const TRINTA_DIAS = 60 * 60 * 24 * 30

export async function lerInscricaoId(): Promise<string | null> {
  const store = await cookies()
  return store.get(COOKIE_INSCRICAO)?.value ?? null
}

export async function gravarInscricaoId(id: string) {
  const store = await cookies()
  store.set(COOKIE_INSCRICAO, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TRINTA_DIAS,
  })
}
