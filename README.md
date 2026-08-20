# Curso de Punção Venosa — Cruz Vermelha Brasileira RJ

Aplicação Next.js do funil de inscrição do **Curso de Punção Venosa (8h, presencial)** da Cruz Vermelha Brasileira — Rio de Janeiro: checkout via PIX ou cartão, confirmação de vaga, triagem de 8 perguntas e ficha do aluno em PWA. Os dados são persistidos em Postgres no Supabase.

## Fluxo do produto

| Etapa | Rota | O que acontece |
| --- | --- | --- |
| 1. Captura | `/` | Landing + bottom sheet de dados (nome, WhatsApp, CPF, pré-requisito de ensino médio) e composição do preço |
| 2. Pagamento | `/?etapa=pagamento` | Escolha entre PIX (copia-e-cola com timer de 30 min) e cartão (com parcelamento). Estados `pendente / confirmado / expirado / recusado` |
| 3. Confirmação | `/?etapa=confirmado` | Vaga garantida — convite para a triagem |
| 4. Triagem | `/triagem/1` … `/triagem/8` | CEP, perfil profissional, turno, dias, urgência, e-mail opcional, origem e confirmação final |
| 5. Ficha do aluno | `/minha-inscricao` | Comprovante com QR, dados do curso e local — instalável como PWA e imprimível |

A sessão do aluno é um cookie `httpOnly` (`cvb_inscricao`) com o id da inscrição — não há login. O `localStorage` (`cvb-enrollment`, `cvb-triage`) continua como cache do rascunho, mas **o servidor é a fonte da verdade**.

## Preço

| Item | Valor |
| --- | --- |
| Matrícula | R$ 99,00 |
| Curso presencial, 8h | R$ 150,00 |
| **Total à vista** | **R$ 249,00** |

O aluno paga o total de uma vez, em PIX ou cartão. A composição é definida em `COMPOSICAO_PRECO` (`lib/enrollment.ts`) e o total é **derivado da soma** — nunca escreva o valor solto.

Cada cobrança grava sua própria composição na coluna `pagamentos.itens`, e uma constraint no banco exige que os itens fechem com `valor_centavos`. Isso impede que uma cobrança de R$ 249 seja registrada com itens somando R$ 99.

Cobrar apenas a matrícula é aceito pelo modelo, mas **não está implementado no funil** — fica disponível para um downsell futuro.

## Arquitetura de dados

Todo acesso ao banco passa por route handlers no servidor. As três tabelas têm RLS ligada e **forçada, sem nenhuma policy**, o que nega qualquer acesso pela chave publicável; o servidor usa a chave secreta, que ignora RLS.

| Tabela | Guarda |
| --- | --- |
| `inscricoes` | Aluno, com CPF como chave natural única |
| `triagem_respostas` | Uma linha por passo, resposta em `jsonb` |
| `pagamentos` | Cobranças PIX e cartão, com histórico de tentativas |

Três funções no banco mantêm atômico o que seria uma sequência de queries:

- `upsert_inscricao` — cria ou atualiza pelo CPF, sem rebaixar quem já pagou
- `confirmar_pagamento` — **idempotente**: webhook e clique podem chegar juntos sem gerar dois números de inscrição
- `concluir_triagem_se_completa` — promove o status só quando os 8 passos existem

### Rotas de API

| Rota | Para que serve |
| --- | --- |
| `POST /api/inscricoes` | Cria/atualiza a inscrição e abre a sessão |
| `GET /api/inscricoes/atual` | Estado da inscrição da sessão |
| `GET /api/inscricoes/consulta` | Diz se um CPF já tem cadastro (resposta mascarada) |
| `POST /api/pagamentos` | Abre uma cobrança PIX ou cartão |
| `GET /api/pagamentos/atual` | Última cobrança — usada no polling da tela de pagamento |
| `POST /api/pagamentos/confirmar` | Confirma e promove a inscrição (só com a simulação ligada) |
| `POST /api/pagamentos/desfecho` | Encerra como `expirado` ou `recusado` |
| `GET`/`PUT` `/api/triagem` | Lê e grava as respostas da triagem |
| `POST /api/webhooks/pix` | Confirmação servidor-a-servidor do provedor |

### Dados de cartão e PCI

