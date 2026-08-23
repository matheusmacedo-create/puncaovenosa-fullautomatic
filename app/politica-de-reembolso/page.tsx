import type { Metadata } from 'next'
import { LegalPage, LegalSection, legalList } from '@/components/legal-page'
import { institutionContact, INSTITUTION_NAME, courseData } from '@/lib/course-data'

export const metadata: Metadata = {
  title: `Política de Cancelamento e Reembolso | ${INSTITUTION_NAME}`,
  description: 'Direito de arrependimento de 7 dias, prazos e forma de devolução para quem se matriculou no Curso de Punção Venosa.',
  robots: { index: true, follow: true },
}

const ATUALIZADO_EM = '23 de agosto de 2026'

export default function PoliticaDeReembolsoPage() {
  return (
    <LegalPage title="Política de Cancelamento e Reembolso" updatedAt={ATUALIZADO_EM}>
      <LegalSection title="1. Direito de arrependimento (7 dias)">
        <p>
          Como a matrícula é feita fora de um estabelecimento físico, você tem <strong>7 dias
          corridos</strong>, a contar da confirmação do pagamento, para desistir da inscrição no{' '}
          {courseData.courseName}, com devolução integral do valor pago — sem precisar justificar o
          motivo, conforme o art. 49 do Código de Defesa do Consumidor.
        </p>
      </LegalSection>

      <LegalSection title="2. Como pedir o cancelamento">
        <p>Envie a solicitação por um destes canais, informando o nome completo e o CPF usados na inscrição:</p>
        <ul className={legalList}>
          <li>
            E-mail:{' '}
            <a href={`mailto:${institutionContact.email}`} className="underline underline-offset-4 hover:text-primary">
              {institutionContact.email}
            </a>
          </li>
          <li>WhatsApp da secretaria de cursos: {institutionContact.whatsappLabel}</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Prazo e forma da devolução">
        <p>
          Depois de recebido o pedido dentro do prazo de arrependimento, processamos a solicitação em
          até 5 dias úteis. O valor volta pelo mesmo meio usado no pagamento: PIX é devolvido para a
          mesma chave de origem; cartão é estornado na fatura, no prazo que a operadora do cartão
          determinar (normalmente até 2 faturas seguintes).
        </p>
      </LegalSection>

      <LegalSection title="4. Cancelamento depois dos 7 dias">
        <p>
          Passado o prazo de arrependimento, o cancelamento deixa de ser automático. Se a turma ainda
          não tiver acontecido, entre em contato pelos canais acima para avaliarmos remarcação ou
          reembolso, caso a caso. Uma vez realizado o curso e emitido o certificado, não há mais
          devolução de valores.
        </p>
      </LegalSection>

      <LegalSection title="5. Se o cancelamento for nosso">
        <p>
          Se a {INSTITUTION_NAME} precisar cancelar ou remarcar uma turma, você escolhe entre migrar
          para a próxima data disponível ou receber o reembolso integral, independente do prazo de 7
          dias.
        </p>
      </LegalSection>

      <LegalSection title="6. Prevenção a fraude">
        <p>
          Pedidos de reembolso com indício de uso indevido do meio de pagamento (por exemplo, cartão
          não pertencente a quem se inscreveu) podem ser analisados antes da devolução, para proteger
          tanto você quanto a instituição.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
