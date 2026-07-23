import { NextResponse } from "next/server";
import { createServerSupabase } from "../../lib/supabase/server";
import { hasSupabaseConfig } from "../../lib/supabase/config";

export async function POST(request: Request) {
  if (hasSupabaseConfig()) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
