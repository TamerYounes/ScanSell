"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const demoEnabled = process.env.NEXT_PUBLIC_DEMO_ENABLED === "true";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

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
    <div className="min-h-screen bg-[#f5f8fd] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[405px]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Stockpile</h1>
          <p className="mt-1 text-sm text-slate-500">You&rsquo;ve been invited to join the team</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
          {status === "checking" && <p className="text-sm text-slate-500">Checking your invite...</p>}

          {status === "demo" && (
            <>
              <h2 className="text-lg font-bold">Joining is off in the demo</h2>
              <p className="mt-2 text-sm text-slate-600">
                This is how a new employee would sign up from an invite link. In the public demo,
                new accounts can&rsquo;t be created, but you can look around as an employee.
              </p>
              <Link
                href="/"
                className="mt-5 block w-full rounded-lg bg-[#3d43c6] py-3 text-center text-sm font-bold text-white hover:bg-[#3037ae]"
              >
                Back to the demo
              </Link>
            </>
          )}

          {status === "invalid" && (
            <>
              <h2 className="text-lg font-bold">This invite link doesn&rsquo;t work</h2>
              <p className="mt-2 text-sm text-slate-600">
                It may have been used already or expired. Ask the owner for a new one.
              </p>
            </>
          )}

          {status === "confirm-email" && (
            <>
              <h2 className="text-lg font-bold">Check your email</h2>
              <p className="mt-2 text-sm text-slate-600">
                We sent a confirmation link to {email.trim().toLowerCase()}. Open it to finish
                setting up your account.
              </p>
            </>
          )}

          {status === "valid" && (
            <form onSubmit={handleSubmit}>
              <h2 className="text-xl font-bold">Create your account</h2>
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">Your name</span>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    maxLength={80}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">Email</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className={inputClass}
                  />
                </label>
              </div>

              {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              <button
                disabled={submitting}
                className="mt-6 w-full rounded-lg bg-[#3d43c6] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#3037ae] disabled:opacity-60"
              >
                {submitting ? "Creating account…" : "Join"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
