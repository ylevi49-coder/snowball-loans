"use client";
import { useState, useMemo } from "react";
import { Loan, AmortizationRow } from "@/types";
import { Modal } from "./ui/modal";
import { formatCurrency, formatDate } from "@/lib/utils";
import { generateSchedule, recalculateFromRow } from "@/lib/scheduleEngine";
import { Badge } from "./ui/badge";

interface AmortizationModalProps {
  open: boolean;
  onClose: () => void;
  loan: Loan | null;
}

export function AmortizationModal({ open, onClose, loan }: AmortizationModalProps) {
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [rows, setRows] = useState<AmortizationRow[]>([]);
  const [initialized, setInitialized] = useState(false);

  useMemo(() => {
    if (open && loan && !initialized) {
      if (loan.importedSchedule && loan.importedSchedule.length > 0) {
        const converted: AmortizationRow[] = loan.importedSchedule.map((r, i) => ({
          month: i + 1,
          date: r.date || "",
          openingBalance: r.balance ?? 0,
          payment: r.payment ?? 0,
          principal: r.principal ?? 0,
          interest: r.interest ?? 0,
          closingBalance: i + 1 < loan.importedSchedule!.length ? (loan.importedSchedule![i + 1]?.balance ?? 0) : 0,
          extraPayment: 0,
          status: "regular" as const,
          annualRate: r.annualRate,
        }));
        setRows(converted);
      } else {
        setRows(generateSchedule(loan));
      }
      setInitialized(true);
    }
    if (!open) setInitialized(false);
  }, [open, loan, initialized]);

  if (!loan) return null;

  const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
  const totalPaid = rows.reduce((s, r) => s + r.payment, 0);

  const handleRateChange = (rowIndex: number, newRate: number) => {
    const updated = recalculateFromRow(rows, rowIndex, newRate);
    setRows(updated);
    setEditingRow(null);
  };

  return (
    <Modal open={open} onClose={onClose} title={`לוח סילוקין — ${loan.name}`} size="2xl">
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-xs text-blue-600 font-medium">מספר תשלומים</p>
            <p className="text-xl font-bold text-blue-800">{rows.length}</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <p className="text-xs text-amber-600 font-medium">סה"כ ריבית</p>
            <p className="text-xl font-bold text-amber-800">{formatCurrency(totalInterest)}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-600 font-medium">סה"כ תשלומים</p>
            <p className="text-xl font-bold text-emerald-800">{formatCurrency(totalPaid)}</p>
          </div>
        </div>

        <div className="overflow-auto max-h-96 rounded-xl border border-slate-200">
          <table className="w-full rtl-table text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-right text-xs font-semibold text-slate-600">חודש</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-slate-600">תאריך</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-slate-600">יתרה פתיחה</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-slate-600">תשלום</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-slate-600">קרן</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-slate-600">ריבית</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-slate-600">יתרה סגירה</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-slate-600">שיעור %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-2 py-2 text-center text-slate-500 text-xs">{row.month}</td>
                  <td className="px-2 py-2 text-slate-500 text-xs whitespace-nowrap">{formatDate(row.date)}</td>
                  <td className="px-2 py-2 text-slate-700">{formatCurrency(row.openingBalance)}</td>
                  <td className="px-2 py-2 font-semibold text-slate-800">{formatCurrency(row.payment)}</td>
                  <td className="px-2 py-2 text-emerald-700">{formatCurrency(row.principal)}</td>
                  <td className="px-2 py-2 text-amber-700">{formatCurrency(row.interest)}</td>
                  <td className="px-2 py-2 text-slate-600">{formatCurrency(row.closingBalance)}</td>
                  <td className="px-2 py-2">
                    {editingRow === i ? (
                      <input
                        type="number"
                        defaultValue={row.annualRate ?? loan.annualInterestRate}
                        step="0.01"
                        className="w-16 rounded border px-1 py-0.5 text-xs"
                        onBlur={(e) => handleRateChange(i, parseFloat(e.target.value))}
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => setEditingRow(i)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {(row.annualRate ?? loan.annualInterestRate).toFixed(2)}%
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loan.rateType === "variable" && (
          <div className="mt-3 p-3 bg-violet-50 border border-violet-200 rounded-xl">
            <p className="text-xs text-violet-700 font-medium">
              ריבית משתנה: לחץ על שיעור % כדי לערוך שורה. השינוי מחושב קדימה אוטומטית.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