O número do cartão, o CVV e a validade **nunca** trafegam pela nossa API nem são gravados. `POST /api/pagamentos` rejeita explicitamente qualquer corpo que contenha esses campos. O banco guarda apenas bandeira, últimos 4 dígitos e parcelas. A tokenização acontece no navegador, pelo SDK do provedor.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **TypeScript 5.7** em modo `strict`
- **Tailwind CSS 4** via `@tailwindcss/postcss`, com design system em `app/globals.css`
- **lucide-react** para ícones, **Vercel Analytics** em produção
- **pnpm** como gerenciador de pacotes

## Rodando localmente

```bash
cp .env.example .env.local   # e preencha SUPABASE_SECRET_KEY
pnpm install
pnpm dev                     # http://localhost:3000
```

Sem as variáveis do Supabase a interface sobe normalmente, mas as rotas de API respondem `503`.

### Variáveis aceitas

| Para quê | Nomes aceitos |
| --- | --- |
| URL do projeto | `NEXT_PUBLIC_SUPABASE_URL` ou `SUPABASE_URL` |
| Chave secreta | `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` |

As segundas opções são os nomes que a integração Supabase da Vercel injeta sozinha. Num deploy pela Vercel com essa integração ativa, não é preciso configurar nada à mão.

## Publicando na Vercel

1. Em vercel.com, **Add New → Project** e importar `puncaovenosa-fullautomatic`.
2. A Vercel detecta Next.js e pnpm sozinha — não mexa em build command nem output directory.
3. Em **Settings → Environment Variables**, conferir se a URL e a chave secreta do Supabase estão presentes (a integração costuma injetá-las). Se não estiverem, adicionar com qualquer um dos nomes da tabela acima.
4. Para conseguir percorrer o funil sem provedor de pagamento, adicionar `NEXT_PUBLIC_SIMULAR_PAGAMENTO` com valor `true`. **Remova essa variável antes de receber aluno de verdade.**
5. Deploy. Cada push na `main` gera um novo deploy, e cada pull request ganha uma URL de preview própria.

### Simulação de pagamento

Enquanto o provedor não está integrado, `NEXT_PUBLIC_SIMULAR_PAGAMENTO=true` libera os botões de simulação na tela de pagamento e a rota `POST /api/pagamentos/confirmar`. É o que permite percorrer o funil inteiro num ambiente de teste.

**Não ligue em produção.** Com a variável ativa, qualquer visitante confirma a própria inscrição sem pagar. Com ela ausente, a rota responde `403` e só o webhook — que exige o token do provedor — confirma pagamento.

Outros comandos:

```bash
pnpm typecheck    # tsc --noEmit
pnpm build        # build de produção
pnpm start        # servir o build
```

## Estrutura

```
app/                    Rotas do App Router (landing, triagem/[step], minha-inscricao)
  globals.css           Design system completo (tokens, componentes, print styles)
components/             Componentes de fluxo (enrollment, triage, student-pass, header)
  ui/                   Primitivas shadcn
  api/                  Route handlers — a única camada que fala com o banco
components/card-form.tsx  Formulário de cartão (tokenização entra aqui)
lib/enrollment.ts       Tipos, máscaras, validação de CPF e cartão, preço e perguntas da triagem
lib/api-cliente.ts      Chamadas do navegador para as rotas
lib/supabase/server.ts  Cliente Supabase com a chave secreta (nunca importar no cliente)
lib/session.ts          Cookie httpOnly da sessão do funil
supabase/migrations/    Schema versionado
public/                 Ícones, manifest PWA e service worker
```

## Pontos de integração pendentes

Persistência, consulta por CPF, número de inscrição e triagem já são reais. O que falta é o dinheiro de verdade:

- **Cobrança no provedor** — `POST /api/pagamentos` registra a intenção, mas não chama a Único. É onde `provedor_id` passa a ser preenchido.
- **Tokenização do cartão** — `components/card-form.tsx` valida e formata, mas ainda não tokeniza; hoje envia um token simulado.
- **Chave PIX** — `PIX_RECEBEDOR.chave` em `lib/enrollment.ts` é um placeholder. O payload já é montado corretamente por cobrança em `lib/pix.ts`, mas o dinheiro só cai quando a chave real da Cruz Vermelha entrar ali.
- **Webhook** — `POST /api/webhooks/pix` está implementado e protegido por `PIX_WEBHOOK_TOKEN`, mas troque a comparação de token pela verificação de assinatura que o provedor documentar.
- **QR Code** — o QR de `components/clinical-header.tsx` é visual e não codifica dados reais.

## Contribuindo

Todo o trabalho entra por pull request. Ver [CONTRIBUTING.md](CONTRIBUTING.md).
