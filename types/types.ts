export interface Account {
  id: number;
  name: string;
  type: string;
  current_balance: number;
}

export interface Category {
  id: number;
  name: string;
  type: string;
}

export interface Transaction {
  id: number;
  amount: number;
  type: 'income' | 'expense';
  description: string;
  account_id: number;
  category_id: number;
  date: string;
  category?: string; 
  account?: string;
}