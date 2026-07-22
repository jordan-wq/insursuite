import { mkdir, rm, writeFile } from "node:fs/promises";

const outDir = new URL("../vercel-dist/", import.meta.url);
const portalUrl = process.env.INSURSUITE_APP_URL || "/signin-with-chatgpt/?return_to=%2F";

const nav = `
  <nav class="site-nav" aria-label="InsurSuite portal navigation">
    <a class="brand" href="/"><span>IS</span><strong>InsurSuite</strong></a>
    <div><a class="nav-cta" href="${portalUrl}">Secure login</a></div>
  </nav>
`;

const styles = `
  :root{--ink:#102039;--muted:#5c6b7f;--line:#dbe5ef;--blue:#255f9c;--deep:#102a4c;--green:#1d9b5a;--paper:#f6fafc;--cream:#fffdf8}
  *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:var(--paper);font-family:Georgia,"Times New Roman",serif}a{color:inherit}
  .site-shell{min-height:100vh;background:linear-gradient(135deg,#f9fcfd,#edf4f7)}
  .site-nav{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:78px;padding:18px clamp(20px,5vw,72px);border-bottom:1px solid rgba(205,218,230,.82);background:rgba(247,251,253,.88);backdrop-filter:blur(14px)}
  .brand{display:flex;align-items:center;gap:10px;text-decoration:none}.brand span{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;color:#fff;background:var(--deep);font:800 13px ui-sans-serif,system-ui}.brand strong{font:800 24px ui-sans-serif,system-ui;letter-spacing:-.4px}
  .site-nav div{display:flex;align-items:center;gap:8px}.site-nav div a{min-height:40px;display:flex;align-items:center;padding:0 12px;border-radius:999px;text-decoration:none;color:#41536b;font:750 13px ui-sans-serif,system-ui}.site-nav div a:hover{background:#eaf3ff;color:#174f8c}.site-nav .nav-cta{color:#fff;background:var(--deep)}
  .hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(380px,.78fr);gap:clamp(30px,5vw,76px);align-items:center;padding:clamp(46px,7vw,96px) clamp(20px,5vw,72px)}
  .kicker{width:max-content;display:flex;align-items:center;gap:8px;min-height:38px;padding:0 13px;border:1px solid #cfe0f1;border-radius:999px;color:#255f9c;background:#fff;font:800 12px ui-sans-serif,system-ui}
  h1{max-width:870px;margin:22px 0 20px;color:#081831;font-size:clamp(46px,7vw,86px);line-height:.95;letter-spacing:-1.8px}h2{margin:0;color:#102039;font-size:clamp(34px,4.8vw,62px);line-height:1.02;letter-spacing:-1px}p{color:var(--muted);font-size:18px;line-height:1.72}.hero p{max-width:660px}
  .actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}.button{min-height:48px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 18px;border-radius:14px;text-decoration:none;font:800 14px ui-sans-serif,system-ui}.primary{color:#fff;background:linear-gradient(135deg,#3478e5,#1f5f97);box-shadow:0 16px 32px rgba(40,104,216,.2)}.secondary{border:1px solid #d2dde8;background:#fff;color:#223854}
  .photo-card{position:relative;min-height:560px;border-radius:34px;overflow:hidden;background:#dce7ef;box-shadow:0 34px 90px rgba(25,54,88,.18)}.photo-card img{width:100%;height:100%;min-height:560px;object-fit:cover;display:block}.photo-card:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(7,22,42,.72))}
  .photo-caption{position:absolute;left:24px;right:24px;bottom:24px;z-index:1;padding:18px;border-radius:20px;color:#fff;background:rgba(10,29,54,.72);backdrop-filter:blur(12px)}.photo-caption strong{display:block;font:850 16px ui-sans-serif,system-ui}.photo-caption small{display:block;margin-top:6px;color:#d9e9f7;font:650 12px ui-sans-serif,system-ui;line-height:1.55}
  .promise-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:0 clamp(20px,5vw,72px) 28px}.promise-strip span{min-height:82px;display:flex;align-items:center;padding:18px;border:1px solid var(--line);border-radius:20px;background:#fff;color:#233b59;font:800 15px ui-sans-serif,system-ui}
  .band{margin:0 clamp(20px,5vw,72px);padding:clamp(40px,6vw,76px);border-radius:32px;color:#fff;background:linear-gradient(135deg,#102a4c,#286293);box-shadow:0 24px 70px rgba(22,55,90,.18)}.band h2{color:#fff}.band p{max-width:900px;color:#d9e9f7}
  .split{display:grid;grid-template-columns:.82fr 1fr;gap:clamp(28px,5vw,70px);padding:clamp(56px,8vw,108px) clamp(20px,5vw,72px)}.split > p{margin-top:0}.list{display:grid;gap:14px}.list article{padding:22px;border:1px solid var(--line);border-radius:22px;background:#fff;box-shadow:0 16px 40px rgba(29,57,91,.06)}.list strong{display:block;font:850 18px ui-sans-serif,system-ui}.list p{margin:10px 0 0;font-size:15px}
  .manifesto article{display:grid;grid-template-columns:60px 1fr;gap:18px;padding:26px 0;border-bottom:1px solid #d4e0eb}.manifesto article:first-child{border-top:1px solid #d4e0eb}.manifesto span{color:#2868d8;font:900 13px ui-sans-serif,system-ui}.manifesto p{margin:0;color:#233b59;font-size:26px;line-height:1.35}
  .footer-cta{margin:0 clamp(20px,5vw,72px) clamp(32px,6vw,82px);padding:clamp(38px,6vw,76px);border:1px solid var(--line);border-radius:32px;background:#fff;text-align:center;box-shadow:0 22px 58px rgba(29,57,91,.08)}.footer-cta p{max-width:720px;margin:16px auto 26px}.footer-cta .button{margin:0 auto}
  .page-hero{padding:clamp(48px,7vw,100px) clamp(20px,5vw,72px) clamp(32px,5vw,60px)}.page-hero p{max-width:820px}
  @media(max-width:900px){.hero,.split{grid-template-columns:1fr}.photo-card,.photo-card img{min-height:430px}.promise-strip{grid-template-columns:1fr}.site-nav{align-items:flex-start;flex-direction:column}.site-nav div{width:100%;overflow-x:auto;padding-bottom:2px}}
  @media(max-width:620px){h1{font-size:42px;letter-spacing:-.8px}h2{font-size:34px}.actions .button{width:100%}.manifesto article{grid-template-columns:1fr}.manifesto p{font-size:21px}.band,.footer-cta{border-radius:24px}}
`;

