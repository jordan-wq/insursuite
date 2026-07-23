import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasSupabaseConfig } from "./lib/supabase/config";
import { createServerSupabase } from "./lib/supabase/server";

export type ChatGPTUser = {
  displayName: string;
  email: string;
  fullName: string | null;
};

const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER =
  "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const supabaseUser = await getSupabasePortalUser();
  if (supabaseUser) return supabaseUser;

  const requestHeaders = await headers();
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!email) return getLocalDevUser();

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    displayName: fullName ?? email,
    email,
    fullName,
  };
}

function getLocalDevUser(): ChatGPTUser | null {
  if (process.env.NODE_ENV === "production" && isAuthRequired()) return null;

  const email = process.env.LOCAL_DEV_USER_EMAIL || "local.client@insursuite.test";
  const fullName = process.env.LOCAL_DEV_USER_NAME || "Local Client";
  return {
    displayName: fullName,
    email,
    fullName,
  };
}

async function getSupabasePortalUser(): Promise<ChatGPTUser | null> {
  if (!hasSupabaseConfig()) return null;

  let user: {
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
    displayName: fullName || user.email,
    email: user.email,
    fullName,
  };
}

function isAuthRequired() {
  return process.env.INSURSUITE_REQUIRE_AUTH === "true";
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  if (hasSupabaseConfig()) {
    return `/login?return_to=${encodeURIComponent(safeReturnTo)}`;
  }
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
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
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
