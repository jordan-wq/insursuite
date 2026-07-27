import { NextResponse } from "next/server";
import { createServerSupabase } from "../../lib/supabase/server";
import { createAdminSupabase } from "../../lib/supabase/admin";
import { hasSupabaseConfig } from "../../lib/supabase/config";

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://insursuite.local");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export async function GET(request: Request) {
  if (!hasSupabaseConfig()) return NextResponse.redirect(new URL("/login", request.url));

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnTo = safeReturnTo(url.searchParams.get("return_to"));

  if (code) {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    const email = data.user?.email || data.session?.user.email;

    if (!error && email) {
      const admin = createAdminSupabase();
      const { data: invite } = await admin.from("staff_invites").select("id").eq("status", "pending").eq("email", email.toLowerCase()).maybeSingle();
      if (invite && data.user) {
        const { error: roleError } = await admin.from("agent_roles").insert({ user_id: data.user.id });
        if (roleError && roleError.code !== "23505") {
          console.error("Failed to grant agent_roles on invite acceptance", { inviteId: invite.id, error: roleError.message });
        } else {
          await admin.from("staff_invites").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", invite.id);
        }
      }
    }
  }

  return NextResponse.redirect(new URL(returnTo, request.url));
}
