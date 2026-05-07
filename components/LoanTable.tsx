"use client";
import { useState } from "react";
import { Loan } from "@/types";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { formatCurrency } from "@/lib/utils";
import { calcRemainingMonths } from "@/lib/loanEngine";
import { Pencil, Trash2, ChevronUp, ChevronDown, Plus, Eye } from "lucide-react";

interface LoanTableProps {
  loans: Loan[];
  onEdit: (loan: Loan) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onReorder: (ids: string[]) => void;
  onDetail: (loan: Loan) => void;
}

type SortKey = "name" | "currentBalance" | "annualInterestRate" | "monthlyPayment";

const STATUS_LABELS: Record<string, string> = {
  active: "פעיל",
  grace: "גרייס",
  frozen: "קפוא",
  paid: "שולם",
};

const STATUS_VARIANTS: Record<string, "success" | "warning" | "info" | "default"> = {
  active: "success",
  grace: "warning",
  frozen: "info",
  paid: "default",
};

export function LoanTable({ loans, onEdit, onDelete, onAdd, onReorder, onDetail }: LoanTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("currentBalance");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sorted = [...loans].sort((a, b) => {
    const av = a[sortKey] as number | string;
    const bv = b[sortKey] as number | string;
    const cmp = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
    ) : null;

  const th = (label: string, key: SortKey) => (
    <th
      className="px-3 py-2 text-right text-xs font-semibold text-slate-600 cursor-pointer hover:text-blue-600 select-none whitespace-nowrap"
      onClick={() => toggleSort(key)}
    >
      <span className="inline-flex items-center gap-1">{label}<SortIcon k={key} /></span>
    </th>
  );

  if (loans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 gap-3">
        <p className="text-slate-400">אין הלוואות — הוסף הלוואה ראשונה</p>
        <Button onClick={onAdd}><Plus size={14} /> הוסף הלוואה</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={onAdd} size="sm"><Plus size={14} /> הוסף הלוואה</Button>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full rtl-table text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {th("שם", "name")}
                {th("יתרה (₪)", "currentBalance")}
                {th("ריבית %", "annualInterestRate")}
                {th("תשלום חודשי", "monthlyPayment")}
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">חודשים</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">סטטוס</th>
                <th className="px-3 py-2 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((loan) => {
                const months = calcRemainingMonths(loan);
                return (
                  <tr
                    key={loan.id}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                    onClick={() => onDetail(loan)}
                  >
                    <td className="px-3 py-3 font-medium text-slate-800">
                      <span className="hover:text-blue-700 transition-colors">{loan.name}</span>
                    </td>
                    <td className="px-3 py-3 text-slate-700 font-semibold">{formatCurrency(loan.currentBalance)}</td>
                    <td className="px-3 py-3">
                      <span className={`font-semibold ${loan.annualInterestRate > 8 ? "text-red-600" : loan.annualInterestRate > 4 ? "text-amber-600" : "text-emerald-600"}`}>
                        {loan.annualInterestRate.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{formatCurrency(loan.monthlyPayment)}</td>
                    <td className="px-3 py-3 text-slate-500">{months < 999 ? months : "∞"}</td>
                    <td className="px-3 py-3">
                      <Badge variant={STATUS_VARIANTS[loan.status] || "default"}>
                        {STATUS_LABELS[loan.status] || loan.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button
                          onClick={() => onDetail(loan)}
                          title="לוח סילוקין"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => onEdit(loan)}
                          title="עריכה מהירה"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => onDelete(loan.id)}
                          title="מחיקה"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
