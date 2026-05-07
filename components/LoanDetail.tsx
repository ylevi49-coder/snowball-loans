"use client";
import { useState, useMemo, useEffect } from "react";
import { Loan, LoanStatus } from "@/types";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { calcMonthlyInterest } from "@/lib/loanEngine";
import { formatCurrency, addMonths, today, formatDate } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { Calendar, TrendingDown, Wallet, Sigma, AlertTriangle, RefreshCw } from "lucide-react";

/* ── helpers ─────────────────────────────────────────────────── */

interface AmortRow {
  month: number;
  date: string;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

function monthsBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
}

function advanceBalance(startBalance: number, rate: number, payment: number, months: number): number {
  if (months <= 0) return startBalance;
  let b = startBalance;
  for (let i = 0; i < months; i++) {
    const interest = calcMonthlyInterest(b, rate);
    const actualPayment = Math.min(payment, b + interest);
    b = Math.max(0, b - Math.max(0, actualPayment - interest));
    if (b < 0.01) break;
  }
  return b;
}

function buildAmortization(balance: number, rate: number, payment: number, startDate: string): AmortRow[] {
  if (balance <= 0 || payment <= 0) return [];
  const rows: AmortRow[] = [];
  let b = balance;

  for (let month = 1; month <= 600; month++) {
    const interest = calcMonthlyInterest(b, rate);
    if (month > 1 && payment <= interest) break;
    const actualPayment = Math.min(payment, b + interest);
    const principal = Math.max(0, actualPayment - interest);
    const newBalance = Math.max(0, b - principal);
    rows.push({ month, date: addMonths(startDate, month - 1), payment: actualPayment, principal, interest, balance: newBalance });
    b = newBalance;
    if (b < 0.01) break;
  }
  return rows;
}

/* ── component ───────────────────────────────────────────────── */

interface LoanDetailProps {
  open: boolean;
  loan: Loan | null;
  onSave: (loan: Loan) => void;
  onClose: () => void;
}

