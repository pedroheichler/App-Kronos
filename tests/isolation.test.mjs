/**
 * Isolamento entre usuários — prova que o RLS separa os dados de verdade.
 *
 * Os outros testes verificam que o RLS está *habilitado*, o que não é a mesma
 * coisa: uma policy mal escrita (`using (true)`) deixa a tabela habilitada e
 * aberta. Foi exatamente esse o caso da tabela `squads`, que ficou legível por
 * qualquer um até ser corrigida.
 *
 * Aqui criamos dois usuários reais, gravamos dados com o usuário A e tentamos
 * ler, alterar e apagar com o usuário B.
 *
 * Precisa de credenciais para rodar (nunca versionadas):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * Sem elas o teste é pulado — por isso não quebra o CI.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

/** Lê VITE_SUPABASE_* do .env local como fallback (URL e chave anônima) */
function fromEnvFile(key) {
  const file = path.join(root, 'Treino', '.env');
  if (!fs.existsSync(file)) return undefined;
  const line = fs.readFileSync(file, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`));
  return line?.slice(key.length + 1).trim().replace(/^["']|["']$/g, '');
}

const URL = process.env.SUPABASE_URL ?? fromEnvFile('VITE_SUPABASE_URL');
const ANON = process.env.SUPABASE_ANON_KEY ?? fromEnvFile('VITE_SUPABASE_ANON_KEY');
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CREDENCIAIS_OK = Boolean(URL && ANON && SERVICE);
const SUFIXO = Date.now().toString(36);

async function api(pathname, { method = 'GET', token, body, prefer } = {}) {
  const headers = { apikey: ANON, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (prefer) headers.Prefer = prefer;

  const response = await fetch(`${URL}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

async function admin(pathname, { method = 'GET', body } = {}) {
  const response = await fetch(`${URL}${pathname}`, {
    method,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

async function criarUsuario(rotulo) {
  const email = `iso-${rotulo}-${SUFIXO}@kronos.test`;
  const password = `Isolamento!${SUFIXO}`;
  const criado = await admin('/auth/v1/admin/users', {
    method: 'POST',
    body: { email, password, email_confirm: true },
  });
  assert.ok(criado.data?.id, `não foi possível criar o usuário ${rotulo}`);

  const sessao = await api('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password },
  });
  assert.ok(sessao.data?.access_token, `não foi possível autenticar ${rotulo}`);

  return { id: criado.data.id, token: sessao.data.access_token };
}

const removerUsuario = (id) => admin(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });

test('um usuário não acessa os dados de outro', { concurrency: false }, async (t) => {
  if (!CREDENCIAIS_OK) {
    t.skip('defina SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY para rodar');
    return;
  }

  const a = await criarUsuario('a');
  const b = await criarUsuario('b');

  try {
    // ── A grava dados em tabelas de domínios diferentes ──
    const hoje = new Date().toISOString().slice(0, 10);

    const criados = {};
    const inserir = async (tabela, registro) => {
      const { status, data } = await api(`/rest/v1/${tabela}`, {
        method: 'POST',
        token: a.token,
        prefer: 'return=representation',
        body: { user_id: a.id, ...registro },
      });
      assert.equal(status, 201, `A não conseguiu gravar em ${tabela}`);
      criados[tabela] = data[0].id;
    };

    await inserir('meals', { date: hoje, name: 'Segredo do A', calories: 999 });
    await inserir('body_weight', { date: hoje, weight: 77.7 });
    await inserir('water_intake', { date: hoje, ml: 250 });
    await inserir('favorite_meals', { name: 'Favorito do A', calories: 123 });
    await inserir('transactions', { title: 'Salário do A', amount: 4321, type: 'income', category: 'Receitas' });

    // ── B tenta LER ──
    for (const [tabela, id] of Object.entries(criados)) {
      const { data } = await api(`/rest/v1/${tabela}?id=eq.${id}&select=id`, { token: b.token });
      assert.deepEqual(data, [], `B conseguiu LER a linha de A em ${tabela}`);
    }

    // ── B tenta ALTERAR ──
    for (const [tabela, id] of Object.entries(criados)) {
      const { data } = await api(`/rest/v1/${tabela}?id=eq.${id}`, {
        method: 'PATCH',
        token: b.token,
        prefer: 'return=representation',
        body: { user_id: b.id },
      });
      assert.deepEqual(data, [], `B conseguiu ALTERAR a linha de A em ${tabela}`);
    }

    // ── B tenta APAGAR ──
    for (const [tabela, id] of Object.entries(criados)) {
      await api(`/rest/v1/${tabela}?id=eq.${id}`, { method: 'DELETE', token: b.token });
      const restou = await admin(`/rest/v1/${tabela}?id=eq.${id}&select=id`);
      assert.equal(restou.data.length, 1, `B conseguiu APAGAR a linha de A em ${tabela}`);
    }

    // ── A continua enxergando o que é dele ──
    for (const [tabela, id] of Object.entries(criados)) {
      const { data } = await api(`/rest/v1/${tabela}?id=eq.${id}&select=id`, { token: a.token });
      assert.equal(data.length, 1, `A perdeu acesso aos próprios dados em ${tabela}`);
    }
  } finally {
    await removerUsuario(a.id);
    await removerUsuario(b.id);
  }
});

test('squad de um usuário não aparece para outro', { concurrency: false }, async (t) => {
  if (!CREDENCIAIS_OK) {
    t.skip('defina as credenciais do Supabase para rodar');
    return;
  }

  const a = await criarUsuario('sq-a');
  const b = await criarUsuario('sq-b');

  try {
    // O app cria um espaço pessoal para quem não tem squad
    const criado = await api('/rest/v1/squads', {
      method: 'POST',
      token: a.token,
      prefer: 'return=representation',
      body: { name: 'Squad do A', created_by: a.id, is_personal: true },
    });
    assert.equal(criado.status, 201, 'A não conseguiu criar o squad');
    const squadId = criado.data[0].id;

    await api('/rest/v1/squad_members', {
      method: 'POST',
      token: a.token,
      body: { squad_id: squadId, user_id: a.id, role: 'admin' },
    });

    // B não pode listar squads nem alcançar o de A pelo id
    const listagem = await api('/rest/v1/squads?select=id,invite_code', { token: b.token });
    assert.deepEqual(listagem.data, [], 'B conseguiu listar squads de outros');

    const direto = await api(`/rest/v1/squads?id=eq.${squadId}&select=id`, { token: b.token });
    assert.deepEqual(direto.data, [], 'B alcançou o squad de A pelo id');

    // B também não entra sozinho na equipe de A
    const membro = await api('/rest/v1/squad_members', {
      method: 'POST',
      token: b.token,
      prefer: 'return=representation',
      body: { squad_id: squadId, user_id: b.id, role: 'member' },
    });
    assert.notEqual(membro.status, 201, 'B conseguiu se inserir no squad de A');
  } finally {
    await removerUsuario(a.id);
    await removerUsuario(b.id);
  }
});
