
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE'
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: TransactionType;
  category: string;
  notes?: string;
  isRecurring?: boolean;
  /** Regra que gerou esta transação (quando veio de uma recorrência) */
  recurringRuleId?: string;
  installmentTotal?: number;
  installmentCurrent?: number;
}

/** Regra de recorrência: gera uma transação por mês automaticamente */
export interface RecurringRule {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: string;
  notes?: string;
  active: boolean;
}

export interface SpendingGoal {
  id: string;
  category: string;
  monthlyLimit: number;
}

export interface Investment {
  id: string;
  name: string;
  initialAmount: number;
  currentValue: number;
  type: 'Ações' | 'FIIs' | 'Renda Fixa' | 'Cripto' | 'Outros';
  date: string;
  cryptoId?: string;
  quantity?: number;
}

export interface DashboardSummary {
  totalIncome: number;
  totalExpenses: number;
  totalInvested: number;
  totalCurrentValue: number;
  totalProfit: number;
  profitPercentage: number;
  balance: number;
  monthlyExpenses: number;
  monthlyTrend: {
    value: string;
    isUp: boolean;
  };
}

export interface FinancialSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  totalInvestments: number;
}
