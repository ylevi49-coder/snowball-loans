import { Loan } from "@/types";

export function calcMonthlyInterest(balance: number, annualRate: number): number {
  return (balance * annualRate) / 100 / 12;
}

export function calcMonthlyPayment(
  principal: number,
  annualRate: number,
  months: number
): number {
  if (annualRate === 0) return principal / months;
  const r = annualRate / 100 / 12;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

export function calcRemainingMonths(loan: Loan): number {
  if (loan.currentBalance <= 0) return 0;
  if (loan.monthlyPayment <= 0) return 999;

  const r = loan.annualInterestRate / 100 / 12;
  if (r === 0) return Math.ceil(loan.currentBalance / loan.monthlyPayment);

  const monthlyInterest = calcMonthlyInterest(loan.currentBalance, loan.annualInterestRate);
  if (loan.monthlyPayment <= monthlyInterest) return 999;

  return Math.ceil(
    Math.log(loan.monthlyPayment / (loan.monthlyPayment - loan.currentBalance * r)) /
      Math.log(1 + r)
  );
}

export function calcTotalInterest(loan: Loan): number {
  const months = calcRemainingMonths(loan);
  if (months >= 999) return 0;
  return loan.monthlyPayment * months - loan.currentBalance;
}

export function totalDebt(loans: Loan[]): number {
  return loans.filter((l) => l.status === "active").reduce((s, l) => s + l.currentBalance, 0);
}

export function totalMonthlyPayment(loans: Loan[]): number {
  return loans.filter((l) => l.status === "active").reduce((s, l) => s + l.monthlyPayment, 0);
}
