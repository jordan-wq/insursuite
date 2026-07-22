import type { ChatGPTUser } from "./chatgpt-auth";
import { sanitizeProfile } from "./profile-fields";
import { initialRequestStatus, priorityForUrgency, sanitizeServiceRequestData } from "./service-request-model";
import { chooseAgent, isAgent } from "./service-routing";

type Profile = {
  id: number;
  userEmail: string;
  fullName: string;
  phone: string;
  dateOfBirth: string;
  onboardingStatus: string;
  onboardingStep: number;
  profileJson: string;
  createdAt: string;
  updatedAt: string;
};

type Policy = Record<string, string | number>;
type DocumentRecord = {
  id: number;
  userEmail: string;
  storageKey: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  policyNumber: string;
  processingStatus: string;
  createdAt: string;
  body?: ArrayBuffer;
};
type ServiceRequest = {
  id: number;
  userEmail: string;
  requestType: string;
  details: string;
  requestDataJson: string;
  status: string;
  assignedTo: string;
  source: string;
  priority: string;
  unreadByAgent: boolean;
  createdAt: string;
  updatedAt: string;
};
type Notification = Record<string, string | number | boolean>;
type KnowledgeEntry = {
  id: number;
  question: string;
  answer: string;
  keywords: string;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
type ChatMessage = Record<string, string | number | null>;

type Store = {
  ids: Record<string, number>;
  profiles: Profile[];
  policies: Policy[];
  documents: DocumentRecord[];
  requests: ServiceRequest[];
  notifications: Notification[];
  knowledge: KnowledgeEntry[];
  chats: ChatMessage[];
};

const globalStore = globalThis as typeof globalThis & { __insursuiteVercelStore?: Store };

export function isVercelDemoStore() {
  return Boolean(process.env.VERCEL) && process.env.INSURSUITE_USE_CLOUDFLARE !== "true";
}

function store() {
  globalStore.__insursuiteVercelStore ??= {
    ids: { profile: 1, policy: 1, document: 1, request: 1, notification: 1, knowledge: 1, chat: 1 },
    profiles: [],
    policies: [],
    documents: [],
    requests: [],
    notifications: [],
    knowledge: [
      seededKnowledge("How do I update my beneficiary?", "Start a support request for a beneficiary review. InsurSuite can organize the request and tell you what carrier form is usually needed, but the carrier must process the official change.", "beneficiary change update form"),
      seededKnowledge("How do I file a claim?", "Use Claims Concierge to collect the policy number, claimant details, death certificate, and carrier contact information. A service request can track the handoff.", "claim death certificate claimant carrier"),
    ],
    chats: [],
  };
  return globalStore.__insursuiteVercelStore;
}

function seededKnowledge(question: string, answer: string, keywords: string): KnowledgeEntry {
  const now = new Date().toISOString();
  return { id: Math.round(Math.random() * 100000), question, answer, keywords, active: true, createdBy: "system", createdAt: now, updatedAt: now };
}

function nextId(key: keyof Store["ids"]) {
  const data = store();
  const id = data.ids[key];
  data.ids[key] += 1;
  return id;
}

function publicProfile(profile: Profile) {
  return { ...profile, profile: JSON.parse(profile.profileJson || "{}") };
}

export async function vercelPortalData(user: ChatGPTUser) {
  const data = store();
  return Response.json({
    user,
    isAgent: await isAgent(user.email),
    profile: data.profiles.find((item) => item.userEmail === user.email) ? publicProfile(data.profiles.find((item) => item.userEmail === user.email)!) : null,
    policies: data.policies.filter((item) => item.userEmail === user.email),
    documents: data.documents.filter((item) => item.userEmail === user.email).map(publicDocument),
    requests: data.requests.filter((item) => item.userEmail === user.email),
  });
}

export async function vercelSaveProfile(user: ChatGPTUser, body: { fullName?: string; phone?: string; dateOfBirth?: string; onboardingStatus?: string; onboardingStep?: number; profile?: Record<string, unknown> }) {
  const data = store();
  const now = new Date().toISOString();
  const existing = data.profiles.find((item) => item.userEmail === user.email);
  const values = {
    id: existing?.id ?? nextId("profile"),
    userEmail: user.email,
    fullName: (body.fullName?.trim() || user.fullName || user.displayName).slice(0, 120),
    phone: body.phone?.trim().slice(0, 30) || "",
    dateOfBirth: body.dateOfBirth?.trim().slice(0, 10) || "",
    onboardingStatus: ["in_progress", "completed"].includes(body.onboardingStatus || "") ? body.onboardingStatus! : "in_progress",
    onboardingStep: Math.max(0, Math.min(7, Number(body.onboardingStep) || 0)),
    profileJson: JSON.stringify(sanitizeProfile(body.profile)),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  if (existing) Object.assign(existing, values);
  else data.profiles.push(values);
  return Response.json({ profile: publicProfile(values) });
}

export function vercelListPolicies(user: ChatGPTUser) {
  return Response.json({ policies: store().policies.filter((item) => item.userEmail === user.email) });
}

export function vercelSavePolicy(user: ChatGPTUser, body: Record<string, string>) {
  const clean = (value: string | undefined, max = 160) => (value || "").trim().slice(0, max);
  const policyNumber = clean(body.policyNumber, 40);
  if (!policyNumber) return Response.json({ error: "Policy number is required" }, { status: 400 });
  const data = store();
  const now = new Date().toISOString();
  const existing = data.policies.find((item) => item.userEmail === user.email && item.policyNumber === policyNumber);
  const values = { id: existing?.id ?? nextId("policy"), userEmail: user.email, policyNumber, policyType: clean(body.policyType), carrier: clean(body.carrier), insuredName: clean(body.insuredName), ownerName: clean(body.ownerName), deathBenefit: clean(body.deathBenefit, 40), monthlyPremium: clean(body.monthlyPremium, 40), effectiveDate: clean(body.effectiveDate, 40), beneficiaries: clean(body.beneficiaries, 800), cashValue: clean(body.cashValue, 40), sourceFileName: clean(body.sourceFileName, 240), createdAt: String(existing?.createdAt ?? now), updatedAt: now };
  if (existing) Object.assign(existing, values);
  else data.policies.push(values);
  return Response.json({ policy: values }, { status: 201 });
}

export function publicDocument(document: DocumentRecord) {
  return {
    id: document.id,
    userEmail: document.userEmail,
    storageKey: document.storageKey,
    fileName: document.fileName,
    contentType: document.contentType,
    fileSize: document.fileSize,
    policyNumber: document.policyNumber,
    processingStatus: document.processingStatus,
    createdAt: document.createdAt,
  };
}

export async function vercelSaveDocument(user: ChatGPTUser, form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "File is required" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return Response.json({ error: "File must be 20 MB or smaller" }, { status: 400 });
  const allowedTypes = new Set(["application/pdf", "image/png", "image/jpeg", "text/plain"]);
  if (!allowedTypes.has(file.type)) return Response.json({ error: "Only PDF, PNG, JPG, and text policy documents are supported" }, { status: 415 });
  const policyNumber = String(form.get("policyNumber") || "");
  const now = new Date().toISOString();
  const document = { id: nextId("document"), userEmail: user.email, storageKey: `${user.email}/${crypto.randomUUID()}-${file.name}`, fileName: file.name.slice(0, 240), contentType: file.type, fileSize: file.size, policyNumber: policyNumber.trim().slice(0, 40), processingStatus: "processed", createdAt: now, body: await file.arrayBuffer() };
  store().documents.push(document);
  return Response.json({ document: publicDocument(document) }, { status: 201 });
}

export function vercelGetDocument(user: ChatGPTUser, id: number, download: boolean) {
  const document = store().documents.find((item) => item.id === id && item.userEmail === user.email);
  if (!document) return Response.json({ error: "Document not found" }, { status: 404 });
  const disposition = `${download ? "attachment" : "inline"}; filename="${document.fileName.replace(/"/g, "")}"`;
  return new Response(document.body, { headers: { "content-type": document.contentType || "application/octet-stream", "content-length": String(document.fileSize), "content-disposition": disposition, "cache-control": "private, max-age=60" } });
}

export function vercelListRequests(user: ChatGPTUser) {
  return Response.json({ requests: store().requests.filter((item) => item.userEmail === user.email).sort(byNewest) });
}

export async function vercelCreateRequest(user: ChatGPTUser, body: { requestType?: string; details?: string; requestData?: Record<string, unknown> }) {
  if (!body.requestType?.trim()) return Response.json({ error: "Request type is required" }, { status: 400 });
  const requestData = sanitizeServiceRequestData(body.requestData);
  const assignedTo = await chooseAgent(user.email);
  const now = new Date().toISOString();
  const saved = { id: nextId("request"), userEmail: user.email, requestType: body.requestType.trim().slice(0, 120), details: (body.details || "").trim().slice(0, 4000), requestDataJson: JSON.stringify(requestData), status: initialRequestStatus(assignedTo), assignedTo, source: "client", priority: priorityForUrgency(requestData.urgency), unreadByAgent: true, createdAt: now, updatedAt: now };
  store().requests.push(saved);
  return Response.json({ request: saved }, { status: 201 });
}

export function vercelChatHistory(user: ChatGPTUser) {
  const messages = store().chats.filter((item) => item.userEmail === user.email).sort(byOldest).slice(-30);
  return Response.json({ messages });
}

export async function vercelChatReply(user: ChatGPTUser, message: string) {
  const data = store();
  const now = new Date().toISOString();
  data.chats.push({ id: nextId("chat"), userEmail: user.email, role: "user", message, resolution: "answered", serviceRequestId: null, createdAt: now });
  const hasPolicy = /policy|coverage|premium|benefit|cash value/i.test(message);
  const answer = hasPolicy
    ? "I can help organize what is saved in your portal. For carrier-specific advice or changes, a licensed representative should confirm the details before you act."
    : "I created a support request from this conversation so the team can follow up with the right next step.";
  const resolution = hasPolicy ? "answered" : "escalated";
  let serviceRequestId: number | null = null;
  if (!hasPolicy) {
    const created = await vercelCreateRequest(user, { requestType: "Chatbot escalation", details: message, requestData: {} });
    const payload = await created.json() as { request: ServiceRequest };
    serviceRequestId = payload.request.id;
  }
  data.chats.push({ id: nextId("chat"), userEmail: user.email, role: "assistant", message: answer, resolution, serviceRequestId, createdAt: new Date().toISOString() });
  return Response.json({ answer, resolution, serviceRequestId });
}

export function vercelKnowledgeEntries() {
  return Response.json({ entries: store().knowledge.sort(byNewest) });
}

export function vercelCreateKnowledge(user: ChatGPTUser, body: { question?: string; answer?: string; keywords?: string }) {
  const question = (body.question || "").trim().slice(0, 500);
  const answer = (body.answer || "").trim().slice(0, 5000);
  const keywords = (body.keywords || "").trim().slice(0, 1000);
  if (!question || !answer) return Response.json({ error: "Question and answer are required" }, { status: 400 });
  const now = new Date().toISOString();
  const entry = { id: nextId("knowledge"), question, answer, keywords, active: true, createdBy: user.email, createdAt: now, updatedAt: now };
  store().knowledge.push(entry);
  return Response.json({ entry }, { status: 201 });
}

export function vercelAgentQueue(user: ChatGPTUser) {
  const data = store();
  const requests = data.requests.filter((item) => item.assignedTo === user.email.toLowerCase()).sort(byNewest);
  const notifications = data.notifications.filter((item) => item.agentEmail === user.email.toLowerCase()).sort(byNewest).slice(0, 30);
  return Response.json({ requests: requests.map((item) => ({ ...item, requestData: JSON.parse(item.requestDataJson || "{}"), clientName: data.profiles.find((client) => client.userEmail === item.userEmail)?.fullName || item.userEmail })), notifications });
}

export function vercelUpdateAgentRequest(user: ChatGPTUser, body: { id?: number; status?: string }) {
  const request = store().requests.find((item) => item.id === body.id && item.assignedTo === user.email.toLowerCase());
  if (!request) return Response.json({ error: "Request not found in your assigned queue" }, { status: 404 });
  request.status = body.status || request.status;
  request.unreadByAgent = false;
  request.updatedAt = new Date().toISOString();
  return Response.json({ request });
}

function byNewest(a: Record<string, unknown>, b: Record<string, unknown>) {
  return String(b.createdAt || b.updatedAt || "").localeCompare(String(a.createdAt || a.updatedAt || ""));
}

function byOldest(a: Record<string, unknown>, b: Record<string, unknown>) {
  return String(a.createdAt || a.updatedAt || "").localeCompare(String(b.createdAt || b.updatedAt || ""));
}
