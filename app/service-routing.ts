import { createAdminSupabase } from "./lib/supabase/admin";

async function getAgentIds(): Promise<string[]> {
  const admin = createAdminSupabase();
  const { data } = await admin.from("agent_roles").select("user_id").order("created_at", { ascending: true });
  return (data || []).map((row) => row.user_id);
}

export async function isAgent(userId: string) {
  const admin = createAdminSupabase();
  const { data } = await admin.from("agent_roles").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

export async function chooseAgent(seed: number | string = 0): Promise<string | null> {
  const agents = await getAgentIds();
  if (!agents.length) return null;
  const number = typeof seed === "number" ? seed : [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return agents[Math.abs(number) % agents.length];
}
