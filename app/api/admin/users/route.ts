import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ADMIN_EMAILS = ["ylevi49@gmail.com"];

export async function GET() {
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
  if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) {
    return NextResponse.json({ error: "אין הרשאות גישה" }, { status: 403 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers();
  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  const { data: loanRecords } = await adminClient
    .from("loans")
    .select("user_id, data, updated_at");

  const loanMap = Object.fromEntries(
    (loanRecords ?? []).map((r) => [r.user_id, r])
  );

  const result = users.map((u) => {
    const loans = (loanMap[u.id]?.data ?? []) as Record<string, unknown>[];
    const totalDebt = loans.reduce(
      (sum, l) => sum + ((l.currentBalance as number) ?? 0),
      0
    );
    // banned_until is null/undefined when not banned
    const bannedUntil = (u as Record<string, unknown>).banned_until as string | null ?? null;
    const isBanned = !!bannedUntil && new Date(bannedUntil) > new Date();

    return {
      id:              u.id,
      email:           u.email ?? "",
      created_at:      u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      provider:        (u.app_metadata?.provider as string) ?? "email",
      loanCount:       loans.length,
      totalDebt,
      loans,
      updatedAt:       loanMap[u.id]?.updated_at ?? null,
      isBanned,
    };
  });

  return NextResponse.json({ users: result });
}
