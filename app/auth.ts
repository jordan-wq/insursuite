import { redirect } from "next/navigation";
import { hasSupabaseConfig } from "./lib/supabase/config";
import { createServerSupabase } from "./lib/supabase/server";

export type PortalUser = {
  id: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export async function getCurrentUser(): Promise<PortalUser | null> {
  const supabaseUser = await getSupabaseUser();
  if (supabaseUser) return supabaseUser;
  return getLocalDevUser();
}

function getLocalDevUser(): PortalUser | null {
  if (process.env.NODE_ENV === "production" && isAuthRequired()) return null;

  const email = process.env.LOCAL_DEV_USER_EMAIL || "local.client@insursuite.test";
  const fullName = process.env.LOCAL_DEV_USER_NAME || "Local Client";
  return {
    id: "local-dev-user",
    displayName: fullName,
    email,
    fullName,
  };
}

async function getSupabaseUser(): Promise<PortalUser | null> {
  if (!hasSupabaseConfig()) return null;

  let user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  } | null = null;
  try {
    const supabase = await createServerSupabase();
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    return null;
  }
  if (!user?.email) return null;

  const fullName =
    (typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null) ||
    (typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null);

  return {
    id: user.id,
    displayName: fullName || user.email,
    email: user.email,
    fullName,
  };
}

function isAuthRequired() {
  return process.env.INSURSUITE_REQUIRE_AUTH === "true";
}

export async function requireCurrentUser(returnTo: string): Promise<PortalUser> {
  const user = await getCurrentUser();
  if (user) return user;

  redirect(signInPath(returnTo));
}

export function signInPath(returnTo: string): string {
  return `/login?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}

export function signOutPath(returnTo = "/"): string {
  return `/auth/signout?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (url.pathname === "/login" || url.pathname === "/auth/signout") return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}
