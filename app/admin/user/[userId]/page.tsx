"use client";
import { useState, useEffect, useCallback, use } from "react";
import { Loan, PayoffPlan, PayoffStrategy } from "@/types";
import { runPayoffSimulation, runBaselineSimulation } from "@/lib/snowballEngine";
import { today } from "@/lib/utils";
import { Dashboard }          from "@/components/Dashboard";
import { LoanTable }          from "@/components/LoanTable";
import { LoanForm }           from "@/components/LoanForm";
import { LoanDetail }         from "@/components/LoanDetail";
import { Charts }             from "@/components/Charts";
import { ActionPlan }         from "@/components/ActionPlan";
import { ScenarioComparison } from "@/components/ScenarioComparison";
import { ImportWizard }       from "@/components/ImportWizard";
import { Button }             from "@/components/ui/button";
import {
  LayoutDashboard, CreditCard, BarChart3, ListChecks, GitCompare, Upload,
  Plus, Snowflake, TrendingDown, Minus, ArrowRight, Shield, Save, Download,
  Loader2,
} from "lucide-react";

/* ── Tabs ── */
const TABS = [
  { id: "dashboard", label: "לוח בקרה",        icon: LayoutDashboard },
  { id: "loans",     label: "הלוואות",          icon: CreditCard      },
  { id: "charts",    label: "גרפים",            icon: BarChart3       },
  { id: "actions",   label: "תוכנית פעולה",     icon: ListChecks      },
  { id: "scenarios", label: "השוואת תרחישים",   icon: GitCompare      },
] as const;
type TabId = (typeof TABS)[number]["id"];

/* ── Strategy ── */
type LocalStrategy = PayoffStrategy | "baseline";
const STRATEGIES: { value: LocalStrategy; label: string; icon: typeof Snowflake }[] = [
  { value: "snowball",  label: "כדור שלג",     icon: Snowflake    },
  { value: "avalanche", label: "מפולת",         icon: TrendingDown },
  { value: "baseline",  label: "ללא אסטרטגיה", icon: Minus        },
];