const pages = {
  "index.html": login(),
  "login/index.html": login(),
  "signin-with-chatgpt/index.html": signIn(),
};

await rm(outDir, { recursive: true, force: true });
for (const [path, html] of Object.entries(pages)) {
  const fileUrl = new URL(path, outDir);
  await mkdir(new URL("./", fileUrl), { recursive: true });
  await writeFile(fileUrl, html);
}

function layout(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="InsurSuite is a secure client-facing insurance concierge website for organizing policies, documents, beneficiaries, service requests, and annual coverage checkups."><style>${styles}</style></head><body><div class="site-shell">${nav}${body}</div></body></html>`;
}

function home() {
  return layout("InsurSuite | Insurance Organized Before It Is Urgent", `
    <section class="hero">
      <div>
        <span class="kicker">Secure insurance concierge</span>
        <h1>Keep your family's insurance organized before anyone needs it.</h1>
        <p>InsurSuite gives you one calm place for policies, documents, beneficiaries, support requests, and annual coverage checkups.</p>
        <div class="actions"><a class="button primary" href="/mission/">Explore the mission</a><a class="button secondary" href="/story/">Why we built it</a></div>
      </div>
      <figure class="photo-card">
        <img src="https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=82" alt="People having a calm planning conversation at a table">
        <figcaption class="photo-caption"><strong>Insurance should feel guided, not scattered.</strong><small>For policy questions, document storage, beneficiary updates, and claim support.</small></figcaption>
      </figure>
    </section>
    <section class="promise-strip"><span>Know what coverage you have.</span><span>Keep important documents together.</span><span>Get help when life changes.</span></section>
    <section class="band"><h2>A secure home base for the insurance life you already have.</h2><p>Policies are bought at one moment in time, but families keep changing. InsurSuite is built to keep your coverage file understandable, current, and ready when you need help.</p></section>
    <section class="split"><div><span class="kicker">What it helps with</span><h2>One website for the work that usually gets scattered.</h2></div><div class="list"><article><strong>Document vault</strong><p>Keep policies, statements, illustrations, and forms attached to the right coverage context.</p></article><article><strong>Coverage checkups</strong><p>See what details are missing, what may be stale, and what deserves a review.</p></article><article><strong>Support requests</strong><p>Ask for help with claims, policy changes, beneficiary questions, billing, documents, and next steps.</p></article><article><strong>Personal coverage profile</strong><p>Keep household details, goals, beneficiaries, and life changes ready for your next conversation.</p></article></div></section>
    ${footer()}
  `);
}

function story() {
  return layout("Our Story | InsurSuite", `
    <section class="page-hero"><span class="kicker">Our story</span><h1>We built this after seeing how hard insurance becomes without a guide.</h1><p>As insurance agents and brokers, we have sat with families who owned coverage but could not find the policy, remember the beneficiary, understand the change form, or know where to start after a death claim.</p></section>
    <section class="split"><figure class="photo-card"><img src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=82" alt="A professional and client reviewing paperwork together"><figcaption class="photo-caption"><strong>Real guidance starts before the emergency.</strong><small>InsurSuite turns scattered insurance details into a living coverage file.</small></figcaption></figure><div class="list"><article><strong>The problem is not just paperwork.</strong><p>It is the feeling of not knowing what matters, who to call, or whether the details are still right.</p></article><article><strong>Most people are under-supported after the sale.</strong><p>A policy can sit untouched for years while households, jobs, debts, beneficiaries, and needs change.</p></article><article><strong>InsurSuite is the front desk we wished every client had.</strong><p>A place to organize, ask, update, review, and get help without starting over every time.</p></article></div></section>${footer()}`);
}

