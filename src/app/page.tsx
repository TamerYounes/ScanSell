"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (!email.trim() || !password) { setError("Please enter your email and password."); return; }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (authError) { setError("Invalid email or password. Please try again."); setLoading(false); return; }
    if (remember) localStorage.setItem("scansell-email", email.trim().toLowerCase());
    router.push("/dashboard"); router.refresh();
  }

  return <div className="min-h-screen bg-[#f5f8fd] flex items-center justify-center px-5 py-10">
    <div className="w-full max-w-[405px]">
      <div className="text-center mb-9">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[#3443b5] text-white shadow-lg shadow-blue-200"><svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="m3 8 9 5 9-5M12 13v8"/><path d="m21 8v8l-9 5-9-5V8"/></svg></div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">ScanSell</h1>
        <p className="mt-1 text-sm text-slate-500">Inventory &amp; Sales Management</p>
      </div>
      <form onSubmit={handleLogin} className="rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
        <h2 className="text-xl font-bold">Welcome Back</h2>
        <p className="mt-1 text-sm text-slate-500">Sign in to access your dashboard</p>
        <div className="mt-6 space-y-5">
          <label className="block"><span className="mb-2 block text-sm font-semibold">Email</span><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold">Password</span><div className="relative"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" className="w-full rounded-lg border border-slate-200 px-4 py-3 pr-11 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"/><button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Toggle password visibility"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg></button></div></label>
        </div>
        <div className="mt-5 flex items-center justify-between text-sm"><label className="flex items-center gap-2 text-slate-700"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600"/>Remember me</label><span className="text-blue-700">Contact manager for access</span></div>
        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>}
        <button disabled={loading} className="mt-6 w-full rounded-lg bg-[#3d43c6] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#3037ae] disabled:opacity-60">{loading ? "Signing in…" : "Sign In"}</button>
      </form>
      <p className="mt-8 text-center text-xs text-slate-500">© 2026 ScanSell. Internal business application.</p>
    </div>
  </div>;
}
