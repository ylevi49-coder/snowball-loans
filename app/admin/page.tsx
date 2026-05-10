"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { runPayoffSimulation, runBaselineSimulation } from "@/lib/snowballEngine";
import { Dashboard } from "@/components/Dashboard";
import {
  Shield, Users, ChevronDown, ChevronUp, ArrowRight,
  TrendingDown, Snowflake, RefreshCw,
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
};

export default function AdminPage() {
  const supabase = createClient();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers]             = useState<AdminUser[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [dashUser, setDashUser]       = useState<AdminUser | null>(null);
  const [plan, setPlan]               = useState<PayoffPlan | null>(null);
  const [baseline, setBaseline]       = useState<PayoffPlan | null>(null);

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

  const openDashboard = (u: AdminUser) => {
    setDashUser(u);
    const active = u.loans.filter((l) => l.status === "active");
    if (active.length > 0) {
      setBaseline(runBaselineSimulation(active));
      setPlan(runPayoffSimulation(active, 0, "snowball"));
    } else {
      setBaseline(null);
      setPlan(null);
    }
  };

  /* ── Dashboard view ── */
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
              דשבורד של:{" "}
              <strong className="text-slate-800">{dashUser.email}</strong>
            </span>
            <span className="mr-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              צפייה בלבד
            </span>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">
          {dashUser.loans.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              למשתמש זה אין הלוואות שמורות
            </div>
          ) : (
            <Dashboard
              loans={dashUser.loans}
              optimized={plan}
              baseline={baseline}
              strategyName="כדור שלג"
            />
          )}
        </main>
      </div>
    );
  }

  /* ── Main admin view ── */
  const totalDebtAll = users.reduce((s, u) => s + u.totalDebt, 0);
  const withLoans    = users.filter((u) => u.loanCount > 0).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50/30" dir="rtl">
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
        {/* Loading / error */}
        {loading && (
          <div className="text-center py-16 text-slate-400">טוען נתונים...</div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm text-center">
                <p className="text-4xl font-bold text-slate-800">{users.length}</p>
                <p className="text-sm text-slate-500 mt-1">משתמשים רשומים</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm text-center">
                <p className="text-4xl font-bold text-blue-600">{withLoans}</p>
                <p className="text-sm text-slate-500 mt-1">עם הלוואות פעילות</p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm text-center">
                <p className="text-4xl font-bold text-amber-600">
                  ₪{Math.round(totalDebtAll).toLocaleString()}
                </p>
                <p className="text-sm text-slate-500 mt-1">סך חוב כולל במערכת</p>
              </div>
            </div>

            {/* Users list */}
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
                {users.map((u) => (
                  <div key={u.id}>
                    {/* Row */}
                    <div
                      className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                        {u.email?.[0]?.toUpperCase() ?? "?"}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{u.email}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          נרשם:{" "}
                          {new Date(u.created_at).toLocaleDateString("he-IL")}
                          {u.last_sign_in_at && (
                            <>
                              {" · "}כניסה אחרונה:{" "}
                              {new Date(u.last_sign_in_at).toLocaleDateString("he-IL")}
                            </>
                          )}
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="text-center min-w-12">
                        <p className="font-semibold text-slate-700">{u.loanCount}</p>
                        <p className="text-xs text-slate-400">הלוואות</p>
                      </div>
                      <div className="text-center min-w-24">
                        <p className="font-semibold text-slate-700">
                          ₪{Math.round(u.totalDebt).toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-400">חוב</p>
                      </div>

                      {/* Provider badge */}
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full hidden sm:inline">
                        {u.provider === "google" ? "Google" : "Magic Link"}
                      </span>

                      {expandedId === u.id
                        ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" />
                        : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />
                      }
                    </div>

                    {/* Expanded panel */}
                    {expandedId === u.id && (
                      <div className="px-5 pb-5 bg-slate-50 border-t border-slate-100">
                        <div className="flex items-center justify-between mt-4 mb-3">
                          <h3 className="text-sm font-semibold text-slate-600">
                            הלוואות ({u.loanCount})
                          </h3>
                          <button
                            onClick={() => openDashboard(u)}
                            className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <Snowflake size={13} /> צפה בדשבורד
                          </button>
                        </div>

                        {u.loans.length === 0 ? (
                          <p className="text-sm text-slate-400 text-center py-6">
                            המשתמש לא הזין הלוואות
                          </p>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50 border-b border-slate-200">
                                <tr className="text-xs text-slate-500">
                                  <th className="text-right px-4 py-2 font-medium">שם הלוואה</th>
                                  <th className="text-right px-4 py-2 font-medium">יתרה</th>
                                  <th className="text-right px-4 py-2 font-medium">ריבית שנתית</th>
                                  <th className="text-right px-4 py-2 font-medium">תשלום חודשי</th>
                                  <th className="text-right px-4 py-2 font-medium">סטטוס</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {u.loans.map((loan, i) => (
                                  <tr key={i} className="text-slate-700 hover:bg-slate-50">
                                    <td className="px-4 py-2.5 font-medium">{loan.name}</td>
                                    <td className="px-4 py-2.5">
                                      ₪{(loan.currentBalance ?? 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2.5">{loan.annualInterestRate}%</td>
                                    <td className="px-4 py-2.5">
                                      ₪{(loan.monthlyPayment ?? 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span
                                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                          loan.status === "active"
                                            ? "bg-green-100 text-green-700"
                                            : "bg-slate-100 text-slate-500"
                                        }`}
                                      >
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
                            עדכון אחרון:{" "}
                            {new Date(u.updatedAt).toLocaleString("he-IL")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