function mission() {
  return layout("Mission | InsurSuite", `
    <section class="page-hero"><span class="kicker">Mission</span><h1>Make insurance accessible, organized, and understandable for every household.</h1><p>Our mission is to help people keep track of what protects them, understand what needs attention, and get guided support through the moments that usually feel confusing.</p></section>
    <section class="band"><h2>We want insurance to be easier to live with.</h2><p>That means clearer records, better review habits, easier support conversations, and a less stressful path through claims, policy changes, document requests, and coverage questions.</p></section>
    <section class="split"><div><span class="kicker">What we strive for</span><h2>Clarity, continuity, and care.</h2></div><div class="list"><article><strong>Clarity</strong><p>Plain-language organization for policies, beneficiaries, documents, and next steps.</p></article><article><strong>Continuity</strong><p>A coverage file that keeps up as life changes instead of going stale in a drawer.</p></article><article><strong>Care</strong><p>Support that feels like a concierge, not a call center maze.</p></article></div></section>${footer()}`);
}

function manifesto() {
  const lines = [
    "Insurance should not become understandable only after tragedy.",
    "A policy is not just a document. It is a promise someone may depend on.",
    "Families deserve to know what they have, where it is, and who it protects.",
    "Beneficiaries should not be a mystery.",
    "Claims should begin with guidance, not panic and paperwork.",
    "Good insurance service should feel human, organized, and accountable.",
  ];
  return layout("Manifesto | InsurSuite", `
    <section class="page-hero"><span class="kicker">Manifesto</span><h1>Coverage is a promise. The system around it should act like one.</h1></section>
    <section class="split"><div><h2>What we believe.</h2><p>InsurSuite is built around a simple idea: people deserve a calmer way to manage the policies that protect their lives.</p></div><div class="manifesto">${lines.map((line, index) => `<article><span>${String(index + 1).padStart(2, "0")}</span><p>${line}</p></article>`).join("")}</div></section>${footer()}`);
}

function login() {
  return layout("Login | InsurSuite", `
    <section class="hero">
      <div>
        <span class="kicker">Secure portal access</span>
        <h1>Enter your InsurSuite coverage portal.</h1>
        <p>Sign in to organize policies, upload documents, review beneficiaries, ask for support, and keep your family coverage file ready.</p>
        <div class="actions"><a class="button primary" href="${portalUrl}">Continue to portal</a></div>
      </div>
      <figure class="photo-card">
        <img src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=82" alt="Insurance documents and planning notes on a desk">
        <figcaption class="photo-caption"><strong>Your insurance information belongs in one protected place.</strong><small>Use the portal for policies, documents, beneficiaries, requests, and annual checkups.</small></figcaption>
      </figure>
    </section>
    <section class="promise-strip"><span>Secure identity step.</span><span>Protected coverage file.</span><span>Guided support when you need it.</span></section>
    <section class="footer-cta"><h2>New to InsurSuite?</h2><p>Create your portal through the same secure access flow and start with the policies and documents you already have.</p><a class="button primary" href="${portalUrl}">Create account or sign in</a></section>
  `);
}

function signIn() {
  return layout("Secure Sign In | InsurSuite", `
    <section class="hero">
      <div>
        <span class="kicker">Portal sign-in</span>
        <h1>Your secure portal login is the next connection point.</h1>
        <p>This Vercel front door is ready. To open live accounts from here, connect the deployed InsurSuite app URL with the INSURSUITE_APP_URL environment variable.</p>
        <div class="actions"><a class="button primary" href="/login/">Back to login</a></div>
      </div>
      <figure class="photo-card">
        <img src="https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=1200&q=82" alt="A secure planning folder on a desk">
        <figcaption class="photo-caption"><strong>No dead ends for visitors.</strong><small>This route stays wired while the production app login destination is connected.</small></figcaption>
      </figure>
    </section>
    <section class="band"><h2>What still needs to be connected?</h2><p>Deploy the authenticated InsurSuite app, then set INSURSUITE_APP_URL in Vercel so the login button sends clients straight into the portal.</p></section>
  `);
}

function footer() {
  return `<section class="footer-cta"><h2>Build a coverage file your future self can actually use.</h2><p>Start with what you own today. Keep the important details together. Know what needs attention before life makes it urgent.</p><a class="button primary" href="/mission/">Start with the mission</a></section>`;
}
