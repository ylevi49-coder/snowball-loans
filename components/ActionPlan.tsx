"use client";
import { useState } from "react";
import { PayoffPlan } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ChevronDown, ChevronUp, ArrowLeft, Banknote, Info, Printer, Download, TrendingDown, Calendar, Wallet, CheckCircle2 } from "lucide-react";

interface ActionPlanProps {
  plan: PayoffPlan | null;
  strategyName: string;
  baseline?: PayoffPlan | null;
}

export function ActionPlan({ plan, strategyName, baseline }: ActionPlanProps) {
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set([1]));
  const [showAll, setShowAll] = useState(false);

  if (!plan) {
    return (
      <div className="flex items-center justify-center h-48 bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <p className="text-slate-400">חשב תוכנית תחילה לקבלת הוראות פעולה</p>
      </div>
    );
  }

  const toggle = (month: number) => {
    const next = new Set(expandedMonths);
    if (next.has(month)) next.delete(month);
    else next.add(month);
    setExpandedMonths(next);
  };

  const visibleMonths = showAll ? plan.monthlyActions : plan.monthlyActions.slice(0, 12);

  const freedEvents = plan.monthlyActions.filter((a, i) => {
    if (i === 0) return false;
    return a.freedAmount > plan.monthlyActions[i - 1].freedAmount;
  });

  /* ── Export CSV ─────────────────────────────────────── */
  const exportCSV = () => {
    const rows: string[][] = [
      ["חודש", "תאריך", "שם הלוואה", "תשלום (₪)", "קרן (₪)", "ריבית (₪)", "יתרה (₪)", "תשלום נוסף"],
    ];
    for (const action of plan.monthlyActions) {
      for (const item of action.actions.filter((a) => a.balance >= 0 || a.payment > 0)) {
        rows.push([
          String(action.month),
          action.date,
          item.loanName,
          item.payment.toFixed(2),
          item.principal.toFixed(2),
          item.interest.toFixed(2),
          item.balance.toFixed(2),
          item.isExtra ? "כן" : "לא",
        ]);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `תוכנית-פעולה-${strategyName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Print ──────────────────────────────────────────── */
  const printPlan = () => {
    const prevFreed = (month: number) => plan.monthlyActions[month - 2]?.freedAmount ?? 0;

    const rows = plan.monthlyActions.flatMap((action) => {
      const items = action.actions.filter((a) => a.balance >= 0 || a.payment > 0);
      const freed = action.freedAmount > prevFreed(action.month);
      return items.map((item, j) => ({ action, item, j, rowCount: items.length, freed }));
    });

    const tableRows = rows
      .map(({ action, item, j, rowCount, freed }) => {
        const rowClass = [freed ? "freed" : "", item.isExtra ? "extra" : ""].filter(Boolean).join(" ");
        return `
        <tr class="${rowClass}">
          ${j === 0
            ? `<td rowspan="${rowCount}" class="month-cell">${action.month}</td>
               <td rowspan="${rowCount}" class="month-cell">${action.date}</td>`
            : ""}
          <td class="${item.isExtra ? "extra-name" : ""}">${item.loanName}${item.isExtra ? " ★" : ""}</td>
          <td class="num${item.isExtra ? " extra-num" : ""}">${Math.round(item.payment).toLocaleString()}</td>
          <td class="num">${Math.round(item.principal).toLocaleString()}</td>
          <td class="num">${Math.round(item.interest).toLocaleString()}</td>
          <td class="num">${Math.round(item.balance).toLocaleString()}</td>
        </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <title>תוכנית פעולה — ${strategyName}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; direction: rtl; margin: 24px; color: #1e293b; font-size: 12px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .subtitle { color: #64748b; margin-bottom: 20px; }
    .subtitle span { margin-left: 16px; }
    table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    th { background: #f1f5f9; padding: 7px 10px; text-align: right; font-weight: 700; border: 1px solid #cbd5e1; font-size: 11px; }
    td { padding: 6px 10px; border: 1px solid #e2e8f0; vertical-align: middle; }
    .month-cell { background: #eff6ff; font-weight: 700; color: #1d4ed8; text-align: center; }
    .freed { background: #f0fdf4; }
    .num { text-align: left; font-variant-numeric: tabular-nums; }
    .extra { background: #fef3c7; }
    .extra-name { font-weight: 700; color: #92400e; }
    .extra-num { font-weight: 700; color: #b45309; }
    .extra.freed { background: #d1fae5; }
  </style>
</head>
<body>
  <h1>תוכנית פעולה — ${strategyName}</h1>
  <div class="subtitle">
    <span>סה"כ ${plan.totalMonths} חודשים</span>
    <span>ריבית כוללת: ₪${Math.round(plan.totalInterest).toLocaleString()}</span>
    <span>סיום: ${plan.payoffDate}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>חודש</th><th>תאריך</th><th>שם הלוואה</th>
        <th>תשלום (₪)</th><th>קרן (₪)</th><th>ריבית (₪)</th><th>יתרה (₪)</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-800 text-lg">תוכנית פעולה — {strategyName}</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-sm text-slate-500 ml-3">
            <Info size={14} />
            <span>סה"כ {plan.totalMonths} חודשים</span>
          </div>
          <Button variant="secondary" size="sm" onClick={exportCSV}>
            <Download size={14} />
            ייצוא CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={printPlan}>
            <Printer size={14} />
            הדפסה
          </Button>
        </div>
      </div>

      {/* ── תקציר התוכנית ── */}
      <Card className="p-5 bg-gradient-to-br from-blue-50 to-slate-50 border-blue-100">
        {/* שורת KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { icon: <Calendar size={15} className="text-blue-500" />, label: "חודשים לסיום", value: String(plan.totalMonths), sub: plan.payoffDate },
            { icon: <TrendingDown size={15} className="text-amber-500" />, label: "ריבית כוללת", value: formatCurrency(plan.totalInterest), sub: "עלות המימון" },
            { icon: <Wallet size={15} className="text-emerald-500" />, label: "תשלום חודשי", value: formatCurrency(plan.monthlyActions[0]?.totalPayment ?? 0), sub: "בחודש הראשון" },
            { icon: <Info size={15} className="text-violet-500" />, label: "סה\"כ תשלומים", value: formatCurrency(plan.totalPaid), sub: "קרן + ריבית" },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white rounded-xl p-3 border border-slate-100">
              <div className="flex items-center gap-1.5 mb-1 text-xs text-slate-500">
                {kpi.icon}{kpi.label}
              </div>
              <p className="font-bold text-slate-800 text-base">{kpi.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* חיסכון לעומת בסיס */}
        {baseline && baseline.totalInterest > plan.totalInterest && (
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span className="font-semibold text-emerald-800">חיסכון לעומת ללא אסטרטגיה:</span>
            <span className="text-emerald-700">
              <strong>{formatCurrency(baseline.totalInterest - plan.totalInterest)}</strong> ריבית
            </span>
            <span className="text-emerald-600 text-xs">•</span>
            <span className="text-emerald-700">
              <strong>{baseline.totalMonths - plan.totalMonths}</strong> חודשים מוקדם יותר
            </span>
          </div>
        )}

        {/* סדר פירעון */}
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">סדר פירעון הלוואות</p>
          <div className="space-y-2">
            {[...plan.loanResults]
              .filter(r => r.paidOffMonth > 0)
              .sort((a, b) => a.paidOffMonth - b.paidOffMonth)
              .map((r, i) => {
                const action = plan.monthlyActions[r.paidOffMonth - 1];
                return (
                  <div key={r.loanId} className="flex items-center gap-2.5 text-sm">
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {i + 1}
                    </div>
                    <span className="font-medium text-slate-700 flex-1">{r.loanName}</span>
                    <span className="text-slate-400 text-xs">חודש {r.paidOffMonth}</span>
                    {action && <span className="text-slate-400 text-xs hidden sm:inline">({formatDate(action.date)})</span>}
                    <Badge variant="default" className="text-xs">{formatCurrency(r.totalInterest)}</Badge>
                  </div>
                );
              })}
          </div>
        </div>
      </Card>

      {freedEvents.length > 0 && (
        <Card className="p-4 border-emerald-200 bg-emerald-50">
          <div className="flex items-center gap-2 mb-2">
            <ArrowLeft size={16} className="text-emerald-600" />
            <span className="font-semibold text-emerald-800 text-sm">רגעי שחרור תשלום</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {freedEvents.map((a) => (
              <div key={a.month} className="text-xs bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5">
                <span className="font-medium text-emerald-700">חודש {a.month}</span>
                <span className="text-emerald-600"> → {formatCurrency(a.freedAmount)} פנוי</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {visibleMonths.map((action) => {
          const isExpanded = expandedMonths.has(action.month);
          const hasFreed = action.freedAmount > (plan.monthlyActions[action.month - 2]?.freedAmount ?? 0);
          return (
            <Card key={action.month} className={`overflow-hidden ${hasFreed ? "border-emerald-200" : ""}`}>
              <button
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                onClick={() => toggle(action.month)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${hasFreed ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                    {action.month}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-700 text-sm">{formatDate(action.date)}</p>
                    <p className="text-xs text-slate-500">{action.actions.length} הלוואות פעילות</p>
                  </div>
                  {hasFreed && <Badge variant="success" className="mr-1">שחרור תשלום!</Badge>}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-slate-400">סך תשלום</p>
                    <p className="font-bold text-slate-800">{formatCurrency(action.totalPayment)}</p>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                  <div className="space-y-2">
                    {action.actions.filter((a) => a.balance >= 0 || a.payment > 0).map((item) => (
                      <div key={item.loanId} className={`flex items-center justify-between py-2 px-3 rounded-lg ${item.isExtra ? "bg-blue-50 border border-blue-100" : "bg-white border border-slate-100"}`}>
                        <div className="flex items-center gap-2">
                          <Banknote size={14} className={item.isExtra ? "text-blue-500" : "text-slate-400"} />
                          <div>
                            <p className="font-medium text-slate-700 text-sm">{item.loanName}</p>
                            <p className="text-xs text-slate-400">קרן: {formatCurrency(item.principal)} | ריבית: {formatCurrency(item.interest)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-sm ${item.isExtra ? "text-blue-600" : "text-slate-700"}`}>{formatCurrency(item.payment)}</p>
                          <p className="text-xs text-slate-400">יתרה: {formatCurrency(item.balance)}</p>
                        </div>
                      </div>
                    ))}
                    {action.actions.some((a) => a.note) && (
                      <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                        {action.actions.filter((a) => a.note).map((a) => (
                          <p key={a.loanId} className="text-xs text-emerald-700 font-medium">✓ {a.loanName}: {a.note}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {plan.monthlyActions.length > 12 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2.5 text-sm text-blue-600 hover:text-blue-700 font-medium rounded-xl border border-blue-200 hover:bg-blue-50 transition-colors"
        >
          {showAll ? "הצג פחות" : `הצג את כל ${plan.monthlyActions.length} החודשים`}
        </button>
      )}
    </div>
  );
}
