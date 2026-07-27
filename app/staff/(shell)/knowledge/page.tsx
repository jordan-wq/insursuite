"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Panel, PanelHeader, ViewHeading } from "../../../components/shared";

type KnowledgeItem = { id: string; question: string };

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeItem[]>([]);
  const [notice, setNotice] = useState("");

  const load = () => fetch("/api/knowledge", { cache: "no-store" }).then((r) => r.json()).then((d) => setEntries(d.entries || []));
  useEffect(() => { load(); }, []);

  const addKnowledge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/knowledge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: form.get("question"), keywords: form.get("keywords"), answer: form.get("answer") }) });
    setNotice(response.ok ? "Training answer published." : "Could not publish answer.");
    if (response.ok) { event.currentTarget.reset(); load(); }
  };

  return <div className="section-view"><ViewHeading eyebrow="Chatbot training" title="Knowledge" description="Answers the client-facing chatbot is allowed to use." /><Panel><PanelHeader title="Train the chatbot" /><form className="knowledge-form" onSubmit={addKnowledge}><label>Customer question<input name="question" required placeholder="How do I change a beneficiary?" /></label><label>Keywords<input name="keywords" placeholder="beneficiary, change, update" /></label><label>Approved answer<textarea name="answer" required placeholder="Write the exact safe answer the bot should use..." /></label><button className="primary-button">Publish answer</button>{notice && <small>{notice}</small>}</form><div className="knowledge-list"><strong>{entries.length} approved answers</strong>{entries.map((entry) => <p key={entry.id}>{entry.question}</p>)}</div></Panel></div>;
}
