# Curso de Punção Venosa — Cruz Vermelha Brasileira RJ

Aplicação Next.js do funil de inscrição do **Curso de Punção Venosa (8h, presencial)** da Cruz Vermelha Brasileira — Rio de Janeiro: checkout via PIX, confirmação de vaga, triagem de 8 perguntas e ficha do aluno em PWA.

## Fluxo do produto

| Etapa | Rota | O que acontece |
| --- | --- | --- |
| 1. Captura | `/` | Landing + bottom sheet de dados (nome, WhatsApp, CPF, pré-requisito de ensino médio) |
| 2. Pagamento | `/?etapa=pagamento` | PIX copia-e-cola com timer de 30 min e estados `pendente / pago / expirado / duplicado` |
| 3. Confirmação | `/?etapa=confirmado` | Vaga garantida — convite para a triagem |
| 4. Triagem | `/triagem/1` … `/triagem/8` | CEP, perfil profissional, turno, dias, urgência, e-mail opcional, origem e confirmação final |
| 5. Ficha do aluno | `/minha-inscricao` | Comprovante com QR, dados do curso e local — instalável como PWA e imprimível |

O estado do funil é persistido em `localStorage` sob as chaves `cvb-enrollment` e `cvb-triage` (ver `lib/enrollment.ts`).

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **TypeScript 5.7** em modo `strict`
- **Tailwind CSS 4** via `@tailwindcss/postcss`, com design system em `app/globals.css`
- **lucide-react** para ícones, **Vercel Analytics** em produção
- **pnpm** como gerenciador de pacotes

## Rodando localmente

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

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
lib/enrollment.ts       Tipos, máscaras, validação de CPF, código PIX e perguntas da triagem
public/                 Ícones, manifest PWA e service worker
```

## Pontos de integração pendentes

Estes trechos são simulações de front-end e precisam de back-end real antes de ir ao ar:

- **Consulta de aluno existente** — `components/enrollment-flow.tsx` (marcado com `[INTEGRAÇÃO]`) hoje reconhece um CPF terminado em `725` e preenche dados fictícios.
- **Confirmação de pagamento PIX** — o estado `pago` é simulado no cliente; precisa de webhook do PSP.
- **Código PIX** — `PIX_CODE` em `lib/enrollment.ts` é estático; deve ser gerado por cobrança.
- **Número de inscrição e QR** — `INSCRIÇÃO CVB-2026-0847` e o QR de `components/clinical-header.tsx` são visuais, não codificam dados reais.
- **Persistência da triagem** — as respostas ficam apenas no `localStorage`, sem envio ao servidor.

## Contribuindo

Todo o trabalho entra por pull request. Ver [CONTRIBUTING.md](CONTRIBUTING.md).
