<div align="center">

# ⚡ Kronos

https://kronos-app.online/

**Plataforma pessoal de produtividade e saúde**

Cinco aplicativos integrados em um só lugar: finanças, treino, dieta, tarefas e um hub central.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)
![Claude](https://img.shields.io/badge/Feito%20com-Claude-D97757?logo=anthropic&logoColor=white)

</div>

---

## 🤖 Sobre o desenvolvimento

Este projeto foi desenvolvido **com o apoio de inteligência artificial** — especificamente o **Claude**, da Anthropic, através do Claude Code.

A IA atuou como par de programação ao longo de todo o processo: arquitetura dos apps, escrita de componentes, modelagem do banco de dados, revisão de segurança e refatorações. Cada funcionalidade foi pensada, testada e validada por mim — a IA acelerou a execução, não substituiu as decisões.

Além disso, o Claude também **roda dentro do produto**: é ele quem analisa as fotos de refeição na Dieta e conversa no chat de treino.

---

## 📱 Os aplicativos

### 🏠 Hub
Porta de entrada da plataforma. Login, cadastro, recuperação de senha e seletor de apps. A sessão é compartilhada entre todos os apps — você loga uma vez só.

### 💰 Finance
Controle financeiro completo.
- Receitas e despesas por categoria, com notas
- **Transações recorrentes** (salário, aluguel) inseridas automaticamente todo mês
- **Parcelamentos** distribuídos nos meses seguintes
- **Limites de gastos** por categoria com barra de progresso
- **Portfólio de investimentos** com **cotação de cripto ao vivo** (CoinGecko)
- Gráficos de distribuição e filtro por categoria
- **Tema claro/escuro** e opção de **esconder saldos**
- Navegação mobile dedicada com barra inferior

### 🏋️ Treino
Gestão de treinos individual ou em squad.
- Plano semanal com exercícios, séries, repetições e descanso
- **Squad** com código de convite e ranking de sequência
- Marcação de séries, cronômetro de descanso e histórico de cargas
- Contador de **sequência (streak)** com marcos
- **Chat com IA** que monta e aplica treinos direto no app

### 🍎 Dieta
Hidratação e alimentação.
- Meta diária de água com **anel de progresso animado**
- Registro rápido (copo, garrafa, litro) e histórico dos últimos 7 dias
- Refeições com calorias, carboidratos e proteína
- **Análise por foto com IA**: fotografe o prato e os macros são preenchidos automaticamente

### ✅ Todolist
Tarefas, hábitos e projetos.

---

## 🛠️ Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Estilo | Tailwind CSS v4 |
| Backend | Supabase (Auth, Postgres, Storage, Edge Functions) |
| Ícones | Lucide |
| Gráficos | Recharts |
| Animações | Motion |
| IA | Claude (Anthropic) |

---

## 🔐 Segurança

- **Row Level Security (RLS)** em todas as tabelas — cada usuário só acessa os próprios dados
- A **chave da API da Anthropic nunca chega ao navegador**: as chamadas passam por uma *Edge Function* (`anthropic-proxy`) que guarda a chave como secret no servidor e valida o JWT do usuário
- Variáveis de ambiente fora do controle de versão
- Escape de HTML nas respostas da IA (proteção contra XSS)

---

## 🚀 Rodando localmente

**Pré-requisitos:** Node.js 18+ e uma conta no Supabase.

```bash
# 1. Clone e instale
git clone https://github.com/pedroheichler/App-Kronos.git
cd App-Kronos
npm install

# 2. Instale as dependências de cada app
for app in hub Finance Treino todolist Dieta; do
  npm install --prefix $app
done

# 3. Configure as variáveis de ambiente
# Crie um .env dentro de cada pasta de app com:
#   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
#   VITE_SUPABASE_ANON_KEY=sua-chave-anon

# 4. Rode tudo de uma vez
npm run dev
```

### Scripts disponíveis

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe os 5 apps simultaneamente |
| `npm run dev:hub` | Só o Hub |
| `npm run dev:finance` | Só o Finance |
| `npm run dev:treino` | Só o Treino (porta 3000) |
| `npm run dev:todo` | Só o Todolist (porta 3003) |
| `npm run dev:dieta` | Só a Dieta (porta 3004) |
| `npm run build` | Build de produção de todos |
| `npm run deploy` | Build + monta a pasta `deploy/` pronta pra publicar |

---

## 📁 Estrutura

```
App-Kronos/
├── hub/            → entrada, auth e seletor de apps
├── Finance/        → controle financeiro
├── Treino/         → treinos e squad
├── Dieta/          → hidratação e refeições
├── todolist/       → tarefas
├── supabase/
│   └── functions/
│       └── anthropic-proxy/   → proxy seguro para a API da Anthropic
└── deploy.mjs      → junta os builds em deploy/
```

Depois do `npm run deploy`, a pasta `deploy/` fica assim:

```
/            → Hub
/finance/    → Finance
/treino/     → Treino
/dieta/      → Dieta
/todolist/   → Todolist
```

---

## 🎨 Design

Interface *dark premium* minimalista, inspirada no Raycast. Paleta base: fundo `#0A0A0A`, superfícies `#111111`, bordas `#1F1F1F`. O Finance também tem tema claro opcional.

---

<div align="center">
<sub>Projeto pessoal • Desenvolvido com Claude 🤖</sub>
</div>
