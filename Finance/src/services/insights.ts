import { Transaction, Investment, TransactionType } from "../../types";

export async function getFinancialInsights(
  transactions: Transaction[],
  investments: Investment[]
): Promise<string> {
  const totalIncome = transactions
    .filter((t) => t.type === TransactionType.INCOME)
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === TransactionType.EXPENSE)
    .reduce((acc, t) => acc + t.amount, 0);

  const balance = totalIncome - totalExpenses;
  const totalInvested = investments.reduce((acc, i) => acc + i.initialAmount, 0);
  const totalCurrentValue = investments.reduce((acc, i) => acc + i.currentValue, 0);
  const profit = totalCurrentValue - totalInvested;
  const profitPct = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

  const categoryTotals: Record<string, number> = {};
  transactions
    .filter((t) => t.type === TransactionType.EXPENSE)
    .forEach((t) => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];

  const lines: string[] = [];

  if (balance >= 0) {
    lines.push(`✅ Seu saldo está positivo em R$ ${balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`);
  } else {
    lines.push(`⚠️ Seus gastos superam os ganhos em R$ ${Math.abs(balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Atenção!`);
  }

  if (topCategory) {
    lines.push(`📊 Sua maior categoria de gasto é "${topCategory[0]}" com R$ ${topCategory[1].toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`);
  }

  if (totalInvested > 0) {
    const emoji = profitPct >= 0 ? "📈" : "📉";
    lines.push(`${emoji} Seus investimentos renderam ${profitPct >= 0 ? "+" : ""}${profitPct.toFixed(1)}% (R$ ${profit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).`);
  }

  if (totalIncome > 0) {
    const savingsRate = ((totalIncome - totalExpenses) / totalIncome) * 100;
    if (savingsRate >= 20) {
      lines.push(`💰 Ótima taxa de poupança: ${savingsRate.toFixed(0)}% da sua renda está sobrando.`);
    } else if (savingsRate > 0) {
      lines.push(`💡 Você está poupando ${savingsRate.toFixed(0)}% da renda. Tente chegar a 20%.`);
    }
  }

  return lines.join("\n\n") || "Adicione mais dados para insights mais precisos.";
}
