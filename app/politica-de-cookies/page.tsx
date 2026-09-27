import type { Metadata } from 'next'
import { LegalPage, LegalSection, legalList } from '@/components/legal-page'
import { courseData, INSTITUTION_NAME, SELLER } from '@/lib/course-data'

export const metadata: Metadata = {
  title: `Política de Cookies | ${INSTITUTION_NAME}`,
  description: 'O que o site do Curso de Punção Venosa guarda no seu navegador — cookies, armazenamento local e cache —, para quê, por quanto tempo e como mudar a sua escolha.',
  robots: { index: true, follow: true },
}

const ATUALIZADO_EM = '27 de setembro de 2026'

/*
 * A lista sai do código: `lib/consentimento.ts` (cvrj_consentimento),
 * `lib/session.ts` (cvb_inscricao), `lib/secretaria.ts` (cvb_secretaria),
 * `STORAGE_KEYS` em `lib/enrollment.ts`, `components/secretaria-abas.tsx`,
 * `public/sw.js`, `lib/rastreio.ts` e `lib/pixel.ts` (sessionStorage e os
 * cookies do Pixel). Guardou algo novo no navegador, entra aqui — e no texto
 * de "Necessários" do aviso (`components/aviso-de-cookies.tsx`).
 */

type Item = { nome: string; tipo: string; finalidade: string; duracao: string }

const NECESSARIOS: Item[] = [
  {
    nome: 'cvrj_consentimento',
    tipo: 'Cookie deste site, compartilhado com todo o domínio cruzvermelhariodejaneiro.org',
    finalidade: 'Guarda a sua escolha sobre estatística e marketing e quando ela foi feita. A mesma escolha vale no site principal e nos demais sites da Cruz Vermelha RJ — quem já escolheu num deles não é perguntado de novo.',
    duracao: '12 meses',
  },
  {
    nome: 'cvb_inscricao',
    tipo: 'Cookie deste site, que o JavaScript da página não consegue ler (httpOnly)',
    finalidade: 'Liga as etapas da inscrição — pagamento, triagem e ficha — à sua inscrição. Guarda só o número interno da inscrição.',
    duracao: '30 dias',
  },
  {
    nome: 'cvb-enrollment',
    tipo: 'Armazenamento local do navegador (localStorage)',
    finalidade: 'Rascunho do formulário de inscrição (nome, WhatsApp, e-mail, CPF e ensino médio), para você não perder o que digitou e para a ficha abrir mesmo sem conexão.',
    duracao: 'Até você limpar os dados deste site no navegador',
  },
  {
    nome: 'cvb-triage',
    tipo: 'Armazenamento local do navegador (localStorage)',
    finalidade: 'Rascunho das respostas da triagem, pelo mesmo motivo.',
    duracao: 'Até você limpar os dados deste site no navegador',
  },
  {
    nome: 'cvb-inscricao-v1',
    tipo: 'Cache do aplicativo (service worker), criado quando você abre “Minha inscrição”',
    finalidade: 'Cópia das páginas e respostas deste site para abrir a ficha do aluno sem internet. Nada de outros sites entra nele.',
    duracao: 'Até você limpar os dados deste site no navegador',
  },
  {
    nome: 'cvb_secretaria',
    tipo: 'Cookie deste site, httpOnly — só para a equipe da secretaria',
    finalidade: 'Mantém a sessão do painel interno da secretaria.',
    duracao: '8 horas',
  },
  {
    nome: 'cvb-secretaria-aba',
    tipo: 'Armazenamento local do navegador (localStorage) — só para a equipe da secretaria',
    finalidade: 'Lembra a última aba aberta no painel interno.',
    duracao: 'Até limpar os dados deste site no navegador',
  },
]

const ESTATISTICA: Item[] = [
  {
    nome: 'Vercel Web Analytics',
    tipo: 'Script de medição servido por este site, sem cookie',
    finalidade: 'Conta as visitas e as páginas lidas, sem identificar você pelo nome. Só é carregado depois da sua permissão.',
    duracao: 'Não grava nada no seu navegador, segundo a Vercel',
  },
]

const MARKETING: Item[] = [
  {
    nome: '_fbp',
    tipo: 'Cookie deste site, gravado pelo Pixel da Meta',
    finalidade: 'Identifica o seu navegador para o Meta medir o alcance e o resultado das campanhas do curso.',
    duracao: '90 dias, renovados a cada visita, segundo a Meta',
  },
  {
    nome: '_fbc',
    tipo: 'Cookie deste site, gravado pelo Pixel da Meta quando você chega por um anúncio (link com fbclid)',
    finalidade: 'Liga a visita ao clique no anúncio.',
    duracao: '90 dias, segundo a Meta',
  },
  {
    nome: 'cvb-rastreio:… e cvb-engajamento:…',
    tipo: 'Armazenamento da sessão do navegador (sessionStorage)',
    finalidade: 'Evita mandar ao Meta o mesmo evento duas vezes na mesma aba — por exemplo, o pagamento confirmado, que a tela de pagamento pode rever várias vezes.',
    duracao: 'Até você fechar a aba',
  },
  {
    nome: 'Cookies do Meta em facebook.com',
    tipo: 'Cookies de terceiro',
    finalidade: 'Quando o Pixel carrega, o Meta pode ler e gravar cookies no domínio dele, conforme a política de cookies do próprio Meta.',
    duracao: 'Definida pelo Meta',
  },
]

