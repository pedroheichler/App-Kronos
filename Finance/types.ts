
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
}

export interface Investment {
  id: string;
  name: string;
  initialAmount: number;
  currentValue: number;
  type: 'Ações' | 'FIIs' | 'Renda Fixa' | 'Cripto' | 'Outros';
  date: string;
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
