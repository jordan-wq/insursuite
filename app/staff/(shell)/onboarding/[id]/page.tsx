"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check } from "lucide-react";

type FieldType = "text" | "date" | "number" | "select" | "textarea";
type Field = { key: string; label: string; type?: FieldType; options?: string[]; placeholder?: string };
type Section = { title: string; short: string; description: string; fields: Field[] };

const IDENTITY_SECTION: Section = {
  title: "Identity & contact", short: "Who they are", description: "Basic identity and contact details for the new account.",
  fields: [
    { key: "firstName", label: "First name" }, { key: "lastName", label: "Last name" },
    { key: "dateOfBirth", label: "Date of birth", type: "date" }, { key: "email", label: "Email address" }, { key: "phone", label: "Phone" },
    { key: "address", label: "Street address" }, { key: "city", label: "City" }, { key: "state", label: "State" }, { key: "postalCode", label: "ZIP code" },
  ],
};

const UNDERWRITING_SECTIONS: Section[] = [
  { title: "Health history", short: "Medical background", description: "Health facts relevant to underwriting. Staff-only — never shown to the client.", fields: [
    { key: "heightWeight", label: "Height / weight" },
    { key: "tobaccoUse", label: "Tobacco / nicotine use", type: "select", options: ["Never", "Former", "Current"] },
    { key: "majorConditions", label: "Major medical conditions", type: "textarea" },
    { key: "currentMedications", label: "Current medications", type: "textarea" },
    { key: "familyHealthHistory", label: "Family health history", type: "textarea" },
    { key: "recentHospitalizations", label: "Recent hospitalizations or surgeries", type: "textarea" },
  ]},
  { title: "Lifestyle & risk", short: "Risk factors", description: "Occupation and lifestyle risk factors.", fields: [
    { key: "occupation", label: "Occupation" },
    { key: "hazardousHobbies", label: "Hazardous hobbies", type: "textarea" },
    { key: "drivingRecord", label: "Driving record", type: "textarea" },
    { key: "foreignTravel", label: "Foreign travel / residency", type: "textarea" },
    { key: "alcoholSubstanceUse", label: "Alcohol / substance use", type: "textarea" },
  ]},
  { title: "Financial", short: "Income & purpose", description: "Financial context for the coverage being set up.", fields: [
    { key: "annualIncome", label: "Annual income", type: "select", options: ["Under $25,000", "$25,000–$49,999", "$50,000–$74,999", "$75,000–$99,999", "$100,000–$149,999", "$150,000+"] },
    { key: "netWorth", label: "Approximate net worth" },
    { key: "existingCoverage", label: "Existing coverage elsewhere", type: "textarea" },
    { key: "coveragePurpose", label: "Purpose of coverage", type: "select", options: ["Protect family income", "Pay off a mortgage", "Final expenses", "Build cash value", "Estate or legacy planning", "Business protection", "Review existing coverage"] },
  ]},
  { title: "Beneficiaries", short: "Who's protected", description: "Primary and contingent beneficiaries.", fields: [
    { key: "primaryBeneficiaryName", label: "Primary beneficiary name" }, { key: "primaryBeneficiaryRelationship", label: "Primary relationship" }, { key: "primaryBeneficiaryPercentage", label: "Primary percentage", type: "number" },
    { key: "contingentBeneficiaryName", label: "Contingent beneficiary name" }, { key: "contingentBeneficiaryRelationship", label: "Contingent relationship" }, { key: "contingentBeneficiaryPercentage", label: "Contingent percentage", type: "number" },
  ]},
  { title: "Wrap-up", short: "Notes & next step", description: "Anything the advisor needs to know before this goes further.", fields: [
    { key: "missingDocuments", label: "Missing documents", type: "textarea" },
    { key: "underwritingNotes", label: "Underwriting notes", type: "textarea" },
    { key: "recommendedNextStep", label: "Recommended next step", type: "textarea" },
  ]},
];

const POLICY_SECTION: Section = {
  title: "Policy details", short: "The new policy", description: "The policy being set up for this client — this becomes their real policy record once invited.",
  fields: [
    { key: "policyNumber", label: "Policy number" }, { key: "policyType", label: "Policy type" }, { key: "carrier", label: "Carrier" },
    { key: "insuredName", label: "Insured name" }, { key: "ownerName", label: "Owner name" },
    { key: "deathBenefit", label: "Death benefit", type: "number" }, { key: "monthlyPremium", label: "Monthly premium", type: "number" },
    { key: "effectiveDate", label: "Effective date", type: "date" }, { key: "beneficiaries", label: "Beneficiaries summary" }, { key: "cashValue", label: "Cash value", type: "number" },
  ],
};

type Draft = {
  id: string; status: string; firstName: string; lastName: string; email: string; phone: string; dateOfBirth: string | null;
  address: string; city: string; state: string; postalCode: string;
  underwriting: Record<string, string>; policyDraft: Record<string, string>;
};

