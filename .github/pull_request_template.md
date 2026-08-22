## O que muda

<!-- Uma ou duas frases: o que este PR faz e por quê. -->

## Etapas do funil afetadas

<!-- Marque o que foi tocado. -->

- [ ] Landing de vendas (`/`)
- [ ] Captura de dados (`/inscricao?etapa=dados`)
- [ ] Pagamento PIX ou cartão (`/inscricao?etapa=pagamento`)
- [ ] Confirmação (`/inscricao?etapa=confirmado`)
- [ ] Triagem (`/triagem/[step]`)
- [ ] Ficha do aluno / PWA (`/minha-inscricao`)
- [ ] Credencial de conferência (`/validar/[token]`)
- [ ] Design system (`app/globals.css`)
- [ ] Infra, CI ou documentação

## Como testar

1.
2.

## Checklist

- [ ] `pnpm typecheck` passa
- [ ] `pnpm build` passa
- [ ] Testado em viewport mobile
- [ ] Sem dados reais de aluno, chave PIX de produção ou credencial no diff
- [ ] Documentação atualizada, se o comportamento mudou

## Notas para quem revisa

<!-- Decisões, trade-offs, o que ficou de fora. -->
