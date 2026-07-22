import {
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  const manifesto = [
    "Insurance should be legible before it is urgent.",
    "Every household deserves one trusted place for policies, people, documents, and next steps.",
    "You should never have to search through emails, drawers, and carrier portals to understand what protects your family.",
  ];

  return (
    <main className="marketing-page">
      <nav className="marketing-nav" aria-label="InsurSuite marketing navigation">
        <div className="gate-brand">
          <ShieldCheck size={27} />
          <strong>Insur<span>Suite</span></strong>
        </div>
        <div>
          <a href="#mission">Mission</a>
          <a href="#manifesto">Manifesto</a>
          <a href="#platform">Platform</a>
          <Link className="nav-cta" href="/login">Enter site</Link>
        </div>
      </nav>

      <section className="marketing-hero">
        <div className="hero-copy">
          <span className="market-kicker"><LockKeyhole size={15} />Secure insurance command center</span>
          <h1>Keep your family’s insurance organized before anyone needs it.</h1>
          <p>InsurSuite gives you one secure place for policies, documents, beneficiaries, support requests, and annual coverage checkups.</p>
          <div className="hero-actions">
            <Link className="primary-button" href="/login">Enter site<ArrowRight size={17} /></Link>
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
          {manifesto.map((line, index) => (
            <article key={line}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{line}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="platform-section" id="platform">
        <div className="platform-heading">
          <span>What InsurSuite brings together</span>
          <h2>One workspace for the work that usually gets scattered.</h2>
        </div>
        <div className="platform-grid">
          {[
            ["Document vault", "Store policy files, statements, illustrations, and forms with the right household and policy context."],
            ["Coverage review", "Turn saved information into readiness scores, missing-detail prompts, and practical next steps."],
            ["Support center", "Ask questions, create requests, and keep every update connected to the same conversation."],
            ["Protection profile", "Keep household facts, beneficiaries, goals, and upcoming life changes ready for your next review."],
          ].map(([title, detail]) => (
            <article key={title}>
              <strong>{title}</strong>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="closing-cta">
        <h2>Build a coverage file your future self can actually use.</h2>
        <p>Start with your account, add the policies you already own, and let InsurSuite turn the paper trail into a working system.</p>
        <Link className="primary-button" href="/login">Enter site<ArrowRight size={17} /></Link>
      </section>
    </main>
  );
}
