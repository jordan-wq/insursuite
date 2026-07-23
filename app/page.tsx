"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  Bell,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  FolderLock,
  Gem,
  Headphones,
  HeartHandshake,
  Home,
  House,
  LifeBuoy,
  LineChart,
  LockKeyhole,
  Menu,
  MessageCircle,
  Paperclip,
  PenLine,
  Phone,
  Plus,
  Search,
  ScanLine,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  Upload,
  UserRound,
  UsersRound,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { CALL_INTAKE_REQUIRED_FIELDS, READINESS_PROFILE_FIELDS } from "./profile-fields";

type NavKey =
  | "Dashboard"
  | "My Policies"
  | "Document Vault"
  | "AI Assistant"
  | "Support Center"
  | "Call Intake"
  | "Coverage Review"
  | "Notifications"
  | "Family & Household"
  | "Claims Concierge"
  | "Agent Console"
  | "Settings";

type Policy = {
  id: string;
  type: string;
  carrier: string;
  benefit: string;
  premium: string;
  color: "purple" | "green" | "blue" | "orange" | "pink";
  icon: LucideIcon;
  cashValue?: string;
  beneficiaries?: string;
  isSample?: boolean;
};

type ExtractedPolicy = {
  carrier: string;
  policyType: string;
  policyNumber: string;
  insuredName: string;
  ownerName: string;
  deathBenefit: string;
  monthlyPremium: string;
  effectiveDate: string;
  beneficiaries: string;
  cashValue: string;
  confidence: number;
  sourceText: string;
};

type PortalUser = { displayName: string; email: string; fullName: string | null };
type StoredProfile = { fullName: string; phone: string; dateOfBirth: string; onboardingStatus: string; onboardingStep: number; profile: Record<string, string | boolean> };
type PortalDocument = { id: string; fileName: string; contentType: string; fileSize: number; policyNumber: string; processingStatus: string; createdAt: string };
type ServiceRequest = { id: string; requestType: string; details: string; status: string; createdAt: string; assignedTo?: string; source?: string; requestDataJson?: string; priority?: string };

function ticketCode(id: string | undefined | null): string {
  return String(id || "").replace(/-/g, "").slice(0, 6).toUpperCase() || "PENDING";
}
type IntakeField = { key: string; label: string; type?: "text" | "date" | "number" | "select" | "textarea" | "checkbox"; placeholder?: string; options?: string[]; required?: boolean; helper?: string };
type SupportRequestInput = { requestType: string; details: string; requestData?: Record<string, string | boolean | null> };
type ReviewMetric = { label: string; score: number; text: string; icon: LucideIcon; color: string };

const allowSetupSkip = process.env.NODE_ENV !== "production";

const navItems: { label: NavKey; icon: LucideIcon; badge?: number }[] = [
  { label: "Dashboard", icon: Home },
  { label: "My Policies", icon: WalletCards },
  { label: "Document Vault", icon: FileText },
  { label: "Support Center", icon: Headphones },
  { label: "Call Intake", icon: ClipboardCheck },
  { label: "Notifications", icon: Bell, badge: 3 },
  { label: "Family & Household", icon: UsersRound },
  { label: "Agent Console", icon: Headphones },
  { label: "Settings", icon: Settings },
];

const samplePolicies: Policy[] = [
  { id: "1234567", type: "Whole Life Insurance", carrier: "Northwestern Mutual", benefit: "$500,000", premium: "$121/mo", cashValue: "$31,400", beneficiaries: "Sample beneficiary", isSample: true, color: "purple", icon: ShieldCheck },
  { id: "89101112", type: "Indexed Universal Life", carrier: "Banner Life", benefit: "$300,000", premium: "$96/mo", cashValue: "$16,850", beneficiaries: "Sample beneficiary", isSample: true, color: "green", icon: LineChart },
  { id: "5678910", type: "Term Life Insurance", carrier: "Haven Life", benefit: "$250,000", premium: "$54/mo", beneficiaries: "Sample beneficiary", isSample: true, color: "blue", icon: ShieldCheck },
  { id: "24681012", type: "Mortgage Protection", carrier: "RBC Insurance", benefit: "$200,000", premium: "$65/mo", isSample: true, color: "orange", icon: House },
  { id: "1357911", type: "Final Expense", carrier: "Mutual of Omaha", benefit: "$25,000", premium: "$28/mo", beneficiaries: "Sample beneficiary", isSample: true, color: "pink", icon: HeartHandshake },
];

const money = (value = "") => Number(value.replace(/[^0-9.]/g, "")) || 0;
const currency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
function portfolioMetrics(policyData: Policy[], profile?: StoredProfile | null, documents: PortalDocument[] = []) {
  const benefit = policyData.reduce((sum, item) => sum + money(item.benefit), 0);
  const premium = policyData.reduce((sum, item) => sum + money(item.premium), 0);
  const cash = policyData.reduce((sum, item) => sum + money(item.cashValue), 0);
  const beneficiaryRate = policyData.length ? Math.round(policyData.filter((item) => item.beneficiaries).length / policyData.length * 100) : 0;
  const complete = READINESS_PROFILE_FIELDS.filter((key) => profile?.profile?.[key]).length;
  const score = Math.min(100, Math.round(35 + complete / READINESS_PROFILE_FIELDS.length * 35 + Math.min(policyData.length, 3) * 6 + Math.min(documents.length, 3) * 4));
  return { benefit, premium, cash, beneficiaryRate, score };
}

function coverageReviewModel(policyData: Policy[], profile?: StoredProfile | null, documents: PortalDocument[] = []) {
  const saved = profile?.profile || {};
  const metrics = portfolioMetrics(policyData, profile, documents);
  const policyWithDocs = policyData.length ? Math.round(policyData.filter((policy) => documents.some((doc) => doc.policyNumber === policy.id)).length / policyData.length * 100) : 0;
  const beneficiaryScore = policyData.length ? metrics.beneficiaryRate : saved.primaryBeneficiary ? 70 : 35;
  const reviewScore = saved.reviewFrequency ? 78 : 42;
  const emergencyScore = saved.emergencyContactName && saved.emergencyContactPhone ? 100 : saved.emergencyContactName ? 70 : 35;
  const reviewMetrics: ReviewMetric[] = [
    { label: "Coverage facts", score: Math.min(100, Math.round(metrics.score)), text: policyData.length ? "Saved policies and onboarding facts are feeding this score." : "Upload at least one policy to replace estimates with record-backed facts.", icon: ShieldCheck, color: metrics.score > 74 ? "green" : metrics.score > 54 ? "orange" : "red" },
    { label: "Beneficiaries", score: beneficiaryScore, text: `${metrics.beneficiaryRate}% of saved policies include beneficiary details in the portal.`, icon: UsersRound, color: beneficiaryScore > 79 ? "green" : beneficiaryScore > 49 ? "orange" : "red" },
    { label: "Policy documents", score: Math.max(policyWithDocs, documents.length ? 68 : 30), text: documents.length ? `${documents.length} document${documents.length === 1 ? "" : "s"} saved in the vault.` : "No verified policy documents are attached yet.", icon: FolderLock, color: documents.length ? "green" : "orange" },
    { label: "Review cadence", score: reviewScore, text: saved.reviewFrequency ? `Preferred review rhythm: ${saved.reviewFrequency}.` : "Set a review frequency to make reminders dependable.", icon: Clock3, color: reviewScore > 74 ? "green" : "orange" },
    { label: "Emergency contacts", score: emergencyScore, text: emergencyScore === 100 ? "Emergency contact name and phone are saved." : "Add an emergency contact name and phone.", icon: Activity, color: emergencyScore > 79 ? "green" : "orange" },
  ];
  const nextActions = [
    !documents.length && { title: "Upload the first policy document", detail: "Document Intelligence can verify carrier, policy number, benefits, premiums, and beneficiary language.", action: "Upload", modal: "upload" },
    beneficiaryScore < 100 && { title: "Confirm beneficiary records", detail: "Portal notes do not change carrier designations, but they help flag what needs review.", action: "Review", modal: "beneficiary" },
    !saved.reviewFrequency && { title: "Set an annual review rhythm", detail: "A scheduled review keeps coverage assumptions from going stale.", action: "Schedule", modal: "review" },
    emergencyScore < 100 && { title: "Add emergency contact details", detail: "This helps a family member or advisor know who should be contacted first.", action: "Add", modal: "beneficiary" },
  ].filter(Boolean) as { title: string; detail: string; action: string; modal: string }[];
  return { score: metrics.score, reviewMetrics, nextActions: nextActions.slice(0, 3) };
}

function DataModeBanner({ sample }: { sample: boolean }) {
  return <div className={`data-mode-banner ${sample ? "sample" : "live"}`}><span>{sample ? "Sample workspace" : "Live client data"}</span><p>{sample ? "These examples show how the portal works. Upload a policy to replace them with your verified information." : "These totals are calculated from saved policies, documents, and onboarding answers."}</p></div>;
}

const aiPrompts = [
  "What happens if I pass away tomorrow?",
  "Do I have enough life insurance?",
  "Are my beneficiaries up to date?",
  "Can I borrow from my policy?",
  "Explain my policies in simple terms",
];

const aiAnswers: Record<string, string> = {
  "What happens if I pass away tomorrow?": "Your active policies currently total $1,275,000 in death benefits. After a claim is filed and approved, each carrier pays the named beneficiaries on that policy. Your household file is mostly organized, but your annual review is overdue.",
  "Do I have enough life insurance?": "Your coverage score is 86/100. Based on the profile in this demo, your benefit amount is strong. The biggest opportunities are refreshing your needs analysis and completing the annual policy review.",
  "Are my beneficiaries up to date?": "Four policies were confirmed this year. Your Mortgage Protection policy has not had its beneficiary details reviewed in 14 months, so I recommend checking that one first.",
  "Can I borrow from my policy?": "Your Whole Life and Indexed Universal Life policies may have accessible cash value. Loans reduce available cash value and the death benefit if unpaid, so confirm the current illustration and loan rate with the carrier before borrowing.",
  "Explain my policies in simple terms": "You have permanent coverage for lifelong protection and cash value, term coverage for a fixed period, mortgage protection tied to your home obligation, and a smaller final-expense policy for end-of-life costs.",
};

function matchField(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/\s{2,}/g, " ");
  }
  return "";
}

