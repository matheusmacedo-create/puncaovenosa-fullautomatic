import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'
import { courseData, institutionContact, INSTITUTION_NAME } from '@/lib/course-data'

export const metadata: Metadata = {
  title: `Lembretes por e-mail | ${INSTITUTION_NAME}`,
  robots: { index: false, follow: false },
}

/**
 * Confirmação para parar os lembretes de recuperação — o link do rodapé do
 * lembrete cai aqui. Não desliga nada ao abrir: antivírus de e-mail abre
 * todo link que passa pela caixa, e só o botão (POST, sem JavaScript) conta
 * como pedido. A assinatura é conferida no POST, em /api/lembretes/parar.
 */
export default async function PararLembretesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { i, f, x, s, feito, erro } = await searchParams
  const temLink = Boolean(i && f && x && s)

  return (
    <LegalPage title="Lembretes por e-mail">
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
        {feito ? (
          <p role="status" className="text-foreground">
            Pronto. Você não vai receber mais lembretes sobre a inscrição no {courseData.courseName}. Se pagar alguma
            etapa, o comprovante continua chegando normalmente.
          </p>
        ) : erro || !temLink ? (
          <p role="alert" className="text-foreground">
            Este link não é válido ou venceu. Para parar os lembretes, fale com a secretaria pelo WhatsApp{' '}
            <a className="underline" href={institutionContact.whatsappUrl}>{institutionContact.whatsappLabel}</a> ou
            pelo e-mail <a className="underline" href={`mailto:${institutionContact.email}`}>{institutionContact.email}</a>.
          </p>
        ) : (
          <>
            <p className="text-foreground">
              Quer parar de receber lembretes sobre a sua inscrição no {courseData.courseName}?
            </p>
            <p>Os comprovantes de pagamento continuam chegando, se você pagar alguma etapa.</p>
            <form method="post" action="/api/lembretes/parar">
              <input type="hidden" name="i" value={i} />
              <input type="hidden" name="f" value={f} />
              <input type="hidden" name="x" value={x} />
              <input type="hidden" name="s" value={s} />
              <button type="submit" className="rounded-md bg-primary px-5 py-3 font-bold text-primary-foreground">
                Não quero mais receber lembretes
              </button>
            </form>
          </>
        )}
      </div>
    </LegalPage>
  )
}
