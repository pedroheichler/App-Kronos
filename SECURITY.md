# Segurança do Kronos

## Arquitetura

- O navegador usa apenas a chave pública `VITE_SUPABASE_ANON_KEY`.
- A chave `ANTHROPIC_API_KEY` existe somente nos secrets da Edge Function.
- O proxy de IA aceita três operações conhecidas, reconstrói a requisição no servidor e reserva quota no Postgres antes de chamar a Anthropic.
- Todas as tabelas têm RLS. Dados pessoais usam `auth.uid()`; dados de squad só são compartilhados entre membros da mesma equipe.
- Os buckets públicos servem apenas imagens e restringem escrita ao caminho do usuário ou a admins do squad.

## Configuração obrigatória em produção

Configure os secrets da função:

```bash
supabase secrets set \
  ANTHROPIC_API_KEY=... \
  ALLOWED_ORIGINS=https://kronos-app.online \
  AI_DAILY_REQUEST_LIMIT=60 \
  AI_DAILY_TOKEN_LIMIT=50000
```

No painel Supabase Auth, mantenha:

- confirmação de e-mail habilitada;
- senha mínima de 10 caracteres;
- troca segura de senha habilitada;
- redirects limitados a `https://kronos-app.online/**`;
- CAPTCHA habilitado quando as chaves do Turnstile/hCaptcha estiverem configuradas.

O `config.toml` aplica equivalentes no ambiente local, mas configurações de Auth hospedado devem ser confirmadas no painel.

## Deploy seguro

`npm run deploy` inclui `hosting/.htaccess` na raiz de `deploy/`. Depois de publicar, valide:

```bash
curl -I https://kronos-app.online/
```

A resposta deve conter CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy` e proteção contra frames.

## Verificações

```bash
npm run check
npm run security:audit
```

O CI executa ambos em cada pull request. O Dependabot acompanha os cinco lockfiles.

### Isolamento entre usuários

`tests/isolation.test.mjs` cria dois usuários reais e verifica que um não
consegue ler, alterar nem apagar os dados do outro — inclusive entrar no squad
alheio. Os demais testes só conferem que o RLS está *habilitado*, o que não
prova isolamento: uma policy `using (true)` deixa a tabela habilitada e aberta.

Precisa de credenciais e por isso é **pulado no CI**. Para rodar localmente:

```bash
SUPABASE_SERVICE_ROLE_KEY=<service_role> node --test tests/isolation.test.mjs
```

A URL e a chave anônima são lidas de `Treino/.env` quando não estão no ambiente.
A chave de service role **nunca** deve ir para arquivo versionado.

> Foi esse teste que revelou que qualquer usuário autenticado conseguia se
> inserir em `squad_members` sabendo apenas o id do squad, sem código de
> convite — corrigido em `20260816000000_squad_members_rls.sql`.

## Migrações e RLS

O arquivo `20260706000000_base_schema.sql` permite reconstruir o projeto do zero. Antes de aplicar em um banco existente, gere um backup e confira a lista:

```bash
supabase migration list
supabase db push --dry-run
```

Para uma auditoria completa de isolamento, use duas contas de teste: a conta A não deve conseguir selecionar, atualizar ou apagar nenhum ID pertencente à conta B.

## Relato de vulnerabilidades

Não abra uma issue pública com tokens, dados de usuários ou passos de exploração contra produção. Revogue imediatamente qualquer credencial que possa ter sido exposta e envie o relato de forma privada ao mantenedor.
