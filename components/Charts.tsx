"use client";
import { PayoffPlan, LoanSimResult } from "@/types";
import { Card } from "./ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";

interface ChartsProps {
  plan: PayoffPlan | null;
  baseline: PayoffPlan | null;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#84cc16"];

export function Charts({ plan, baseline }: ChartsProps) {
  if (!plan) {
    return (
      <div className="flex items-center justify-center h-48 bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <p className="text-slate-400">חשב תוכנית לקבלת גרפים</p>
      </div>
    );
  }

  // Balance over time (total)
  const balanceData = plan.monthlyActions.map((a) => ({
    month: a.month,
    יתרה: Math.round(a.actions.reduce((s, x) => s + x.balance, 0)),
  }));

  // Interest per loan
  const interestData = plan.loanResults.map((r: LoanSimResult) => ({
    name: r.loanName,
    ריבית: Math.round(r.totalInterest),
    תשלומים: Math.round(r.totalPaid),
  }));

  // Months to pay off per loan
  const payoffData = plan.loanResults.map((r: LoanSimResult) => ({
    name: r.loanName,
    חודשים: r.paidOffMonth,
  }));

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h3 className="font-bold text-slate-700 mb-4">יתרת חוב לאורך זמן</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={balanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} label={{ value: "חודש", position: "insideBottom", offset: -2 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={(l) => `חודש ${l}`} />
            <Area type="monotone" dataKey="יתרה" stroke="#3b82f6" fill="#bfdbfe" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-slate-700 mb-4">ריבית כוללת לפי הלוואה</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={interestData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend />
            <Bar dataKey="ריבית" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            <Bar dataKey="תשלומים" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-slate-700 mb-4">מועד סיום לפי הלוואה</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={payoffData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="number" tick={{ fontSize: 11 }} label={{ value: "חודשים", position: "insideBottom", offset: -2 }} />
            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => `${v} חודשים`} />
            {payoffData.map((_, i) => (
              <Bar key={i} dataKey="חודשים" fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
