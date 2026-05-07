import { Loan, PayoffPlan, LoanSimResult, MonthlyAction, ActionItem, SimMonthRow, PayoffStrategy } from "@/types";
import { calcMonthlyInterest } from "./loanEngine";
import { addMonths, today } from "./utils";

interface LoanState {
  loan: Loan;
  balance: number;
  paidOff: boolean;
  paidOffMonth: number;
  totalInterest: number;
  totalPaid: number;
  rows: SimMonthRow[];
}

function sortLoans(loans: Loan[], strategy: PayoffStrategy | "baseline", manualOrder: string[]): Loan[] {
  const active = loans.filter((l) => l.status === "active");
  if (strategy === "snowball") {
    return [...active].sort((a, b) => a.currentBalance - b.currentBalance);
  }
  if (strategy === "avalanche") {
    return [...active].sort((a, b) => b.annualInterestRate - a.annualInterestRate);
  }
  if (strategy === "manual") {
    return [...active].sort((a, b) => {
      const ia = manualOrder.indexOf(a.id);
      const ib = manualOrder.indexOf(b.id);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }
  return active;
}

export function runPayoffSimulation(
  loans: Loan[],
  extraMonthly: number,
  strategy: PayoffStrategy,
  manualOrder: string[] = []
): PayoffPlan {
  const sorted = sortLoans(loans, strategy, manualOrder);
  return simulate(sorted, extraMonthly, strategy);
}

export function runBaselineSimulation(loans: Loan[]): PayoffPlan {
  // בסיס אמיתי: כל הלוואה משלמת את המינימום שלה עצמאית — אין ניתוב מחדש של תשלומים משוחררים
  const active = loans.filter((l) => l.status === "active");
  if (active.length === 0) {
    return { strategy: "baseline", loanResults: [], monthlyActions: [], totalInterest: 0, totalMonths: 0, totalPaid: 0, payoffDate: today() };
  }

  const states: LoanState[] = active.map((loan) => ({
    loan,
    balance: loan.currentBalance,
    paidOff: false,
    paidOffMonth: 0,
    totalInterest: 0,
    totalPaid: 0,
    rows: [],
  }));

  const monthlyActions: MonthlyAction[] = [];
  const startDate = today();
  let month = 1;
  const maxMonths = 600;

  while (states.some((s) => !s.paidOff) && month <= maxMonths) {
    const date = addMonths(startDate, month - 1);
    const actions: ActionItem[] = [];

    for (const state of states) {
      if (state.paidOff) continue;
      const interest = calcMonthlyInterest(state.balance, state.loan.annualInterestRate);
      let payment = Math.min(state.loan.monthlyPayment, state.balance + interest);
      const principal = Math.max(0, payment - interest);
      const newBalance = Math.max(0, state.balance - principal);

      state.totalInterest += interest;
      state.totalPaid += payment;
      state.rows.push({ month, date, payment, principal, interest, balance: newBalance, isExtra: false });

      const paidOffNow = newBalance < 0.01;
      if (paidOffNow) { state.paidOff = true; state.paidOffMonth = month; }
      state.balance = newBalance;

      actions.push({ loanId: state.loan.id, loanName: state.loan.name, payment, principal, interest, balance: newBalance, isExtra: false, note: paidOffNow ? "שולם במלואו!" : undefined });
    }

    monthlyActions.push({ month, date, actions, totalPayment: actions.reduce((s, a) => s + a.payment, 0), freedAmount: 0, activeLoans: states.filter((s) => !s.paidOff).map((s) => s.loan.id) });
    month++;
  }

  const loanResults: LoanSimResult[] = states.map((s) => ({
    loanId: s.loan.id, loanName: s.loan.name, paidOffMonth: s.paidOffMonth,
    totalInterest: Math.round(s.totalInterest * 100) / 100,
    totalPaid: Math.round(s.totalPaid * 100) / 100,
    monthlyRows: s.rows,
  }));

  const totalMonths = Math.max(...states.map((s) => s.paidOffMonth));
  const totalInterest = loanResults.reduce((s, r) => s + r.totalInterest, 0);
  const totalPaid = loanResults.reduce((s, r) => s + r.totalPaid, 0);

  return {
    strategy: "baseline",
    loanResults,
    monthlyActions,
    totalInterest: Math.round(totalInterest),
    totalMonths,
    totalPaid: Math.round(totalPaid),
    payoffDate: addMonths(startDate, totalMonths),
  };
}

function simulate(
  sorted: Loan[],
  extraMonthly: number,
  strategy: PayoffStrategy | "baseline"
): PayoffPlan {
  if (sorted.length === 0) {
    return {
      strategy,
      loanResults: [],
      monthlyActions: [],
      totalInterest: 0,
      totalMonths: 0,
      totalPaid: 0,
      payoffDate: today(),
    };
  }

  const states: LoanState[] = sorted.map((loan) => ({
    loan,
    balance: loan.currentBalance,
    paidOff: false,
    paidOffMonth: 0,
    totalInterest: 0,
    totalPaid: 0,
    rows: [],
  }));

  const monthlyActions: MonthlyAction[] = [];
  const startDate = today();
  let month = 1;
  const maxMonths = 600;
  let freedPayment = 0;

  while (states.some((s) => !s.paidOff) && month <= maxMonths) {
    const date = addMonths(startDate, month - 1);
    const actions: ActionItem[] = [];
    const extraAtMonthStart = extraMonthly + freedPayment;
    let extra = extraAtMonthStart;

    for (const state of states) {
      if (state.paidOff) continue;

      const interest = calcMonthlyInterest(state.balance, state.loan.annualInterestRate);
      let payment = state.loan.monthlyPayment;

      // Apply extra to the first unpaid loan in priority order
      const isFirst = states.find((s) => !s.paidOff) === state;
      const usedExtra = isFirst && extra > 0;
      if (usedExtra) {
        payment += extra;
        extra = 0;
      }

      payment = Math.min(payment, state.balance + interest);
      const principal = Math.max(0, payment - interest);
      const newBalance = Math.max(0, state.balance - principal);

      state.totalInterest += interest;
      state.totalPaid += payment;
      state.rows.push({
        month,
        date,
        payment,
        principal,
        interest,
        balance: newBalance,
        isExtra: usedExtra,
      });

      const paidOffNow = newBalance < 0.01;
      if (paidOffNow) {
        state.paidOff = true;
        state.paidOffMonth = month;
        freedPayment += state.loan.monthlyPayment;
      }

      state.balance = newBalance;

      actions.push({
        loanId: state.loan.id,
        loanName: state.loan.name,
        payment,
        principal,
        interest,
        balance: newBalance,
        isExtra: usedExtra,
        note: paidOffNow ? "שולם במלואו!" : undefined,
      });
    }

    const totalPayment = actions.reduce((s, a) => s + a.payment, 0);
    monthlyActions.push({
      month,
      date,
      actions,
      totalPayment,
      freedAmount: freedPayment,
      activeLoans: states.filter((s) => !s.paidOff).map((s) => s.loan.id),
    });

    month++;
  }

  const loanResults: LoanSimResult[] = states.map((s) => ({
    loanId: s.loan.id,
    loanName: s.loan.name,
    paidOffMonth: s.paidOffMonth,
    totalInterest: Math.round(s.totalInterest * 100) / 100,
    totalPaid: Math.round(s.totalPaid * 100) / 100,
    monthlyRows: s.rows,
  }));

  const totalMonths = Math.max(...states.map((s) => s.paidOffMonth));
  const totalInterest = loanResults.reduce((s, r) => s + r.totalInterest, 0);
  const totalPaid = loanResults.reduce((s, r) => s + r.totalPaid, 0);
  const payoffDate = addMonths(startDate, totalMonths);

  return {
    strategy,
    loanResults,
    monthlyActions,
    totalInterest: Math.round(totalInterest),
    totalMonths,
    totalPaid: Math.round(totalPaid),
    payoffDate,
  };
}
