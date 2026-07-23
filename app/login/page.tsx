"use client";

import { Suspense, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientSupabase } from "../lib/supabase/client";

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://insursuite.local");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("return_to"));
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClientSupabase();
      const cleanEmail = email.trim().toLowerCase();
      const response =
        mode === "signup"
          ? await supabase.auth.signUp({
              email: cleanEmail,
              password,
              options: {
                data: { full_name: fullName.trim() },
                emailRedirectTo: `${window.location.origin}/auth/callback?return_to=${encodeURIComponent(returnTo)}`,
              },
            })
          : await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password,
            });

      if (response.error) throw response.error;

      if (mode === "signup" && !response.data.session) {
        setMessage("Account created. Check your email to confirm your login, then return here.");
        return;
      }

      router.replace(returnTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete login.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!email.trim()) {
      setError("Enter your email first, then request a reset link.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClientSupabase();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: `${window.location.origin}/auth/callback?return_to=${encodeURIComponent(returnTo)}`,
        },
      );
      if (resetError) throw resetError;
      setMessage("Password reset link sent. Check your inbox.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="auth-card" onSubmit={submit}>
      <span className="form-icon">
        <LockKeyhole size={23} />
      </span>
      <h2>{mode === "signin" ? "Sign in to InsurSuite" : "Create your InsurSuite account"}</h2>
      <p>
        {mode === "signin"
          ? "Open your protected coverage workspace."
          : "Create your login, then finish the client profile inside the portal."}
      </p>
      <div className="auth-tabs" role="tablist" aria-label="Login mode">
        <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>
          Sign in
        </button>
        <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
          Create account
        </button>
      </div>
      {mode === "signup" && (
        <label>
          Full name
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required />
        </label>
      )}
      <label>
        Email address
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <span className="password-field">
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={6}
            required
          />
          <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </label>
      {error && <p className="form-error">{error}</p>}
      {message && <p className="form-success">{message}</p>}
      <button className="primary-button full" disabled={loading}>
        {loading ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
        <ArrowRight size={17} />
      </button>
      <button className="text-button auth-reset" type="button" onClick={resetPassword} disabled={loading}>
        Forgot password?
      </button>
      <small className="privacy-line">
        <LockKeyhole size={13} />
        Protected by Supabase Auth. Do not enter SSNs, bank credentials, or carrier passwords.
      </small>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="marketing-page login-page">
      <nav className="marketing-nav" aria-label="InsurSuite login navigation">
        <div className="gate-brand">
          <ShieldCheck size={27} />
          <strong>
            Insur<span>Suite</span>
          </strong>
        </div>
        <div>
          <Link href="/">Portal</Link>
        </div>
      </nav>
      <section className="marketing-hero login-hero">
        <div className="hero-copy">
          <span className="market-kicker">
            <LockKeyhole size={15} />
            Secure portal access
          </span>
          <h1>Enter your InsurSuite coverage portal.</h1>
          <p>
            Sign in to organize policies, upload documents, review beneficiaries, ask for support, and keep your family coverage file ready.
          </p>
          <div className="trust-strip">
            <span>
              <CheckCircle2 size={16} />
              Real user accounts
            </span>
            <span>
              <CheckCircle2 size={16} />
              Protected sessions
            </span>
            <span>
              <CheckCircle2 size={16} />
              Guided onboarding
            </span>
          </div>
        </div>
        <div className="auth-panel-wrap">
          <Suspense fallback={<div className="auth-card"><p>Loading secure login...</p></div>}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
