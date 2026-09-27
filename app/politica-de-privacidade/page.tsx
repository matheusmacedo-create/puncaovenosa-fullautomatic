import type { Metadata } from 'next'
import { LegalPage, LegalSection, legalList } from '@/components/legal-page'
import { courseData, institutionContact, INSTITUTION_NAME, SELLER } from '@/lib/course-data'

export const metadata: Metadata = {
  title: `Política de Privacidade | ${INSTITUTION_NAME}`,
  description: 'Como a Cruz Vermelha Brasileira — Filial do Estado do Rio de Janeiro coleta, usa, compartilha e protege os dados pessoais de quem se inscreve no Curso de Punção Venosa.',
  robots: { index: true, follow: true },
}

const ATUALIZADO_EM = '27 de setembro de 2026'

/*
 * Cada afirmação desta página sai do que o código faz — o que o formulário
 * pede, o que vai para cada fornecedor, o que fica no navegador. Mudou o
 * funil (um campo novo, um fornecedor novo, um evento novo para o Meta),
 * esta página muda junto, e a Política de Cookies também.
 */

const link = 'underline underline-offset-4 hover:text-primary'
const Email = () => <a href={`mailto:${SELLER.email}`} className={link}>{SELLER.email}</a>

export default function PoliticaDePrivacidadePage() {
  return (
    <LegalPage title="Política de Privacidade" updatedAt={ATUALIZADO_EM}>
      <LegalSection title="1. Quem trata os seus dados">
        <p>
          O controlador dos dados pessoais tratados neste site — a página do {courseData.courseName}, o
          formulário de inscrição, o pagamento, a triagem e a ficha do aluno — é a{' '}
          <strong>{SELLER.legalName}</strong>, CNPJ {SELLER.cnpj}, com sede na {SELLER.address}, responsável
          pela Escola de Educação e Saúde. O tratamento segue a Lei nº 13.709/2018 (Lei Geral de Proteção de
          Dados — LGPD).
        </p>
      </LegalSection>

      <LegalSection title="2. Canal de atendimento ao titular">
        <p>
          A filial é agente de tratamento de pequeno porte, nos termos da Resolução CD/ANPD nº 2/2022, e,
          como essa resolução permite, não indicou um encarregado pelo tratamento de dados pessoais. Em seu
          lugar, mantém um canal de comunicação com os titulares: o e-mail <Email />. É por ele que você
          exerce os seus direitos (seção 9), tira dúvidas e envia reclamações sobre o tratamento dos seus
          dados. O WhatsApp da secretaria de cursos ({institutionContact.whatsappLabel}) também recebe esses
          pedidos.
        </p>
      </LegalSection>

      <LegalSection title="3. Quais dados tratamos, para quê e com que base legal">
        <p><strong>Inscrição.</strong> Nome completo, WhatsApp, e-mail, CPF e a declaração de que você concluiu o Ensino Médio (pré-requisito do curso). Servem para registrar a sua inscrição, reservar a vaga, gerar o número de inscrição e a credencial com QR Code conferida no dia da aula, emitir a cobrança e falar com você sobre a turma. Base legal: execução de contrato e de procedimentos preliminares a ele, a seu pedido (art. 7º, V, da LGPD).</p>
        <p><strong>Pagamento.</strong> Valor, meio de pagamento (PIX ou cartão), parcelas, situação da cobrança e o código PIX gerado. Do cartão, guardamos só a bandeira e os 4 últimos dígitos: o número completo, a validade e o código de segurança passam pelo nosso servidor apenas durante o pagamento, a caminho da processadora, e não são gravados em banco, registro ou arquivo. Base legal: execução de contrato (art. 7º, V) e, na guarda dos registros de pagamento exigidos pela legislação fiscal e contábil, cumprimento de obrigação legal (art. 7º, II).</p>
        <p><strong>Triagem.</strong> Depois da matrícula paga, oito perguntas para montar a turma: CEP (com bairro, cidade e UF), se você atua na área da saúde (técnico de enfermagem, enfermeiro, estudante ou outra área), turno e dias disponíveis, quando pretende fazer o curso, um e-mail opcional para segunda via e ajuda com o certificado, como conheceu o curso e a confirmação das condições do dia (8 horas presenciais, 1 kg de alimento não perecível e documento com foto). Pelo bairro e pela cidade informados, o nosso servidor calcula uma coordenada aproximada — o centro da região, não o seu endereço —, usada no mapa de origem das inscrições da secretaria. Base legal: execução de contrato (art. 7º, V).</p>
        <p><strong>Nenhum dado sensível.</strong> A triagem não coleta dado pessoal sensível (art. 5º, II, e art. 11 da LGPD): não perguntamos sobre saúde, origem racial ou étnica, convicção religiosa, opinião política, filiação a sindicato ou a organização religiosa, filosófica ou política, vida sexual, nem dado genético ou biométrico. A pergunta sobre a área da saúde trata da sua ocupação profissional, não do seu estado de saúde.</p>
        <p><strong>Comunicações da inscrição.</strong> E-mails transacionais com o código PIX da cobrança aberta, a confirmação da matrícula, a confirmação do pagamento do curso e o aviso de triagem recebida — com o seu primeiro nome, o número de inscrição, o valor e, quando for o caso, o código PIX. Base legal: execução de contrato (art. 7º, V).</p>
        <p><strong>Origem da inscrição.</strong> Os parâmetros de campanha do link pelo qual você chegou (utm_source, utm_medium e utm_campaign, gravados com a inscrição; utm_content e utm_term, enviados com a cobrança), para saber qual divulgação trouxe cada inscrição e somar a receita por campanha. Não usa cookie e não depende do Meta. Base legal: legítimo interesse da instituição em avaliar a própria divulgação (art. 7º, IX). À parte, cada visita à página do curso é contada só com a data, a hora e esses parâmetros, sem nada que identifique quem visitou.</p>
        <p><strong>Medição de marketing — só com o seu consentimento.</strong> Se você permitir marketing no aviso de cookies: (a) o Pixel da Meta registra, no seu navegador, as etapas do funil (visita, clique em matrícula, dados preenchidos, cobrança aberta, pagamento, início e fim da triagem, abertura da ficha) e sinais de engajamento na página do curso (quanto da página foi rolado e 30 segundos de permanência); (b) o nosso servidor envia ao Meta uma cópia das etapas de dados preenchidos, cobrança aberta, pagamento e triagem concluída (API de Conversões), com e-mail, telefone, CPF, nome e país — e, depois da triagem, cidade, UF e CEP — transformados em código (hash SHA-256), além do endereço IP, do navegador e dos cookies do Pixel quando o evento parte do seu navegador; (c) se você preencher os dados e não pagar em até 2 horas, e-mail e telefone, também em hash, podem entrar num público personalizado do Meta, para mostrar a você anúncios do curso, e saem dele quando o pagamento é confirmado ou quando você retira a permissão. O hash não é anonimização: é o que permite ao Meta reconhecer você entre os usuários dele. Base legal: consentimento (art. 7º, I), que você pode retirar a qualquer momento em “Preferências de cookies”. Sem ele, nada disso acontece.</p>
        <p><strong>Estatística — só com o seu consentimento.</strong> Se você permitir estatística, o Vercel Web Analytics conta as visitas e as páginas lidas neste site, sem gravar cookie e sem identificar você pelo nome. Base legal: consentimento (art. 7º, I).</p>
        <p><strong>Segurança e prevenção a fraude.</strong> Registramos cada leitura da credencial do aluno (data e hora), para a conferência presencial e para denunciar uma captura de tela antiga no lugar da credencial; conferimos todo aviso de pagamento diretamente na processadora antes de confirmar a vaga; a consulta de CPF no formulário devolve só o primeiro nome e o final do telefone; e pedidos de reembolso com indício de uso indevido do meio de pagamento podem ser analisados antes da devolução. Base legal: legítimo interesse na segurança da inscrição, sua e da instituição (art. 7º, IX).</p>
      </LegalSection>

      <LegalSection title="4. Com quem compartilhamos">
        <p>Nenhum dado é vendido. Compartilhamos só o necessário para cada finalidade acima:</p>
        <ul className={legalList}>
          <li><strong>ÚnicoPag</strong>, processadora de pagamento: nome, e-mail, telefone, CPF, o que está sendo pago e o valor, os dados do cartão (só no momento do pagamento com cartão), os parâmetros de campanha e o número interno da inscrição;</li>
          <li><strong>Supabase</strong>, que hospeda o banco de dados da inscrição, no Brasil, com acesso restrito ao nosso servidor;</li>
          <li><strong>Vercel</strong>, que hospeda o site e executa o nosso servidor em São Paulo;</li>
          <li><strong>Resend</strong>, que entrega os e-mails transacionais da inscrição;</li>
          <li><strong>Meta</strong> (Facebook e Instagram), só com o seu consentimento de marketing, como descrito na seção 3;</li>
          <li><strong>Google</strong> (Planilhas e Apps Script), quando a secretaria usa a planilha de acompanhamento: nome, CPF, WhatsApp, e-mail, ensino médio, situação da inscrição e do pagamento, meio de pagamento, valor e quantas perguntas da triagem foram respondidas;</li>
          <li>os <strong>sistemas da secretaria da Escola</strong>: quando a integração está ligada, recebem esses mesmos dados a cada etapa (inscrição recebida, pagamento iniciado, confirmado ou recusado, triagem concluída); e o sistema administrativo da Escola lê as transações na ÚnicoPag para somar a receita por campanha;</li>
          <li><strong>serviços públicos de CEP e mapas</strong> (BrasilAPI, ViaCEP e OpenStreetMap Nominatim), consultados pelo nosso servidor apenas com o CEP, a rua, o bairro, a cidade e a UF procurados — nunca com o seu nome, CPF ou endereço de IP;</li>
          <li>autoridades públicas, quando exigido por lei ou ordem judicial.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Transferência internacional">
        <p>
          Alguns desses fornecedores tratam ou podem tratar dados fora do Brasil: a Vercel (a rede que recebe
          as requisições ao site e a medição de audiência), a Resend, o Meta, o Google e o OpenStreetMap —
          este, sem nenhum dado que identifique você. Essas transferências só são feitas nas hipóteses do
          art. 33 da LGPD: quando necessárias à execução do contrato com você (art. 33, IX), como a hospedagem
          do site e os e-mails da inscrição, e com as garantias contratuais de proteção de dados oferecidas
          por esses fornecedores (art. 33, II). As que envolvem o Meta só acontecem com o seu consentimento
          de marketing.
        </p>
      </LegalSection>

      <LegalSection title="6. Cookies e armazenamento no navegador">
        <p>
          O site guarda no seu navegador a sua escolha sobre cookies, a sessão e o rascunho da inscrição e,
          com a sua permissão, os cookies do Pixel da Meta. A lista completa, com nomes, finalidades e
          prazos, está na{' '}
          <a href={courseData.cookiePolicyUrl} className={link}>Política de Cookies</a>, onde você também muda
          a sua escolha.
        </p>
      </LegalSection>

      <LegalSection title="7. Segurança da informação">
        <p>
          O banco de dados só aceita consultas do nosso servidor — nenhuma consulta direta do navegador chega
          às tabelas —, toda a comunicação é feita por HTTPS, a sessão da inscrição fica num cookie que o
          JavaScript da página não consegue ler, e o número do cartão nunca é gravado, registrado ou devolvido
          em resposta nenhuma.
        </p>
      </LegalSection>

      <LegalSection title="8. Por quanto tempo guardamos os dados">
        <p>
          Os dados da inscrição ficam guardados enquanto durar a relação com você — da inscrição à conclusão
          do curso — e, depois disso, pelo prazo necessário ao cumprimento de obrigações legais, fiscais e
          contábeis, ou ao exercício regular de direitos em processo (art. 16 da LGPD). Fora dessas hipóteses,
          você pode pedir a eliminação (seção 9). O que depende do seu consentimento para de ser feito quando
          você o retira. Os prazos dos cookies e do que fica no seu navegador estão na Política de Cookies.
        </p>
      </LegalSection>

      <LegalSection title="9. Seus direitos como titular dos dados">
        <p>A qualquer momento, você pode pedir (art. 18 da LGPD):</p>
        <ul className={legalList}>
          <li>confirmação de que tratamos seus dados, e acesso a eles;</li>
          <li>correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD;</li>
          <li>portabilidade dos dados a outro fornecedor de serviço, mediante requisição expressa;</li>
          <li>eliminação dos dados tratados com o seu consentimento;</li>
          <li>informação sobre com quem compartilhamos seus dados;</li>
          <li>informação sobre a possibilidade de não consentir e sobre as consequências da recusa — recusar estatística ou marketing não muda nada na sua inscrição;</li>
          <li>revogação do consentimento, a qualquer momento, em “Preferências de cookies” ou pelo canal abaixo;</li>
          <li>oposição a tratamento feito com base em outra hipótese legal, se ele descumprir a LGPD.</li>
        </ul>
        <p>
          Para exercer qualquer um deles, escreva para <Email />, com o nome completo e o CPF usados na
          inscrição, para confirmarmos que o pedido é seu. Respondemos nos prazos do art. 19 da LGPD,
          observado o regime dos agentes de pequeno porte (Resolução CD/ANPD nº 2/2022).
        </p>
      </LegalSection>

      <LegalSection title="10. Reclamação à ANPD">
        <p>
          Se você entender que o seu pedido não foi atendido, pode peticionar à Autoridade Nacional de
          Proteção de Dados — ANPD (art. 18, § 1º, da LGPD), pelos canais indicados em{' '}
          <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className={link}>www.gov.br/anpd</a>.
        </p>
      </LegalSection>

      <LegalSection title="11. Alterações desta política">
        <p>
          Esta política pode ser atualizada para refletir mudanças no formulário de inscrição, nos fornecedores
          ou na legislação. A data no topo desta página indica a versão vigente.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