function Lista({ itens }: { itens: Item[] }) {
  return (
    <ul className="space-y-3">
      {itens.map(item => (
        <li key={item.nome} className="rounded-md border border-border p-4">
          <p className="break-words font-mono text-sm font-semibold text-foreground">{item.nome}</p>
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[6.5rem_1fr]">
            <dt className="font-semibold text-foreground">Tipo</dt>
            <dd>{item.tipo}</dd>
            <dt className="font-semibold text-foreground">Para quê</dt>
            <dd>{item.finalidade}</dd>
            <dt className="font-semibold text-foreground">Duração</dt>
            <dd>{item.duracao}</dd>
          </dl>
        </li>
      ))}
    </ul>
  )
}

const link = 'underline underline-offset-4 hover:text-primary'

export default function PoliticaDeCookiesPage() {
  return (
    <LegalPage title="Política de Cookies" updatedAt={ATUALIZADO_EM}>
      <LegalSection title="1. O que são e por que perguntamos">
        <p>
          Cookies e tecnologias parecidas (armazenamento local, armazenamento da sessão, cache do aplicativo)
          são pequenos registros que um site guarda no seu navegador. Este site, da{' '}
          <strong>{SELLER.legalName}</strong>, usa alguns que são necessários para funcionar e, só com a sua
          permissão, outros de estatística e de marketing — como orienta o Guia de Cookies da Autoridade
          Nacional de Proteção de Dados (ANPD). Estatística e marketing ficam desligados até você ligar.
        </p>
      </LegalSection>

      <LegalSection title="2. Necessários — sempre ligados">
        <p>Sem eles o site não funciona: a inscrição, o pagamento e a ficha dependem deles. Por isso não pedem permissão.</p>
        <Lista itens={NECESSARIOS} />
      </LegalSection>

      <LegalSection title="3. Estatística — só com a sua permissão">
        <Lista itens={ESTATISTICA} />
        <p>
          O Google Analytics do site principal grava os cookies <code>_ga</code> e <code>_ga_*</code> no
          domínio compartilhado. Este site não usa o Google Analytics, mas apaga esses cookies se você recusar
          estatística aqui, porque a escolha vale para os dois.
        </p>
      </LegalSection>

      <LegalSection title="4. Marketing — só com a sua permissão">
        <Lista itens={MARKETING} />
        <p>
          Com marketing permitido, o nosso servidor também envia ao Meta uma cópia das etapas da inscrição
          (API de Conversões), e quem preenche os dados e não paga pode entrar num público de anúncios do
          curso. O que vai em cada caso está na seção 3 da{' '}
          {courseData.privacyPolicyUrl
            ? <a href={courseData.privacyPolicyUrl} className={link}>Política de Privacidade</a>
            : 'Política de Privacidade'}
          . Sem a permissão, nada disso acontece, e nenhum script do Meta é carregado.
        </p>
      </LegalSection>

      <LegalSection id="preferencias" title="5. Como mudar a sua escolha">
        <p>
          <a
            href="#preferencias"
            data-cvrj-cookies=""
            className="inline-flex min-h-11 items-center rounded-md border-2 border-foreground px-4 py-2 font-bold text-foreground no-underline hover:bg-muted"
          >
            Abrir as preferências de cookies
          </a>
        </p>
        <ul className={legalList}>
          <li>O mesmo link, “Preferências de cookies”, fica no rodapé de todas as páginas do site.</li>
          <li>A escolha vale por 12 meses; depois disso, perguntamos de novo.</li>
          <li>
            Ao retirar uma permissão, o site apaga os cookies daquela categoria que ele mesmo consegue apagar
            (<code>_fbp</code> e <code>_fbc</code> no marketing; <code>_ga*</code> na estatística), o Pixel
            deixa de enviar eventos e o nosso servidor deixa de mandar ao Meta eventos da sua inscrição. Se
            você estava no público de anúncios, sai dele. Se a inscrição foi feita em outro aparelho, peça pelo
            e-mail abaixo que a retirada valha também para ela.
          </li>
          <li>A retirada não desfaz o que foi feito enquanto a permissão valia (art. 8º, § 5º, da LGPD).</li>
          <li>Você também pode apagar cookies e dados deste site nas configurações do navegador; aí o aviso volta a aparecer.</li>
          <li>Recusar estatística ou marketing não muda nada na sua inscrição.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Dúvidas">
        <p>
          Escreva para{' '}
          <a href={`mailto:${SELLER.email}`} className={link}>{SELLER.email}</a>, o canal de atendimento aos
          titulares de dados. Como tratamos os seus dados, com quem compartilhamos e os seus direitos estão na{' '}
          {courseData.privacyPolicyUrl
            ? <a href={courseData.privacyPolicyUrl} className={link}>Política de Privacidade</a>
            : 'Política de Privacidade'}
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}
