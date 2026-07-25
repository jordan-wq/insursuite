import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export const metadata = { title: "Terms of Service | InsurSuite" };

export default function TermsPage() {
  return (
    <main className="marketing-page legal-page">
      <nav className="marketing-nav" aria-label="InsurSuite legal navigation">
        <div className="gate-brand"><ShieldCheck size={27} /><strong>Insur<span>Suite</span></strong></div>
        <div><Link href="/">Portal</Link></div>
      </nav>
      <section className="legal-content">
        <h1>Terms of Service</h1>
        <p className="legal-updated">Last updated July 24, 2026</p>
        <p>InsurSuite is a client portal that helps you and your insurance agent organize policy information, documents, and communication in one place. It is not an insurance carrier, and using it does not itself create, change, or cancel any insurance policy — those actions still happen through your carrier and your agent.</p>
        <h2>Your account</h2>
        <p>You are responsible for keeping your login credentials confidential and for the accuracy of the information you provide. Contact your agent if you believe your account has been accessed without your permission.</p>
        <h2>Acceptable use</h2>
        <p>Use InsurSuite only to manage your own insurance information, or, if you are an agent, the information of clients you are authorized to serve. Do not attempt to access another person&apos;s account or data.</p>
        <h2>What InsurSuite provides</h2>
        <p>InsurSuite is provided during an early access period for a small group of clients. Features may change as the product develops. We will do our best to keep your information accurate and available, but InsurSuite is not a substitute for your official policy documents, which remain the authoritative record with your carrier.</p>
        <h2>Questions</h2>
        <p>If you have questions about these terms, contact your agent directly.</p>
        <p className="legal-note">This is a plain-language summary appropriate for early access. It is not a substitute for a formal legal review.</p>
      </section>
    </main>
  );
}
