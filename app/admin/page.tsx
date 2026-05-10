"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { runPayoffSimulation, runBaselineSimulation } from "@/lib/snowballEngine";
import { Dashboard } from "@/components/Dashboard";
import { LoanForm } from "@/components/LoanForm";
import {
  Shield, Users, RefreshCw, ArrowRight, Mail, Ban, CheckCircle,
  Trash2, Snowflake, AlertTriangle, X, Copy, Check, Pencil,
  Eye, Edit3, Plus, ChevronDown, ChevronUp,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { Loan, PayoffPlan } from "@/types";
import { today } from "@/lib/utils";

const ADMIN_EMAILS = ["ylevi49@gmail.com"];

/* ─────────────────── Types ─────────────────── */
type AdminUser = {
  id: string; email: string; created_at: string;
  last_sign_in_at: string | null; provider: string;
  loanCount: number; totalDebt: number;
  loans: Loan[]; updatedAt: string | null; isBanned: boolean;
};
type Toast    = { msg: string; ok: boolean };
type Confirm  = { userId: string; email: string; action: string; label: string; warn?: string };
type ViewMode = "list" | "dashboard" | "edit-loans";

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("he-IL", { day:"2-digit", month:"2-digit", year:"numeric" });
}

/* ─────────────────── Component ─────────────────── */
export default function AdminPage() {
  const supabase = createClient();

  // Data
  const [users, setUsers]           = useState<AdminUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [pageError, setPageError]   = useState<string | null>(null);

  // View
  const [view, setView]             = useState<ViewMode>("list");
  const [activeUser, setActiveUser] = useState<AdminUser | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Dashboard
  const [plan, setPlan]             = useState<PayoffPlan | null>(null);
  const [baseline, setBaseline]     = useState<PayoffPlan | null>(null);

  // Loan editing
  const [editLoans, setEditLoans]   = useState<Loan[]>([]);
  const [showForm, setShowForm]     = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [saving, setSaving]         = useState(false);

  // UX
  const [toast, setToast]           = useState<Toast | null>(null);
  const [confirm, setConfirm]       = useState<Confirm | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied]         = useState<string | null>(null);
  const [editEmailId, setEditEmailId] = useState<string | null>(null);
  const [editEmailVal, setEditEmailVal] = useState("");

  /* toast auto-dismiss */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  /* auth check */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && ADMIN_EMAILS.includes(user.email ?? "")) fetchUsers();
      else { setPageError("אין לך הרשאות גישה לדף זה"); setLoading(false); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const res  = await fetch("/api/admin/users");
    const json = await res.json();
    if (json.error) setPageError(json.error);
    else setUsers(json.users);
    setLoading(false);
  };

  /* generic action */
  const doAction = useCallback(async (
    action: string, userId: string, email: string,
    extra?: Record<string, unknown>
  ) => {
    setActionLoading(`${userId}:${action}`);
    try {
      const res  = await fetch("/api/admin/action", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action, userId, email, ...extra }),
      });
      const json = await res.json();
      if (json.error) setToast({ msg: json.error, ok: false });
      else {
        setToast({ msg: json.message ?? "בוצע בהצלחה", ok: true });
        if (!["send_magic_link"].includes(action)) await fetchUsers();
      }
    } catch (e) { setToast({ msg: String(e), ok: false }); }
    setActionLoading(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* open dashboard */
  const openDashboard = (u: AdminUser) => {
    setActiveUser(u);
    const active = u.loans.filter(l => l.status === "active");
    setBaseline(active.length ? runBaselineSimulation(active) : null);
    setPlan(active.length ? runPayoffSimulation(active, 0, "snowball") : null);
    setView("dashboard");
  };

  /* open loan editor */
  const openEditLoans = (u: AdminUser) => {
    setActiveUser(u);
    setEditLoans([...u.loans]);
    setView("edit-loans");
  };

  /* save edited loans */
  const saveLoans = async () => {
    if (!activeUser) return;
    setSaving(true);
    await doAction("update_loans", activeUser.id, activeUser.email, { loans: editLoans });
    setSaving(false);
    setView("list");
    setActiveUser(null);
  };

  /* loan CRUD in edit mode */
  const upsertLoan = (loan: Loan) => {
    setEditLoans(prev => {
      const exists = prev.some(l => l.id === loan.id);
      return exists ? prev.map(l => l.id === loan.id ? loan : l) : [...prev, loan];
    });
  };
  const deleteLoan = (id: string) => setEditLoans(prev => prev.filter(l => l.id !== id));

  /* copy email */
  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopied(email);
    setTimeout(() => setCopied(null), 2000);
  };

  /* ═══════════════════════════════════════════
     DASHBOARD VIEW
  ═══════════════════════════════════════════ */
  if (view === "dashboard" && activeUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
        <SubHeader label={`דשבורד — ${activeUser.email}`} badge="צפייה בלבד" onBack={() => setView("list")} />
        <main className="max-w-7xl mx-auto px-4 py-6">
          {activeUser.loans.length === 0
            ? <Empty text="למשתמש זה אין הלוואות שמורות" />
            : <Dashboard loans={activeUser.loans} optimized={plan} baseline={baseline} strategyName="כדור שלג" />}
        </main>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     EDIT-LOANS VIEW
  ═══════════════════════════════════════════ */
  if (view === "edit-loans" && activeUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50/20" dir="rtl">
        <SubHeader label={`עריכת הלוואות — ${activeUser.email}`} badge="מצב עריכה" onBack={() => setView("list")} />

        <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {editLoans.length} הלוואות · שינויים יישמרו לחשבון המשתמש
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setEditingLoan(null); setShowForm(true); }}
                className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors"
              >
                <Plus size={14} /> הוסף הלוואה
              </button>
              <button
                onClick={saveLoans}
                disabled={saving}
                className="flex items-center gap-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
              >
                {saving ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={14} />}
                שמור שינויים
              </button>
            </div>
          </div>

          {/* Loans */}
          {editLoans.length === 0 && <Empty text="אין הלוואות — לחץ 'הוסף הלוואה'" />}
          <div className="space-y-3">
            {editLoans.map((loan) => (
              <div key={loan.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800">{loan.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    יתרה: ₪{(loan.currentBalance ?? 0).toLocaleString()} ·
                    ריבית: {loan.annualInterestRate}% ·
                    תשלום: ₪{(loan.monthlyPayment ?? 0).toLocaleString()}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${loan.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                  {loan.status === "active" ? "פעיל" : "סגור"}
                </span>
                <button
                  onClick={() => { setEditingLoan(loan); setShowForm(true); }}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => deleteLoan(loan.id)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </main>

        <LoanForm
          open={showForm}
          loan={editingLoan}
          onSave={(loan) => { upsertLoan(loan); setShowForm(false); setEditingLoan(null); }}
          onClose={() => { setShowForm(false); setEditingLoan(null); }}
        />
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     MAIN LIST VIEW
  ═══════════════════════════════════════════ */
  const totalDebt = users.reduce((s, u) => s + u.totalDebt, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50/30" dir="rtl">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium ${toast.ok ? "bg-emerald-600" : "bg-red-600"} text-white`}>
          {toast.ok ? <Check size={15} /> : <AlertTriangle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Confirm modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800">אישור פעולה</p>
                <p className="text-xs text-slate-400">{confirm.label}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-1">עבור:</p>
            <p className="text-sm font-semibold text-slate-800 mb-3 truncate">{confirm.email}</p>
            {confirm.warn && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700">{confirm.warn}</div>
            )}
            <div className="flex gap-2">
              <button onClick={async () => { const c = confirm; setConfirm(null); await doAction(c.action, c.userId, c.email); }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">
                אישור
              </button>
              <button onClick={() => setConfirm(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-2.5 text-sm font-medium transition-colors">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-lg leading-tight">פאנל ניהול</h1>
              <p className="text-xs text-slate-400">כדור שלג — ניהול משתמשים</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchUsers} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <RefreshCw size={14} /> רענן
            </button>
            <a href="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <ArrowRight size={14} /> אפליקציה
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {loading    && <div className="text-center py-16 text-slate-400">טוען נתונים...</div>}
        {pageError  && <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center text-red-700">{pageError}</div>}

        {!loading && !pageError && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "משתמשים",    val: users.length,                         cls: "text-slate-800" },
                { label: "עם הלוואות", val: users.filter(u=>u.loanCount>0).length, cls: "text-blue-600"  },
                { label: "חסומים",     val: users.filter(u=>u.isBanned).length,   cls: "text-red-500"   },
                { label: "סך חוב",     val: `₪${(totalDebt/1000).toFixed(0)}K`,   cls: "text-amber-600" },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center">
                  <p className={`text-3xl font-bold ${s.cls}`}>{s.val}</p>
                  <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Users */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Users size={18} className="text-slate-400" />
                <h2 className="font-semibold text-slate-700">רשימת משתמשים</h2>
                <span className="mr-auto text-xs text-slate-400">{users.length} משתמשים · לחץ על שורה לפעולות</span>
              </div>

              {users.length === 0 && <Empty text="אין משתמשים" />}

              <div className="divide-y divide-slate-100">
                {users.map(u => {
                  const isExpanded = expandedId === u.id;
                  const ld = (a:string) => actionLoading === `${u.id}:${a}`;

                  return (
                    <div key={u.id}>
                      {/* ── Row ── */}
                      <div
                        onClick={() => setExpandedId(isExpanded ? null : u.id)}
                        className={`px-5 py-4 flex items-center gap-3 hover:bg-slate-50 cursor-pointer transition-colors ${u.isBanned ? "bg-red-50/50" : ""}`}
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${u.isBanned ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-700"}`}>
                          {u.email[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-slate-800 truncate">{u.email}</p>
                            {u.isBanned && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">חסום</span>}
                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{u.provider === "google" ? "Google" : "Magic Link"}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            נרשם: {fmt(u.created_at)}{u.last_sign_in_at && ` · כניסה אחרונה: ${fmt(u.last_sign_in_at)}`}
                          </p>
                        </div>
                        <div className="text-center min-w-16 hidden sm:block">
                          <p className="font-semibold text-slate-700">{u.loanCount}</p>
                          <p className="text-xs text-slate-400">הלוואות</p>
                        </div>
                        <div className="text-center min-w-24 hidden md:block">
                          <p className="font-semibold text-slate-700">₪{Math.round(u.totalDebt).toLocaleString()}</p>
                          <p className="text-xs text-slate-400">חוב</p>
                        </div>
                        {isExpanded ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />}
                      </div>

                      {/* ── Expanded ── */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50 px-5 py-5" onClick={e => e.stopPropagation()}>

                          {/* Action groups */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">

                            {/* Group 1: תקשורת */}
                            <ActionGroup title="תקשורת">
                              <Btn icon={<Mail size={13}/>} label="שלח קישור כניסה" color="blue" loading={ld("send_magic_link")} onClick={() => doAction("send_magic_link", u.id, u.email)} />
                              <Btn icon={copied===u.email ? <Check size={13}/> : <Copy size={13}/>} label={copied===u.email ? "הועתק!" : "העתק אימייל"} color="slate" loading={false} onClick={() => copyEmail(u.email)} />
                            </ActionGroup>

                            {/* Group 2: צפייה ועריכה */}
                            <ActionGroup title="נתונים">
                              <Btn icon={<Eye size={13}/>} label="צפה בדשבורד" color="indigo" loading={false} onClick={() => openDashboard(u)} />
                              <Btn icon={<Edit3 size={13}/>} label="ערוך הלוואות" color="teal" loading={false} onClick={() => openEditLoans(u)} />
                            </ActionGroup>

                            {/* Group 3: ניהול חשבון */}
                            <ActionGroup title="ניהול חשבון">
                              {u.isBanned
                                ? <Btn icon={<CheckCircle size={13}/>} label="שחרר חסימה" color="emerald" loading={ld("unban_user")} onClick={() => doAction("unban_user", u.id, u.email)} />
                                : <Btn icon={<Ban size={13}/>} label="חסום משתמש" color="orange" loading={ld("ban_user")} onClick={() => setConfirm({ userId:u.id, email:u.email, action:"ban_user", label:"חסימת משתמש" })} />
                              }
                              <Btn icon={<Trash2 size={13}/>} label="נקה הלוואות" color="amber" loading={ld("clear_loans")} onClick={() => setConfirm({ userId:u.id, email:u.email, action:"clear_loans", label:"מחיקת נתוני הלוואות" })} />
                              <Btn icon={<X size={13}/>} label="מחק משתמש" color="red" loading={ld("delete_user")} onClick={() => setConfirm({ userId:u.id, email:u.email, action:"delete_user", label:"מחיקת משתמש לצמיתות", warn:"⚠️ פעולה זו בלתי הפיכה. המשתמש וכל נתוניו יימחקו לצמיתות." })} />
                            </ActionGroup>
                          </div>

                          {/* Edit email */}
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">שינוי אימייל</p>
                            {editEmailId === u.id ? (
                              <div className="flex gap-2">
                                <input type="email" value={editEmailVal} onChange={e => setEditEmailVal(e.target.value)}
                                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 flex-1" placeholder="אימייל חדש" dir="ltr" />
                                <button onClick={async () => { if (!editEmailVal.trim()) return; await doAction("update_email", u.id, editEmailVal.trim()); setEditEmailId(null); }}
                                  className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700">שמור</button>
                                <button onClick={() => setEditEmailId(null)} className="text-slate-500 px-2 py-1.5 rounded-lg hover:bg-slate-200"><X size={14}/></button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditEmailId(u.id); setEditEmailVal(u.email); }}
                                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors">
                                <Pencil size={12}/> שנה כתובת אימייל
                              </button>
                            )}
                          </div>

                          {/* Loans summary */}
                          {u.loans.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">סיכום הלוואות</p>
                              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                <table className="w-full text-sm">
                                  <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-400">
                                    <tr>
                                      <th className="text-right px-4 py-2 font-medium">שם</th>
                                      <th className="text-right px-4 py-2 font-medium">יתרה</th>
                                      <th className="text-right px-4 py-2 font-medium">ריבית</th>
                                      <th className="text-right px-4 py-2 font-medium">תשלום</th>
                                      <th className="text-right px-4 py-2 font-medium">סטטוס</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {u.loans.map((loan, i) => (
                                      <tr key={i} className="text-slate-700">
                                        <td className="px-4 py-2.5 font-medium">{loan.name}</td>
                                        <td className="px-4 py-2.5">₪{(loan.currentBalance??0).toLocaleString()}</td>
                                        <td className="px-4 py-2.5">{loan.annualInterestRate}%</td>
                                        <td className="px-4 py-2.5">₪{(loan.monthlyPayment??0).toLocaleString()}</td>
                                        <td className="px-4 py-2.5">
                                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${loan.status==="active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                                            {loan.status==="active" ? "פעיל" : "סגור"}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/* ─── Sub-components ─── */
function SubHeader({ label, badge, onBack }: { label: string; badge: string; onBack: () => void }) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium">
          <ArrowRight size={16} /> חזרה לניהול
        </button>
        <span className="text-slate-200">|</span>
        <span className="text-sm text-slate-600 truncate">{label}</span>
        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex-shrink-0">{badge}</span>
      </div>
    </header>
  );
}

function ActionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{title}</p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="p-12 text-center text-slate-400 text-sm">{text}</div>;
}

type BtnColor = "blue"|"slate"|"indigo"|"teal"|"emerald"|"orange"|"amber"|"red";
const COLORS: Record<BtnColor, string> = {
  blue:    "bg-blue-50 text-blue-700 hover:bg-blue-100",
  slate:   "bg-slate-50 text-slate-700 hover:bg-slate-100",
  indigo:  "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
  teal:    "bg-teal-50 text-teal-700 hover:bg-teal-100",
  emerald: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  orange:  "bg-orange-50 text-orange-700 hover:bg-orange-100",
  amber:   "bg-amber-50 text-amber-700 hover:bg-amber-100",
  red:     "bg-red-50 text-red-700 hover:bg-red-100",
};

function Btn({ icon, label, color, loading, onClick }: {
  icon: React.ReactNode; label: string; color: BtnColor; loading: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50 w-full text-right ${COLORS[color]}`}>
      {loading ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" /> : <span className="flex-shrink-0">{icon}</span>}
      {label}
    </button>
  );
}
