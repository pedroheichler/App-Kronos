import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function migrationSql() {
  const directory = path.join(root, 'supabase', 'migrations');
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => read(path.join('supabase', 'migrations', name)))
    .join('\n');
}

test('proxy de IA reconstrói requisições e aplica quota', () => {
  const proxy = read(path.join('supabase', 'functions', 'anthropic-proxy', 'index.ts'));
  assert.doesNotMatch(proxy, /Access-Control-Allow-Origin['"]?\s*:\s*['"]\*['"]/);
  assert.match(proxy, /consume_ai_quota/);
  assert.match(proxy, /MAX_REQUEST_BYTES/);
  assert.match(proxy, /OPERATIONS/);
  assert.match(proxy, /JSON\.stringify\(safeRequest\.body\)/);
  assert.doesNotMatch(proxy, /body:\s*await req\.text\(\)/);
});

test('SDKs de IA não são enviados ao navegador', () => {
  const packageJson = JSON.parse(read(path.join('Treino', 'package.json')));
  assert.equal(packageJson.dependencies?.['@anthropic-ai/sdk'], undefined);
  assert.equal(packageJson.dependencies?.['@google/genai'], undefined);
});

test('respostas da IA são renderizadas sem injeção de HTML', () => {
  const chat = read(path.join('Treino', 'src', 'components', 'AIChat.tsx'));
  assert.doesNotMatch(chat, /dangerouslySetInnerHTML/);
  assert.match(chat, /<MarkdownMessage text=\{msg\.text\} \/>/);
});

test('todas as tabelas do domínio têm RLS habilitado', () => {
  const sql = migrationSql().toLowerCase();
  const tables = [
    'transactions', 'spending_goals', 'investments', 'recurring_rules',
    'squads', 'squad_members', 'workout_days', 'exercises', 'exercise_progress',
    'profiles', 'tracked_exercises', 'exercise_loads', 'set_logs',
    'tasks', 'projects', 'habits', 'habit_completions', 'boards', 'board_items',
    'water_intake', 'meals', 'diet_settings', 'meal_slots', 'favorite_meals',
    'body_weight', 'body_measurements', 'ai_usage_daily',
  ];

  for (const table of tables) {
    assert.match(
      sql,
      new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`),
      `RLS ausente em ${table}`,
    );
  }
});

test('funções SECURITY DEFINER fixam search_path vazio', () => {
  const sql = migrationSql().toLowerCase();
  const definitions = sql.match(/^\s*security definer\s*$/gm) ?? [];
  const hardened = sql.match(/^\s*security definer\s*$[\s\S]{0,160}?^\s*set search_path = ''\s*$/gm) ?? [];
  assert.equal(hardened.length, definitions.length);
  assert.doesNotMatch(sql, /set search_path = public/);
});

test('deploy inclui headers de segurança e proteção de arquivos', () => {
  const htaccess = read(path.join('hosting', '.htaccess'));
  const deploy = read('deploy.mjs');
  assert.match(htaccess, /Strict-Transport-Security/);
  assert.match(htaccess, /Content-Security-Policy/);
  assert.match(htaccess, /frame-ancestors 'none'/);
  assert.match(htaccess, /X-Content-Type-Options "nosniff"/);
  assert.match(deploy, /hosting.*\.htaccess/);
});

test('arquivos de ambiente são ignorados, exceto exemplos', () => {
  const gitignore = read('.gitignore');
  assert.match(gitignore, /^\.env\*/m);
  assert.match(gitignore, /^!\.env\.example/m);
});
