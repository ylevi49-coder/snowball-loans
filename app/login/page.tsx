"use client";
import { useSearchParams } from "next/navigation";
import { Snowflake } from "lucide-react";
import { Suspense } from "react";

function LoginContent() {
  const params = useSearchParams();
  const error  = params.get("error");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
        {/* Logo */}
        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Snowflake size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-1">כדור שלג</h1>
        <p className="text-slate-400 text-sm mb-8">מחשבון פירעון הלוואות</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            שגיאה: {decodeURIComponent(error)}
          </div>
        )}

        {/* Google Sign In — plain anchor, server handles the redirect */}
        <a
          href="/api/auth/google"
          className="w-full flex items-center justify-center gap-3 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors font-medium shadow-sm"
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          כניסה עם Google
        </a>

        <p className="text-xs text-slate-400 mt-6">
          הנתונים שלך מאובטחים ומוצפנים
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
