"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthFrame } from "@/components/layout/AuthFrame";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/States";

const REMEMBER_KEY = "stockpile-email";
const demoEnabled = process.env.NEXT_PUBLIC_DEMO_ENABLED === "true";


function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    searchParams.get("demo") === "unavailable"
      ? "The demo isn't available right now."
      : searchParams.get("inactive")
        ? "Your account isn't active. Ask the owner to give you access."
        : "",
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch {
      // Storage can be blocked (private browsing); remembering is optional.
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (authError) {
      setError("Invalid email or password. Please try again.");
      setLoading(false);
      return;
    }

    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, normalizedEmail);
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {
      // See above.
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthFrame>
      {demoEnabled && (
        <section className="mb-6 rounded-lg border border-line bg-white p-4">
          <h2 className="text-sm font-semibold text-ink">Try the demo</h2>
          <p className="mt-1 text-sm text-muted">
            A small phone accessories shop with two sellers. No sign-up, and the data resets every night.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["owner", "employee"] as const).map((role) => (
              <form key={role} action="/auth/demo" method="post">
                <input type="hidden" name="role" value={role} />
                <Button type="submit" variant={role === "owner" ? "primary" : "secondary"} fullWidth>
                  {role === "owner" ? "As the owner" : "As a seller"}
                </Button>
              </form>
            ))}
          </div>
        </section>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <h1 className="text-xl font-semibold text-ink">Sign in</h1>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field pr-16"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 text-xs font-medium text-muted hover:text-ink"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 accent-[#1F5F4A]"
          />
          Remember my email
        </label>

        {error && <Notice tone="error">{error}</Notice>}

        <Button type="submit" size="lg" fullWidth disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>

        <p className="text-sm text-muted">New here? Ask the owner for an invite link.</p>
      </form>
    </AuthFrame>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
