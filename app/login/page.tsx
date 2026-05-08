"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Snowflake, Mail, Loader2, CheckCircle } from "lucide-react";

function LoginContent() {
  const params  = useSearchParams();
  const urlErr  = params.get("error");

  const [email, setEmail]   = useState("");
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(urlErr);

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) setError(error.message);
      else setSent(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">

        {/* Logo */}
        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Snowflake size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">כדור שלג</h1>
        <p className="text-slate-400 text-sm mb-8">מחשבון פירעון הלוואות</p>

        {sent ? (
          /* ── Success state ── */
          <div className="text-center space-y-3">
            <CheckCircle size={48} className="text-emerald-500 mx-auto" />
            <p className="font-semibold text-slate-800">נשלח קישור כניסה!</p>
            <p className="text-sm text-slate-500">
              בדוק את תיבת הדואר של <strong>{email}</strong> ולחץ על הקישור שקיבלת.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="text-xs text-blue-500 hover:underline mt-2"
            >
              שלח שוב / כתובת אחרת
            </button>
          </div>
        ) : (
          /* ── Email form ── */
          <form onSubmit={sendMagicLink} className="space-y-3">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-right">
                {error}
              </div>
            )}

            <div className="relative">
              <Mail size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="כתובת אימייל"
                dir="ltr"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 text-right"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-3 font-medium text-sm transition-colors disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              {loading ? "שולח..." : "שלח קישור כניסה"}
            </button>

            {/* Google OAuth — server-side route */}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-2 text-xs text-slate-400">או</span>
              </div>
            </div>

            <a
              href="/api/auth/google"
              className="w-full flex items-center justify-center gap-3 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 hover:bg-slate-50 transition-colors font-medium text-sm shadow-sm"
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              כניסה עם Google
            </a>
          </form>
        )}

        <p className="text-xs text-slate-400 mt-6">הנתונים שלך מאובטחים ומוצפנים</p>
        {/* debug — remove after fix */}
        <p className="text-xs text-slate-300 mt-1 break-all" dir="ltr">
          key len: {(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").length} |
          start: {(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "MISSING").slice(0,12)} |
          end: {(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "MISSING").slice(-6)}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
