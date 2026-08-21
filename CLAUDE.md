# Guia do repositório para sessões do Claude Code

Contexto que vale carregar antes de mexer em qualquer coisa aqui.

## O que é

Funil de inscrição do Curso de Punção Venosa da Cruz Vermelha Brasileira RJ. Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind 4. Ver `README.md` para o mapa de rotas e etapas.

## Comandos

```bash
pnpm install --frozen-lockfile   # sempre com lockfile
pnpm dev                         # desenvolvimento
pnpm typecheck                   # tsc --noEmit — é o gate real de tipos
pnpm build                       # build de produção
```

Use **pnpm**, nunca npm ou yarn — o lockfile é do pnpm e o CI roda com `--frozen-lockfile`.

## Convenções do código

- Estilo enxuto, uma linha por bloco JSX quando cabe — é o padrão que veio do v0 e está mantido por todo o projeto. Combine com o arquivo ao redor em vez de reformatar.
- Sem biblioteca de CSS-in-JS: todo o visual está em `app/globals.css` com classes semânticas (`.triage-shell`, `.primary-button`, `.student-pass`). Reaproveite classe existente antes de criar uma nova.
- Textos de interface em **português do Brasil**, tom clínico e direto.
- Alias de import é `@/*` apontando para a raiz.
- `lib/enrollment.ts` é a fonte única de máscaras, validação (CPF e cartão), preço, chaves de `localStorage` e das 8 perguntas da triagem. Mudou lá, confira `/` e `/triagem/[step]`.
- Banco só pelo servidor: `lib/supabase/server.ts` usa a chave secreta e **nunca** pode ser importado de um Client Component. O navegador fala com `lib/api-cliente.ts`, que chama as rotas em `app/api/`.

## Armadilhas

- `next.config.mjs` tem `typescript.ignoreBuildErrors: true` — `pnpm build` passa mesmo com erro de tipo. Rode `pnpm typecheck` sempre; hoje ele passa limpo.
- A triagem tem exatamente 8 passos, validados em `app/triagem/[step]/page.tsx` e usados no cálculo da barra de progresso (`step * 12.5`). Mudar a quantidade de perguntas exige mexer nos dois lugares.
- O back-end é Postgres no Supabase. O `localStorage` sobrou como cache do rascunho — a fonte da verdade é o servidor. Componentes que leem estado usam `useEffect` para evitar mismatch de hidratação; mantenha esse padrão.
- A sessão é o cookie httpOnly `cvb_inscricao`. Nenhuma rota aceita id de inscrição vindo do cliente — se aceitasse, qualquer um leria a inscrição alheia.
- RLS está ligada e **forçada** nas três tabelas, sem policy nenhuma. Isso é proposital: nega tudo pela chave publicável. Não adicione policy sem entender que isso abriria acesso direto do navegador.
- **Dado de cartão nunca chega ao servidor.** `POST /api/pagamentos` rejeita corpos com `numero`, `cvv`, `validade` ou `pan`. Se precisar mexer no cartão, a tokenização é no navegador.
- Ao escrever função PL/pgSQL com `returns table`, não repita nome de coluna da tabela nos campos de retorno sem qualificar com alias — o Postgres aborta com "column reference is ambiguous". Já aconteceu em `confirmar_pagamento`.
- A simulação de pagamento é **derivada do ambiente**: sem chave de provedor (`UNICO_API_KEY`) ela liga sozinha, porque é o único modo que funciona; com a chave, desliga. `SIMULAR_PAGAMENTO` sobrescreve os dois lados. Nunca condicione isso a `NODE_ENV`: na Vercel todo deploy é `production`.
- `/api/diagnostico` é público de propósito — ele existe para explicar por que a configuração não está funcionando, e seria inútil se exigisse a configuração funcionando. Nunca devolva valor de chave ali, só o prefixo.
- Cobrança no provedor e tokenização ainda são **simuladas**. Trechos marcados com `[INTEGRAÇÃO]` sinalizam onde entra o provedor de verdade. A chave PIX em `PIX_RECEBEDOR` é placeholder.
- Preço: R$ 99 de matrícula + R$ 150 de curso = R$ 249, cobrados juntos. `PRECO_CENTAVOS` é **derivado** de `COMPOSICAO_PRECO`; não escreva o total solto em lugar nenhum. Uma constraint no banco exige que `pagamentos.itens` feche com `valor_centavos`.
- O código PIX é montado em `lib/pix.ts`, nunca à mão. O payload EMV é TLV (tag, tamanho, valor): um tamanho errado desalinha o leitor, o app do banco não acha o valor e libera o pagador para digitar qualquer quantia. Foi exatamente esse o bug do código estático anterior.

## Fluxo de trabalho

Branch por tarefa, PR contra a `main`, template preenchido. Detalhes em `CONTRIBUTING.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
