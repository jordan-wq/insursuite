"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Panel, PanelHeader, ViewHeading } from "../../../../components/shared";

type ClientDetail = {
  profile: { fullName: string; email: string; phone: string; onboardingStatus: string; profile: Record<string, unknown> } | null;
  policies: { id: string; policyNumber: string; carrier: string; packetStatus: string }[];
  requests: { id: string; requestType: string; details: string; status: string; createdAt: string }[];
  documents: { id: string; fileName: string; contentType: string; fileSize: number; createdAt: string }[];
  underwriting: { underwriting: Record<string, string>; createdAt: string } | null;
};

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<ClientDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/agent/clients/${params.id}`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError(true));
  }, [params.id]);

  if (error) return <div className="section-view"><div className="empty-state"><strong>Client not found</strong></div></div>;
  if (!data || !data.profile) return <div className="section-view"><p className="modal-copy">Loading...</p></div>;

  const { profile, policies, requests, documents, underwriting } = data;

  return <div className="section-view">
    <ViewHeading eyebrow="Client record" title={profile.fullName || "(no name on file)"} description={profile.email} />
    <div className="agent-console-grid">
      <Panel><PanelHeader title="Profile" /><div className="detail-grid"><div><small>Phone</small><strong>{profile.phone || "Not provided"}</strong></div><div><small>Onboarding</small><strong style={{ textTransform: "capitalize" }}>{profile.onboardingStatus.replace("_", " ")}</strong></div></div></Panel>
      <Panel><PanelHeader title={`Policies (${policies.length})`} /><div className="beneficiary-list">{policies.map((policy) => <div key={policy.id}><span><strong>{policy.carrier || "Carrier needs review"}</strong><small>#{policy.policyNumber}</small></span><small style={{ textTransform: "capitalize" }}>{policy.packetStatus.replace("_", " ")}</small></div>)}{!policies.length && <p className="modal-copy">No policies on file.</p>}</div></Panel>
      <Panel><PanelHeader title={`Conversation history (${requests.length})`} /><div className="beneficiary-list">{requests.map((r) => <div key={r.id}><span><strong>{r.requestType}</strong><small>{r.details}</small></span><small style={{ textTransform: "capitalize" }}>{r.status.replace("_", " ")}</small></div>)}{!requests.length && <p className="modal-copy">No conversations yet.</p>}</div></Panel>
      <Panel><PanelHeader title={`Documents (${documents.length})`} /><div className="beneficiary-list">{documents.map((doc) => <div key={doc.id}><span><strong>{doc.fileName}</strong><small>{Math.round(doc.fileSize / 1024)} KB</small></span><a className="text-button" href={`/api/documents/${doc.id}?download=1`}>Download</a></div>)}{!documents.length && <p className="modal-copy">No documents uploaded.</p>}</div></Panel>
      {underwriting && (() => {
        const underwritingEntries = Object.entries(underwriting.underwriting).filter(([, value]) => value);
        return <Panel><PanelHeader title="Underwriting" /><div className="detail-grid">{underwritingEntries.map(([key, value]) => <div key={key}><small>{key.replace(/([A-Z])/g, " $1")}</small><strong>{String(value)}</strong></div>)}</div>{!underwritingEntries.length && <p className="modal-copy">No underwriting details recorded.</p>}</Panel>;
      })()}
    </div>
  </div>;
}
