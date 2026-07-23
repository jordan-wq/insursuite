"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./config";

export function createClientSupabase() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
