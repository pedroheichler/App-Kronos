/**
 * Modo treino em andamento — garante que as peças continuam ligadas.
 *
 * O ponto crítico é o offline: se alguma escrita voltar a chamar o Supabase
 * direto, ela falha em silêncio na academia sem sinal e o treino se perde.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function migracoes() {
  const dir = path.join(root, 'supabase', 'migrations');
  return fs.readdirSync(dir)
    .filter((n) => n.endsWith('.sql'))
    .sort()
    .map((n) => read(path.join('supabase', 'migrations', n)))
    .join('\n');
}

test('esquema cobre RPE, exercício pulado e sessão de treino', () => {
  const sql = migracoes();
  assert.match(sql, /alter table public\.set_logs\s+add column if not exists rpe/);
  assert.match(sql, /rpe between 1 and 10/);
  assert.match(sql, /alter table public\.exercise_progress\s+add column if not exists skipped/);
  assert.match(sql, /create table if not exists public\.workout_sessions/);
  // Duas sessões abertas ao mesmo tempo bagunçariam a duração
  assert.match(sql, /workout_sessions_uma_aberta/);
});

test('escritas do treino passam pela fila offline', () => {
  const app = read(path.join('Treino', 'src', 'App.tsx'));

  // As duas escritas do modo treino têm de usar a fila
  assert.match(app, /enfileirar\(\{\s*tipo: 'set_log'/);
  assert.match(app, /enfileirar\(\{\s*tipo: 'exercise_progress'/);

  // E não podem voltar a gravar direto, senão falham em silêncio sem rede
  assert.doesNotMatch(app, /from\('set_logs'\)\s*\.upsert/);
  assert.doesNotMatch(app, /from\('exercise_progress'\)\s*\.upsert/);
});

test('fila offline deduplica, persiste e tem limite de tentativas', () => {
  const fila = read(path.join('Treino', 'src', 'services', 'offlineQueue.ts'));

  assert.match(fila, /localStorage/);
  assert.match(fila, /MAX_TENTATIVAS/);
  // Reeditar a mesma série offline não pode gerar vários envios
  assert.match(fila, /fila\.filter\(item => !\(item\.tipo === op\.tipo && item\.chave === op\.chave\)\)/);
  // Precisa reagir à volta da conexão
  assert.match(fila, /addEventListener\('online'/);
});

test('service worker é gerado para o app abrir sem internet', () => {
  const config = read(path.join('Treino', 'vite.config.ts'));
  assert.match(config, /VitePWA/);
  assert.match(config, /navigateFallback/);

  const dist = path.join(root, 'Treino', 'dist');
  if (fs.existsSync(dist)) {
    assert.ok(fs.existsSync(path.join(dist, 'sw.js')), 'sw.js não foi gerado no build');
    assert.ok(
      fs.existsSync(path.join(dist, 'manifest.webmanifest')),
      'manifest.webmanifest não foi gerado no build'
    );
  }
});

test('index.html não declara dois manifests', () => {
  const html = read(path.join('Treino', 'index.html'));
  const manifests = html.match(/rel="manifest"/g) ?? [];
  assert.equal(manifests.length, 0, 'o manifest deve vir apenas do vite-plugin-pwa');
});
