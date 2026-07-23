export async function getAgentEmails() {
  return String(process.env.AGENT_EMAILS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

export async function isAgent(email: string) {
  return (await getAgentEmails()).includes(email.toLowerCase());
}

export async function chooseAgent(seed: number | string = 0) {
  const agents = await getAgentEmails();
  if (!agents.length) return "";
  const number = typeof seed === "number" ? seed : [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return agents[Math.abs(number) % agents.length];
}
