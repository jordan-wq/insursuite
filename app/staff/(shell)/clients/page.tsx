"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Panel, PanelHeader, ViewHeading } from "../../../components/shared";

type ClientRow = { userId: string; fullName: string; email: string; onboardingStatus: string; createdAt: string };

export default function ClientsDirectoryPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    fetch(`/api/agent/clients?page=${page}&pageSize=${pageSize}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setClients(d.clients || []); setTotal(d.total || 0); });
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return <div className="section-view"><ViewHeading eyebrow="Client directory" title="Clients" description={`${total} client${total === 1 ? "" : "s"}.`} /><Panel><PanelHeader title="All clients" /><div className="beneficiary-list">{clients.map((client) => <Link key={client.userId} href={`/staff/clients/${client.userId}`} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 10, padding: 11, border: "1px solid var(--line)", borderRadius: 9, textDecoration: "none", color: "inherit" }}><span><strong style={{ display: "block" }}>{client.fullName || "(no name on file)"}</strong><small style={{ display: "block", marginTop: 3, color: "var(--muted)" }}>{client.email}</small></span><small style={{ textTransform: "capitalize" }}>{client.onboardingStatus.replace("_", " ")}</small><small>Joined {new Date(client.createdAt).toLocaleDateString()}</small></Link>)}{!clients.length && <p className="modal-copy">No clients yet.</p>}</div>{totalPages > 1 && <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}><button className="secondary-button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span style={{ alignSelf: "center", fontSize: 12, color: "var(--muted)" }}>Page {page} of {totalPages}</span><button className="secondary-button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button></div>}</Panel></div>;
}
