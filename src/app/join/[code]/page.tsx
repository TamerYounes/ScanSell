"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthFrame } from "@/components/layout/AuthFrame";
import { Button, buttonClass } from "@/components/ui/Button";
import { Loading, Notice } from "@/components/ui/States";

const demoEnabled = process.env.NEXT_PUBLIC_DEMO_ENABLED === "true";


type Status = "checking" | "valid" | "invalid" | "demo" | "confirm-email";

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [status, setStatus] = useState<Status>(demoEnabled ? "demo" : "checking");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (demoEnabled) return;

    supabase.rpc("check_invite", { p_code: code }).then(({ data }) => {
      setStatus(data ? "valid" : "invalid");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Enter your name.");
      return;
    }
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }

    setSubmitting(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: fullName.trim(), invite_code: code },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setSubmitting(false);

    if (signUpError) {
      // The database rejects used or expired codes, which fails the sign-up.
      const stillValid = await supabase.rpc("check_invite", { p_code: code });
      if (!stillValid.data) {
        setStatus("invalid");
      } else {
        setError(signUpError.message || "Couldn't create your account. Try again.");
      }
      return;
    }

    // With email confirmation turned on, there's no session until they confirm.
    if (!data.session) {
      setStatus("confirm-email");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthFrame>
      {status === "checking" && <Loading />}

      {status === "demo" && (
        <div>
          <h1 className="text-xl font-semibold text-ink">Joining is off in the demo</h1>
          <p className="mt-2 text-sm text-muted">
            This is where a new seller creates their account from an invite link. The public demo
            doesn&rsquo;t allow new accounts, but you can look around as a seller.
          </p>
          <Link href="/" className={buttonClass("primary", "lg", "mt-5 w-full")}>
            Back to the demo
          </Link>
        </div>
      )}

      {status === "invalid" && (
        <div>
          <h1 className="text-xl font-semibold text-ink">This invite link doesn&rsquo;t work</h1>
          <p className="mt-2 text-sm text-muted">
            It&rsquo;s been used already or it expired. Ask the owner to send a new one.
          </p>
        </div>
      )}

      {status === "confirm-email" && (
        <div>
          <h1 className="text-xl font-semibold text-ink">Check your email</h1>
          <p className="mt-2 text-sm text-muted">
            We sent a confirmation link to {email.trim().toLowerCase()}. Open it to finish setting up
            your account.
          </p>
        </div>
      )}

      {status === "valid" && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h1 className="text-xl font-semibold text-ink">Join the team</h1>
            <p className="mt-1 text-sm text-muted">Create your account to start selling.</p>
          </div>

          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-ink">
              Your name
            </label>
            <input
              id="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              maxLength={80}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="field"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="field"
            />
            <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
          </div>

          {error && <Notice tone="error">{error}</Notice>}

          <Button type="submit" size="lg" fullWidth disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
      )}
    </AuthFrame>
  );
}
