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
  const flow = url.searchParams.get("flow");

  if (code) {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    // Deliberate exception to "admin client only after an explicit isAgent()
    // check" (see AGENTS.md) -- the whole point of this path is granting
    // access to someone who isn't an agent yet, so an isAgent() gate would be
    // circular. Safety instead comes from requiring a genuine, just-completed
    // code exchange AND an exact match on the specific auth user id that
    // inviteUserByEmail created for this invite (not just a matching email --
    // other flows, e.g. client-onboarding invites or ordinary signup, also
    // land on this same callback route and must never match here).
    if (!error && data.user) {
      const admin = createAdminSupabase();
      const { data: invite } = await admin.from("staff_invites").select("id").eq("status", "pending").eq("invited_user_id", data.user.id).maybeSingle();
      if (invite) {
        const { error: roleError } = await admin.from("agent_roles").insert({ user_id: data.user.id });
        if (roleError && roleError.code !== "23505") {
          console.error("Failed to grant agent_roles on invite acceptance", { inviteId: invite.id, error: roleError.message });
        } else {
          await admin.from("staff_invites").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", invite.id);
        }
      }
    }
  }

  // Invite and password-reset links authenticate the user but never give them
  // a password to sign back in with later -- route them through a page that
  // sets one before landing wherever they were headed. Ordinary signup
  // confirmation already has a password from signup, so it skips this. Route
  // there even when the exchange failed (stale/already-used code, the most
  // common real-world failure) so the page's "this link has expired" message
  // is actually reachable, instead of silently bouncing to a contextless login.
  if (flow === "invite" || flow === "reset") {
    return NextResponse.redirect(new URL(`/auth/set-password?return_to=${encodeURIComponent(returnTo)}`, request.url));
  }

  return NextResponse.redirect(new URL(returnTo, request.url));
}
