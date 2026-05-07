export type LoanStatus = "active" | "paid" | "frozen" | "grace";
export type PayoffStrategy = "snowball" | "avalanche" | "manual";
export type PaymentRowStatus = "regular" | "grace" | "interest-only" | "skip";
export type RateType = "fixed" | "variable" | "prime" | "cpi";

export interface Loan {
  id: string;
  name: string;
  originalAmount: number;
  currentBalance: number;
  annualInterestRate: number;
  monthlyPayment: number;
  status: LoanStatus;
  priority: number;
  startDate: string;
  notes?: string;
  rateType?: RateType;
  rateMin?: number;
  rateMax?: number;
  rateAvg?: number;
  importedSchedule?: ImportedPaymentRow[];
}

export interface ImportedPaymentRow {
  date?: string;
  payment?: number;
  principal?: number;
  interest?: number;
  balance?: number;
  annualRate?: number;
}

export interface AmortizationRow {
  month: number;
  date: string;
  openingBalance: number;
  payment: number;
  principal: number;
  interest: number;
  closingBalance: number;
  extraPayment: number;
  status: PaymentRowStatus;
  notes?: string;
  annualRate?: number;
}

export interface LoanSimResult {
  loanId: string;
  loanName: string;
  paidOffMonth: number;
  totalInterest: number;
  totalPaid: number;
  monthlyRows: SimMonthRow[];
}

export interface SimMonthRow {
  month: number;
  date: string;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
  isExtra: boolean;
}

export interface PayoffPlan {
  strategy: PayoffStrategy | "baseline";
  loanResults: LoanSimResult[];
  monthlyActions: MonthlyAction[];
  totalInterest: number;
  totalMonths: number;
  totalPaid: number;
  payoffDate: string;
}

export interface MonthlyAction {
  month: number;
  date: string;
  actions: ActionItem[];
  totalPayment: number;
  freedAmount: number;
  activeLoans: string[];
}

export interface ActionItem {
  loanId: string;
  loanName: string;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
  isExtra: boolean;
  note?: string;
}

export interface ScenarioResult {
  name: string;
  label: string;
  strategy: PayoffStrategy | "baseline";
  totalInterest: number;
  totalMonths: number;
  totalPaid: number;
  payoffDate: string;
  savingsVsBaseline: number;
  monthsSavedVsBaseline: number;
}

export interface ColumnMapping {
  name?: string;
  originalAmount?: string;
  currentBalance?: string;
  annualInterestRate?: string;
  monthlyInterestAmount?: string;
  monthlyPayment?: string;
  principalAmount?: string;
  paymentDate?: string;
  status?: string;
  priority?: string;
  startDate?: string;
  notes?: string;
}

export interface VariableRateAnalysis {
  isVariable: boolean;
  isAmortizationTable: boolean;
  avgRate: number;
  minRate: number;
  maxRate: number;
  rateSpread: number;
  rowCount: number;
}

export interface ImportPreview {
  headers: string[];
  sampleRows: string[][];
  suggestedMapping: ColumnMapping;
  confidence: number;
  explanation: string;
  variableRateAnalysis?: VariableRateAnalysis;
}

export interface AppState {
  loans: Loan[];
  extraMonthlyPayment: number;
  strategy: PayoffStrategy;
  manualOrder: string[];
}