export default function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);

  /* ── State ── */
  const [email, setEmail]           = useState("");
  const [loans, setLoans]           = useState<Loan[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState<TabId>("dashboard");
  const [strategy, setStrategy]     = useState<LocalStrategy>("snowball");
  const [extraPayment, setExtraPayment] = useState(0);
  const [extraInput, setExtraInput] = useState("0");
  const [showForm, setShowForm]     = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [detailLoan, setDetailLoan] = useState<Loan | null>(null);
  const [plan, setPlan]             = useState<PayoffPlan | null>(null);
  const [baselinePlan, setBaselinePlan] = useState<PayoffPlan | null>(null);
  const [snowballPlan, setSnowballPlan] = useState<PayoffPlan | null>(null);
  const [avalanchePlan, setAvalanchePlan] = useState<PayoffPlan | null>(null);
  const [calculated, setCalculated] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  /* ── Load user data ── */
  useEffect(() => {
    (async () => {
      const res  = await fetch(`/api/admin/user-data?userId=${userId}`);
      const json = await res.json();
      if (json.error) { setError(json.error); setLoading(false); return; }
      setEmail(json.email);
      setLoans(json.loans);
      setLoading(false);
    })();
  }, [userId]);

  /* ── Save to Supabase via admin API ── */
  const saveLoans = useCallback(async (ls: Loan[]) => {
    setSaving(true);
    await fetch("/api/admin/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_loans", userId, email, loans: ls }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setHasChanges(false);
  }, [userId, email]);

  /* ── CRUD ── */
  const upsertLoan = (loan: Loan) => {
    setLoans(prev => {
      const exists = prev.some(l => l.id === loan.id);
      const next = exists ? prev.map(l => l.id === loan.id ? loan : l) : [...prev, loan];
      saveLoans(next);
      return next;
    });
    setPlan(null); setCalculated(false); setHasChanges(true);
  };

  const deleteLoan = (id: string) => {
    setLoans(prev => {
      const next = prev.filter(l => l.id !== id);
      saveLoans(next);
      return next;
    });
    setPlan(null); setCalculated(false); setHasChanges(true);
  };

  const reorderLoans = (ids: string[]) => {
    setLoans(prev => {
      const map = Object.fromEntries(prev.map(l => [l.id, l]));
      const next = ids.map((id, i) => ({ ...map[id], priority: i })).filter(Boolean) as Loan[];
      saveLoans(next);
      return next;
    });
  };

  const handleImport = (imported: Loan[]) => {
    const withPriority = imported.map((l, i) => ({
      ...l, priority: l.priority ?? loans.length + i, startDate: l.startDate || today(),
    }));
    setLoans(prev => {
      const next = [...prev, ...withPriority];
      saveLoans(next);
      return next;
    });
    setPlan(null); setCalculated(false); setShowImport(false); setActiveTab("loans");
  };

  /* ── Calculate ── */
  const calculate = () => {
    const active = loans.filter(l => l.status === "active");
    if (!active.length) return;
    const bl = runBaselineSimulation(active);
    const sb = runPayoffSimulation(active, extraPayment, "snowball");
    const av = runPayoffSimulation(active, extraPayment, "avalanche");
    setBaselinePlan(bl); setSnowballPlan(sb); setAvalanchePlan(av);
    if (strategy === "snowball") setPlan(sb);
    else if (strategy === "avalanche") setPlan(av);
    else setPlan(bl);
    setCalculated(true);
  };

  const handleStrategyChange = (s: LocalStrategy) => {
    setStrategy(s);
    if (!calculated) return;
    if (s === "snowball") setPlan(snowballPlan);
    else if (s === "avalanche") setPlan(avalanchePlan);
    else setPlan(baselinePlan);
  };

  /* ── JSON export/import ── */
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(loans, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `הלוואות-${email}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target?.result as string) as Loan[];
          setLoans(data); saveLoans(data); setPlan(null); setCalculated(false);
        } catch { alert("קובץ לא תקין"); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const strategyLabel = STRATEGIES.find(s => s.value === strategy)?.label ?? "";

  /* ── Loading / error ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-red-700">{error}</div>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      {/* ── Admin banner ── */}
      <div className="bg-purple-600 text-white text-xs px-4 py-1.5 flex items-center gap-2 justify-center" dir="rtl">
        <Shield size={12} />
        <span>מצב ניהול — צופה בחשבון של <strong>{email}</strong></span>
        <span className="mx-2 opacity-40">|</span>
        <a href="/admin" className="flex items-center gap-1 underline underline-offset-2 hover:no-underline">
          <ArrowRight size={11} /> חזרה לפאנל ניהול
        </a>
      </div>

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Snowflake size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-lg leading-tight">כדור שלג</h1>
              <p className="text-xs text-slate-400 truncate max-w-48">{email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={importJSON}>
              <Download size={14} /><span className="hidden sm:inline">טען JSON</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={exportJSON}>
              <Save size={14} /><span className="hidden sm:inline">שמור JSON</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowImport(true)}>
              <Upload size={14} /><span className="hidden sm:inline">ייבוא קובץ</span>
            </Button>
            <Button variant="primary" size="sm" onClick={() => { setEditingLoan(null); setShowForm(true); }}>
              <Plus size={14} />הלוואה חדשה
            </Button>
            {saving && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Loader2 size={12} className="animate-spin" /> שומר...
              </span>
            )}
            {saved && !saving && (
              <span className="text-xs text-emerald-600 font-medium">✓ נשמר</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon size={15} />{tab.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Strategy bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-4 shadow-sm">
          <div>
            <p className="text-xs text-slate-500 mb-1">אסטרטגיה</p>
            <div className="flex gap-1">
              {STRATEGIES.map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleStrategyChange(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      strategy === opt.value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Icon size={13} />{opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 min-w-40">
            <p className="text-xs text-slate-500 mb-1">תשלום נוסף חודשי (₪)</p>
            <input
              type="number" min="0" value={extraInput}
              onChange={e => { setExtraInput(e.target.value); setExtraPayment(parseFloat(e.target.value) || 0); }}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="0"
            />
          </div>

          <div className="flex items-end">
            <Button variant="primary" onClick={calculate} disabled={loans.filter(l => l.status === "active").length === 0}>
              חשב תוכנית
            </Button>
          </div>

          {calculated && plan && (
            <div className="flex items-center gap-4 text-sm text-slate-600 border-r border-slate-200 pr-4">
              <span>סיום: <strong className="text-blue-700">{plan.payoffDate}</strong></span>
              <span>ריבית: <strong className="text-amber-700">₪{Math.round(plan.totalInterest).toLocaleString()}</strong></span>
              <span>{plan.totalMonths} חודשים</span>
            </div>
          )}
        </div>

        {/* Tab content */}
        {activeTab === "dashboard" && (
          <Dashboard loans={loans} optimized={plan} baseline={baselinePlan} strategyName={strategyLabel} />
        )}
        {activeTab === "loans" && (
          <LoanTable
            loans={loans}
            onEdit={loan => { setEditingLoan(loan); setShowForm(true); }}
            onDelete={deleteLoan}
            onAdd={() => { setEditingLoan(null); setShowForm(true); }}
            onReorder={reorderLoans}
            onDetail={loan => setDetailLoan(loan)}
          />
        )}
        {activeTab === "charts" && (
          <Charts plan={plan} baseline={baselinePlan} />
        )}
        {activeTab === "actions" && (
          <ActionPlan plan={plan} strategyName={strategyLabel} baseline={baselinePlan} />
        )}
        {activeTab === "scenarios" && (
          <ScenarioComparison
            baseline={baselinePlan}
            optimized={plan}
            snowball={snowballPlan}
            avalanche={avalanchePlan}
            currentStrategy={strategy === "baseline" ? "baseline" : strategy}
          />
        )}
      </main>

      {/* Modals */}
      <LoanForm
        open={showForm}
        loan={editingLoan}
        onSave={upsertLoan}
        onClose={() => { setShowForm(false); setEditingLoan(null); }}
      />
      <ImportWizard
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
      />
      <LoanDetail
        open={detailLoan !== null}
        loan={detailLoan}
        onSave={upsertLoan}
        onClose={() => setDetailLoan(null)}
      />
    </div>
  );
}
