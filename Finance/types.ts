
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
  value: number;
  type: 'Ações' | 'FIIs' | 'Renda Fixa' | 'Cripto' | 'Outros';
  change: number; // Percentual de variação
}

export interface FinancialSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  totalInvestments: number;
}
