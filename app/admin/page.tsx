"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import {
  Shield, Users, RefreshCw, ArrowRight, Mail, Ban, CheckCircle,
  Trash2, AlertTriangle, X, Copy, Check, Pencil,
  Eye, ChevronDown, ChevronUp,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { Loan } from "@/types";

const ADMIN_EMAILS = ["ylevi49@gmail.com"];

/* ─── Types ─── */
type AdminUser = {
  id: string; email: string; created_at: string;
  last_sign_in_at: string | null; provider: string;
  loanCount: number; totalDebt: number;
  loans: Loan[]; updatedAt: string | null; isBanned: boolean;
};
type Toast   = { msg: string; ok: boolean };
type Confirm = { userId: string; email: string; action: string; label: string; warn?: string };

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("he-IL", { day:"2-digit", month:"2-digit", year:"numeric" });
}

/* ─── Main ─── */
export default function AdminPage() {
  const supabase = createClient();
  const [, setMe]               = useState<User | null>(null);
  const [users, setUsers]       = useState<AdminUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast]       = useState<Toast | null>(null);
  const [confirm, setConfirm]   = useState<Confirm | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied]     = useState<string | null>(null);
  const [editEmailId, setEditEmailId] = useState<string | null>(null);
  const [editEmailVal, setEditEmailVal] = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setMe(user);
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

  const doAction = useCallback(async (
    action: string, userId: string, email: string,
    extra?: Record<string, unknown>
  ) => {
    setActionLoading(`${userId}:${action}`);
    try {
      const res  = await fetch("/api/admin/action", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId, email, ...extra }),
      });
      const json = await res.json();
      if (json.error) setToast({ msg: json.error, ok: false });
      else {
        setToast({ msg: json.message ?? "בוצע בהצלחה", ok: true });
        if (action !== "send_magic_link") await fetchUsers();
      }
    } catch (e) { setToast({ msg: String(e), ok: false }); }
    setActionLoading(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopied(email); setTimeout(() => setCopied(null), 2000);
  };

  /* ── Stats ── */
  const totalDebt = users.reduce((s, u) => s + u.totalDebt, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50/30" dir="rtl">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium ${toast.ok ? "bg-emerald-600" : "bg-red-600"} text-white`}>
          {toast.ok ? <Check size={15}/> : <AlertTriangle size={15}/>} {toast.msg}
        </div>
      )}

      {/* Confirm */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-600"/>
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
              <button onClick={async () => { const c=confirm; setConfirm(null); await doAction(c.action, c.userId, c.email); }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">אישור</button>
              <button onClick={() => setConfirm(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-2.5 text-sm font-medium transition-colors">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center">
              <Shield size={20} className="text-white"/>
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-lg leading-tight">פאנל ניהול</h1>
              <p className="text-xs text-slate-400">כדור שלג — ניהול משתמשים</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchUsers} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <RefreshCw size={14}/> רענן
            </button>
            <a href="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <ArrowRight size={14}/> אפליקציה
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {loading   && <div className="text-center py-16 text-slate-400">טוען נתונים...</div>}
        {pageError && <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center text-red-700">{pageError}</div>}

        {!loading && !pageError && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "משתמשים",    val: users.length,                          cls: "text-slate-800" },
                { label: "עם הלוואות", val: users.filter(u=>u.loanCount>0).length, cls: "text-blue-600"  },
                { label: "חסומים",     val: users.filter(u=>u.isBanned).length,    cls: "text-red-500"   },
                { label: "סך חוב",     val: `₪${(totalDebt/1000).toFixed(0)}K`,    cls: "text-amber-600" },
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
                <Users size={18} className="text-slate-400"/>
                <h2 className="font-semibold text-slate-700">רשימת משתמשים</h2>
                <span className="mr-auto text-xs text-slate-400">לחץ על שורה לפתיחת אפשרויות</span>
              </div>

              {users.length === 0 && <div className="p-12 text-center text-slate-400 text-sm">אין משתמשים</div>}

              <div className="divide-y divide-slate-100">
                {users.map(u => {
                  const isExpanded = expandedId === u.id;
                  const ld = (a: string) => actionLoading === `${u.id}:${a}`;

                  return (
                    <div key={u.id}>
                      {/* Row */}
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
                        {isExpanded ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0"/> : <ChevronDown size={16} className="text-slate-400 flex-shrink-0"/>}
                      </div>

                      {/* Expanded */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50 px-5 py-5" onClick={e => e.stopPropagation()}>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">

                            {/* תקשורת */}
                            <ActionGroup title="תקשורת">
                              <Btn icon={<Mail size={13}/>} label="שלח קישור כניסה" color="blue" loading={ld("send_magic_link")} onClick={() => doAction("send_magic_link", u.id, u.email)}/>
                              <Btn icon={copied===u.email ? <Check size={13}/> : <Copy size={13}/>} label={copied===u.email ? "הועתק!" : "העתק אימייל"} color="slate" loading={false} onClick={() => copyEmail(u.email)}/>
                            </ActionGroup>

                            {/* ניהול נתונים */}
                            <ActionGroup title="ניהול נתונים">
                              <a href={`/admin/user/${u.id}`} className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg transition-colors bg-indigo-50 text-indigo-700 hover:bg-indigo-100 w-full">
                                <Eye size={13}/> פתח חשבון מלא
                              </a>
                              <p className="text-xs text-slate-400 px-1">כל הטאבים: דשבורד, הלוואות, גרפים, תוכנית, תרחישים</p>
                            </ActionGroup>

                            {/* ניהול חשבון */}
                            <ActionGroup title="ניהול חשבון">
                              {u.isBanned
                                ? <Btn icon={<CheckCircle size={13}/>} label="שחרר חסימה" color="emerald" loading={ld("unban_user")} onClick={() => doAction("unban_user", u.id, u.email)}/>
                                : <Btn icon={<Ban size={13}/>} label="חסום משתמש" color="orange" loading={ld("ban_user")} onClick={() => setConfirm({ userId:u.id, email:u.email, action:"ban_user", label:"חסימת משתמש" })}/>
                              }
                              <Btn icon={<Trash2 size={13}/>} label="נקה הלוואות" color="amber" loading={ld("clear_loans")} onClick={() => setConfirm({ userId:u.id, email:u.email, action:"clear_loans", label:"מחיקת נתוני הלוואות" })}/>
                              <Btn icon={<X size={13}/>} label="מחק משתמש" color="red" loading={ld("delete_user")} onClick={() => setConfirm({ userId:u.id, email:u.email, action:"delete_user", label:"מחיקת משתמש לצמיתות", warn:"⚠️ פעולה זו בלתי הפיכה." })}/>
                            </ActionGroup>
                          </div>

                          {/* Edit email */}
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">שינוי אימייל</p>
                            {editEmailId === u.id ? (
                              <div className="flex gap-2">
                                <input type="email" value={editEmailVal} onChange={e => setEditEmailVal(e.target.value)}
                                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 flex-1" placeholder="אימייל חדש" dir="ltr"/>
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
                              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">סיכום הלוואות ({u.loanCount})</p>
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

/* ── Sub-components ── */
function ActionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{title}</p>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

type BtnColor = "blue"|"slate"|"indigo"|"emerald"|"orange"|"amber"|"red";
const COLORS: Record<BtnColor, string> = {
  blue:    "bg-blue-50 text-blue-700 hover:bg-blue-100",
  slate:   "bg-slate-50 text-slate-700 hover:bg-slate-100",
  indigo:  "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
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
      className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50 w-full ${COLORS[color]}`}>
      {loading ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0"/> : <span className="flex-shrink-0">{icon}</span>}
      {label}
    </button>
  );
}
