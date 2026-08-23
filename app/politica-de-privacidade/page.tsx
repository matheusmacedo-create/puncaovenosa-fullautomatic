import type { Metadata } from 'next'
import { LegalPage, LegalSection, legalList } from '@/components/legal-page'
import { institutionContact, INSTITUTION_NAME } from '@/lib/course-data'

export const metadata: Metadata = {
  title: `Política de Privacidade | ${INSTITUTION_NAME}`,
  description: 'Como a Cruz Vermelha Brasileira do Rio de Janeiro coleta, usa e protege os dados pessoais de quem se inscreve no Curso de Punção Venosa.',
  robots: { index: true, follow: true },
}

const ATUALIZADO_EM = '23 de agosto de 2026'

export default function PoliticaDePrivacidadePage() {
  return (
    <LegalPage title="Política de Privacidade" updatedAt={ATUALIZADO_EM}>
      <LegalSection title="1. Quem trata os seus dados">
        <p>
          Esta política vale para o site do Curso de Punção Venosa e para todo o formulário de
          inscrição, tratados pela <strong>{INSTITUTION_NAME}</strong>, com sede em{' '}
          {institutionContact.addressShort}, sob a Lei nº 13.709/2018 (Lei Geral de Proteção de
          Dados — LGPD), o Código Civil e o Código de Defesa do Consumidor.
        </p>
      </LegalSection>

      <LegalSection title="2. Quais dados coletamos">
        <p>Coletamos, conforme a etapa em que você está no formulário:</p>
        <ul className={legalList}>
          <li>Nome completo, CPF, telefone e, quando informado, e-mail;</li>
          <li>CEP, bairro, cidade e UF do seu endereço, usados para localizar a turma mais próxima;</li>
          <li>Área de atuação profissional, disponibilidade de dias e turno, e como você conheceu o curso;</li>
          <li>
            Dados da cobrança (bandeira do cartão e os 4 últimos dígitos, ou o código PIX gerado) —
            nunca o número completo do cartão, que é encaminhado direto ao processador de pagamento e
            não fica guardado em nenhum banco nosso;
          </li>
          <li>Cookies e identificadores de navegação (Meta Pixel), IP e navegador, para medir a origem dos acessos.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Para que usamos esses dados">
        <ul className={legalList}>
          <li>Processar a matrícula e a cobrança do curso;</li>
          <li>Emitir o certificado e a ficha de identificação apresentada no dia da aula;</li>
          <li>Comunicar prazos, turmas e confirmações relacionadas à sua inscrição;</li>
          <li>Cumprir obrigações legais, fiscais e regulatórias;</li>
          <li>Prevenir fraude no processo de pagamento;</li>
          <li>Medir a origem dos acessos e o resultado das campanhas de divulgação do curso.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Com quem compartilhamos">
        <p>Nenhum dado é vendido. Compartilhamos apenas o necessário, com:</p>
        <ul className={legalList}>
          <li>A Únicopag, processadora responsável por cobrar o PIX ou o cartão;</li>
          <li>O Supabase, que hospeda o banco de dados da inscrição, protegido por controle de acesso restrito ao servidor;</li>
          <li>
            A Meta (Facebook/Instagram), que recebe eventos de conversão para medir o resultado dos
            anúncios — dados como e-mail, telefone e CPF são transformados em hash irreversível
            antes do envio, nunca enviados em texto claro;
          </li>
          <li>Autoridades públicas, quando exigido por lei ou ordem judicial.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Bases legais do tratamento">
        <p>
          Tratamos seus dados com base na execução do contrato de prestação do curso, no cumprimento
          de obrigação legal ou regulatória, no legítimo interesse em medir e melhorar a divulgação do
          curso, e no consentimento, quando esta for a base aplicável (como no uso de cookies de
          publicidade).
        </p>
      </LegalSection>

      <LegalSection title="6. Segurança da informação">
        <p>
          O banco de dados usa controle de acesso restrito ao servidor (nenhuma consulta direta do
          navegador chega às tabelas), toda a comunicação é feita por HTTPS, e o número do cartão
          nunca é gravado, logado ou devolvido em nenhuma resposta — apenas a bandeira e os últimos 4
          dígitos ficam registrados, só para conferência.
        </p>
      </LegalSection>

      <LegalSection title="7. Por quanto tempo guardamos os dados">
        <p>
          Os dados ficam armazenados enquanto durar a relação com você — da inscrição à conclusão do
          curso — e, depois disso, pelo prazo necessário ao cumprimento de obrigações legais, fiscais e
          contábeis, ou ao exercício regular de direitos.
        </p>
      </LegalSection>

      <LegalSection title="8. Seus direitos como titular dos dados">
        <p>A qualquer momento, você pode solicitar:</p>
        <ul className={legalList}>
          <li>Confirmação de que tratamos seus dados, e acesso a eles;</li>
          <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;</li>
          <li>Portabilidade dos dados a outro fornecedor de serviço;</li>
          <li>Informação sobre com quem compartilhamos seus dados;</li>
          <li>Revogação do consentimento, quando esta for a base legal aplicável;</li>
          <li>Oposição ao tratamento, nas hipóteses previstas em lei.</li>
        </ul>
      </LegalSection>

      <LegalSection title="9. Como falar conosco">
        <p>
          Para exercer qualquer um desses direitos, ou tirar dúvidas sobre o tratamento dos seus dados,
          escreva para{' '}
          <a href={`mailto:${institutionContact.email}`} className="underline underline-offset-4 hover:text-primary">
            {institutionContact.email}
          </a>{' '}
          ou fale no WhatsApp da secretaria de cursos ({institutionContact.whatsappLabel}). Respondemos
          no prazo previsto na legislação aplicável.
        </p>
      </LegalSection>

      <LegalSection title="10. Alterações desta política">
        <p>
          Esta política pode ser atualizada para refletir mudanças no formulário de inscrição ou na
          legislação. A data no topo desta página indica a versão vigente.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
