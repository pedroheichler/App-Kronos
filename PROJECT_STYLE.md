# PROJECT_STYLE.md
# Design system do Kronos. Edite à vontade.
# Gerado em: 2026-04-05

## Projeto
name: Kronos
description: Plataforma com três apps (Hub, Finance, Treino) para controle financeiro e de treinos — uso pessoal e em squad
tone: minimalista, dark premium, clean — inspirado no Raycast

## Stack
framework: React + Vite
typescript: sim
component_library: nenhuma
icons: Lucide
animations: Framer Motion

## Cores
primary: "#8b5cf6"
primary_hover: "#7c3aed"
background: "#0A0A0A"
surface: "#111111"
surface_hover: "#161616"
border: "#1F1F1F"
text_primary: "#E8E8E8"
text_secondary: "#616161"
accent: "#8b5cf6"
success: "#4ade80"
error: "#f87171"
warning: "#fbbf24"

## Dark Mode
dark_mode: dark_only

## Tipografia
font_heading: "Inter — sistema"
font_body: "Inter — sistema"
font_mono: "JetBrains Mono — sistema"

## Layout & Tokens
border_radius: modern
# Cards/painéis: rounded-xl (12px)
# Modais: rounded-2xl (16px)
# Botões: rounded-lg (8px)
# Badges: rounded-full

density: balanced

## Paleta semântica Finance
# Receita/ganho:  text-green-400  bg-green-400/10
# Despesa/gasto:  text-rose-400   bg-rose-400/10
# Investimento:   text-violet-400 bg-violet-400/10
# Saldo:          text-sky-400    bg-sky-400/10

## Componentes Específicos do Domínio
# DashboardCard: título muted em cima, valor grande em baixo, ícone pequeno sem fundo colorido
# TransactionRow: ícone colorido small + descrição + valor alinhado à direita
# InvestmentCard: nome + tipo + valores investido/atual + barra de lucro/prejuízo
# ExerciseItem: checkbox redondo + nome + sets/reps/descanso em muted
# SquadMember: avatar + nome + badge de role
