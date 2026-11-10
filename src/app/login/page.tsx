"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || "ما كدرنا ندخلك، جرّب مرة ثانية.");
        setBusy(false);
        return;
      }
      window.location.href = "/";
    } catch {
      setMsg("ما كدرنا نوصل للسيرفر، تأكد من الاتصال.");
      setBusy(false);
    }
  }

  return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div>
          <h1>مخزن الاستيكرات</h1>
          <p>اكتب كلمة السر حتى تدخل.</p>
        </div>
        <div className="field">
          <label htmlFor="pw">كلمة السر</label>
          <input
            id="pw"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <p className="msg" role="alert">
          {msg}
        </p>
        <button className="btn primary" type="submit" disabled={busy || !password}>
          {busy ? "جاري الدخول…" : "دخول"}
        </button>
      </form>
    </main>
  );
}