export function LoanDetail({ open, loan, onSave, onClose }: LoanDetailProps) {
  const [name, setName] = useState("");
  const [originalAmount, setOriginalAmount] = useState("");
  const [dataDate, setDataDate] = useState(today());   // date of bank statement
  const [balanceAtDate, setBalanceAtDate] = useState("");  // balance on that date
  const [annualInterestRate, setAnnualInterestRate] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [status, setStatus] = useState<LoanStatus>("active");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!loan || !open) return;
    setName(loan.name);
    setOriginalAmount(String(loan.originalAmount || ""));
    setDataDate(today());           // default to today — user changes this if they have old bank data
    setBalanceAtDate(String(loan.currentBalance));
    setAnnualInterestRate(String(loan.annualInterestRate));
    setMonthlyPayment(String(loan.monthlyPayment));
    setStatus(loan.status as LoanStatus);
    setNotes(loan.notes || "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loan?.id, open]); // reset only when a different loan opens — NOT on every parent re-render

  const rate = parseFloat(annualInterestRate) || 0;
  const payment = parseFloat(monthlyPayment) || 0;
  const enteredBalance = parseFloat(balanceAtDate) || 0;

  // How many months elapsed between the data date and today
  const elapsed = useMemo(() => monthsBetween(dataDate, today()), [dataDate]);
  const isHistoricDate = elapsed > 0;

  // Current balance as of today (may differ from entered balance if date is in the past)
  const currentBalance = useMemo(
    () => isHistoricDate ? advanceBalance(enteredBalance, rate, payment, elapsed) : enteredBalance,
    [enteredBalance, rate, payment, elapsed, isHistoricDate]
  );

  // Amortization from today's balance
  const schedule = useMemo(
    () => buildAmortization(currentBalance, rate, payment, today()),
    [currentBalance, rate, payment]
  );

  const totalMonths = schedule.length;
  const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);
  const totalPaid = schedule.reduce((s, r) => s + r.payment, 0);
  const payoffDate = totalMonths > 0 ? schedule[schedule.length - 1].date : "—";
  const monthlyInterest = calcMonthlyInterest(currentBalance, rate);
  const diverges = payment > 0 && payment <= monthlyInterest;

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!loan) return;
    onSave({
      ...loan,
      id: loan.id || uuidv4(),
      name: name.trim() || "הלוואה",
      originalAmount: parseFloat(originalAmount) || enteredBalance,
      currentBalance: Math.round(currentBalance * 100) / 100,
      annualInterestRate: rate,
      monthlyPayment: payment,
      status,
      startDate: dataDate,
      notes,
    });
    onClose();
  };

  if (!loan) return null;

  const inp = "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-blue-400 transition-colors";
  const lbl = "block text-xs font-semibold text-slate-500 mb-1";

  return (
    <Modal open={open} onClose={onClose} title={`פרטי הלוואה — ${name || loan.name}`} size="full">
      {/* stop clicks inside the modal from bubbling to any parent handlers */}
      <div className="p-5 space-y-5" onClick={e => e.stopPropagation()}>

        {/* ── Row 1: name + amounts + rate + payment ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <label className={lbl}>שם ההלוואה</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className={inp}
              placeholder="למשל: משכנתא"
            />
          </div>
          <div>
            <label className={lbl}>סכום מקורי (₪)</label>
            <input
              type="number" min="0"
              value={originalAmount}
              onChange={e => setOriginalAmount(e.target.value)}
              className={inp}
            />
          </div>
          <div>
            <label className={lbl}>ריבית שנתית (%)</label>
            <input
              type="number" min="0" step="0.01"
              value={annualInterestRate}
              onChange={e => setAnnualInterestRate(e.target.value)}
              className={inp}
            />
          </div>
          <div>
            <label className={lbl}>תשלום חודשי (₪)</label>
            <input
              type="number" min="0"
              value={monthlyPayment}
              onChange={e => setMonthlyPayment(e.target.value)}
              className={inp}
            />
          </div>
        </div>

        {/* ── Row 2: date of data + balance at that date + status + notes ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className={lbl}>
              תאריך הנתונים{" "}
              <span className="text-slate-400 font-normal">(מהבנק)</span>
            </label>
            <input
              type="date"
              value={dataDate}
              max={today()}
              onChange={e => setDataDate(e.target.value)}
              className={inp}
            />
          </div>
          <div>
            <label className={lbl}>
              יתרה בתאריך הנתונים (₪)
            </label>
            <input
              type="number" min="0"
              value={balanceAtDate}
              onChange={e => setBalanceAtDate(e.target.value)}
              className={inp}
            />
          </div>
          <div>
            <label className={lbl}>סטטוס</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as LoanStatus)}
              className={inp}
            >
              <option value="active">פעיל</option>
              <option value="grace">גרייס</option>
              <option value="frozen">קפוא</option>
              <option value="paid">שולם</option>
            </select>
          </div>
          <div>
            <label className={lbl}>הערות</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className={inp}
              placeholder="הערות נוספות"
            />
          </div>
        </div>

        {/* ── Historic date banner ── */}
        {isHistoricDate && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
            <RefreshCw size={15} className="text-blue-600 shrink-0" />
            <span className="text-blue-800">
              הנתונים מתאריך <strong>{formatDate(dataDate)}</strong> — לפני {elapsed} חודשים.
            </span>
            <span className="text-blue-700">
              יתרה מחושבת נכון להיום:{" "}
              <strong className="text-blue-900 text-base">{formatCurrency(currentBalance)}</strong>
            </span>
            <span className="text-blue-500 text-xs">(לוח הסילוקין מוצג מהיום)</span>
          </div>
        )}

        {/* ── Divergence warning ── */}
        {diverges && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertTriangle size={16} className="shrink-0" />
            <span>
              התשלום החודשי (<strong>{formatCurrency(payment)}</strong>) נמוך מהריבית החודשית{" "}
              (<strong>{formatCurrency(monthlyInterest)}</strong>) — ההלוואה לא תיפרע!
            </span>
          </div>
        )}

        {/* ── KPI cards ── */}
        {!diverges && schedule.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                icon: <Calendar size={14} className="text-blue-500" />,
                label: "חודשים לסיום",
                value: String(totalMonths),
                sub: formatDate(payoffDate),
              },
              {
                icon: <TrendingDown size={14} className="text-amber-500" />,
                label: 'סה"כ ריבית',
                value: formatCurrency(totalInterest),
                sub: "עלות המימון",
              },
              {
                icon: <Wallet size={14} className="text-emerald-500" />,
                label: "ריבית חודש 1",
                value: formatCurrency(schedule[0]?.interest ?? 0),
                sub: `קרן: ${formatCurrency(schedule[0]?.principal ?? 0)}`,
              },
              {
                icon: <Sigma size={14} className="text-violet-500" />,
                label: 'סה"כ תשלומים',
                value: formatCurrency(totalPaid),
                sub: "קרן + ריבית",
              },
            ].map((k) => (
              <div key={k.label} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  {k.icon}{k.label}
                </div>
                <p className="font-bold text-slate-800">{k.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Amortization table ── */}
        {schedule.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">לוח סילוקין</p>
              {isHistoricDate && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  מחושב מהיום עם יתרה {formatCurrency(currentBalance)}
                </span>
              )}
            </div>
            <div className="overflow-auto rounded-xl border border-slate-200" style={{ maxHeight: "22rem" }}>
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-slate-50 border-b border-slate-200" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                  <tr>
                    {["חודש", "תאריך", "תשלום (₪)", "קרן (₪)", "ריבית (₪)", "יתרה (₪)"].map((h) => (
                      <th key={h} className="px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap bg-slate-50">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schedule.map((row) => (
                    <tr
                      key={row.month}
                      className={`hover:bg-blue-50/40 transition-colors ${row.balance < 0.01 ? "bg-emerald-50" : ""}`}
                    >
                      <td className="px-3 py-2 font-medium text-blue-700 text-center w-14">{row.month}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDate(row.date)}</td>
                      <td className="px-3 py-2 font-semibold text-slate-800 text-left tabular-nums">{Math.round(row.payment).toLocaleString()}</td>
                      <td className="px-3 py-2 text-emerald-700 text-left tabular-nums">{Math.round(row.principal).toLocaleString()}</td>
                      <td className="px-3 py-2 text-amber-600 text-left tabular-nums">{Math.round(row.interest).toLocaleString()}</td>
                      <td className={`px-3 py-2 text-left tabular-nums font-semibold ${row.balance < 0.01 ? "text-emerald-600" : "text-slate-700"}`}>
                        {row.balance < 0.01 ? "✓ שולם" : Math.round(row.balance).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>ביטול</Button>
          <Button variant="success" onClick={handleSave}>שמור שינויים</Button>
        </div>
      </div>
    </Modal>
  );
}
