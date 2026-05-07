import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Fallback values prevent a crash during Next.js SSR/prerender at build time.
  // In production the real env vars are always present; the placeholders are never
  // used for actual API calls.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL    || "http://localhost",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
  );
}
