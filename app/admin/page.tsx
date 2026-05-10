"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { runPayoffSimulation, runBaselineSimulation } from "@/lib/snowballEngine";
import { Dashboard } from "@/components/Dashboard";
import {
  Shield, Users, ChevronDown, ChevronUp, ArrowRight,
  RefreshCw, Mail, Ban, CheckCircle, Trash2, Snowflake,
  AlertTriangle, X, Copy, Check, Pencil,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { Loan, PayoffPlan } from "@/types";

const ADMIN_EMAILS = ["ylevi49@gmail.com"];

type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  provider: string;
  loanCount: number;
  totalDebt: number;
  loans: Loan[];
  updatedAt: string | null;
  isBanned: boolean;
};

type Toast = { message: string; type: "success" | "error" };
type ConfirmState = {
  userId: string;
  email: string;
  action: "delete_user" | "clear_loans" | "ban_user";
  label: string;
};

/* ── tiny helpers ── */
function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("he-IL", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

export default function AdminPage() {
  const supabase = createClient();
  const [, setCurrentUser]            = useState<User | null>(null);
  const [users, setUsers]             = useState<AdminUser[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [dashUser, setDashUser]       = useState<AdminUser | null>(null);
  const [plan, setPlan]               = useState<PayoffPlan | null>(null);
  const [baseline, setBaseline]       = useState<PayoffPlan | null>(null);
  const [toast, setToast]             = useState<Toast | null>(null);
  const [confirm, setConfirm]         = useState<ConfirmState | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // "userId:action"
  const [copied, setCopied]           = useState<string | null>(null);
  const [editEmailId, setEditEmailId] = useState<string | null>(null);
  const [editEmailVal, setEditEmailVal] = useState("");

  /* ── Toast auto-dismiss ── */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  /* ── Auth check ── */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
      if (user && ADMIN_EMAILS.includes(user.email ?? "")) {
        fetchUsers();
      } else {
        setError("אין לך הרשאות גישה לדף זה");
        setLoading(false);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/users");
      const json = await res.json();
      if (json.error) setError(json.error);
      else setUsers(json.users);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  /* ── Generic action caller ── */
  const doAction = useCallback(async (
    action: string,
    userId: string,
    email: string,
    extraBody?: Record<string, string>
  ) => {
    const key = `${userId}:${action}`;
    setActionLoading(key);
    try {
      const res  = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId, email, ...extraBody }),
      });
      const json = await res.json();
      if (json.error) {
        setToast({ message: json.error, type: "error" });
      } else {
        setToast({ message: json.message ?? "בוצע בהצלחה", type: "success" });
        // Refresh user list for state-changing actions
        if (["ban_user","unban_user","delete_user","clear_loans","update_email"].includes(action)) {
          await fetchUsers();
        }
      }
    } catch (e) {
      setToast({ message: String(e), type: "error" });
    } finally {
      setActionLoading(null);
    }
  }, []); // eslint-disable-line

  /* ── Confirmed destructive action ── */
  const handleConfirmed = async () => {
    if (!confirm) return;
    setConfirm(null);
    await doAction(confirm.action, confirm.userId, confirm.email);
  };

  /* ── Dashboard view ── */
  const openDashboard = (u: AdminUser) => {
    setDashUser(u);
    const active = u.loans.filter((l) => l.status === "active");
    if (active.length > 0) {
      setBaseline(runBaselineSimulation(active));
      setPlan(runPayoffSimulation(active, 0, "snowball"));
    } else {
      setBaseline(null); setPlan(null);
    }
  };

  /* ── Copy to clipboard ── */
  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopied(email);
    setTimeout(() => setCopied(null), 2000);
  };

  /* ── Dashboard preview ── */
  if (dashUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setDashUser(null)}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium"
            >
              <ArrowRight size={16} /> חזרה לניהול
            </button>
            <span className="text-slate-200">|</span>
            <span className="text-sm text-slate-500">
              דשבורד של: <strong className="text-slate-800">{dashUser.email}</strong>
            </span>
            <span className="mr-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              צפייה בלבד
            </span>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">
          {dashUser.loans.length === 0
            ? <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">למשתמש זה אין הלוואות שמורות</div>
            : <Dashboard loans={dashUser.loans} optimized={plan} baseline={baseline} strategyName="כדור שלג" />
          }
        </main>
      </div>
    );
  }

  /* ── Stats ── */
  const totalDebtAll = users.reduce((s, u) => s + u.totalDebt, 0);
  const withLoans    = users.filter((u) => u.loanCount > 0).length;
  const banned       = users.filter((u) => u.isBanned).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50/30" dir="rtl">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium transition-all ${
          toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.type === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}
          {toast.message}
        </div>
      )}

      {/* ── Confirm modal ── */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800">אישור פעולה</p>
                <p className="text-xs text-slate-400">{confirm.label}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-1">
              האם אתה בטוח שברצונך לבצע פעולה זו עבור:
            </p>
            <p className="text-sm font-semibold text-slate-800 mb-4 truncate">{confirm.email}</p>
            {confirm.action === "delete_user" && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs text-red-700">
                ⚠️ פעולה זו בלתי הפיכה. המשתמש וכל נתוניו יימחקו לצמיתות.
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleConfirmed}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
              >
                אישור
              </button>
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-2.5 text-sm font-medium transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
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
          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <RefreshCw size={14} /> רענן
            </button>
            <a
              href="/"
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ArrowRight size={14} /> חזרה לאפליקציה
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {loading && <div className="text-center py-16 text-slate-400">טוען נתונים...</div>}
        {error   && <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center text-red-700">{error}</div>}

        {!loading && !error && (
          <>
            {/* ── Stats ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "משתמשים רשומים", value: users.length,  color: "text-slate-800" },
                { label: "עם הלוואות",     value: withLoans,     color: "text-blue-600"  },
                { label: "חסומים",          value: banned,        color: "text-red-500"   },
                { label: "סך חוב (₪)",      value: `₪${Math.round(totalDebtAll / 1000)}K`, color: "text-amber-600" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center">
                  <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* ── Users list ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Users size={18} className="text-slate-400" />
                <h2 className="font-semibold text-slate-700">רשימת משתמשים</h2>
                <span className="mr-auto text-xs text-slate-400">{users.length} משתמשים</span>
              </div>

              {users.length === 0 && (
                <div className="p-12 text-center text-slate-400">אין משתמשים</div>
              )}

              <div className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isExpanded = expandedId === u.id;
                  const actionKey  = (a: string) => `${u.id}:${a}`;
                  const isLoading  = (a: string) => actionLoading === actionKey(a);

                  return (
                    <div key={u.id}>
                      {/* ── Row ── */}
                      <div
                        className={`px-5 py-4 flex items-center gap-4 hover:bg-slate-50 cursor-pointer transition-colors ${u.isBanned ? "bg-red-50/40" : ""}`}
                        onClick={() => setExpandedId(isExpanded ? null : u.id)}
                      >
                        {/* Avatar */}
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${u.isBanned ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-700"}`}>
                          {u.email?.[0]?.toUpperCase() ?? "?"}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-800 truncate">{u.email}</p>
                            {u.isBanned && (
                              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full flex-shrink-0">חסום</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            נרשם: {fmt(u.created_at)}
                            {u.last_sign_in_at && <> · כניסה אחרונה: {fmt(u.last_sign_in_at)}</>}
                          </p>
                        </div>

                        {/* Stats */}
                        <div className="text-center min-w-12 hidden sm:block">
                          <p className="font-semibold text-slate-700">{u.loanCount}</p>
                          <p className="text-xs text-slate-400">הלוואות</p>
                        </div>
                        <div className="text-center min-w-24 hidden sm:block">
                          <p className="font-semibold text-slate-700">₪{Math.round(u.totalDebt).toLocaleString()}</p>
                          <p className="text-xs text-slate-400">חוב</p>
                        </div>
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full hidden md:inline">
                          {u.provider === "google" ? "Google" : "Magic Link"}
                        </span>
                        {isExpanded ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />}
                      </div>

                      {/* ── Expanded panel ── */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50">
                          <div className="px-5 py-4 space-y-4">

                            {/* ── Action buttons ── */}
                            <div>
                              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">פעולות ניהול</p>
                              <div className="flex flex-wrap gap-2">

                                {/* שלח קישור כניסה */}
                                <ActionBtn
                                  icon={<Mail size={13} />}
                                  label="שלח קישור כניסה"
                                  color="blue"
                                  loading={isLoading("send_magic_link")}
                                  onClick={() => doAction("send_magic_link", u.id, u.email)}
                                />

                                {/* העתק אימייל */}
                                <ActionBtn
                                  icon={copied === u.email ? <Check size={13} /> : <Copy size={13} />}
                                  label={copied === u.email ? "הועתק!" : "העתק אימייל"}
                                  color="slate"
                                  loading={false}
                                  onClick={() => copyEmail(u.email)}
                                />

                                {/* צפה בדשבורד */}
                                <ActionBtn
                                  icon={<Snowflake size={13} />}
                                  label="צפה בדשבורד"
                                  color="indigo"
                                  loading={false}
                                  onClick={() => openDashboard(u)}
                                />

                                {/* חסום / שחרר */}
                                {u.isBanned ? (
                                  <ActionBtn
                                    icon={<CheckCircle size={13} />}
                                    label="שחרר חסימה"
                                    color="emerald"
                                    loading={isLoading("unban_user")}
                                    onClick={() => doAction("unban_user", u.id, u.email)}
                                  />
                                ) : (
                                  <ActionBtn
                                    icon={<Ban size={13} />}
                                    label="חסום משתמש"
                                    color="orange"
                                    loading={isLoading("ban_user")}
                                    onClick={() => setConfirm({ userId: u.id, email: u.email, action: "ban_user", label: "חסימת משתמש" })}
                                  />
                                )}

                                {/* נקה הלוואות */}
                                <ActionBtn
                                  icon={<Trash2 size={13} />}
                                  label="נקה הלוואות"
                                  color="amber"
                                  loading={isLoading("clear_loans")}
                                  onClick={() => setConfirm({ userId: u.id, email: u.email, action: "clear_loans", label: "מחיקת נתוני הלוואות" })}
                                />

                                {/* מחק משתמש */}
                                <ActionBtn
                                  icon={<X size={13} />}
                                  label="מחק משתמש"
                                  color="red"
                                  loading={isLoading("delete_user")}
                                  onClick={() => setConfirm({ userId: u.id, email: u.email, action: "delete_user", label: "מחיקת משתמש לצמיתות" })}
                                />
                              </div>
                            </div>

                            {/* ── Edit email ── */}
                            <div>
                              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">עריכת אימייל</p>
                              {editEmailId === u.id ? (
                                <div className="flex gap-2 items-center">
                                  <input
                                    type="email"
                                    value={editEmailVal}
                                    onChange={(e) => setEditEmailVal(e.target.value)}
                                    className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 flex-1"
                                    placeholder="אימייל חדש"
                                    dir="ltr"
                                  />
                                  <button
                                    onClick={async () => {
                                      if (!editEmailVal.trim()) return;
                                      await doAction("update_email", u.id, editEmailVal.trim());
                                      setEditEmailId(null);
                                    }}
                                    className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                                  >
                                    שמור
                                  </button>
                                  <button
                                    onClick={() => setEditEmailId(null)}
                                    className="text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setEditEmailId(u.id); setEditEmailVal(u.email); }}
                                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-100 transition-colors"
                                >
                                  <Pencil size={12} /> שנה אימייל
                                </button>
                              )}
                            </div>

                            {/* ── Loans table ── */}
                            <div>
                              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                                הלוואות ({u.loanCount})
                              </p>
                              {u.loans.length === 0 ? (
                                <p className="text-sm text-slate-400 py-4 text-center">המשתמש לא הזין הלוואות</p>
                              ) : (
                                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                  <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                      <tr className="text-xs text-slate-500">
                                        <th className="text-right px-4 py-2 font-medium">שם</th>
                                        <th className="text-right px-4 py-2 font-medium">יתרה</th>
                                        <th className="text-right px-4 py-2 font-medium">ריבית</th>
                                        <th className="text-right px-4 py-2 font-medium">תשלום חודשי</th>
                                        <th className="text-right px-4 py-2 font-medium">סטטוס</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {u.loans.map((loan, i) => (
                                        <tr key={i} className="text-slate-700 hover:bg-slate-50">
                                          <td className="px-4 py-2.5 font-medium">{loan.name}</td>
                                          <td className="px-4 py-2.5">₪{(loan.currentBalance ?? 0).toLocaleString()}</td>
                                          <td className="px-4 py-2.5">{loan.annualInterestRate}%</td>
                                          <td className="px-4 py-2.5">₪{(loan.monthlyPayment ?? 0).toLocaleString()}</td>
                                          <td className="px-4 py-2.5">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${loan.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                                              {loan.status === "active" ? "פעיל" : "סגור"}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              {u.updatedAt && (
                                <p className="text-xs text-slate-400 mt-2 text-left">
                                  עדכון אחרון: {new Date(u.updatedAt).toLocaleString("he-IL")}
                                </p>
                              )}
                            </div>

                          </div>
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

/* ── Reusable action button ── */
type Color = "blue" | "slate" | "indigo" | "emerald" | "orange" | "amber" | "red";
const colorMap: Record<Color, string> = {
  blue:    "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  slate:   "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
  indigo:  "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  orange:  "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
  amber:   "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  red:     "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
};

function ActionBtn({
  icon, label, color, loading, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  color: Color;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-colors disabled:opacity-50 ${colorMap[color]}`}
    >
      {loading
        ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        : icon
      }
      {label}
    </button>
  );
}
