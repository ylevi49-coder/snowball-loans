import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  return NextResponse.json({
    url_ok:    url.startsWith("https://") && url.includes("supabase.co"),
    url_start: url.slice(0, 30),
    key_len:   key.length,
    key_start: key.slice(0, 20),
    key_end:   key.slice(-8),
  });
}
