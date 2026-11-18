"use client";

import { FormEvent, useState } from "react";

function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#loginLogoGrad)" />
      <rect x="1" y="1" width="30" height="30" rx="9" stroke="rgba(255,255,255,.25)" />
      <path
        d="M16 6.5l7.2 4v9L16 23.5l-7.2-4v-9L16 6.5z"
        stroke="#fff"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M8.8 10.5L16 14.5l7.2-4M16 14.5v8.6" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
      <defs>
        <linearGradient id="loginLogoGrad" x1="4" y1="1" x2="29" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="#19b3b8" />
          <stop offset="1" stopColor="#07494c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="brand-check">
      <circle cx="10" cy="10" r="9" fill="rgba(255,255,255,.14)" />
      <path d="M6.4 10.3l2.3 2.3 4.9-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

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
    <div className="auth">
      <aside className="auth-brand" aria-hidden="true">
        <div className="auth-brand-glow" />
        <div className="auth-brand-inner">
          <div className="brand-top">
            <span className="brand-logo">
              <LogoMark className="brand-logo-mark" />
            </span>
            <span className="brand-name">مخازن الاستيكرات</span>
          </div>

          <div className="brand-body">
            <span className="brand-eyebrow">نظام إدارة المخزون الدوائي</span>
            <h1 className="brand-title">
              تحكّم كامل
              <br />
              بمخزون الاستيكرات
            </h1>
            <p className="brand-sub">
              استلام وصرف ومتابعة دفعات الاستيكرات بدقة، مع تتبّع تواريخ الانتهاء وسجل كامل لكل حركة.
            </p>

            <ul className="brand-list">
              <li>
                <CheckIcon />
                <span>تتبّع دفعات دقيق مع الباج نمبر وتاريخ الانتهاء</span>
              </li>
              <li>
                <CheckIcon />
                <span>تنبيهات تلقائية للدفعات القريبة من الانتهاء</span>
              </li>
              <li>
                <CheckIcon />
                <span>سجل حركات كامل وعمليات صرف آمنة</span>
              </li>
            </ul>
          </div>

          <p className="brand-foot">وصول آمن ومشفّر للمخزون</p>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-box">
          <div className="auth-mobile-brand">
            <LogoMark className="brand-logo-mark" />
            <span>مخازن الاستيكرات</span>
          </div>

          <header className="auth-head">
            <span className="auth-eyebrow">مرحباً بعودتك</span>
            <h2 className="auth-title">تسجيل الدخول</h2>
            <p className="auth-sub">اكتب رمز المخزن للدخول إلى لوحة التحكم.</p>
          </header>

          <form className="auth-form" onSubmit={submit}>
            <div className="auth-field">
              <label htmlFor="pw">رمز الدخول</label>
              <div className={`auth-input-group${msg ? " has-error" : ""}`}>
                <svg className="auth-input-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <rect x="4" y="8.5" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M6.8 8.5V6.8a3.2 3.2 0 016.4 0v1.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="10" cy="12.5" r="1.1" fill="currentColor" />
                </svg>
                <input
                  id="pw"
                  className="auth-input"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  autoFocus
                  placeholder="رمز المخزن"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="auth-toggle"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "إخفاء كلمة السر" : "إظهار كلمة السر"}
                  aria-pressed={show}
                  tabIndex={-1}
                >
                  {show ? (
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M3 10s2.6-4.5 7-4.5S17 10 17 10s-2.6 4.5-7 4.5S3 10 3 10z" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="10" cy="10" r="2.1" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M3 10s2.6-4.5 7-4.5S17 10 17 10s-2.6 4.5-7 4.5S3 10 3 10z" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="10" cy="10" r="2.1" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M4 16L16 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="auth-error" role="alert" aria-live="polite">
              {msg ? (
                <>
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="10" cy="10" r="8.4" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M10 6.2v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <circle cx="10" cy="13.9" r=".95" fill="currentColor" />
                  </svg>
                  <span>{msg}</span>
                </>
              ) : null}
            </div>

            <button className="auth-btn" type="submit" disabled={busy || !password}>
              {busy ? (
                <>
                  <span className="auth-spinner" aria-hidden="true" />
                  جاري الدخول…
                </>
              ) : (
                <>
                  دخول
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M11 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="auth-foot">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 2.8l6 2.2v4.4c0 3.6-2.5 6.4-6 7.8-3.5-1.4-6-4.2-6-7.8V5l6-2.2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M7.4 9.9l1.8 1.8 3.4-3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            اتصال آمن — بياناتك محمية
          </p>
        </div>
      </main>
    </div>
  );
}
