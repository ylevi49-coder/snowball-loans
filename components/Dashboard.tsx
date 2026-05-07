"use client";
import { Loan, PayoffPlan } from "@/types";
import { Card } from "./ui/card";
import { formatCurrency } from "@/lib/utils";
import { calcRemainingMonths, calcTotalInterest, totalDebt, totalMonthlyPayment } from "@/lib/loanEngine";
import { TrendingDown, CreditCard, Percent, Calendar } from "lucide-react";

interface DashboardProps {
  loans: Loan[];
  optimized: PayoffPlan | null;
  baseline: PayoffPlan | null;
  strategyName: string;
}

export function Dashboard({ loans, optimized, baseline, strategyName }: DashboardProps) {
  const activeLoans = loans.filter((l) => l.status === "active");
  const debt = totalDebt(loans);
  const monthlyPayment = totalMonthlyPayment(loans);
  const totalInterest = activeLoans.reduce((s, l) => s + calcTotalInterest(l), 0);

  const savedInterest =
    baseline && optimized ? baseline.totalInterest - optimized.totalInterest : 0;
  const savedMonths =
    baseline && optimized ? baseline.totalMonths - optimized.totalMonths : 0;

  const kpis = [
    {
      icon: <CreditCard size={20} className="text-blue-600" />,
      label: "יתרה כוללת",
      value: formatCurrency(debt),
      sub: `${activeLoans.length} הלוואות פעילות`,
      color: "border-blue-200 bg-blue-50",
    },
    {
      icon: <TrendingDown size={20} className="text-emerald-600" />,
      label: "תשלום חודשי",
      value: formatCurrency(monthlyPayment),
      sub: "סך כל ההלוואות",
      color: "border-emerald-200 bg-emerald-50",
    },
    {
      icon: <Percent size={20} className="text-amber-600" />,
      label: "ריבית עתידית",
      value: formatCurrency(totalInterest),
      sub: "ללא אסטרטגיה",
      color: "border-amber-200 bg-amber-50",
    },
    {
      icon: <Calendar size={20} className="text-violet-600" />,
      label: "חיסכון ב" + strategyName,
      value: savedInterest > 0 ? formatCurrency(savedInterest) : "—",
      sub: savedMonths > 0 ? `${savedMonths} חודשים מוקדם יותר` : "חשב תוכנית לראות חיסכון",
      color: "border-violet-200 bg-violet-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className={`p-5 border ${kpi.color}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-xl bg-white shadow-sm">{kpi.icon}</div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{kpi.value}</p>
            <p className="text-xs text-slate-500 mt-1">{kpi.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{kpi.sub}</p>
          </Card>
        ))}
      </div>

      {activeLoans.length > 0 && (
        <Card className="p-5">
          <h3 className="font-bold text-slate-700 mb-4">פירוט הלוואות</h3>
          <div className="space-y-3">
            {activeLoans.map((loan) => {
              const months = calcRemainingMonths(loan);
              const pct = debt > 0 ? (loan.currentBalance / debt) * 100 : 0;
              return (
                <div key={loan.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{loan.name}</span>
                    <span className="text-slate-500">
                      {formatCurrency(loan.currentBalance)} ({months < 999 ? `${months} חודשים` : "∞"})
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
