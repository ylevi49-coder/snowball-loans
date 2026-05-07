"use client";
import { PayoffPlan, PayoffStrategy } from "@/types";
import { Card } from "./ui/card";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "./ui/badge";

interface ScenarioComparisonProps {
  baseline: PayoffPlan | null;
  optimized: PayoffPlan | null;
  snowball: PayoffPlan | null;
  avalanche: PayoffPlan | null;
  currentStrategy: PayoffStrategy | "baseline";
}

const STRATEGY_LABELS: Record<string, string> = {
  baseline: "ללא אסטרטגיה",
  snowball: "כדור שלג",
  avalanche: "מפולת",
};

export function ScenarioComparison({
  baseline,
  optimized,
  snowball,
  avalanche,
  currentStrategy,
}: ScenarioComparisonProps) {
  const plans = [
    { key: "baseline", plan: baseline, label: "ללא אסטרטגיה" },
    { key: "snowball", plan: snowball, label: "כדור שלג (הקטן תחילה)" },
    { key: "avalanche", plan: avalanche, label: "מפולת (ריבית גבוהה תחילה)" },
  ].filter((p) => p.plan !== null);

  if (plans.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <p className="text-slate-400">חשב תוכנית לקבלת השוואת תרחישים</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-slate-800 text-lg">השוואת אסטרטגיות</h2>

      <div className="grid gap-4">
        {plans.map(({ key, plan, label }) => {
          if (!plan) return null;
          const savingsVsBaseline =
            baseline && key !== "baseline"
              ? baseline.totalInterest - plan.totalInterest
              : 0;
          const monthsSaved =
            baseline && key !== "baseline"
              ? baseline.totalMonths - plan.totalMonths
              : 0;
          const isCurrent = key === currentStrategy || (key === "baseline" && !currentStrategy);

          return (
            <Card key={key} className={`p-5 ${isCurrent ? "ring-2 ring-blue-400" : ""}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    {label}
                    {isCurrent && <Badge variant="info">נוכחית</Badge>}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">סיום: {plan.payoffDate}</p>
                </div>
                {savingsVsBaseline > 0 && (
                  <Badge variant="success">
                    חיסכון: {formatCurrency(savingsVsBaseline)}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">ריבית כוללת</p>
                  <p className="font-bold text-amber-700 text-lg">{formatCurrency(plan.totalInterest)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">חודשים לסיום</p>
                  <p className="font-bold text-blue-700 text-lg">{plan.totalMonths}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">סה"כ תשלומים</p>
                  <p className="font-bold text-slate-700 text-lg">{formatCurrency(plan.totalPaid)}</p>
                </div>
              </div>

              {monthsSaved > 0 && (
                <p className="text-xs text-emerald-600 mt-2 font-medium">
                  ✓ {monthsSaved} חודשים מוקדם יותר מהבסיס
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
