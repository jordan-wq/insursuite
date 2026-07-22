import {
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="marketing-page login-page">
      <nav className="marketing-nav" aria-label="InsurSuite login navigation">
        <div className="gate-brand">
          <ShieldCheck size={27} />
          <strong>Insur<span>Suite</span></strong>
        </div>
        <div>
          <Link href="/landing">Website</Link>
          <a className="nav-cta" href="/signin-with-chatgpt?return_to=%2F">Sign in</a>
        </div>
      </nav>
      <section className="marketing-hero login-hero">
        <div className="hero-copy">
          <span className="market-kicker"><LockKeyhole size={15} />Secure portal access</span>
          <h1>Enter your InsurSuite coverage portal.</h1>
          <p>Sign in to organize policies, upload documents, review beneficiaries, ask for support, and keep your family coverage file ready.</p>
          <div className="hero-actions">
            <a className="primary-button" href="/signin-with-chatgpt?return_to=%2F">Continue to secure login<ArrowRight size={17} /></a>
            <Link className="secondary-button" href="/landing">Back to website</Link>
          </div>
          <div className="trust-strip">
            <span><CheckCircle2 size={16} />Secure identity step</span>
            <span><CheckCircle2 size={16} />Protected coverage file</span>
            <span><CheckCircle2 size={16} />Guided support</span>
          </div>
        </div>
        <div className="hero-product" aria-label="InsurSuite login preview">
          <div className="product-window">
            <div className="window-top"><span /><span /><span /><strong>Secure portal</strong></div>
            <div className="product-grid">
              <section>
                <small>Step one</small>
                <strong>Confirm your identity</strong>
                <p>Use the secure login flow before accessing coverage records.</p>
              </section>
              <section>
                <small>Step two</small>
                <strong>Open your file</strong>
                <p>Return to policies, documents, beneficiaries, and requests.</p>
              </section>
              <section className="wide">
                <small>New client?</small>
                <strong>Create your portal from the same secure flow.</strong>
                <p>Start with your profile, then add the policies and documents you already have.</p>
              </section>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