function structurePolicyText(text: string): ExtractedPolicy {
  const clean = text.replace(/\u0000/g, " ").replace(/[ \t]+/g, " ");
  const carriers = ["Northwestern Mutual", "Mutual of Omaha", "Banner Life", "Haven Life", "RBC Insurance", "Americo", "National Life Group", "Ethos", "Transamerica", "Protective Life", "Pacific Life", "Prudential", "New York Life", "MassMutual"];
  const types = ["Indexed Universal Life", "Universal Life", "Whole Life Insurance", "Whole Life", "Term Life Insurance", "Term Life", "Final Expense", "Mortgage Protection"];
  const carrier = carriers.find((name) => clean.toLowerCase().includes(name.toLowerCase())) ?? matchField(clean, [/insurance company\s*[:\-]?\s*([^\n]{3,45})/i, /carrier\s*[:\-]?\s*([^\n]{3,45})/i]);
  const policyType = types.find((name) => clean.toLowerCase().includes(name.toLowerCase())) ?? matchField(clean, [/policy type\s*[:\-]?\s*([^\n]{3,40})/i, /plan name\s*[:\-]?\s*([^\n]{3,40})/i]);
  const policyNumber = matchField(clean, [/policy\s*(?:number|no\.?|#)\s*[:#\-]?\s*([A-Z0-9\-]{5,24})/i, /contract\s*(?:number|no\.?)\s*[:#\-]?\s*([A-Z0-9\-]{5,24})/i]);
  const insuredName = matchField(clean, [/insured(?: name)?\s*[:\-]?\s*([A-Z][A-Za-z' .,-]{3,45})/i, /name of insured\s*[:\-]?\s*([A-Z][A-Za-z' .,-]{3,45})/i]);
  const ownerName = matchField(clean, [/policy owner(?: name)?\s*[:\-]?\s*([A-Z][A-Za-z' .,-]{3,45})/i, /owner(?: name)?\s*[:\-]?\s*([A-Z][A-Za-z' .,-]{3,45})/i]);
  const deathBenefit = matchField(clean, [/(?:death benefit|face amount|specified amount)\s*[:\-]?\s*(\$[\d,]+(?:\.\d{2})?)/i, /(\$[\d,]+)\s+(?:death benefit|face amount)/i]);
  const monthlyPremium = matchField(clean, [/(?:monthly premium|planned premium|modal premium)\s*[:\-]?\s*(\$[\d,]+(?:\.\d{2})?)/i, /premium\s*[:\-]?\s*(\$[\d,]+(?:\.\d{2})?)\s*(?:monthly|per month)/i]);
  const effectiveDate = matchField(clean, [/(?:effective date|policy date|issue date)\s*[:\-]?\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i, /(?:effective date|policy date|issue date)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i]);
  const beneficiaries = matchField(clean, [/(?:primary )?beneficiar(?:y|ies)\s*[:\-]?\s*([^\n]{3,75})/i]);
  const cashValue = matchField(clean, [/(?:cash value|account value|accumulation value)\s*[:\-]?\s*(\$[\d,]+(?:\.\d{2})?)/i]);
  const found = [carrier, policyType, policyNumber, insuredName, deathBenefit, monthlyPremium, effectiveDate].filter(Boolean).length;
  return { carrier, policyType, policyNumber, insuredName, ownerName: ownerName || insuredName, deathBenefit, monthlyPremium, effectiveDate, beneficiaries, cashValue, confidence: Math.round(55 + (found / 7) * 43), sourceText: clean.slice(0, 12000) };
}

async function extractDocumentText(file: File, onProgress: (progress: number, step: string) => void) {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = file.type.startsWith("image/");
  if (!isPdf && !isImage) {
    onProgress(52, "Reading document text");
    return file.text();
  }
  if (isImage) {
    onProgress(22, "Starting secure OCR");
    const { recognize } = await import("tesseract.js");
    const result = await recognize(file, "eng", { logger: (message) => { if (message.status === "recognizing text") onProgress(25 + Math.round((message.progress ?? 0) * 58), "Reading policy text"); } });
    return result.data.text;
  }
  onProgress(18, "Opening PDF securely");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  const pageLimit = Math.min(pdf.numPages, 12);
  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    onProgress(20 + Math.round((pageNumber / pageLimit) * 55), `Reading page ${pageNumber} of ${pageLimit}`);
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
  }
  return pages.join("\n");
}

function StatCard({ label, value, note, tone, icon: Icon }: { label: string; value: string; note: string; tone: string; icon: LucideIcon }) {
  return (
    <article className="stat-card">
      <div>
        <div className="eyebrow-row"><span>{label}</span><CircleHelp size={14} /></div>
        <strong className={`stat-value ${tone}`}>{value}</strong>
        <p className={tone === "green" ? "success-note" : "muted"}>{note}</p>
      </div>
      <div className={`stat-icon ${tone}`}><Icon size={31} strokeWidth={1.8} /></div>
    </article>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>;
}

function PanelHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      {action && <button className="text-button" onClick={onAction}>{action}</button>}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  return (
    <div className="score-ring" aria-label={`Overall coverage score ${score} percent`} style={{ "--score": `${score}%` } as React.CSSProperties}>
      <div className="score-ring-inner"><strong>{score}<span>%</span></strong><small>Overall Score</small></div>
    </div>
  );
}

function Dashboard({ onNavigate, onPolicy, onOpen, policyData, profile, documents, requests, isSample }: { onNavigate: (key: NavKey) => void; onPolicy: (policy: Policy) => void; onOpen: (modal: string) => void; policyData: Policy[]; profile: StoredProfile | null; documents: PortalDocument[]; requests: ServiceRequest[]; isSample: boolean }) {
  const metrics = portfolioMetrics(policyData, profile, documents);
  const review = coverageReviewModel(policyData, profile, documents);
  const topAction = review.nextActions[0];
  const sampleActivity = [
    { id: "sample-doc-iul", icon: CheckCircle2, title: "Document uploaded", detail: "IUL_Statement_May2024.pdf", time: "Example", color: "green" },
    { id: "sample-beneficiary", icon: UserRound, title: "Beneficiary updated", detail: "Whole Life Insurance", time: "Example", color: "blue" },
    { id: "sample-ticket", icon: TicketCheck, title: "Ticket closed", detail: "Request for Proof of Insurance", time: "Example", color: "orange" },
    { id: "sample-doc-term", icon: Upload, title: "Document uploaded", detail: "Term_Life_Policy.pdf", time: "Example", color: "purple" },
  ];
  const liveActivity = [
    ...requests.slice(0, 3).map((request) => ({ id: `request-${request.id}`, icon: TicketCheck, title: `Request ${request.status.replaceAll("_", " ")}`, detail: `${request.requestType} · IS-${ticketCode(request.id)}`, time: new Date(request.createdAt).toLocaleDateString(), color: request.status === "resolved" ? "green" : "orange" })),
    ...documents.slice(0, 3).map((document) => ({ id: `document-${document.id}`, icon: FileCheck2, title: "Document processed", detail: document.fileName, time: new Date(document.createdAt).toLocaleDateString(), color: "blue" })),
    ...policyData.filter((policy) => !policy.isSample).slice(0, 2).map((policy) => ({ id: `policy-${policy.id}`, icon: ShieldCheck, title: "Policy saved", detail: `${policy.type} · ${policy.carrier}`, time: "Saved", color: "green" })),
  ].slice(0, 4);
  const activityItems = isSample || !liveActivity.length ? sampleActivity : liveActivity;
  const verifiedPolicies = policyData.filter((policy) => !policy.isSample).length;
  const policyDocumentCount = documents.filter((document) => document.policyNumber).length;
  const activeRequestCount = requests.filter((request) => request.status !== "resolved").length;

  return (
    <>
      <DataModeBanner sample={isSample} />
      <div className="priority-focus">
        <span className="priority-badge"><Zap size={17} />Needs attention</span>
        <div className="priority-copy">
          <strong>{topAction?.title || "Coverage file is organized"}</strong>
          <p>{topAction?.detail || "Saved policies, documents, beneficiaries, review rhythm, and emergency contacts are in a good place."}</p>
        </div>
        <div className="priority-ledger" aria-label="Coverage file status">
          <span><b>{metrics.score}</b><small>readiness</small></span>
          <span><b>{documents.length}</b><small>vault docs</small></span>
          <span><b>{activeRequestCount}</b><small>open asks</small></span>
        </div>
        <button className="primary-button" onClick={() => onOpen(topAction?.modal || "review")}>{topAction?.action || "Review coverage"}</button>
      </div>
      <div className="stat-grid">
        <StatCard label="Portal Readiness" value={String(metrics.score)} note="Based on saved data completeness" tone="green" icon={ShieldCheck} />
        <StatCard label="Total Death Benefit" value={currency(metrics.benefit)} note={`Across ${policyData.length} ${policyData.length === 1 ? "policy" : "policies"}`} tone="blue" icon={ShieldCheck} />
        <StatCard label="Recorded Cash Value" value={currency(metrics.cash)} note="Only values found in saved records" tone="green" icon={LineChart} />
        <StatCard label="Monthly Premiums" value={currency(metrics.premium)} note="Recorded monthly total" tone="purple" icon={CalendarDays} />
      </div>

      <div className="dashboard-grid">
        <Panel className="policies-panel">
          <PanelHeader title="My Policies" action="View All Policies" onAction={() => onNavigate("My Policies")} />
          <div className="policy-list">
            {policyData.slice(0, 6).map((policy) => {
              const Icon = policy.icon;
              return (
                <button key={policy.id} className="policy-row" onClick={() => onPolicy(policy)}>
                  <span className={`policy-icon ${policy.color}`}><Icon size={21} /></span>
                  <span className="policy-name"><strong>{policy.type}</strong><small>{policy.carrier}</small></span>
                  <span className="policy-number"><small>Policy # {policy.id}</small><span>Active</span></span>
                  <span className="policy-benefit"><strong>{policy.benefit}</strong><small>Death Benefit</small></span>
                  <ChevronRight size={18} className="row-chevron" />
                </button>
              );
            })}
          </div>
          <button className="add-policy-row" onClick={() => onOpen("upload")}>
            <span className="add-icon"><Upload size={20} /></span>
            <span><strong>Add a Policy</strong><small>Upload a policy document to track it in InsurSuite</small></span>
            <span className="outline-button">Upload Document</span>
          </button>
          <div className="policy-panel-footer">
            <span><ShieldCheck size={15} /><b>{verifiedPolicies}</b> verified policies</span>
            <span><FolderLock size={15} /><b>{policyDocumentCount}</b> linked documents</span>
            <span><UsersRound size={15} /><b>{metrics.beneficiaryRate}%</b> beneficiaries recorded</span>
          </div>
        </Panel>

        <Panel className="activity-panel">
          <PanelHeader title="Recent Activity" action="View All" onAction={() => onNavigate("Notifications")} />
          <div className="activity-list">
            {activityItems.map(({ id, icon: ActivityIcon, title, detail, time, color }) => {
              return <div className="activity-row" key={id}><span className={`activity-icon ${color}`}><ActivityIcon size={16} /></span><span><strong>{title}</strong><small>{detail}</small></span><time>{time}</time></div>;
            })}
          </div>
        </Panel>

        <Panel className="actions-panel">
          <PanelHeader title="Quick Actions" />
          <div className="action-grid">
            {[
              [Upload, "Upload Document", "Add policy files", "upload", "blue"],
              [TicketCheck, "Create Request", "Track service needs", "ticket", "orange"],
              [UsersRound, "Beneficiaries", "Review designations", "beneficiary", "blue"],
              [WalletCards, "Compare Policies", "Inspect side by side", "policies", "navy"],
              [CalendarDays, "Annual Review", "Book a review", "review", "blue"],
              [Headphones, "Concierge", "Message a person", "concierge", "blue"],
            ].map(([Icon, label, detail, action, color]) => {
              const ActionIcon = Icon as LucideIcon;
              return <button key={String(label)} onClick={() => action === "policies" ? onNavigate("My Policies") : onOpen(String(action))}><span className={`action-icon ${String(color)}`}><ActionIcon size={22} /></span><span><strong>{String(label)}</strong><small>{String(detail)}</small></span></button>;
            })}
          </div>
        </Panel>
      </div>

      <div className="expert-bar"><span><UsersRound size={22} /><strong>Need Expert Help?</strong> Connect with your dedicated insurance consultant.</span><button onClick={() => onOpen("concierge")}><MessageCircle size={17} />Message My Consultant</button></div>
    </>
  );
}

function ViewHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="view-heading"><div><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{action && <div className="view-heading-actions">{action}</div>}</div>;
}

function PoliciesView({ onPolicy, onOpen, notify, policyData, isSample }: { onPolicy: (policy: Policy) => void; onOpen: (modal: string) => void; notify: (message: string) => void; policyData: Policy[]; isSample: boolean }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All policies");
  const [compare, setCompare] = useState<string[]>([]);
  const permanent = ["Whole Life Insurance", "Indexed Universal Life", "Final Expense"];
  const visible = policyData.filter((policy) => {
    const matchesQuery = `${policy.type} ${policy.carrier} ${policy.id}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === "All policies" || (status === "Permanent" && permanent.includes(policy.type)) || (status === "Term" && policy.type === "Term Life Insurance");
    return matchesQuery && matchesStatus;
  });
  const toggleCompare = (id: string) => setCompare((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  return <div className="section-view">
    <ViewHeading eyebrow="Coverage portfolio" title="My Policies" description="See every policy, carrier, premium, and beneficiary status in one organized view." action={<button className="primary-button" onClick={() => onOpen("upload")}><Plus size={17} />Add a policy</button>} />
    <DataModeBanner sample={isSample} />
    <div className="summary-strip"><div><span>Saved policies</span><strong>{policyData.length}</strong><small>{isSample ? "Illustrative examples" : "Client records"}</small></div><div><span>Total protection</span><strong>{currency(portfolioMetrics(policyData).benefit)}</strong><small>Recorded death benefits</small></div><div><span>Monthly cost</span><strong>{currency(portfolioMetrics(policyData).premium)}</strong><small>Recorded premiums</small></div><div><span>Cash value</span><strong>{currency(portfolioMetrics(policyData).cash)}</strong><small>Where reported</small></div></div>
    <Panel className="workspace-panel"><div className="workspace-toolbar"><div className="section-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search policies or carriers" aria-label="Search policies" /></div><label className="select-wrap"><Filter size={16} /><select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter policies"><option>All policies</option><option>Permanent</option><option>Term</option></select></label></div>
      <div className="large-policy-list">{visible.map((policy) => { const Icon = policy.icon; const checked = compare.includes(policy.id); return <article key={policy.id} className="large-policy-card"><button className="large-policy-main" onClick={() => onPolicy(policy)}><span className={`policy-icon ${policy.color}`}><Icon size={21} /></span><span><strong>{policy.type}</strong><small>{policy.carrier} · #{policy.id}</small></span></button><div><small>Death benefit</small><strong>{policy.benefit}</strong></div><div><small>Premium</small><strong>{policy.premium}</strong></div><div><small>Status</small><span className="status active"><Check size={13} />Active</span></div><button className={`compare-toggle ${checked ? "selected" : ""}`} onClick={() => toggleCompare(policy.id)}>{checked ? <Check size={15} /> : <Plus size={15} />}{checked ? "Selected" : "Compare"}</button><button className="row-action" aria-label={`Open ${policy.type}`} onClick={() => onPolicy(policy)}><ChevronRight size={19} /></button></article>; })}{!visible.length && <div className="empty-state"><Search size={29} /><strong>No policies found</strong><p>Try another carrier, policy number, or filter.</p></div>}</div>
    </Panel>
    {compare.length > 0 && <div className="compare-tray"><div><WalletCards size={20} /><span><strong>{compare.length} selected</strong><small>Select up to 3 policies</small></span></div><button className="secondary-button" onClick={() => setCompare([])}>Clear</button><button className="primary-button" disabled={compare.length < 2} onClick={() => notify("Your side-by-side policy comparison is ready.")}>Compare policies</button></div>}
  </div>;
}

type DocumentRow = { id?: string; name: string; policy: string; type: string; date: string; size: string; contentType?: string; previewUrl?: string };

function DocumentVaultView({ onOpen, notify, uploadedDocuments }: { onOpen: (modal: string) => void; notify: (message: string) => void; uploadedDocuments: PortalDocument[] }) {
  const [query, setQuery] = useState("");
  const [previewDocument, setPreviewDocument] = useState<{ id?: string; name: string; contentType?: string; previewUrl?: string } | null>(null);
  const persistentDocuments: DocumentRow[] = uploadedDocuments.map((doc) => ({ id: doc.id, name: doc.fileName, policy: doc.policyNumber ? `Policy #${doc.policyNumber}` : "Unassigned policy", type: doc.contentType === "text/plain" ? "Text policy file" : doc.contentType.startsWith("image/") ? "Policy image" : "AI-scanned policy", date: new Date(doc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), size: doc.fileSize > 1048576 ? `${(doc.fileSize / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(doc.fileSize / 1024))} KB`, contentType: doc.contentType, previewUrl: `/api/documents/${doc.id}` }));
  const sampleDocuments: DocumentRow[] = [{ name: "Sample_Whole_Life_Policy.pdf", policy: "Sample policy", type: "Policy contract", date: "Example", size: "2.4 MB" }, { name: "Sample_Annual_Statement.pdf", policy: "Sample policy", type: "Annual statement", date: "Example", size: "1.8 MB" }];
  const isSample = persistentDocuments.length === 0;
  const documents = (isSample ? sampleDocuments : persistentDocuments).filter((doc) => `${doc.name} ${doc.policy} ${doc.type}`.toLowerCase().includes(query.toLowerCase()));
  const download = (doc: typeof documents[number]) => {
    if (!("previewUrl" in doc) || !doc.previewUrl) { notify("Sample files are illustrative and cannot be downloaded."); return; }
    window.open(`${doc.previewUrl}?download=1`, "_blank", "noopener,noreferrer");
  };
  return <div className="section-view"><ViewHeading eyebrow="Encrypted document storage" title="Document Vault" description="Keep contracts, statements, illustrations, and forms attached to the right policy." action={<button className="primary-button" onClick={() => onOpen("upload")}><Upload size={17} />Upload document</button>} /><DataModeBanner sample={isSample} /><div className="vault-banner"><div className="vault-shield"><LockKeyhole size={27} /></div><div><strong>Your vault is protected</strong><p>Files are stored by account and organized by policy.</p></div><span><ShieldCheck size={16} />Protected</span></div><Panel className="workspace-panel"><div className="workspace-toolbar"><div className="section-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents" aria-label="Search documents" /></div><button className="secondary-button"><Filter size={16} />All file types</button></div><div className="document-table"><div className="table-head"><span>Document</span><span>Policy</span><span>Type</span><span>Uploaded</span><span></span></div>{documents.map((doc) => <div className="document-row" key={doc.name}><span className="document-name"><i><FileText size={19} /></i><span><strong>{doc.name}</strong><small>{doc.size}</small></span></span><span>{doc.policy}</span><span>{doc.type}</span><span>{doc.date}</span><span className="document-actions"><button aria-label={`Preview ${doc.name}`} onClick={() => "previewUrl" in doc && doc.previewUrl ? setPreviewDocument(doc) : notify("Sample preview only—upload a document to use secure storage.")}><Eye size={17} /></button><button aria-label={`Download ${doc.name}`} onClick={() => download(doc)}><Download size={17} /></button></span></div>)}</div></Panel>{previewDocument && <div className="document-preview-modal" role="dialog" aria-modal="true" aria-label={`Preview ${previewDocument.name}`}><div className="document-preview-card"><header><div><strong>{previewDocument.name}</strong><small>Authenticated vault preview</small></div><button aria-label="Close preview" onClick={() => setPreviewDocument(null)}><X size={18} /></button></header><iframe title={previewDocument.name} src={previewDocument.previewUrl} /></div></div>}</div>;
}

function AssistantView({ onOpen }: { onOpen: (modal: string) => void }) {
  const [messages, setMessages] = useState<{ role: "assistant" | "user"; text: string; escalated?: boolean }[]>([{ role: "assistant", text: "Hi — I can answer trained questions, organize your saved policy information, or bring in a customer service representative when I cannot help safely." }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const ask = async (question: string) => { if (!question.trim() || sending) return; setMessages((current) => [...current, { role: "user", text: question }]); setInput(""); setSending(true); try { const response = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: question }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setMessages((current) => [...current, { role: "assistant", text: result.answer, escalated: result.resolution === "escalated" }]); } catch { setMessages((current) => [...current, { role: "assistant", text: "I could not connect to support. Please create a service request directly." }]); } finally { setSending(false); } };
  return <div className="section-view assistant-page"><ViewHeading eyebrow="Trained answers with human handoff" title="AI Insurance Assistant" description="The assistant answers from approved knowledge and escalates anything it cannot handle." action={<span className="ai-status"><i />Online 24/7</span>} /><div className="assistant-workspace"><Panel className="chat-panel"><div className="chat-top"><span><Sparkles size={20} /></span><div><strong>InsurSuite AI</strong><small>Approved knowledge, saved policy context, and customer-service handoff</small></div></div><div className="message-thread">{messages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? <Sparkles size={17} /> : "You"}</span><p>{message.text}{message.escalated && <small className="escalation-label">Human handoff created</small>}</p></div>)}</div><div className="suggestion-chips">{aiPrompts.slice(1,4).map((prompt) => <button key={prompt} onClick={() => ask(prompt)}>{prompt}</button>)}</div><form className="chat-composer" onSubmit={(e) => { e.preventDefault(); ask(input); }}><button type="button" aria-label="Attach a document"><Paperclip size={19} /></button><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your coverage..." aria-label="Message InsurSuite AI" /><button type="submit" disabled={sending} aria-label="Send message"><Send size={18} /></button></form></Panel><aside className="assistant-context"><Panel><PanelHeader title="How this works" /><div className="context-stat"><Bot size={18} /><span><strong>1. Bot attempts answer</strong><small>Uses approved Q&A and saved policy context</small></span></div><div className="context-stat"><TicketCheck size={18} /><span><strong>2. Unresolved becomes ticket</strong><small>Conversation is attached automatically</small></span></div><div className="context-stat"><Headphones size={18} /><span><strong>3. Representative takes over</strong><small>Assigned agent receives an alert</small></span></div></Panel><Panel className="human-help"><UsersRound size={25} /><h3>Ask for a person anytime</h3><p>Create a direct request when the matter is urgent or needs licensed advice.</p><button className="secondary-button full" onClick={() => onOpen("ticket")}><MessageCircle size={17} />Create a request</button></Panel></aside></div></div>;
}

function SupportView({ onOpen, notify, requests, onCreateRequest }: { onOpen: (modal: string) => void; notify: (message: string) => void; requests: ServiceRequest[]; onCreateRequest: (input: SupportRequestInput) => Promise<ServiceRequest | null> }) {
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [messages, setMessages] = useState<{ role: "consultant" | "user" | "event"; text: string; time: string }[]>([
    { role: "consultant", text: "Hi, I’m Maya. Choose an option below or tell me what you need. I can answer, collect details, and create a tracked request from this same conversation.", time: "Just now" },
  ]);
  const supportOptions = [
    { label: "Coverage review", icon: ClipboardCheck, requestType: "Coverage review", details: "Client requested a coverage review from the support chat.", urgency: "Standard - within 1 business day" },
    { label: "Policy document", icon: FileText, requestType: "Proof or policy document", details: "Client needs help locating, requesting, or reviewing a policy document.", urgency: "Standard - within 1 business day" },
    { label: "Billing issue", icon: CalendarDays, requestType: "Billing or premium issue", details: "Client has a billing, draft, or premium question.", urgency: "Time-sensitive - within 4 business hours" },
    { label: "Beneficiary change", icon: UsersRound, requestType: "Beneficiary update", details: "Client wants help reviewing or changing beneficiary information.", urgency: "Standard - within 1 business day" },
    { label: "Claim support", icon: HeartHandshake, requestType: "Claim support", details: "Client needs claim support or help understanding claim next steps.", urgency: "Urgent - coverage or payment at risk" },
    { label: "Account help", icon: CircleHelp, requestType: "Account or portal help", details: "Client needs help using the InsurSuite portal.", urgency: "Standard - within 1 business day" },
  ];
  const visibleRequests = requests.slice(0, 5);
  const sendMessage = (text: string) => {
    const message = text.trim();
    if (!message) return;
    setMessages((current) => [...current, { role: "user", text: message, time: "Now" }, { role: "consultant", text: "I can help with that. Use one of the request buttons above when this needs tracking, or keep typing here and I’ll keep the context together.", time: "Now" }]);
    setDraft("");
  };
  const startRequest = async (option: typeof supportOptions[number]) => {
    if (creating) return;
    setCreating(true);
    setMessages((current) => [...current, { role: "user", text: option.label, time: "Now" }, { role: "consultant", text: `I’m opening a ${option.requestType.toLowerCase()} request and attaching this conversation context.`, time: "Now" }]);
    const request = await onCreateRequest({
      requestType: option.requestType,
      details: option.details,
      requestData: {
        urgency: option.urgency,
        contactMethod: "Secure portal message",
        bestContactTime: "Any time",
        desiredOutcome: `Help with ${option.label.toLowerCase()}`,
        authorization: true,
      },
    });
    setMessages((current) => [...current, { role: "event", text: request ? `Request IS-${ticketCode(request.id)} was created and added to your support timeline.` : "I could not create the request yet. You can keep chatting or try the full request form.", time: "Now" }]);
    setCreating(false);
  };
  return <div className="section-view support-hub-view"><ViewHeading eyebrow="Conversation-first support" title="Support Center" description="Chat with your concierge, create tracked requests, and follow ticket progress from one workspace." action={<button className="primary-button" onClick={() => onOpen("ticket")}><Plus size={17} />Full request form</button>} /><section className="support-command"><div className="support-chat-main"><div className="support-chat-header"><div className="consultant inline-consultant"><span className="avatar">MC</span><span><strong>Maya Carter</strong><small>Dedicated consultant · Online now</small></span><i /></div><div className="support-action-bar">{supportOptions.map(({ label, icon: Icon, ...option }) => <button key={label} type="button" onClick={() => startRequest({ label, icon: Icon, ...option })} disabled={creating}><Icon size={16} />{label}</button>)}</div></div><div className="support-thread" aria-live="polite">{messages.map((message, index) => <div className={`support-bubble ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "consultant" ? "MC" : message.role === "event" ? <TicketCheck size={15} /> : "You"}</span><p>{message.text}<small>{message.time}</small></p></div>)}{messages.length === 1 && <div className="preloaded-options"><strong>Start with one of these</strong><div>{supportOptions.slice(0, 4).map(({ label, icon: Icon, ...option }) => <button key={label} type="button" onClick={() => startRequest({ label, icon: Icon, ...option })}><Icon size={18} /><span>{label}</span></button>)}</div></div>}</div><form className="support-composer" onSubmit={(event) => { event.preventDefault(); sendMessage(draft); }}><button type="button" aria-label="Attach document" onClick={() => onOpen("upload")}><Paperclip size={18} /></button><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Message support or describe what you need..." aria-label="Message support" /><button type="submit" disabled={!draft.trim()} aria-label="Send message"><Send size={17} /></button></form></div><aside className="support-sidecar"><Panel><PanelHeader title="Active requests" /><div className="merged-ticket-list">{visibleRequests.length ? visibleRequests.map((request) => <article key={request.id}><span className={`ticket-status ${request.status.toLowerCase().replaceAll("_", "-")}`} /><div><strong>{request.requestType}</strong><small>IS-{1000 + request.id} · {request.status.replaceAll("_", " ")}</small></div><button aria-label={`Open IS-${1000 + request.id}`} onClick={() => notify(`Request IS-${1000 + request.id} opened in the support timeline.`)}><ChevronRight size={16} /></button></article>) : <div className="empty-state compact"><TicketCheck size={24} /><strong>No active requests</strong><p>Choose an option in the chat to create one.</p></div>}</div></Panel><Panel><PanelHeader title="What this chat can do" /><div className="support-capabilities"><span><MessageCircle size={16} />Answer quick questions</span><span><TicketCheck size={16} />Create service requests</span><span><Upload size={16} />Attach documents</span><span><Phone size={16} />Request a callback</span></div></Panel></aside></section></div>;
}

function CallIntakeView({ profile, policyData, documents, notify, onSave }: { profile: StoredProfile | null; policyData: Policy[]; documents: PortalDocument[]; notify: (message: string) => void; onSave: (patch: Record<string, string | boolean>) => Promise<StoredProfile | null> }) {
  const [activeSection, setActiveSection] = useState("Goals");
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, string | boolean>>({
    underwritingStatus: "Call in progress",
    underwritingPriority: "Normal",
    coverageNeed: "",
    policyPurpose: "",
    nicotineUse: "",
    heightWeight: "",
    healthNotes: "",
    medications: "",
    familyHealthHistory: "",
    drivingHistory: "",
    hazardousActivities: "",
    advisorQuestions: "",
    missingDocuments: "",
    callOutcome: "",
    underwritingCallNotes: "",
    ...(profile?.profile || {}),
  });
  const sections = [
    { name: "Goals", icon: ShieldCheck, questions: ["What made you want to review coverage now?", "Who are we protecting financially?", "What outcome would make this call successful?"], fields: [["primaryGoal", "Primary goal"], ["coverageNeed", "Coverage need"], ["policyPurpose", "Policy purpose"], ["monthlyCoverageBudget", "Monthly budget"]] },
    { name: "Household", icon: UsersRound, questions: ["Who depends on your income?", "Any upcoming household changes?", "Who should be contacted in an emergency?"], fields: [["maritalStatus", "Marital status"], ["dependentsCount", "Dependents"], ["lifeEvents", "Upcoming life changes"], ["emergencyContactName", "Emergency contact"]] },
    { name: "Financials", icon: WalletCards, questions: ["What income should coverage protect?", "Any mortgage or major debt?", "Any business obligations or key-person exposure?"], fields: [["annualIncomeRange", "Annual income range"], ["mortgageBalance", "Mortgage balance"], ["otherDebt", "Other debt"], ["businessObligations", "Business obligations"]] },
    { name: "Health", icon: HeartHandshake, questions: ["Any nicotine use in the last 12 months?", "Current height and weight?", "Any major diagnoses, prescriptions, or pending tests?"], fields: [["nicotineUse", "Nicotine use"], ["heightWeight", "Height / weight"], ["healthNotes", "Health notes"], ["medications", "Medications"]] },
    { name: "Risk", icon: Activity, questions: ["Any moving violations, DUI, or license issues?", "Any hazardous hobbies, aviation, racing, diving, or military risk?", "Any family history that may matter for underwriting?"], fields: [["drivingHistory", "Driving history"], ["hazardousActivities", "Hazardous activities"], ["familyHealthHistory", "Family health history"], ["policyConcerns", "Policy concerns"]] },
    { name: "Wrap", icon: CheckCircle2, questions: ["What documents do we still need?", "What questions should the advisor answer next?", "What is the agreed next step?"], fields: [["missingDocuments", "Missing documents"], ["advisorQuestions", "Advisor questions"], ["callOutcome", "Call outcome"], ["underwritingPriority", "Priority"]] },
  ];
  const completed = CALL_INTAKE_REQUIRED_FIELDS.filter((key) => String(fields[key] || "").trim()).length;
  const active = sections.find((section) => section.name === activeSection) || sections[0];
  const update = (key: string, value: string) => setFields((current) => ({ ...current, [key]: value }));
  const appendNote = (text: string) => setFields((current) => ({ ...current, underwritingCallNotes: `${String(current.underwritingCallNotes || "").trim()}${current.underwritingCallNotes ? "\n" : ""}${text}` }));
  const save = async () => {
    setSaving(true);
    const saved = await onSave(fields);
    setSaving(false);
    notify(saved ? "Call intake saved to the client profile." : "Could not save the call intake.");
  };
  return <div className="section-view call-intake-view"><ViewHeading eyebrow="Live client call workspace" title="Call Intake" description="Ask questions, capture underwriting details, and leave the call with a usable advisor-ready client profile." action={<button className="primary-button" onClick={save} disabled={saving}><CheckCircle2 size={17} />{saving ? "Saving..." : "Save intake"}</button>} /><div className="call-command"><aside className="call-script"><Panel><PanelHeader title="Call flow" /><div className="call-progress"><strong>{completed}/{CALL_INTAKE_REQUIRED_FIELDS.length}</strong><span><i style={{ width: `${Math.round(completed / CALL_INTAKE_REQUIRED_FIELDS.length * 100)}%` }} /></span><small>Core underwriting facts captured</small></div><nav>{sections.map(({ name, icon: Icon }) => <button key={name} className={activeSection === name ? "active" : ""} onClick={() => setActiveSection(name)}><Icon size={16} />{name}</button>)}</nav></Panel><Panel><PanelHeader title="Suggested questions" /><div className="question-stack">{active.questions.map((question) => <button key={question} onClick={() => appendNote(`Asked: ${question}`)}><MessageCircle size={15} />{question}</button>)}</div></Panel></aside><Panel className="underwriting-sheet"><div className="sheet-head"><div><span>{active.name}</span><h3>Underwriting Sheet</h3></div><select value={String(fields.underwritingStatus || "Call in progress")} onChange={(event) => update("underwritingStatus", event.target.value)} aria-label="Underwriting status"><option>Call in progress</option><option>Waiting on documents</option><option>Ready for advisor review</option><option>Application likely</option><option>Not a fit yet</option></select></div><div className="sheet-grid">{active.fields.map(([key, label]) => <label key={key}>{label}{key === "policyConcerns" || key === "healthNotes" || key === "businessObligations" || key === "lifeEvents" ? <textarea value={String(fields[key] || "")} onChange={(event) => update(key, event.target.value)} placeholder={`Capture ${label.toLowerCase()}...`} /> : <input value={String(fields[key] || "")} onChange={(event) => update(key, event.target.value)} placeholder={`Add ${label.toLowerCase()}`} />}</label>)}</div><div className="call-record-strip"><span><FileText size={16} />{documents.length} vault document{documents.length === 1 ? "" : "s"}</span><span><ShieldCheck size={16} />{policyData.length} saved polic{policyData.length === 1 ? "y" : "ies"}</span><span><Clock3 size={16} />Status: {String(fields.underwritingStatus || "Call in progress")}</span></div></Panel><aside className="call-notes"><Panel><PanelHeader title="Live notes" /><textarea value={String(fields.underwritingCallNotes || "")} onChange={(event) => update("underwritingCallNotes", event.target.value)} placeholder="Type raw notes while the client talks. Use the guided questions to add prompts here as you go." /><div className="note-actions"><button onClick={() => appendNote("Client wants advisor follow-up.")}>Advisor follow-up</button><button onClick={() => appendNote("Need policy document upload.")}>Need docs</button><button onClick={() => appendNote("Potential underwriting concern.")}>Risk concern</button></div></Panel><Panel><PanelHeader title="Next step" /><label className="call-outcome">Call outcome<textarea value={String(fields.callOutcome || "")} onChange={(event) => update("callOutcome", event.target.value)} placeholder="Example: send term quote, request statements, schedule advisor review..." /></label><button className="secondary-button full" onClick={save} disabled={saving}><Check size={16} />Save call notes</button></Panel></aside></div></div>;
}

function AgentConsole() {
  type QueueItem = ServiceRequest & { clientName: string; unreadByAgent: boolean; requestData?: Record<string, string | boolean> };
  type KnowledgeItem = { id: string; question: string };
  const [queue, setQueue] = useState<QueueItem[]>([]); const [entries, setEntries] = useState<KnowledgeItem[]>([]); const [notice, setNotice] = useState("");
  const load = async () => { const [q, k] = await Promise.all([fetch("/api/agent/queue", { cache: "no-store" }), fetch("/api/knowledge", { cache: "no-store" })]); if (q.ok) setQueue((await q.json()).requests || []); if (k.ok) setEntries((await k.json()).entries || []); };
  useEffect(() => { Promise.all([fetch("/api/agent/queue", { cache: "no-store" }), fetch("/api/knowledge", { cache: "no-store" })]).then(async ([q, k]) => { if (q.ok) setQueue((await q.json()).requests || []); if (k.ok) setEntries((await k.json()).entries || []); }); }, []);
  const update = async (id: string, status: string) => { await fetch("/api/agent/queue", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) }); load(); };
  const addKnowledge = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const response = await fetch("/api/knowledge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: form.get("question"), keywords: form.get("keywords"), answer: form.get("answer") }) }); setNotice(response.ok ? "Training answer published." : "Could not publish answer."); if (response.ok) { event.currentTarget.reset(); load(); } };
  return <div className="section-view"><ViewHeading eyebrow="Customer service operations" title="Agent Console" description="New client and chatbot tickets are assigned here automatically." /><div className="agent-console-grid"><Panel><PanelHeader title={`My assigned queue (${queue.filter((item) => item.status !== "resolved").length})`} /><div className="agent-queue">{queue.map((item) => <article key={item.id} className={item.unreadByAgent ? "unread" : ""}><div><strong>{item.clientName}</strong><span>{item.requestType} · IS-{ticketCode(item.id)}{item.priority === "urgent" ? " · URGENT" : ""}</span><p>{item.details}</p>{item.requestData && <dl className="agent-intake-details">{Object.entries(item.requestData).filter(([, value]) => value && value !== "on").map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, " $1")}</dt><dd>{String(value)}</dd></div>)}</dl>}<small>{item.source === "chatbot" ? "Escalated by chatbot" : "Submitted by client form"}</small></div><select value={item.status} onChange={(e) => update(item.id, e.target.value)}><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="waiting_on_client">Waiting on client</option><option value="resolved">Resolved</option></select></article>)}{!queue.length && <div className="empty-state"><CheckCircle2 size={28} /><strong>Queue is clear</strong><p>New assigned tickets will appear here.</p></div>}</div></Panel><Panel><PanelHeader title="Train the chatbot" /><form className="knowledge-form" onSubmit={addKnowledge}><label>Customer question<input name="question" required placeholder="How do I change a beneficiary?" /></label><label>Keywords<input name="keywords" placeholder="beneficiary, change, update" /></label><label>Approved answer<textarea name="answer" required placeholder="Write the exact safe answer the bot should use..." /></label><button className="primary-button">Publish answer</button>{notice && <small>{notice}</small>}</form><div className="knowledge-list"><strong>{entries.length} approved answers</strong>{entries.slice(0,5).map((entry) => <p key={entry.id}>{entry.question}</p>)}</div></Panel></div></div>;
}

function CoverageView({ onOpen, policyData, profile, documents }: { onOpen: (modal: string) => void; policyData: Policy[]; profile: StoredProfile | null; documents: PortalDocument[] }) {
  const review = coverageReviewModel(policyData, profile, documents);
  const headline = review.score >= 80 ? "Your protection file is in good shape." : review.score >= 60 ? "A few gaps need attention." : "Start by verifying the core coverage records.";
  return <div className="section-view"><ViewHeading eyebrow="Annual protection checkup" title="Coverage Review" description="A simple view of what is strong, what changed, and what deserves attention." action={<button className="primary-button" onClick={() => onOpen("review")}><CalendarDays size={17} />Schedule review</button>} /><div className="coverage-hero"><div className="large-score-ring" style={{ "--score": `${review.score}%` } as React.CSSProperties}><div><strong>{review.score}</strong><span>/100</span><small>Readiness score</small></div></div><div><span className="pill blue">Updated from saved records</span><h3>{headline}</h3><p>{review.nextActions[0]?.detail || "Saved policies, documents, beneficiaries, review rhythm, and emergency contacts are all contributing to this view."}</p><button className="secondary-button" onClick={() => onOpen(review.nextActions[0]?.modal || "review")}><CalendarDays size={16} />{review.nextActions[0]?.action || "Complete review"}</button></div></div><div className="review-metric-grid">{review.reviewMetrics.map(({ label, score, text, icon: Icon, color }) => <Panel key={label} className="review-metric"><div className={`metric-icon ${color}`}><Icon size={21} /></div><div className="metric-title"><strong>{label}</strong><span>{score}/100</span></div><div className="metric-progress"><i className={color} style={{ width: `${score}%` }} /></div><p>{text}</p></Panel>)}</div><Panel className="recommendations"><PanelHeader title="Recommended next steps" />{review.nextActions.length ? review.nextActions.map((item, index) => <div key={item.title}><span><strong>{index + 1}</strong></span><p><strong>{item.title}</strong><small>{item.detail}</small></p><button onClick={() => onOpen(item.modal)}>{item.action}</button></div>) : <div><span><strong>1</strong></span><p><strong>Keep your review cadence</strong><small>Your core records are complete. Recheck whenever household, income, debt, or beneficiary details change.</small></p><button onClick={() => onOpen("review")}>Schedule</button></div>}</Panel></div>;
}

function NotificationsView({ notify }: { notify: (message: string) => void }) {
  const [unread, setUnread] = useState(["review", "ticket", "document"]);
  const notifications = [{ id: "review", icon: CalendarDays, title: "Your annual review is ready", detail: "Choose a 30-minute time with Maya to refresh your coverage plan.", time: "12 min ago" }, { id: "ticket", icon: TicketCheck, title: "Your request moved forward", detail: "Your proof of insurance request is now in progress.", time: "2 hours ago" }, { id: "document", icon: FileCheck2, title: "Document processed successfully", detail: "IUL_Statement_May2026.pdf is now connected to your IUL policy.", time: "2 hours ago" }, { id: "beneficiary", icon: UsersRound, title: "Beneficiary update confirmed", detail: "Your Whole Life policy beneficiary review was completed.", time: "Yesterday" }];
  return <div className="section-view"><ViewHeading eyebrow="Account activity" title="Notifications" description="Coverage reminders, document updates, and request progress in one timeline." action={<button className="secondary-button" onClick={() => { setUnread([]); notify("All notifications marked as read."); }}><CheckCircle2 size={16} />Mark all read</button>} /><Panel className="notification-list">{notifications.map(({ id, icon: Icon, title, detail, time }) => <button key={id} className={unread.includes(id) ? "unread" : ""} onClick={() => setUnread((current) => current.filter((item) => item !== id))}><span className="notification-icon"><Icon size={20} /></span><span><strong>{title}</strong><small>{detail}</small></span><time>{time}</time>{unread.includes(id) && <i />}</button>)}</Panel></div>;
}

function FamilyView({ onOpen, notify }: { onOpen: (modal: string) => void; notify: (message: string) => void }) {
  return <div className="section-view"><ViewHeading eyebrow="People your coverage protects" title="Family & Household" description="Keep household details, emergency contacts, and protection roles accurate." action={<button className="primary-button" onClick={() => notify("Household member form opened.")}><Plus size={17} />Add member</button>} /><div className="family-grid"><article className="person-card primary-person"><div className="person-top"><span className="avatar big">JM</span><span className="pill blue">Account owner</span></div><h3>Jordan McNutt</h3><p>Owner · Primary insured</p><div><span><strong>$1.275M</strong><small>Total protection</small></span><span><strong>5</strong><small>Policies</small></span></div><button onClick={() => notify("Jordan’s profile opened.")}>View profile<ChevronRight size={17} /></button></article><article className="person-card"><div className="person-top"><span className="avatar big soft">AS</span><span className="status active"><Check size={13} />Protected</span></div><h3>Alex Smith</h3><p>Spouse · Primary beneficiary</p><div><span><strong>4</strong><small>Policies named</small></span><span><strong>70%</strong><small>Primary share</small></span></div><button onClick={() => onOpen("beneficiary")}>Review details<ChevronRight size={17} /></button></article><button className="add-person-card" onClick={() => notify("Household member form opened.")}><span><Plus size={23} /></span><strong>Add a household member</strong><p>Track dependents, emergency contacts, and protection needs.</p></button></div><Panel className="household-readiness"><PanelHeader title="Household readiness" /><div><CheckCircle2 size={20} /><span><strong>Emergency contact confirmed</strong><small>Alex Smith · Updated Jun 29, 2026</small></span><button onClick={() => notify("Emergency contact details opened.")}>Review</button></div><div><CircleHelp size={20} /><span><strong>Dependent needs not reviewed</strong><small>Add dependents to improve your coverage analysis.</small></span><button onClick={() => notify("Dependent details opened.")}>Add details</button></div></Panel></div>;
}

function ClaimsView({ notify, onOpen }: { notify: (message: string) => void; onOpen: (modal: string) => void }) {
  return <div className="section-view"><div className="claims-hero"><span className="claims-icon"><HeartHandshake size={31} /></span><span className="pill purple">Compassionate support</span><h2>You do not have to navigate a claim alone.</h2><p>InsurSuite helps families organize documents, contact the right carrier, and understand what happens next—step by step.</p><div><button className="primary-button" onClick={() => notify("A private claim intake has started.")}><FileCheck2 size={17} />Start a claim</button><button className="secondary-button" onClick={() => onOpen("concierge")}><Phone size={17} />Talk to a concierge</button></div></div><div className="claim-steps"><article><span>1</span><div><strong>Tell us what happened</strong><p>Share the policyholder and policy details in a private intake.</p></div></article><article><span>2</span><div><strong>We organize the claim</strong><p>Your concierge prepares the carrier checklist and documents.</p></div></article><article><span>3</span><div><strong>Track every milestone</strong><p>See requests, follow-ups, and claim status in one timeline.</p></div></article></div><div className="claims-bottom"><Panel><LifeBuoy size={25} /><h3>Already filed with a carrier?</h3><p>Add the claim number and we’ll help you keep the process organized.</p><button className="secondary-button" onClick={() => notify("Existing claim form opened.")}>Track an existing claim</button></Panel><Panel><FolderLock size={25} /><h3>Prepare before it is needed</h3><p>Keep policy documents and emergency contacts ready in your secure vault.</p><button className="secondary-button" onClick={() => onOpen("upload")}>Organize documents</button></Panel></div></div>;
}

function SettingsView({ notify, user, profile }: { notify: (message: string) => void; user: PortalUser | null; profile: StoredProfile | null }) {
  const [preferences, setPreferences] = useState({ email: true, sms: true, policy: true, marketing: false });
  const toggle = (key: keyof typeof preferences) => setPreferences((current) => ({ ...current, [key]: !current[key] }));
  const initials = (profile?.fullName || user?.displayName || "Account").split(/\s+/).map((part) => part[0]).join("").slice(0,2).toUpperCase();
  return <div className="section-view"><ViewHeading eyebrow="Account preferences" title="Settings" description="Manage your profile, security, and how InsurSuite keeps you informed." /><div className="settings-layout"><aside className="settings-nav"><button className="active"><UserRound size={17} />Profile</button><button><Bell size={17} />Notifications</button><button><LockKeyhole size={17} />Security</button><button><Gem size={17} />Plan & billing</button></aside><div className="settings-content"><Panel><PanelHeader title="Profile information" /><div className="profile-block"><span className="avatar big">{initials}</span><div><strong>{profile?.fullName || user?.displayName || "Account owner"}</strong><small>{user?.email || "Signed in account"}</small></div><form action="/auth/signout" method="post"><button className="secondary-button" type="submit">Sign out</button></form></div><form className="settings-form" onSubmit={(e) => { e.preventDefault(); notify("Profile settings saved."); }}><label>Full name<input defaultValue={profile?.fullName || user?.fullName || ""} /></label><label>Email address<input defaultValue={user?.email || ""} type="email" readOnly /></label><label>Phone number<input defaultValue={profile?.phone || ""} /></label><label>State<select defaultValue="Texas"><option>Texas</option><option>Oklahoma</option><option>Florida</option></select></label><button className="primary-button" type="submit">Save changes</button></form></Panel><Panel><PanelHeader title="Notification preferences" /><div className="preference-list">{[["email", "Email updates", "Policy, ticket, and account activity"], ["sms", "Text reminders", "Draft dates and scheduled reviews"], ["policy", "Coverage alerts", "Missing details and annual review prompts"], ["marketing", "Product news", "New InsurSuite features and offers"]].map(([key, title, detail]) => <div key={key}><span><strong>{title}</strong><small>{detail}</small></span><button className={`toggle ${preferences[key as keyof typeof preferences] ? "on" : ""}`} onClick={() => toggle(key as keyof typeof preferences)} aria-label={`Toggle ${title}`}><i /></button></div>)}</div></Panel></div></div></div>;
}

function SectionContent({ active, onNavigate, onPolicy, onOpen, notify, policyData, uploadedDocuments, profile, user, isSample, requests, onCreateRequest, onSaveProfile }: { active: NavKey; onNavigate: (key: NavKey) => void; onPolicy: (policy: Policy) => void; onOpen: (modal: string) => void; notify: (message: string) => void; policyData: Policy[]; uploadedDocuments: PortalDocument[]; profile: StoredProfile | null; user: PortalUser | null; isSample: boolean; requests: ServiceRequest[]; onCreateRequest: (input: SupportRequestInput) => Promise<ServiceRequest | null>; onSaveProfile: (patch: Record<string, string | boolean>) => Promise<StoredProfile | null> }) {
  if (active === "Dashboard") return <Dashboard onNavigate={onNavigate} onPolicy={onPolicy} onOpen={onOpen} policyData={policyData} profile={profile} documents={uploadedDocuments} requests={requests} isSample={isSample} />;
  if (active === "My Policies") return <PoliciesView onPolicy={onPolicy} onOpen={onOpen} notify={notify} policyData={policyData} isSample={isSample} />;
  if (active === "Document Vault") return <DocumentVaultView onOpen={onOpen} notify={notify} uploadedDocuments={uploadedDocuments} />;
  if (active === "AI Assistant") return <AssistantView onOpen={onOpen} />;
  if (active === "Support Center") return <SupportView onOpen={onOpen} notify={notify} requests={requests} onCreateRequest={onCreateRequest} />;
  if (active === "Call Intake") return <CallIntakeView profile={profile} policyData={policyData} documents={uploadedDocuments} notify={notify} onSave={onSaveProfile} />;
  if (active === "Coverage Review") return <CoverageView onOpen={onOpen} policyData={policyData} profile={profile} documents={uploadedDocuments} />;
  if (active === "Notifications") return <NotificationsView notify={notify} />;
  if (active === "Family & Household") return <FamilyView onOpen={onOpen} notify={notify} />;
  if (active === "Claims Concierge") return <ClaimsView onOpen={onOpen} notify={notify} />;
  if (active === "Agent Console") return <AgentConsole />;
  return <SettingsView notify={notify} user={user} profile={profile} />;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header"><div><span className="modal-kicker">InsurSuite</span><h2>{title}</h2></div><button onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        {children}
      </div>
    </div>
  );
}

function ConciergeChat({ onCreateRequest }: { onCreateRequest: (input: SupportRequestInput) => Promise<unknown> }) {
  type ConciergeMessage = { role: "consultant" | "user"; text: string; time: string };
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [requested, setRequested] = useState(false);
  const [messages, setMessages] = useState<ConciergeMessage[]>([
    { role: "consultant" as const, text: "Hi, I’m Maya. I can help with policy questions, billing, beneficiaries, claims, or getting a request routed to the right person.", time: "Just now" },
    { role: "consultant" as const, text: "What would you like help with today?", time: "Just now" },
  ]);
  const quickReplies = ["Review my coverage", "I need a policy document", "Billing question", "Beneficiary change"];
  const send = (text: string) => {
    const message = text.trim();
    if (!message || typing) return;
    setMessages((current) => [...current, { role: "user", text: message, time: "Now" }]);
    setDraft("");
    setTyping(true);
    window.setTimeout(() => {
      setMessages((current) => [...current, { role: "consultant", text: "Got it. I’ll keep this in the conversation and can turn it into a tracked service request if it needs follow-up from the team.", time: "Now" }]);
      setTyping(false);
    }, 850);
  };
  const escalate = async () => {
    const transcript = messages.filter((message) => message.role === "user").map((message) => message.text).join("\n") || "Client requested help via the concierge chat.";
    await onCreateRequest({ requestType: "Concierge chat follow-up", details: transcript, requestData: {} });
    setRequested(true);
    setMessages((current) => [...current, { role: "consultant", text: "This conversation is now a tracked request — you can follow its status in Support Center.", time: "Now" }]);
  };
  return <div className="concierge-chat"><div className="consultant chat-consultant"><span className="avatar">MC</span><span><strong>Maya Carter</strong><small>Your dedicated coverage consultant · Online now</small></span><i /></div><div className="concierge-thread" aria-live="polite">{messages.map((message, index) => <div className={`concierge-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "consultant" ? "MC" : "You"}</span><p>{message.text}<small>{message.time}</small></p></div>)}{typing && <div className="concierge-message consultant typing"><span>MC</span><p><b /><b /><b /></p></div>}</div><div className="concierge-quick-replies">{quickReplies.map((reply) => <button type="button" key={reply} onClick={() => send(reply)}>{reply}</button>)}</div><form className="concierge-composer" onSubmit={(event) => { event.preventDefault(); send(draft); }}><button type="button" aria-label="Attach document"><Paperclip size={18} /></button><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Message Maya..." aria-label="Message Maya" /><button type="submit" disabled={!draft.trim() || typing} aria-label="Send message"><Send size={17} /></button></form><div className="concierge-handoff"><Clock3 size={15} /><span>Replies here are saved as conversation context. {requested ? "This conversation is now a tracked request." : "Carrier changes, claims, payment issues, and licensed advice should become tracked requests."}</span>{!requested && <button type="button" className="text-button" onClick={escalate} disabled={messages.filter((message) => message.role === "user").length === 0}>Turn into tracked request</button>}</div></div>;
}

const intakeSections: { title: string; short: string; description: string; fields: IntakeField[] }[] = [
  { title: "You & household", short: "Personal details", description: "The basics we use to identify your account, stay compliant, and see who protection planning should include.", fields: [
    { key: "preferredName", label: "Preferred name", placeholder: "What should we call you?", required: true }, { key: "address", label: "Street address", placeholder: "123 Main Street", required: true }, { key: "city", label: "City", required: true }, { key: "state", label: "State", type: "select", options: ["Texas", "Oklahoma", "Florida", "California", "New York", "Other"], required: true }, { key: "postalCode", label: "ZIP code", required: true }, { key: "preferredContact", label: "Preferred contact method", type: "select", options: ["Text message", "Phone call", "Email"], required: true }, { key: "maritalStatus", label: "Marital status", type: "select", options: ["Single", "Married", "Partnered", "Divorced", "Widowed"], required: true }, { key: "dependentsCount", label: "Number of dependents", type: "number", placeholder: "0", required: true },
  ]},
  { title: "Goals & beneficiaries", short: "Priorities & people", description: "What the coverage should accomplish, who it protects, and who we contact in an emergency.", fields: [
    { key: "primaryGoal", label: "Primary reason for coverage", type: "select", options: ["Protect family income", "Pay off a mortgage", "Final expenses", "Build cash value", "Estate or legacy planning", "Business protection", "Review existing coverage"], required: true }, { key: "coverageConcerns", label: "What concerns you most?", type: "textarea", placeholder: "Tell us what you want the review to answer", required: true }, { key: "primaryBeneficiary", label: "Primary beneficiary", placeholder: "Full legal name", required: true }, { key: "primaryRelationship", label: "Relationship", required: true }, { key: "emergencyContactName", label: "Emergency contact", placeholder: "Full name", required: true }, { key: "emergencyContactPhone", label: "Emergency contact phone", placeholder: "(000) 000-0000", required: true },
  ]},
  { title: "Financials & preferences", short: "Income & review rhythm", description: "How your ongoing insurance relationship should work.", fields: [
    { key: "employmentStatus", label: "Employment status", type: "select", options: ["Employed", "Self-employed", "Business owner", "Retired", "Student", "Not currently employed"], required: true }, { key: "annualIncomeRange", label: "Annual income", type: "select", options: ["Under $25,000", "$25,000–$49,999", "$50,000–$74,999", "$75,000–$99,999", "$100,000–$149,999", "$150,000+"], required: true }, { key: "reviewFrequency", label: "Coverage review frequency", type: "select", options: ["Every 6 months", "Annually", "After major life events", "Only when I request one"], required: true }, { key: "informationConsent", label: "I authorize InsurSuite to organize the information and documents I provide for policy servicing and coverage reviews, and confirm it is accurate to the best of my knowledge.", type: "checkbox", required: true },
  ]},
];

function PortalLoading() {
  return <main className="portal-gate loading"><div className="gate-brand"><ShieldCheck size={27} /><strong>Insur<span>Suite</span></strong></div><div className="loading-orbit"><ShieldCheck size={30} /></div><h1>Opening your secure portal</h1><p>Loading your profile, policies, and onboarding progress.</p></main>;
}

function SignInGate() {
  const manifesto = [
    "Insurance should be legible before it is urgent.",
    "Every household deserves one trusted place for policies, people, documents, and next steps.",
    "You should never have to search through emails, drawers, and carrier portals to understand what protects your family.",
  ];
  return (
    <main className="marketing-page">
      <nav className="marketing-nav" aria-label="InsurSuite marketing navigation">
        <div className="gate-brand"><ShieldCheck size={27} /><strong>Insur<span>Suite</span></strong></div>
        <div>
          <a href="#mission">Mission</a>
          <a href="#manifesto">Manifesto</a>
          <a href="#platform">Platform</a>
          <a className="nav-cta" href="/login">Sign in</a>
        </div>
      </nav>

      <section className="marketing-hero">
        <div className="hero-copy">
          <span className="market-kicker"><LockKeyhole size={15} />Secure insurance command center</span>
          <h1>Keep your family’s insurance organized before anyone needs it.</h1>
          <p>InsurSuite gives you one secure place for policies, documents, beneficiaries, support requests, and annual coverage checkups.</p>
          <div className="hero-actions">
            <a className="primary-button" href="/login">Create account<ArrowRight size={17} /></a>
            <a className="secondary-button" href="#mission">Read the mission</a>
          </div>
          <div className="trust-strip">
            <span><CheckCircle2 size={16} />Policy vault</span>
            <span><CheckCircle2 size={16} />Coverage checkups</span>
            <span><CheckCircle2 size={16} />Human support</span>
          </div>
        </div>
        <div className="hero-product" aria-label="InsurSuite product preview">
          <div className="product-window">
            <div className="window-top"><span /><span /><span /><strong>Family coverage file</strong></div>
            <div className="product-grid">
              <section>
                <small>Needs attention</small>
                <strong>Set annual review rhythm</strong>
                <p>A scheduled review keeps coverage assumptions from going stale.</p>
              </section>
              <section>
                <small>Readiness</small>
                <strong>81/100</strong>
                <i><b style={{ width: "81%" }} /></i>
              </section>
              <section className="wide">
                <small>Personal coverage profile</small>
                <strong>What should your coverage protect next?</strong>
                <p>Keep household details, beneficiaries, important documents, and follow-up questions together for your next review.</p>
              </section>
            </div>
          </div>
        </div>
      </section>

      <section className="mission-band" id="mission">
        <span>Company mission</span>
        <h2>InsurSuite exists to make insurance feel organized, explainable, and human before life forces the issue.</h2>
        <p>We are building a simpler way for people to keep track of their policies, documents, beneficiaries, and service requests so they always know what exists, what changed, what is missing, and what to do next.</p>
      </section>

      <section className="manifesto-section" id="manifesto">
        <div>
          <span>Manifesto</span>
          <h2>Coverage is a promise. The system around it should act like one.</h2>
        </div>
        <div className="manifesto-list">
          {manifesto.map((line, index) => <article key={line}><span>{String(index + 1).padStart(2, "0")}</span><p>{line}</p></article>)}
        </div>
      </section>

      <section className="platform-section" id="platform">
        <div className="platform-heading">
          <span>What InsurSuite brings together</span>
          <h2>One workspace for the work that usually gets scattered.</h2>
        </div>
        <div className="platform-grid">
          {[["Document vault", "Store policy files, statements, illustrations, and forms with the right household and policy context."], ["Coverage review", "Turn saved information into readiness scores, missing-detail prompts, and practical next steps."], ["Support center", "Ask questions, create requests, and keep every update connected to the same conversation."], ["Protection profile", "Keep household facts, beneficiaries, goals, and upcoming life changes ready for your next review."]].map(([title, detail]) => <article key={title}><strong>{title}</strong><p>{detail}</p></article>)}
        </div>
      </section>

      <section className="closing-cta">
        <h2>Build a coverage file your future self can actually use.</h2>
        <p>Start with your account, add the policies you already own, and let InsurSuite turn the paper trail into a working system.</p>
        <a className="primary-button" href="/login">Create account or sign in<ArrowRight size={17} /></a>
      </section>
    </main>
  );
}

function AccountCreation({ user, onCreated, onSkip }: { user: PortalUser; onCreated: (profile: StoredProfile) => void; onSkip: () => void }) {
  const [fullName, setFullName] = useState(user.fullName || user.displayName || ""); const [phone, setPhone] = useState(""); const [dateOfBirth, setDateOfBirth] = useState(""); const [accepted, setAccepted] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); setError(""); try { const response = await fetch("/api/client-profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName, phone, dateOfBirth, onboardingStatus: "in_progress", onboardingStep: 0, profile: { accountConsent: true } }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not create account"); onCreated(result.profile); } catch (err) { setError(err instanceof Error ? err.message : "Could not create account"); } finally { setSaving(false); } };
  return <main className="account-creation"><section className="creation-copy"><div className="gate-brand"><ShieldCheck size={27} /><strong>Insur<span>Suite</span></strong></div><span className="step-label">Step 1 of 2 · Create your portal</span><h1>Let’s build your insurance command center.</h1><p>Your account keeps every detail in one place and remembers your progress across devices.</p><div className="creation-points"><div><span>01</span><p><strong>Create the secure account</strong><small>Confirm your identity and best contact information.</small></p></div><div><span>02</span><p><strong>Complete your protection profile</strong><small>Three short, resumable sections — about two minutes.</small></p></div><div><span>03</span><p><strong>Add your existing policies</strong><small>Upload documents and let Document Intelligence organize them.</small></p></div></div></section><section className="creation-form-wrap"><form className="creation-form" onSubmit={submit}><span className="form-icon"><UserRound size={23} /></span><h2>Create your account</h2><p>We’ve verified your email. Confirm the details below to begin.</p><label>Full legal name<input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></label><label>Email address<input value={user.email} readOnly /></label><div className="two-fields"><label>Mobile phone<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(000) 000-0000" required /></label><label>Date of birth<input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required /></label></div><label className="consent-check"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} required /><span>I agree to the portal terms and authorize InsurSuite to store the information I choose to provide.</span></label>{error && <p className="form-error">{error}</p>}<button className="primary-button full" disabled={saving || !accepted}>{saving ? "Creating your portal..." : "Create my portal"}<ArrowRight size={17} /></button>{allowSetupSkip && <button type="button" className="text-button save-exit" onClick={onSkip} disabled={saving}>Skip setup for local preview</button>}<small className="privacy-line"><LockKeyhole size={13} />We do not collect SSNs, bank credentials, or medical records during account setup.</small></form></section></main>;
}

