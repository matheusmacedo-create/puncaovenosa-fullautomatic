-- Agenda dos lembretes de recuperação: 8 rodadas por dia, das 7h às 21h de
-- Brasília (10h, 12h, ..., 22h e 0h UTC), no minuto 7.
--
-- Mora no banco, e não no vercel.json, porque o plano Hobby da Vercel recusa
-- no deploy qualquer cron que rode mais de uma vez por dia. O pg_cron só
-- chama a rota (GET /api/lembretes/sync) pelo pg_net; quem decide quem
-- recebe o quê continua sendo lib/lembretes-regras.ts.
--
-- O segredo que autentica a chamada nasce aqui dentro, no Vault, e não sai:
-- o job o lê para montar o cabeçalho, e a rota o confere chamando
-- `segredo_dos_lembretes()`, que só a chave de serviço executa. Nenhum valor
-- fica neste arquivo nem precisa ser copiado para a Vercel.
--
-- Para trocar o segredo:
--   select vault.update_secret(id, encode(extensions.gen_random_bytes(32), 'hex'))
--     from vault.secrets where name = 'lembretes_segredo';
-- Para pausar os lembretes sem mexer em código:
--   select cron.unschedule('lembretes-de-recuperacao');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'lembretes_segredo',
                           'Autentica o pg_cron em GET /api/lembretes/sync. Ver migration 0018.')
 where not exists (select 1 from vault.secrets where name = 'lembretes_segredo');

create or replace function public.segredo_dos_lembretes()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'lembretes_segredo';
$$;

comment on function public.segredo_dos_lembretes is 'Segredo que o pg_cron manda a /api/lembretes/sync. Executavel so pela chave de servico.';

revoke all on function public.segredo_dos_lembretes() from public, anon, authenticated;
grant execute on function public.segredo_dos_lembretes() to service_role;

select cron.unschedule('lembretes-de-recuperacao')
 where exists (select 1 from cron.job where jobname = 'lembretes-de-recuperacao');

select cron.schedule(
  'lembretes-de-recuperacao',
  '7 0,10,12,14,16,18,20,22 * * *',
  $$
    select net.http_get(
      url := 'https://puncaovenosav1.cruzvermelhariodejaneiro.org/api/lembretes/sync',
      headers := jsonb_build_object('Authorization', 'Bearer ' || coalesce(public.segredo_dos_lembretes(), '')),
      -- A rodada espera entre um envio e outro; o padrão de 5s cortaria a
      -- conexão no meio dela.
      timeout_milliseconds := 150000
    );
  $$
);