export default function OnboardingSheetPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(0);
  const [identity, setIdentity] = useState<Record<string, string>>({});
  const [underwriting, setUnderwriting] = useState<Record<string, string>>({});
  const [policy, setPolicy] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetch(`/api/agent/onboarding/${params.id}`, { cache: "no-store" }).then(async (r) => {
      const d = await r.json();
      if (!r.ok || !d.record) throw new Error(d.error || "Could not load this intake");
      const record: Draft = d.record;
      setDraft(record);
      setIdentity({ firstName: record.firstName, lastName: record.lastName, email: record.email, phone: record.phone, dateOfBirth: record.dateOfBirth || "", address: record.address, city: record.city, state: record.state, postalCode: record.postalCode });
      setUnderwriting(record.underwriting || {});
      setPolicy(record.policyDraft || {});
    }).catch(() => {
      setLoadError("Could not load this intake — please try again.");
    });
  }, [params.id]);

  const formSections = [IDENTITY_SECTION, ...UNDERWRITING_SECTIONS, POLICY_SECTION];
  const allSections = [...formSections, { title: "Review & complete", short: "Confirm & send", description: "Everything below is sent as-is. Complete & invite emails the client to set a password and sign in.", fields: [] }];
  const isReview = step === formSections.length;
  const section = allSections[step];
  const isIdentity = step === 0;
  const isPolicy = step === formSections.length - 1;
  const fieldValue = (key: string) => isIdentity ? (identity[key] || "") : isPolicy ? (policy[key] || "") : (underwriting[key] || "");
  const updateField = (key: string, value: string) => {
    if (isIdentity) setIdentity((current) => ({ ...current, [key]: value }));
    else if (isPolicy) setPolicy((current) => ({ ...current, [key]: value }));
    else setUnderwriting((current) => ({ ...current, [key]: value }));
  };

  const persist = async () => {
    try {
      const response = await fetch(`/api/agent/onboarding/${params.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...identity, underwriting, policyDraft: policy }),
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const save = async (next: number | null) => {
    setSaving(true);
    setNotice("");
    const ok = await persist();
    if (ok) {
      if (next !== null) { setStep(next); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else setNotice("Saved.");
    } else {
      setNotice("Could not save — please try again.");
    }
    setSaving(false);
  };

  const canComplete = Boolean(identity.firstName && identity.lastName && identity.email && policy.policyType && policy.carrier);

  const complete = async () => {
    if (!canComplete) return;
    setSaving(true);
    setNotice("");
    const saved = await persist();
    if (!saved) { setNotice("Could not save — please try again."); setSaving(false); return; }
    try {
      const response = await fetch(`/api/agent/onboarding/${params.id}/complete`, { method: "POST" });
      const result = await response.json();
      if (response.ok) router.push(`/staff/clients/${result.record.userId}`);
      else { setNotice(result.error || "Could not complete intake"); setSaving(false); }
    } catch {
      setNotice("Could not complete intake — please try again.");
      setSaving(false);
    }
  };

  if (!draft) return <div className="section-view"><p className="modal-copy">{loadError || "Loading..."}</p></div>;
  if (draft.status === "completed") return <div className="section-view"><div className="empty-state"><strong>Already completed</strong><p>This intake was already completed and can't be edited.</p></div></div>;

  const progress = Math.round(((step + 1) / allSections.length) * 100);
  const reviewGroups: { label: string; values: Record<string, string> }[] = [
    { label: "Identity & contact", values: identity },
    { label: "Underwriting", values: underwriting },
    { label: "Policy details", values: policy },
  ];

  return <div className="onboarding-layout">
    <aside className="onboarding-checklist">
      <span className="step-label">Step {step + 1} of {allSections.length}</span>
      <h2>{draft.firstName} {draft.lastName}</h2>
      <p>{draft.email}</p>
      <div className="overall-progress"><i style={{ width: `${progress}%` }} /></div>
      <small>{progress}% complete</small>
      <nav>{allSections.map((s, index) => <button key={s.title} className={index === step ? "active" : index < step ? "complete" : ""} onClick={() => setStep(index)}><span>{index < step ? <Check size={14} /> : index + 1}</span><div><strong>{s.short}</strong></div></button>)}</nav>
    </aside>
    <section className="onboarding-form-card">
      <div className="onboarding-form-head"><span>Section {step + 1} of {allSections.length}</span><h1>{section.title}</h1><p>{section.description}</p></div>
      {isReview ? <>
        {reviewGroups.map((group) => <div key={group.label} className="detail-grid" style={{ marginBottom: 16 }}>{Object.entries(group.values).filter(([, value]) => value).map(([key, value]) => <div key={key}><small>{key.replace(/([A-Z])/g, " $1")}</small><strong>{String(value)}</strong></div>)}{!Object.values(group.values).some(Boolean) && <div><small>{group.label}</small><strong>Nothing entered</strong></div>}</div>)}
        {notice && <p className="form-error">{notice}</p>}
        <div className="onboarding-actions">
          <button type="button" className="secondary-button" disabled={saving} onClick={() => setStep(step - 1)}>Back</button>
          {!canComplete && <p className="form-error" style={{ margin: 0 }}>First name, last name, email, policy type, and carrier are required to complete.</p>}
          <button type="button" className="primary-button" disabled={saving || !canComplete} onClick={complete}><Check size={16} />{saving ? "Completing..." : "Complete & invite"}</button>
        </div>
      </> : <form onSubmit={(event) => { event.preventDefault(); save(step + 1); }}>
        <div className="intake-fields">{section.fields.map((field) => <label key={field.key} className={field.type === "textarea" ? "wide" : ""}>{field.label}{field.type === "select" ? <select value={fieldValue(field.key)} onChange={(e) => updateField(field.key, e.target.value)}><option value="">Select one</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : field.type === "textarea" ? <textarea value={fieldValue(field.key)} onChange={(e) => updateField(field.key, e.target.value)} /> : <input type={field.type || "text"} value={fieldValue(field.key)} onChange={(e) => updateField(field.key, e.target.value)} placeholder={field.placeholder} />}</label>)}</div>
        {notice && <p className="form-error">{notice}</p>}
        <div className="onboarding-actions">
          <button type="button" className="secondary-button" disabled={step === 0 || saving} onClick={() => setStep(step - 1)}>Back</button>
          <button type="button" className="text-button save-exit" disabled={saving} onClick={() => save(null)}>Save</button>
          <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving..." : "Save & continue"}</button>
        </div>
      </form>}
    </section>
  </div>;
}
