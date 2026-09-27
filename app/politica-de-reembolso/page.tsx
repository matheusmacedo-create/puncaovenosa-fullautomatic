import type { Metadata } from 'next'
import { LegalPage, LegalSection, legalList } from '@/components/legal-page'
import { institutionContact, INSTITUTION_NAME, courseData } from '@/lib/course-data'

export const metadata: Metadata = {
  title: `Política de Cancelamento e Reembolso | ${INSTITUTION_NAME}`,
  description: 'Direito de arrependimento de 7 dias, prazos e forma de devolução para quem se matriculou no Curso de Punção Venosa.',
  robots: { index: true, follow: true },
}

const ATUALIZADO_EM = '27 de setembro de 2026'

/*
 * O que o Decreto nº 7.962/2013 (art. 5º) exige de quem vende pela internet,
 * além do prazo do art. 49 do CDC: meio claro para desistir, inclusive pela
 * mesma ferramenta da compra (§ 1º); desfazer sem custo o que for acessório
 * (§ 2º); avisar na hora a administradora do cartão (§ 3º); e confirmar na
 * hora o recebimento do pedido (§ 4º). As regras de negócio — prazo contado
 * da confirmação do pagamento, 5 dias úteis para processar, o que vale depois
 * dos 7 dias — são da secretaria e não mudam aqui.
 */
const PEDIDO_DE_ARREPENDIMENTO =
  `mailto:${institutionContact.email}` +
  `?subject=${encodeURIComponent(`Arrependimento — ${courseData.courseName}`)}` +
  `&body=${encodeURIComponent(`Quero desistir da minha inscrição no ${courseData.courseName}, no prazo de arrependimento (art. 49 do Código de Defesa do Consumidor).\n\nNome completo:\nCPF:\n`)}`

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
        <p>
          O arrependimento desfaz também, sem nenhum custo para você, o que estiver vinculado à matrícula,
          como o parcelamento no cartão (Decreto nº 7.962/2013, art. 5º, § 2º).
        </p>
      </LegalSection>

      <LegalSection title="2. Como pedir o cancelamento">
        <p>
          Você pode pedir pelo mesmo meio em que se inscreveu — este site — ou por outro canal abaixo,
          informando o nome completo e o CPF usados na inscrição:
        </p>
        <ul className={legalList}>
          <li>
            Aqui mesmo:{' '}
            <a href={PEDIDO_DE_ARREPENDIMENTO} className="font-semibold underline underline-offset-4 hover:text-primary">
              quero desistir da minha matrícula
            </a>{' '}
            (abre uma mensagem de e-mail já endereçada à secretaria, com o pedido escrito);
          </li>
          <li>
            E-mail:{' '}
            <a href={`mailto:${institutionContact.email}`} className="underline underline-offset-4 hover:text-primary">
              {institutionContact.email}
            </a>
          </li>
          <li>WhatsApp da secretaria de cursos: {institutionContact.whatsappLabel}</li>
        </ul>
        <p>
          Confirmamos o recebimento do seu pedido imediatamente, pelo mesmo canal que você usou (Decreto nº
          7.962/2013, art. 5º, § 4º).
        </p>
      </LegalSection>

      <LegalSection title="3. Prazo e forma da devolução">
        <p>
          Depois de recebido o pedido dentro do prazo de arrependimento, processamos a solicitação em
          até 5 dias úteis. O valor volta pelo mesmo meio usado no pagamento: PIX é devolvido para a
          mesma chave de origem; cartão é estornado na fatura, no prazo que a operadora do cartão
          determinar (normalmente até 2 faturas seguintes).
        </p>
        <p>
          No pagamento com cartão, comunicamos o arrependimento imediatamente à administradora do cartão,
          para que a cobrança não seja lançada na sua fatura ou, se já tiver sido, seja estornada (Decreto nº
          7.962/2013, art. 5º, § 3º).
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
