import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ADMIN_EMAILS = ["ylevi49@gmail.com"];

async function verifyAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()             { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user && ADMIN_EMAILS.includes(user.email ?? "") ? user : null;
}

export async function POST(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "אין הרשאות" }, { status: 403 });

  const { action, userId, email, loans } = await request.json();

  if (!action) return NextResponse.json({ error: "חסר שדה action" }, { status: 400 });

  // Admin client (service role) for destructive / privileged operations
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Anon client for sending auth emails (OTP)
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    switch (action) {

      /* ── שלח קישור כניסה ── */
      case "send_magic_link": {
        if (!email) return NextResponse.json({ error: "חסר אימייל" }, { status: 400 });
        const { error } = await anonClient.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, message: `קישור כניסה נשלח ל-${email}` });
      }

      /* ── חסום משתמש ── */
      case "ban_user": {
        if (!userId) return NextResponse.json({ error: "חסר userId" }, { status: 400 });
        const { error } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: "876000h", // ~100 years
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, message: "המשתמש נחסם" });
      }

      /* ── שחרר חסימה ── */
      case "unban_user": {
        if (!userId) return NextResponse.json({ error: "חסר userId" }, { status: 400 });
        const { error } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: "none",
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, message: "החסימה הוסרה" });
      }

      /* ── נקה הלוואות ── */
      case "clear_loans": {
        if (!userId) return NextResponse.json({ error: "חסר userId" }, { status: 400 });
        const { error } = await adminClient
          .from("loans")
          .delete()
          .eq("user_id", userId);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, message: "נתוני ההלוואות נמחקו" });
      }

      /* ── מחק משתמש לחלוטין ── */
      case "delete_user": {
        if (!userId) return NextResponse.json({ error: "חסר userId" }, { status: 400 });
        // Delete loan data first
        await adminClient.from("loans").delete().eq("user_id", userId);
        // Delete the auth user
        const { error } = await adminClient.auth.admin.deleteUser(userId);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, message: "המשתמש נמחק לחלוטין" });
      }

      /* ── שנה אימייל ── */
      case "update_email": {
        if (!userId || !email) return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });
        const { error } = await adminClient.auth.admin.updateUserById(userId, { email });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, message: "האימייל עודכן" });
      }

      /* ── עדכן הלוואות ── */
      case "update_loans": {
        if (!userId || !Array.isArray(loans)) return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });
        const { error } = await adminClient.from("loans").upsert({
          user_id: userId,
          data: loans,
          updated_at: new Date().toISOString(),
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, message: "ההלוואות עודכנו" });
      }

      default:
        return NextResponse.json({ error: "פעולה לא מוכרת" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
