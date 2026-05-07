import { Loan, AmortizationRow } from "@/types";
import { calcMonthlyInterest } from "./loanEngine";
import { addMonths } from "./utils";

export function generateSchedule(loan: Loan, startDate?: string): AmortizationRow[] {
  const rows: AmortizationRow[] = [];
  let balance = loan.currentBalance;
  const date = startDate || loan.startDate;
  let month = 1;
  const maxMonths = 600;

  while (balance > 0.01 && month <= maxMonths) {
    const openingBalance = balance;
    const interest = calcMonthlyInterest(balance, loan.annualInterestRate);
    const payment = Math.min(loan.monthlyPayment, balance + interest);
    const principal = payment - interest;
    const closingBalance = Math.max(0, balance - principal);

    rows.push({
      month,
      date: addMonths(date, month - 1),
      openingBalance,
      payment,
      principal,
      interest,
      closingBalance,
      extraPayment: 0,
      status: "regular",
      annualRate: loan.annualInterestRate,
    });

    balance = closingBalance;
    month++;
  }

  return rows;
}

export function recalculateFromRow(
  rows: AmortizationRow[],
  fromIndex: number,
  annualRate: number
): AmortizationRow[] {
  const updated = [...rows];
  let balance = updated[fromIndex].openingBalance;

  for (let i = fromIndex; i < updated.length; i++) {
    const row = updated[i];
    const interest = calcMonthlyInterest(balance, annualRate);
    const extra = row.extraPayment || 0;
    const totalPayment = Math.min(row.payment + extra, balance + interest);
    const principal = totalPayment - interest;
    const closingBalance = Math.max(0, balance - principal);

    updated[i] = {
      ...row,
      openingBalance: balance,
      interest,
      principal,
      payment: totalPayment - extra,
      closingBalance,
      annualRate,
    };

    balance = closingBalance;
    if (balance < 0.01) {
      return updated.slice(0, i + 1);
    }
  }

  return updated;
}