function TicketRequestForm({ policies, onSubmit }: { policies: Policy[]; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const [requestType, setRequestType] = useState("");
  const detailLabel = requestType === "Billing or premium issue" ? "What charge, draft, or payment needs attention?" : requestType === "Beneficiary update" ? "What beneficiary change are you requesting?" : requestType === "Policy change" ? "What policy change would you like reviewed?" : requestType === "Claim support" ? "What happened, and where are you in the claim process?" : "Describe what you need help accomplishing";
  return <form className="ticket-intake-form" onSubmit={onSubmit}>
    <div className="ticket-form-intro"><span><TicketCheck size={20} /></span><p><strong>Tell us what you need once.</strong><small>Your answers are saved with the ticket and sent to the assigned representative.</small></p></div>
    <fieldset><legend>1. Request details</legend><div className="ticket-form-grid"><label>Request category<select name="requestType" required value={requestType} onChange={(event) => setRequestType(event.target.value)}><option value="" disabled>Select one</option><option>Policy change</option><option>Proof or policy document</option><option>Billing or premium issue</option><option>Beneficiary update</option><option>Claim support</option><option>Coverage review</option><option>Account or portal help</option><option>Other request</option></select></label><label>Related policy<select name="policyNumber" defaultValue=""><option value="">Not sure / multiple policies</option>{policies.filter((policy) => !policy.isSample).map((policy) => <option value={policy.id} key={policy.id}>{policy.type} - #{policy.id}</option>)}</select></label><label>Urgency<select name="urgency" required defaultValue="Standard - within 1 business day"><option>Standard - within 1 business day</option><option>Time-sensitive - within 4 business hours</option><option>Urgent - coverage or payment at risk</option></select></label><label>Requested effective date<input name="effectiveDate" type="date" /></label></div><label className="wide">{detailLabel}<textarea name="details" required minLength={15} placeholder="Include names, dates, amounts, carrier messages, and what you have already tried." /></label><label className="wide">What outcome would resolve this request?<textarea name="desiredOutcome" required minLength={8} placeholder="Example: Confirm the correct premium and stop the duplicate draft." /></label></fieldset>
    <fieldset><legend>2. Supporting information</legend><div className="ticket-form-grid"><label>Amount involved, if any<input name="amountInQuestion" placeholder="$0.00" /></label><label>Have you contacted the carrier?<select name="carrierContacted" defaultValue="No"><option>No</option><option>Yes - waiting for response</option><option>Yes - carrier responded</option></select></label><label>Do you have supporting documents?<select name="documentsAvailable" defaultValue="No"><option>No</option><option>Yes - already in my vault</option><option>Yes - I need to upload them</option></select></label></div><p className="ticket-upload-note"><Paperclip size={15} />After submitting, upload supporting files to the Document Vault and select the related policy.</p></fieldset>
    <fieldset><legend>3. Follow-up preference</legend><div className="ticket-form-grid"><label>Preferred contact method<select name="contactMethod" required defaultValue="Secure portal message"><option>Secure portal message</option><option>Email</option><option>Text message</option><option>Phone call</option></select></label><label>Best time to reach you<select name="bestContactTime" defaultValue="Any time"><option>Morning</option><option>Afternoon</option><option>Evening</option><option>Any time</option></select></label></div><label className="ticket-consent"><input type="checkbox" name="authorization" required /><span>I confirm this information is accurate and authorize the support team to use it to investigate this request. I understand that submitting this form does not itself change my policy.</span></label></fieldset>
    <div className="ticket-form-actions"><small><LockKeyhole size={13} />Do not include Social Security numbers, passwords, bank credentials, or medical records.</small><button className="primary-button" type="submit"><TicketCheck size={17} />Submit and assign request</button></div>
  </form>;
}

function OnboardingFlow({ user, profile, onComplete, onSkip }: { user: PortalUser; profile: StoredProfile; onComplete: (profile: StoredProfile) => void; onSkip: () => void }) {
  const initialStep = Math.min(profile.onboardingStep || 0, intakeSections.length - 1); const [step, setStep] = useState(initialStep); const [data, setData] = useState<Record<string, string | boolean>>(profile.profile || {}); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState(""); const section = intakeSections[step]; const progress = Math.round(((step + 1) / intakeSections.length) * 100);
  const update = (key: string, value: string | boolean) => setData((current) => ({ ...current, [key]: value }));
  const save = async (next: number, finish = false) => { setSaving(true); setNotice(""); try { const response = await fetch("/api/client-profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName: profile.fullName, phone: profile.phone, dateOfBirth: profile.dateOfBirth, onboardingStatus: finish ? "completed" : "in_progress", onboardingStep: finish ? intakeSections.length : next, profile: data }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not save progress"); if (finish) onComplete(result.profile); else { setStep(next); window.scrollTo({ top: 0, behavior: "smooth" }); } } catch (err) { setNotice(err instanceof Error ? err.message : "Could not save progress"); } finally { setSaving(false); } };
  return <main className="onboarding-shell"><header className="onboarding-top"><div className="gate-brand"><ShieldCheck size={25} /><strong>Insur<span>Suite</span></strong></div><div><span>Signed in as</span><strong>{user.email}</strong></div></header><div className="onboarding-layout"><aside className="onboarding-checklist"><span className="step-label">Step 2 of 2 · Protection profile</span><h2>Client onboarding</h2><p>Your progress is saved after every section.</p><div className="overall-progress"><i style={{ width: `${progress}%` }} /></div><small>{progress}% complete</small><nav>{intakeSections.map((item, index) => <button key={item.title} className={index === step ? "active" : index < step ? "complete" : ""} onClick={() => index <= profile.onboardingStep && setStep(index)}><span>{index < step ? <Check size={14} /> : index + 1}</span><div><strong>{item.short}</strong><small>{index < step ? "Complete" : index === step ? "In progress" : "Not started"}</small></div></button>)}</nav><div className="intake-safety"><LockKeyhole size={17} /><p><strong>Purposeful data collection</strong><small>We only ask for information needed to organize, review, and service coverage.</small></p></div></aside><section className="onboarding-form-card"><div className="onboarding-form-head"><span>Section {step + 1} of {intakeSections.length}</span><h1>{section.title}</h1><p>{section.description}</p></div><form onSubmit={(event) => { event.preventDefault(); save(step + 1, step === intakeSections.length - 1); }}><div className="intake-fields">{section.fields.map((field) => <label key={field.key} className={`${field.type === "textarea" || field.type === "checkbox" ? "wide" : ""} ${field.type === "checkbox" ? "intake-checkbox" : ""}`}>{field.type === "checkbox" ? <><input type="checkbox" checked={Boolean(data[field.key])} onChange={(e) => update(field.key, e.target.checked)} required={field.required} /><span>{field.label}{field.helper && <small>{field.helper}</small>}</span></> : <>{field.label}{field.type === "select" ? <select value={String(data[field.key] ?? "")} onChange={(e) => update(field.key, e.target.value)} required={field.required}><option value="">Select one</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : field.type === "textarea" ? <textarea value={String(data[field.key] ?? "")} onChange={(e) => update(field.key, e.target.value)} placeholder={field.placeholder} required={field.required} /> : <input type={field.type || "text"} value={String(data[field.key] ?? (field.key === "dateOfBirth" ? profile.dateOfBirth : ""))} onChange={(e) => update(field.key, e.target.value)} placeholder={field.placeholder} required={field.required} />}{field.helper && <small>{field.helper}</small>}</>}</label>)}</div>{step === intakeSections.length - 1 && <div className="sensitive-data-note"><ShieldCheck size={18} /><p><strong>Information we intentionally do not collect here</strong><small>Social Security numbers, bank routing details, passwords, full medical records, and carrier login credentials belong only in a secure, purpose-specific application or carrier workflow.</small></p></div>}{notice && <p className="form-error">{notice}</p>}<div className="onboarding-actions"><button type="button" className="secondary-button" disabled={step === 0 || saving} onClick={() => setStep(step - 1)}>Back</button><button type="button" className="text-button save-exit" onClick={() => save(step)}>Save & exit</button>{allowSetupSkip && <button type="button" className="text-button save-exit" onClick={onSkip} disabled={saving}>Skip setup</button>}<button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving..." : step === intakeSections.length - 1 ? "Finish onboarding" : "Save & continue"}<ArrowRight size={16} /></button></div></form></section></div></main>;
}

export default function HomePage() {
  const [portalMode, setPortalMode] = useState<"loading" | "signed_out" | "create" | "onboarding" | "ready" | "error">("loading");
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [storedProfile, setStoredProfile] = useState<StoredProfile | null>(null);
  const [storedDocuments, setStoredDocuments] = useState<PortalDocument[]>([]);
  const [storedRequests, setStoredRequests] = useState<ServiceRequest[]>([]);
  const [agentAccess, setAgentAccess] = useState(false);
  const [portalError, setPortalError] = useState("");
  const [active, setActive] = useState<NavKey>("Dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modal, setModal] = useState<string | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [scannedPolicies, setScannedPolicies] = useState<Policy[]>([]);
  const [scanStage, setScanStage] = useState<"idle" | "scanning" | "review" | "error">("idle");
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStep, setScanStep] = useState("Preparing document");
  const [scanFileName, setScanFileName] = useState("");
  const [scanError, setScanError] = useState("");
  const [extractedPolicy, setExtractedPolicy] = useState<ExtractedPolicy | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanSaving, setScanSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isSampleMode = scannedPolicies.length === 0;
  const allPolicies = useMemo(() => isSampleMode ? samplePolicies : scannedPolicies, [scannedPolicies, isSampleMode]);

  const skipSetup = async () => {
    if (!portalUser) return;
    try {
      const response = await fetch("/api/client-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: portalUser.fullName || portalUser.displayName,
          phone: "",
          dateOfBirth: "",
          onboardingStatus: "completed",
          onboardingStep: intakeSections.length,
          profile: {
            preferredName: portalUser.displayName,
            communicationStyle: "Short and direct",
            informationConsent: true,
            accuracyAttestation: true,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not skip setup");
      setStoredProfile(result.profile);
      setPortalMode("ready");
    } catch (error) {
      setPortalError(error instanceof Error ? error.message : "Could not skip setup");
      setPortalMode("error");
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadPortal = async () => {
      try {
        const response = await fetch("/api/client-profile", { cache: "no-store" });
        if (cancelled) return;
        if (response.status === 401) { setPortalMode("signed_out"); return; }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load your portal");
        setPortalUser(result.user);
        setStoredDocuments(result.documents || []);
        setStoredRequests(result.requests || []);
        setAgentAccess(Boolean(result.isAgent));
        const savedPolicies: Policy[] = (result.policies || []).map((policy: Record<string, string>) => ({ id: policy.policyNumber, type: policy.policyType || "Imported Life Insurance Policy", carrier: policy.carrier || "Carrier needs review", benefit: policy.deathBenefit || "$0", premium: policy.monthlyPremium ? `${policy.monthlyPremium}/mo` : "$0/mo", cashValue: policy.cashValue || "$0", beneficiaries: policy.beneficiaries || "", color: "blue" as const, icon: ShieldCheck }));
        setScannedPolicies(savedPolicies);
        if (!result.profile) { setPortalMode("create"); return; }
        setStoredProfile(result.profile);
        setPortalMode(result.profile.onboardingStatus === "completed" ? "ready" : "onboarding");
      } catch (error) {
        if (!cancelled) { setPortalError(error instanceof Error ? error.message : "Could not load your portal"); setPortalMode("error"); }
      }
    };
    loadPortal();
    return () => { cancelled = true; };
  }, []);

  const resetScanner = () => {
    setScanStage("idle"); setScanProgress(0); setScanStep("Preparing document"); setScanFileName(""); setScanError(""); setExtractedPolicy(null); setScanFile(null); setScanSaving(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const openModal = (name: string) => {
    if (name === "upload") resetScanner();
    setModal(name);
  };

  const scanDocument = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) { setScanStage("error"); setScanError("This file is larger than 20 MB. Choose a smaller PDF, JPG, or PNG."); return; }
    setScanFile(file); setScanFileName(file.name); setScanError(""); setScanStage("scanning"); setScanProgress(8); setScanStep("Securing document");
    try {
      const text = await extractDocumentText(file, (progress, step) => { setScanProgress(progress); setScanStep(step); });
      setScanProgress(89); setScanStep("Identifying policy fields");
      const structured = structurePolicyText(text);
      setExtractedPolicy(structured); setScanProgress(100); setScanStep("Scan complete"); setScanStage("review");
    } catch (error) {
      console.error(error);
      setScanStage("error"); setScanError("We couldn’t read this document. Try a clearer image or a text-based PDF, then review the fields before saving.");
    }
  };

  const updateExtracted = (key: keyof Omit<ExtractedPolicy, "confidence" | "sourceText">, value: string) => setExtractedPolicy((current) => current ? { ...current, [key]: value } : current);

  const saveScannedPolicy = async () => {
    if (!extractedPolicy) return;
    setScanSaving(true); setScanError("");
    const id = extractedPolicy.policyNumber || `IMPORTED-${String(scannedPolicies.length + 1).padStart(3, "0")}`;
    const newPolicy: Policy = { id, type: extractedPolicy.policyType || "Imported Life Insurance Policy", carrier: extractedPolicy.carrier || "Carrier needs review", benefit: extractedPolicy.deathBenefit || "$0", premium: extractedPolicy.monthlyPremium ? `${extractedPolicy.monthlyPremium}/mo` : "$0/mo", cashValue: extractedPolicy.cashValue || "$0", beneficiaries: extractedPolicy.beneficiaries || "", color: "blue", icon: ShieldCheck };
    try {
      const policyResponse = await fetch("/api/policies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...extractedPolicy, policyNumber: id, sourceFileName: scanFileName }) });
      const policyResult = await policyResponse.json();
      if (!policyResponse.ok) throw new Error(policyResult.error || "Could not save the policy");
      if (scanFile) { const form = new FormData(); form.append("file", scanFile); form.append("policyNumber", id); const documentResponse = await fetch("/api/documents", { method: "POST", body: form }); const documentResult = await documentResponse.json(); if (!documentResponse.ok) throw new Error(documentResult.error || "Policy saved, but the document could not be stored"); setStoredDocuments((current) => [documentResult.document, ...current]); }
      setScannedPolicies((current) => [newPolicy, ...current.filter((policy) => policy.id !== id)]);
      setActive("My Policies"); notify(`${scanFileName} securely stored and added to My Policies.`); resetScanner();
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Could not save the policy");
      setScanSaving(false);
    }
  };

  const createServiceRequest = async ({ requestType, details, requestData = {} }: SupportRequestInput) => {
    const response = await fetch("/api/service-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestType, details, requestData }) });
    const result = await response.json();
    if (!response.ok) { setToast(result.error || "Could not save the request"); return null; }
    setStoredRequests((current) => [result.request, ...current]);
    notify(`Request #IS-${ticketCode(result.request.id)} created${result.request.assignedTo ? " and assigned to a representative" : " and queued"}.`);
    return result.request as ServiceRequest;
  };

  const saveProfilePatch = async (patch: Record<string, string | boolean>) => {
    if (!storedProfile) return null;
    const response = await fetch("/api/client-profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: storedProfile.fullName,
        phone: storedProfile.phone,
        dateOfBirth: storedProfile.dateOfBirth,
        onboardingStatus: storedProfile.onboardingStatus || "completed",
        onboardingStep: storedProfile.onboardingStep || intakeSections.length,
        profile: { ...(storedProfile.profile || {}), ...patch },
      }),
    });
    const result = await response.json();
    if (!response.ok) { setToast(result.error || "Could not save profile"); return null; }
    setStoredProfile(result.profile);
    return result.profile as StoredProfile;
  };

  const submitServiceRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const requestData = { policyNumber: form.get("policyNumber"), urgency: form.get("urgency"), contactMethod: form.get("contactMethod"), bestContactTime: form.get("bestContactTime"), desiredOutcome: form.get("desiredOutcome"), effectiveDate: form.get("effectiveDate"), amountInQuestion: form.get("amountInQuestion"), carrierContacted: form.get("carrierContacted"), documentsAvailable: form.get("documentsAvailable"), authorization: form.get("authorization") === "on" };
    await createServiceRequest({ requestType: String(form.get("requestType") || ""), details: String(form.get("details") || ""), requestData: requestData as Record<string, string | boolean | null> });
  };

  const navigate = (key: NavKey) => {
    setActive(key);
    setMobileOpen(false);
    setSearchOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const notify = (message: string) => {
    setToast(message);
    setModal(null);
    window.setTimeout(() => setToast(null), 3500);
  };

  const results = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return [];
    const navigation = navItems.filter((item) => item.label.toLowerCase().includes(term)).map((item) => ({ title: item.label, detail: "Open section", type: "nav" as const, value: item.label }));
    const policyMatches = allPolicies.filter((policy) => `${policy.type} ${policy.carrier} ${policy.id}`.toLowerCase().includes(term)).map((policy) => ({ title: policy.type, detail: `${policy.carrier} · Policy #${policy.id}`, type: "policy" as const, value: policy }));
    return [...navigation, ...policyMatches].slice(0, 6);
  }, [search, allPolicies]);

  if (portalMode === "loading") return <PortalLoading />;
  if (portalMode === "signed_out") return <SignInGate />;
  if (portalMode === "error") return <main className="portal-gate"><div className="gate-card"><span className="gate-icon error"><CircleHelp size={31} /></span><h1>We couldn’t open your portal</h1><p>{portalError}</p><button className="primary-button" onClick={() => window.location.reload()}>Try again</button></div></main>;
  if (portalMode === "create" && portalUser) return <AccountCreation user={portalUser} onCreated={(profile) => { setStoredProfile(profile); setPortalMode("onboarding"); }} onSkip={skipSetup} />;
  if (portalMode === "onboarding" && portalUser && storedProfile) return <OnboardingFlow user={portalUser} profile={storedProfile} onComplete={(profile) => { setStoredProfile(profile); setPortalMode("ready"); setModal("upload"); notify("Profile saved. Upload a policy now and Document Intelligence will organize it."); }} onSkip={skipSetup} />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand"><div className="brand-mark"><ShieldCheck size={25} /></div><div><strong>Insur<span>Suite</span></strong><small>Your Complete Insurance Command Center</small></div></div>
        <nav aria-label="Main navigation">
          {navItems.filter((item) => item.label !== "Agent Console" || agentAccess).map(({ label, icon: Icon, badge }) => <button key={label} className={active === label ? "active" : ""} onClick={() => navigate(label)}><Icon size={20} /><span>{label}</span>{badge && <b>{badge}</b>}</button>)}
        </nav>
        <div className="premium-card"><div><Gem size={20} /><strong>InsurSuite Premium</strong></div><p>Unlock advanced tools, unlimited AI conversations, and priority support.</p><button onClick={() => setModal("upgrade")}>Upgrade My Plan</button></div>
        <button className="account-card" onClick={() => navigate("Settings")}><span className="avatar">{(storedProfile?.fullName || "Account").split(/\s+/).map((part) => part[0]).join("").slice(0,2).toUpperCase()}</span><span><strong>{storedProfile?.fullName || portalUser?.displayName || "Account owner"}</strong><small>Account Owner</small></span><ChevronDown size={18} /></button>
      </aside>
      {mobileOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu /></button>
          <div className="welcome"><p className="mobile-brand">InsurSuite</p><h1>{active === "Dashboard" ? `Welcome back, ${String(storedProfile?.profile?.preferredName || storedProfile?.fullName || "there")}` : active}</h1><p>{active === "Dashboard" ? "Here’s what needs attention across your coverage file." : "Manage every detail of your coverage in one place."}</p></div>
          <div className="header-tools">
            <div className="global-search"><Search size={18} /><input value={search} onFocus={() => setSearchOpen(true)} onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }} placeholder="Search anything..." aria-label="Search InsurSuite" />{search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={15} /></button>}</div>
            <button className="icon-button notification-button" onClick={() => navigate("Notifications")} aria-label="Notifications"><Bell size={22} /><span>3</span></button>
            <button className="icon-button" onClick={() => navigate("Support Center")} aria-label="Help"><CircleHelp size={23} /></button>
          </div>
          {searchOpen && (search || results.length > 0) && <div className="search-results"><div className="search-label">Search results</div>{results.length ? results.map((result) => <button key={result.title + result.detail} onClick={() => { setSearchOpen(false); setSearch(""); if (result.type === "nav") navigate(result.value as NavKey); else setSelectedPolicy(result.value as Policy); }}><Search size={16} /><span><strong>{result.title}</strong><small>{result.detail}</small></span><ArrowRight size={15} /></button>) : <p>No matching policies or sections.</p>}</div>}
        </header>

        <SectionContent active={active} onNavigate={navigate} onPolicy={setSelectedPolicy} onOpen={openModal} notify={notify} policyData={allPolicies} uploadedDocuments={storedDocuments} profile={storedProfile} user={portalUser} isSample={isSampleMode} requests={storedRequests} onCreateRequest={createServiceRequest} onSaveProfile={saveProfilePatch} />
      </main>

      {selectedPolicy && <Modal title={selectedPolicy.type} onClose={() => setSelectedPolicy(null)}><div className="policy-detail-hero"><span className={`policy-icon ${selectedPolicy.color}`}><selectedPolicy.icon size={24} /></span><div><strong>{selectedPolicy.carrier}</strong><small>Policy #{selectedPolicy.id} · Active</small></div><span className="status active"><Check size={13} />Active</span></div><div className="detail-grid"><div><small>Death Benefit</small><strong>{selectedPolicy.benefit}</strong></div><div><small>Monthly Premium</small><strong>{selectedPolicy.premium}</strong></div><div><small>Beneficiaries</small><strong>{selectedPolicy.beneficiaries || "Not yet recorded"}</strong></div><div><small>Next Review</small><strong>{storedProfile?.profile?.reviewFrequency ? `Per your ${storedProfile.profile.reviewFrequency} preference` : "Not yet scheduled"}</strong></div></div><div className="modal-actions"><button className="secondary-button" onClick={() => { setSelectedPolicy(null); navigate("Document Vault"); }}><FileText size={17} />View Documents</button><button className="primary-button" onClick={() => { setSelectedPolicy(null); setModal("beneficiary"); }}><PenLine size={17} />Manage Policy</button></div></Modal>}

      {modal === "upload" && <Modal title={scanStage === "review" ? "Review scanned policy" : "Scan a policy document"} onClose={() => { setModal(null); resetScanner(); }}>
        {scanStage === "idle" && <><div className="scan-intro"><span><ScanLine size={20} /></span><div><strong>AI Document Intelligence</strong><p>InsurSuite reads the document, identifies key policy details, and lets you confirm everything before it is saved.</p></div></div><button className="upload-zone" onClick={() => fileRef.current?.click()}><span><Upload size={28} /></span><strong>Choose a policy document</strong><p>Text PDFs and clear JPG or PNG images · up to 20 MB</p><input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={(e) => e.target.files?.[0] && scanDocument(e.target.files[0])} /></button><div className="scan-fields-preview"><span>We’ll look for</span><div><b>Carrier</b><b>Policy number</b><b>Coverage amount</b><b>Premium</b><b>Insured</b><b>Beneficiaries</b></div></div><p className="safe-note"><FolderLock size={16} />Scanning runs securely. You confirm extracted information before saving.</p></>}
        {scanStage === "scanning" && <div className="scanning-state"><div className="scan-animation"><ScanLine size={38} /><i /></div><span className="ai-scan-pill"><Sparkles size={14} />AI scan in progress</span><h3>{scanStep}</h3><p>{scanFileName}</p><div className="scan-progress"><i style={{ width: `${scanProgress}%` }} /></div><strong>{scanProgress}%</strong><small>Large image files can take a minute while OCR reads the page.</small></div>}
        {scanStage === "error" && <div className="scan-error"><span><CircleHelp size={28} /></span><h3>We need a clearer document</h3><p>{scanError}</p><button className="primary-button" onClick={resetScanner}>Choose another file</button></div>}
        {scanStage === "review" && extractedPolicy && <div className="scan-review"><div className="scan-result-head"><span className="scan-success"><CheckCircle2 size={21} /></span><div><strong>{scanFileName}</strong><small>Document read successfully</small></div><span className="confidence">{extractedPolicy.confidence}% confidence</span></div>{extractedPolicy.confidence < 78 && <div className="review-warning"><CircleHelp size={16} />Some fields were unclear. Review highlighted blanks before saving.</div>}<form className="extracted-form" onSubmit={(e) => { e.preventDefault(); saveScannedPolicy(); }}><label>Insurance carrier<input className={!extractedPolicy.carrier ? "needs-review" : ""} value={extractedPolicy.carrier} onChange={(e) => updateExtracted("carrier", e.target.value)} placeholder="Review carrier" /></label><label>Policy type<input className={!extractedPolicy.policyType ? "needs-review" : ""} value={extractedPolicy.policyType} onChange={(e) => updateExtracted("policyType", e.target.value)} placeholder="e.g. Whole Life" /></label><label>Policy number<input className={!extractedPolicy.policyNumber ? "needs-review" : ""} value={extractedPolicy.policyNumber} onChange={(e) => updateExtracted("policyNumber", e.target.value)} placeholder="Review policy number" required /></label><label>Insured name<input className={!extractedPolicy.insuredName ? "needs-review" : ""} value={extractedPolicy.insuredName} onChange={(e) => updateExtracted("insuredName", e.target.value)} placeholder="Review insured name" /></label><label>Death benefit<input className={!extractedPolicy.deathBenefit ? "needs-review" : ""} value={extractedPolicy.deathBenefit} onChange={(e) => updateExtracted("deathBenefit", e.target.value)} placeholder="$0" /></label><label>Monthly premium<input className={!extractedPolicy.monthlyPremium ? "needs-review" : ""} value={extractedPolicy.monthlyPremium} onChange={(e) => updateExtracted("monthlyPremium", e.target.value)} placeholder="$0" /></label><label>Effective date<input value={extractedPolicy.effectiveDate} onChange={(e) => updateExtracted("effectiveDate", e.target.value)} placeholder="MM/DD/YYYY" /></label><label>Cash value<input value={extractedPolicy.cashValue} onChange={(e) => updateExtracted("cashValue", e.target.value)} placeholder="If applicable" /></label><label className="wide">Beneficiaries<input value={extractedPolicy.beneficiaries} onChange={(e) => updateExtracted("beneficiaries", e.target.value)} placeholder="Names and percentages, if found" /></label>{scanError && <p className="form-error wide">{scanError}</p>}<div className="scan-review-actions"><button type="button" className="secondary-button" onClick={resetScanner} disabled={scanSaving}>Scan another</button><button type="submit" className="primary-button" disabled={scanSaving}><CheckCircle2 size={17} />{scanSaving ? "Saving securely..." : "Confirm & add policy"}</button></div></form></div>}
      </Modal>}
      {modal === "ticket" && <Modal title="Create a service request" onClose={() => setModal(null)}><TicketRequestForm policies={allPolicies} onSubmit={submitServiceRequest} /></Modal>}
      {modal === "beneficiary" && <Modal title="Review beneficiaries" onClose={() => setModal(null)}><div className="beneficiary-list">{storedProfile?.profile?.primaryBeneficiary ? <div><span className="avatar soft">{String(storedProfile.profile.primaryBeneficiary).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{String(storedProfile.profile.primaryBeneficiary)}</strong><small>Primary beneficiary{storedProfile.profile.primaryRelationship ? ` · ${storedProfile.profile.primaryRelationship}` : ""}{storedProfile.profile.primaryPercentage ? ` · ${storedProfile.profile.primaryPercentage}` : ""}</small></span><button onClick={() => notify("Update your beneficiary in your protection profile.")}>Edit</button></div> : <div><span className="avatar soft"><UsersRound size={16} /></span><span><strong>No beneficiary on file</strong><small>Add one from your protection profile</small></span></div>}{storedProfile?.profile?.contingentBeneficiary && <div><span className="avatar soft">{String(storedProfile.profile.contingentBeneficiary).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span><strong>{String(storedProfile.profile.contingentBeneficiary)}</strong><small>Contingent beneficiary{storedProfile.profile.contingentRelationship ? ` · ${storedProfile.profile.contingentRelationship}` : ""}</small></span><button onClick={() => notify("Update your beneficiary in your protection profile.")}>Edit</button></div>}</div><button className="primary-button full" onClick={() => notify("Beneficiary review marked complete.")}><CheckCircle2 size={17} />Confirm Details Are Current</button></Modal>}
      {modal === "review" && <Modal title="Schedule your annual review" onClose={() => setModal(null)}><p className="modal-copy">Choose a 30-minute time with your dedicated coverage consultant.</p><div className="date-options">{["Tue, Jul 28 · 10:30 AM", "Wed, Jul 29 · 2:00 PM", "Fri, Jul 31 · 11:00 AM"].map((date) => <button key={date} onClick={() => notify(`Annual review scheduled for ${date}.`)}><CalendarDays size={18} /><span>{date}</span><ChevronRight size={17} /></button>)}</div></Modal>}
      {modal === "concierge" && <Modal title="Message your consultant" onClose={() => setModal(null)}><ConciergeChat onCreateRequest={createServiceRequest} /></Modal>}
      {modal === "upgrade" && <Modal title="Unlock InsurSuite Premium" onClose={() => setModal(null)}><div className="upgrade-box"><Gem size={34} /><h3>More guidance, whenever you need it</h3><ul><li><Check size={16} />Unlimited AI assistant conversations</li><li><Check size={16} />Priority concierge support</li><li><Check size={16} />Advanced policy comparisons</li></ul><button className="primary-button full" onClick={() => notify("You’ve joined the Premium waitlist.")}>Join the Premium Waitlist</button></div></Modal>}

      {toast && <div className="toast"><CheckCircle2 size={19} /><span>{toast}</span><button onClick={() => setToast(null)}><X size={15} /></button></div>}
      <button className="search-dismiss" aria-label="Close search results" onClick={() => setSearchOpen(false)} style={{ display: searchOpen ? "block" : "none" }} />
    </div>
  );
}
