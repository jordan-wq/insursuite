import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export const metadata = { title: "Privacy Policy | InsurSuite" };

export default function PrivacyPage() {
  return (
    <main className="marketing-page legal-page">
      <nav className="marketing-nav" aria-label="InsurSuite legal navigation">
        <div className="gate-brand"><ShieldCheck size={27} /><strong>Insur<span>Suite</span></strong></div>
        <div><Link href="/">Portal</Link></div>
      </nav>
      <section className="legal-content">
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated July 24, 2026</p>
        <h2>What we collect</h2>
        <p>To help your agent service your policies, InsurSuite stores information you provide, including your name, contact information, date of birth, household and beneficiary details, income range, coverage goals, and any policy documents you upload.</p>
        <h2>How it&apos;s used</h2>
        <p>Your information is used only to help your agent understand and service your insurance coverage — for example, tracking beneficiaries, reminding you of premium due dates, and organizing your policy documents. We do not sell your information to third parties.</p>
        <h2>Where it&apos;s stored</h2>
        <p>Your data is stored with Supabase, a hosted database and file storage provider, using access controls that limit visibility to your own account and the agents assigned to work with you.</p>
        <h2>Your choices</h2>
        <p>You can review and update most of your information from the Settings page inside the portal. To request a copy of your data or ask that it be deleted, contact your agent.</p>
        <p className="legal-note">This is a plain-language summary appropriate for early access. It is not a substitute for a formal legal review.</p>
      </section>
    </main>
  );
}
