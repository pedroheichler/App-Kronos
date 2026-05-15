import fs from 'fs';
import path from 'path';

const OUT = 'deploy';

// Limpa e recria a pasta deploy
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true });
fs.mkdirSync(OUT);

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

// Hub vai na raiz do deploy
copyDir('hub/dist', OUT);

// Os outros ficam em subpastas
copyDir('Finance/dist',  path.join(OUT, 'finance'));
copyDir('Treino/dist',   path.join(OUT, 'treino'));
copyDir('todolist/dist', path.join(OUT, 'todolist'));

console.log('✓ deploy/ pronto:');
console.log('  /          → Hub');
console.log('  /finance/  → Finance');
console.log('  /treino/   → Treino');
console.log('  /todolist/ → Todolist');
