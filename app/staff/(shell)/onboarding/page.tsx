"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, PanelHeader, ViewHeading } from "../../../components/shared";

type Draft = { id: string; firstName: string; lastName: string; email: string; updatedAt: string };

export default function OnboardingListPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => fetch("/api/agent/onboarding", { cache: "no-store" }).then((r) => r.json()).then((d) => setDrafts(d.drafts || []));
  useEffect(() => { load(); }, []);

  const startIntake = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch("/api/agent/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ firstName, lastName, email, phone }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error || "Could not start intake"); setSaving(false); return; }
    router.push(`/staff/onboarding/${result.id}`);
  };

  return <div className="section-view">
    <ViewHeading eyebrow="New client intake" title="Onboarding" description="Capture underwriting and policy details for a new prospect, then invite them to their account." action={<button className="primary-button" onClick={() => setShowNew((current) => !current)}>{showNew ? "Close" : "Start new intake"}</button>} />
    {showNew && <Panel><PanelHeader title="Start a new intake" /><form className="modal-form" onSubmit={startIntake}><label>First name<input value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></label><label>Last name<input value={lastName} onChange={(e) => setLastName(e.target.value)} required /></label><label>Email address<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /></label><label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(000) 000-0000" /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={saving}>{saving ? "Starting..." : "Start intake"}</button></form></Panel>}
    <Panel><PanelHeader title={`In-progress intakes (${drafts.length})`} /><div className="beneficiary-list">{drafts.map((draft) => <a key={draft.id} href={`/staff/onboarding/${draft.id}`} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10, padding: 11, border: "1px solid var(--line)", borderRadius: 9, textDecoration: "none", color: "inherit" }}><span><strong style={{ display: "block" }}>{draft.firstName} {draft.lastName}</strong><small style={{ display: "block", marginTop: 3, color: "var(--muted)" }}>{draft.email}</small></span><small>Updated {new Date(draft.updatedAt).toLocaleDateString()}</small></a>)}{!drafts.length && <p className="modal-copy">No intakes in progress.</p>}</div></Panel>
  </div>;
}
