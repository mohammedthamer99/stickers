"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Batch = {
  id: number;
  name: string;
  batch: string;
  expiry: string;
  location: string;
  received: number;
  dispensed: number;
};

type Move = { id: number; kind: "in" | "out" | "adj"; qty: number | null; note: string; at: string };

type Warehouse = { id: number; name: string };

type Modal =
  | null
  | { kind: "receive" }
  | { kind: "edit"; batch: Batch }
  | { kind: "unlockEdit"; batch: Batch }
  | { kind: "withdraw"; fixedId?: number }
  | { kind: "log"; batch: Batch }
  | { kind: "delete"; batch: Batch }
  | { kind: "export" };

type Filter = "all" | "soon" | "expired" | "empty";

const SOON = 90;

/* ---------- helpers ---------- */

const rem = (b: Batch) => Math.max(0, b.received - b.dispensed);

function daysLeft(expiry: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiry);
  if (!m) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return Math.round((d.getTime() - today.getTime()) / 864e5);
}

function statusOf(b: Batch): "ok" | "soon" | "expired" | "empty" {
  if (rem(b) === 0) return "empty";
  const left = daysLeft(b.expiry);
  if (left !== null && left < 0) return "expired";
  if (left !== null && left <= SOON) return "soon";
  return "ok";
}

function fmtDT(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("لازم تسجل دخول.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "صار خطأ، جرّب مرة ثانية.");
  return data as T;
}

/* ---------- modal shell ---------- */

function Shell({
  onClose,
  wide,
  label,
  children,
}: {
  onClose: () => void;
  wide?: boolean;
  label: string;
  children: ReactNode;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={"sheet" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

/* ---------- receive / edit ---------- */

function ReceiveModal({
  edit,
  names,
  onClose,
  onSaved,
}: {
  edit?: Batch;
  names: string[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(edit?.name ?? "");
  const [batch, setBatch] = useState(edit?.batch ?? "");
  const [expiry, setExpiry] = useState(edit?.expiry ?? "");
  const [location, setLocation] = useState(edit?.location ?? "");
  const [qty, setQty] = useState(edit ? String(edit.received) : "");
  const [out, setOut] = useState(edit && edit.dispensed ? String(edit.dispensed) : "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const q = qty === "" ? NaN : Number(qty);
  const o = out === "" ? 0 : Number(out);
  const preview = Number.isFinite(q) && Number.isFinite(o) && q - o >= 0 ? String(q - o) : "—";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMsg("");
    if (!name.trim()) return setMsg("اكتب اسم المادة.");
    if (!batch.trim()) return setMsg("اكتب الباج نمبر.");
    if (!expiry) return setMsg("اختار تاريخ الانتهاء.");
    if (!Number.isInteger(q) || q < 1) return setMsg("الكمية لازم تكون رقم صحيح أكبر من صفر.");
    if (!Number.isInteger(o) || o < 0) return setMsg("المصروف لازم يكون رقم صحيح، أو اتركه فارغ.");
    if (o > q) return setMsg("المصروف أكبر من الكمية.");

    const body = { name, batch, expiry, location, received: q, dispensed: o };
    setBusy(true);
    try {
      if (edit) {
        await api(`/api/batches/${edit.id}`, "PATCH", body);
        onSaved("انحفظ التعديل");
      } else {
        const r = await api<{ merged: boolean }>("/api/batches", "POST", body);
        onSaved(r.merged ? "انضافت الكمية للدفعة الموجودة" : "انحفظت الدفعة");
      }
    } catch (err) {
      setMsg((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Shell wide onClose={onClose} label={edit ? "تعديل الدفعة" : "استلام استيكر جديد"}>
      <h2>{edit ? "تعديل الدفعة" : "استلام استيكر جديد"}</h2>
      <form onSubmit={submit} noValidate>
        <div className="fgrid">
          <div className="field">
            <label htmlFor="f-name">اسم المادة</label>
            <input
              id="f-name"
              type="text"
              dir="auto"
              list="known-names"
              autoComplete="off"
              maxLength={120}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <datalist id="known-names">
              {names.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="f-batch">الباج نمبر</label>
            <input
              id="f-batch"
              type="text"
              dir="ltr"
              autoComplete="off"
              maxLength={60}
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="f-exp">تاريخ الانتهاء</label>
            <input id="f-exp" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="f-loc">مكان التخزين</label>
            <input
              id="f-loc"
              type="text"
              dir="auto"
              autoComplete="off"
              maxLength={60}
              placeholder="مثلاً: رف 3 / صندوق B"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="f-qty">الكمية بالقطعة</label>
            <input
              id="f-qty"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="f-out">المصروف (اختياري)</label>
            <input
              id="f-out"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              placeholder="0"
              value={out}
              onChange={(e) => setOut(e.target.value)}
            />
          </div>
        </div>
        <div className="formfoot">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "جاري الحفظ…" : edit ? "حفظ التعديل" : "حفظ الاستلام"}
          </button>
          <button className="btn" type="button" onClick={onClose}>
            إلغاء
          </button>
          <span className="rempv">
            المتبقي بعد الحفظ: <b>{preview}</b>
          </span>
          <p className="msg" role="alert">
            {msg}
          </p>
        </div>
      </form>
    </Shell>
  );
}

/* ---------- withdraw ---------- */

function WithdrawModal({
  items,
  fixedId,
  onClose,
  onSaved,
}: {
  items: Batch[];
  fixedId?: number;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [pickId, setPickId] = useState<number | null>(null);
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const qtyRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((b) => rem(b) > 0)
      .filter((b) => !q || `${b.name} ${b.batch} ${b.location}`.toLowerCase().includes(q))
      .sort((a, b) => (a.expiry < b.expiry ? -1 : a.expiry > b.expiry ? 1 : 0));
  }, [items, search]);

  const selId = fixedId ?? (list.some((b) => b.id === pickId) ? pickId : (list[0]?.id ?? null));
  const sel = items.find((b) => b.id === selId) ?? null;
  const left = sel ? rem(sel) : 0;
  const expired = sel ? (daysLeft(sel.expiry) ?? 0) < 0 : false;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMsg("");
    if (!sel) return setMsg("اختار المادة أول.");
    const n = Number(qty);
    if (!Number.isInteger(n) || n < 1) return setMsg("اكتب كمية صحيحة أكبر من صفر.");
    if (n > left) return setMsg(`الكمية أكبر من المتبقي (${left}).`);
    setBusy(true);
    try {
      await api(`/api/batches/${sel.id}/dispense`, "POST", { qty: n, note });
      onSaved(`تم صرف ${n} قطعة، المتبقي ${left - n}`);
    } catch (err) {
      setMsg((err as Error).message);
      setBusy(false);
    }
  }

  const title = fixedId ? "صرف استيكر" : "سحب مادة";

  return (
    <Shell onClose={onClose} label={title}>
      <form onSubmit={submit} noValidate>
        <h2>{title}</h2>

        {!fixedId && (
          <>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="d-search">بحث</label>
              <input
                id="d-search"
                type="search"
                autoComplete="off"
                autoFocus
                placeholder="اسم المادة أو الباج نمبر أو المكان"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    qtyRef.current?.focus();
                  }
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="d-pick">
                المادة والباج نمبر (الأقرب انتهاءً أول) · {list.length ? `${list.length} نتيجة` : "ماكو نتائج"}
              </label>
              <select
                id="d-pick"
                size={5}
                value={selId ?? ""}
                onChange={(e) => setPickId(Number(e.target.value))}
              >
                {list.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.batch} (متبقي {rem(b)})
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {sel ? (
          <p className="meta">
            {fixedId && (
              <>
                <strong>{sel.name}</strong>
                <br />
                <bdi className="mono">{sel.batch}</bdi>
                <br />
              </>
            )}
            ينتهي <bdi className="num">{sel.expiry}</bdi> · المكان: {sel.location || "غير محدد"} · المتبقي{" "}
            <b className="num">{left}</b> قطعة
          </p>
        ) : (
          <p className="meta">ما لقينا مادة بهذا البحث.</p>
        )}
        {expired && <p className="warnline">هذي الدفعة منتهية الصلاحية.</p>}

        <div className="field">
          <label htmlFor="d-qty">الكمية المسحوبة (قطعة)</label>
          <div className="inrow">
            <input
              id="d-qty"
              ref={qtyRef}
              type="number"
              inputMode="numeric"
              min={1}
              max={left || undefined}
              step={1}
              disabled={!sel}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus={Boolean(fixedId)}
            />
            <button
              type="button"
              className="btn sm"
              disabled={!sel}
              onClick={() => {
                setQty(String(left));
                qtyRef.current?.focus();
              }}
            >
              الكل ({left})
            </button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="d-note">ملاحظة (اختياري)</label>
          <input id="d-note" type="text" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <p className="msg" role="alert">
          {msg}
        </p>
        <div className="sheet-actions">
          <button className="btn primary" type="submit" disabled={!sel || busy}>
            {busy ? "جاري الحفظ…" : fixedId ? "تأكيد الصرف" : "تأكيد السحب"}
          </button>
          <button className="btn" type="button" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </form>
    </Shell>
  );
}

/* ---------- log & delete ---------- */

const KIND_LABEL: Record<Move["kind"], string> = { in: "استلام", out: "صرف", adj: "تعديل" };

function LogModal({ batch, onClose }: { batch: Batch; onClose: () => void }) {
  const [log, setLog] = useState<Move[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    api<{ log: Move[] }>(`/api/batches/${batch.id}/log`)
      .then((d) => live && setLog(d.log))
      .catch((e) => live && setErr((e as Error).message));
    return () => {
      live = false;
    };
  }, [batch.id]);

  return (
    <Shell onClose={onClose} label="سجل الحركات">
      <h2>سجل الحركات</h2>
      <p className="meta">
        <strong>{batch.name}</strong>
        <br />
        <bdi className="mono">{batch.batch}</bdi>
      </p>
      {err ? (
        <p className="msg">{err}</p>
      ) : log === null ? (
        <p className="sub">جاري التحميل…</p>
      ) : log.length === 0 ? (
        <p className="sub">ماكو حركات مسجلة.</p>
      ) : (
        <ul className="hist">
          {log.map((l) => (
            <li key={l.id}>
              <span className={`t-${l.kind}`}>{KIND_LABEL[l.kind]}</span>
              <b className="num">{l.qty != null ? `${l.kind === "in" ? "+" : "−"}${l.qty}` : ""}</b>
              <span className="sub num">{fmtDT(l.at)}</span>
              {l.note && <span className="hn">{l.note}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="sheet-actions">
        <button className="btn" type="button" onClick={onClose} autoFocus>
          إغلاق
        </button>
      </div>
    </Shell>
  );
}

function DeleteModal({
  batch,
  onClose,
  onSaved,
}: {
  batch: Batch;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function go() {
    setBusy(true);
    try {
      await api(`/api/batches/${batch.id}`, "DELETE");
      onSaved("انحذفت الدفعة");
    } catch (e) {
      setMsg((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Shell onClose={onClose} label="حذف الدفعة">
      <h2>حذف الدفعة؟</h2>
      <p className="meta">
        <strong>{batch.name}</strong>
        <br />
        <bdi className="mono">{batch.batch}</bdi>
        <br />
        راح ينمسح كل سجلها نهائياً.
      </p>
      <p className="msg" role="alert">
        {msg}
      </p>
      <div className="sheet-actions">
        <button className="btn danger" type="button" onClick={go} disabled={busy}>
          {busy ? "جاري الحذف…" : "حذف نهائي"}
        </button>
        <button className="btn" type="button" onClick={onClose} autoFocus>
          إلغاء
        </button>
      </div>
    </Shell>
  );
}

/* ---------- edit unlock ---------- */

function UnlockEditModal({ onClose, onUnlocked }: { onClose: () => void; onUnlocked: () => void }) {
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMsg("");
    if (!code.trim()) return setMsg("اكتب رمز التعديل.");
    setBusy(true);
    try {
      const res = await fetch("/api/edit-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
        cache: "no-store",
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "الرمز غلط.");
      onUnlocked();
    } catch (err) {
      setMsg((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Shell onClose={onClose} label="رمز التعديل">
      <form className="unlock" onSubmit={submit} noValidate>
        <div className="unlock-head">
          <span className="unlock-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4.5" y="10" width="15" height="10" rx="2.5" />
              <path d="M8 10V7.5a4 4 0 0 1 8 0V10" strokeLinecap="round" />
              <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <div>
            <h2>رمز التعديل</h2>
            <p className="unlock-sub">تعديل الدفعات محمي، أدخل الرمز للمتابعة.</p>
          </div>
        </div>

        <div className="field">
          <label htmlFor="e-code">رمز التعديل</label>
          <div className={"unlock-input" + (msg ? " bad" : "")}>
            <svg
              className="unlock-input-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <rect x="4.5" y="10" width="15" height="10" rx="2.5" />
              <path d="M8 10V7.5a4 4 0 0 1 8 0V10" strokeLinecap="round" />
            </svg>
            <input
              id="e-code"
              type={show ? "text" : "password"}
              autoComplete="off"
              maxLength={120}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="••••••"
            />
            <button
              className="unlock-eye"
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "إخفاء الرمز" : "إظهار الرمز"}
              title={show ? "إخفاء الرمز" : "إظهار الرمز"}
            >
              {show ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 3l18 18" strokeLinecap="round" />
                  <path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c5 0 9 4.5 9 6 0 .6-.7 1.9-2 3.1M6.5 7.7C4.6 9.1 3 11 3 12c0 1.5 4 6 9 6 1.3 0 2.5-.3 3.6-.8" strokeLinecap="round" />
                  <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <p className="msg unlock-msg" role="alert">
          {msg}
        </p>

        <div className="unlock-actions">
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "جاري التحقق…" : "فتح التعديل"}
          </button>
          <button className="btn" type="button" onClick={onClose}>
            إلغاء
          </button>
        </div>
        <p className="unlock-note">الرمز يبقى صالح 15 دقيقة بعد التحقق.</p>
      </form>
    </Shell>
  );
}

/* ---------- export ---------- */

function ExportModal({ items, onClose }: { items: Batch[]; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(() => new Set(items.map((b) => b.id)));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((b) => {
        if (q && !`${b.name} ${b.batch} ${b.location}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const ea = rem(a) === 0 ? 1 : 0;
        const eb = rem(b) === 0 ? 1 : 0;
        if (ea !== eb) return ea - eb;
        if (a.expiry !== b.expiry) return a.expiry < b.expiry ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [items, query]);

  const allFilteredSelected = list.length > 0 && list.every((b) => selected.has(b.id));

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) list.forEach((b) => next.delete(b.id));
      else list.forEach((b) => next.add(b.id));
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(items.map((b) => b.id)));
    setQuery("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMsg("");
    if (selected.size === 0) return setMsg("اختار مادة وحدة على الأقل.");
    setBusy(true);
    try {
      const ids = Array.from(selected).join(",");
      const res = await fetch(`/api/export?ids=${ids}`, { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "تعذر إنشاء الملف، جرّب مرة ثانية.");
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = /filename\*=UTF-8''([^;]+)/i.exec(cd);
      const filename = m ? decodeURIComponent(m[1]) : "inventory.xlsx";
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      onClose();
    } catch (err) {
      setMsg((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Shell wide onClose={onClose} label="تصدير كشف Excel">
      <form onSubmit={submit} noValidate>
        <h2>تصدير كشف Excel</h2>
        <p className="meta">
          اختار مادة وحدة أو أكثر. استخدم البحث بالاسم أو الباج نمبر، أو اختار كل المواد.
        </p>

        <div className="xsearch">
          <input
            type="search"
            placeholder="دوّر باسم المادة أو الباج نمبر أو المكان"
            aria-label="بحث عن مادة"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="xbar">
          <label className="xall">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleFiltered}
              disabled={list.length === 0}
            />
            <span>{query ? `تحديد النتائج (${list.length})` : "تحديد الكل"}</span>
          </label>
          <div className="xbar-actions">
            <button className="btn sm" type="button" onClick={selectAll}>
              كل المواد
            </button>
            <button
              className="btn sm"
              type="button"
              onClick={() => setSelected(new Set())}
              disabled={selected.size === 0}
            >
              مسح التحديد
            </button>
          </div>
        </div>

        <div className="xlist">
          {items.length === 0 ? (
            <p className="xempty">ماكو دفعات مسجلة للحين.</p>
          ) : list.length === 0 ? (
            <p className="xempty">ماكو نتائج لهذا البحث.</p>
          ) : (
            list.map((b) => {
              const checked = selected.has(b.id);
              return (
                <label key={b.id} className={"xrow" + (checked ? " on" : "")}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(b.id)} />
                  <span className="xmain">
                    <span className="xname">{b.name}</span>
                    <span className="xmeta">
                      <bdi className="mono">{b.batch}</bdi>
                      <span className="xdot" />
                      ينتهي <bdi className="num">{b.expiry}</bdi>
                      <span className="xdot" />
                      متبقي <b className="num">{rem(b)}</b>
                    </span>
                  </span>
                </label>
              );
            })
          )}
        </div>

        <p className="msg" role="alert">
          {msg}
        </p>
        <div className="sheet-actions">
          <button className="btn primary" type="submit" disabled={busy || selected.size === 0}>
            {busy ? "جاري التجهيز…" : `تنزيل الملف (${selected.size})`}
          </button>
          <button className="btn" type="button" onClick={onClose}>
            إلغاء
          </button>
          <span className="xcount">المحدد: {selected.size} من {items.length}</span>
        </div>
      </form>
    </Shell>
  );
}

/* ---------- offline cache ---------- */

const cacheKey = (warehouseId: number) => `stk.inventory.cache.v2.${warehouseId}`;

type Cached = { items: Batch[]; at: number };

function isBatch(v: unknown): v is Batch {
  if (!v || typeof v !== "object") return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b.id === "number" &&
    typeof b.name === "string" &&
    typeof b.batch === "string" &&
    typeof b.expiry === "string" &&
    typeof b.location === "string" &&
    typeof b.received === "number" &&
    typeof b.dispensed === "number"
  );
}

function readCache(warehouseId: number): Cached | null {
  try {
    const raw = localStorage.getItem(cacheKey(warehouseId));
    if (!raw) return null;
    const d = JSON.parse(raw) as { items?: unknown; at?: unknown };
    if (!d || !Array.isArray(d.items)) return null;
    return {
      items: d.items.filter(isBatch),
      at: typeof d.at === "number" ? d.at : Date.now(),
    };
  } catch {
    return null;
  }
}

function saveCache(warehouseId: number, items: Batch[]): number {
  const at = Date.now();
  try {
    localStorage.setItem(cacheKey(warehouseId), JSON.stringify({ items, at }));
  } catch {}
  return at;
}

/* ---------- warehouse session ---------- */

function readWarehouseCookie(): Warehouse | null {
  try {
    const part = document.cookie.split("; ").find((c) => c.startsWith("stk_wh="));
    if (!part) return null;
    const parsed = JSON.parse(decodeURIComponent(part.slice("stk_wh=".length))) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const { id, name } = parsed as { id?: unknown; name?: unknown };
    if (!Number.isInteger(id) || typeof name !== "string" || !name) return null;
    return { id: id as number, name };
  } catch {
    return null;
  }
}

/* ---------- page ---------- */

export default function InventoryApp() {
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);

  useEffect(() => {
    const w = readWarehouseCookie();
    if (w) setWarehouse(w);
    else window.location.href = "/login";
  }, []);

  if (!warehouse) {
    return (
      <main className="wrap">
        <div className="empty">
          <strong>جاري التحميل…</strong>
        </div>
      </main>
    );
  }

  return <Inventory warehouse={warehouse} />;
}

function Inventory({ warehouse }: { warehouse: Warehouse }) {
  const [items, setItems] = useState<Batch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState("");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [offline, setOffline] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const d = await api<{ items: Batch[] }>("/api/batches");
      const at = saveCache(warehouse.id, d.items);
      setItems(d.items);
      setLastUpdated(at);
      setFromCache(false);
      setLoadErr("");
    } catch (e) {
      setLoadErr((e as Error).message);
      const cached = readCache(warehouse.id);
      if (cached) {
        setItems((prev) => (prev.length ? prev : cached.items));
        setLastUpdated((prev) => prev ?? cached.at);
        setFromCache(true);
      }
    } finally {
      setLoaded(true);
    }
  }, [warehouse.id]);

  const showToast = useCallback((t: string) => {
    setToast(t);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  }, []);

  useEffect(() => {
    const cached = readCache(warehouse.id);
    if (cached) {
      setItems(cached.items);
      setLastUpdated(cached.at);
      setFromCache(true);
      setLoaded(true);
    }
    setOffline(!navigator.onLine);

    load();
    const t = setInterval(load, 30000);
    const onFocus = () => load();
    const onOnline = () => {
      setOffline(false);
      showToast("رجع الاتصال، جاري تحديث البيانات…");
      load();
    };
    const onOffline = () => setOffline(true);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [load, showToast]);

  const closeModal = useCallback(() => setModal(null), []);
  const saved = useCallback(
    (msg: string) => {
      setModal(null);
      showToast(msg);
      load();
    },
    [load, showToast],
  );

  const stats = useMemo(() => {
    let batches = 0;
    let total = 0;
    let soon = 0;
    let exp = 0;
    for (const b of items) {
      const st = statusOf(b);
      if (rem(b) > 0) {
        batches++;
        total += rem(b);
      }
      if (st === "soon") soon++;
      if (st === "expired") exp++;
    }
    return { batches, total, soon, exp };
  }, [items]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((b) => {
        if (q && !`${b.name} ${b.batch} ${b.location}`.toLowerCase().includes(q)) return false;
        const st = statusOf(b);
        if (filter === "soon") return st === "soon";
        if (filter === "expired") return st === "expired";
        if (filter === "empty") return st === "empty";
        return true;
      })
      .sort((a, b) => {
        const ea = rem(a) === 0 ? 1 : 0;
        const eb = rem(b) === 0 ? 1 : 0;
        if (ea !== eb) return ea - eb;
        if (a.expiry !== b.expiry) return a.expiry < b.expiry ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [items, query, filter]);

  const names = useMemo(() => Array.from(new Set(items.map((b) => b.name))).sort(), [items]);

  async function logout() {
    try {
      await api("/api/logout", "POST", {});
    } catch {}
    window.location.href = "/login";
  }

  const FILTERS: [Filter, string][] = [
    ["all", "الكل"],
    ["soon", "قريبة الانتهاء"],
    ["expired", "منتهية"],
    ["empty", "خالصة"],
  ];

  const stamp = lastUpdated ? fmtDT(new Date(lastUpdated).toISOString()) : "";
  const storageText = !loaded
    ? "جاري التحميل…"
    : loadErr && fromCache
      ? `غير متصل — آخر تحديث ${stamp}`
      : loadErr
        ? `تعذر التحديث: ${loadErr}`
        : stamp
          ? `آخر تحديث ${stamp}`
          : "محفوظة بقاعدة البيانات";

  return (
    <>
      <main className="wrap">
        <header className="top">
          <div>
            <h1>مخزن {warehouse.name}</h1>
            <p>استلام وصرف وتتبع كل باج نمبر</p>
            <span id="storage">{storageText}</span>
          </div>
          <div className="topacts">
            <button className="btn primary" type="button" onClick={() => setModal({ kind: "receive" })}>
              استلام
            </button>
            <button className="btn" type="button" onClick={() => setModal({ kind: "withdraw" })}>
              سحب مادة
            </button>
            <button className="btn" type="button" onClick={() => setModal({ kind: "export" })}>
              كشف Excel
            </button>
            <button className="btn ghost" type="button" onClick={logout}>
              خروج
            </button>
          </div>
        </header>

        <section className="stats" aria-label="ملخص المخزن">
          <div className="stat">
            <b>{stats.batches}</b>
            <span>دفعة بالمخزن</span>
          </div>
          <div className="stat">
            <b>{stats.total}</b>
            <span>قطعة متبقية</span>
          </div>
          <div className={"stat" + (stats.soon ? " warn" : "")}>
            <b>{stats.soon}</b>
            <span>تنتهي خلال {SOON} يوم</span>
          </div>
          <div className={"stat" + (stats.exp ? " bad" : "")}>
            <b>{stats.exp}</b>
            <span>منتهية الصلاحية</span>
          </div>
        </section>

        <section aria-label="قائمة الدفعات" style={{ display: "grid", gap: 12 }}>
          <div className="toolbar">
            <input
              className="search"
              type="search"
              placeholder="دوّر باسم المادة أو الباج نمبر أو المكان"
              aria-label="بحث"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="filters">
              {FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  className="fchip"
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loaded && (offline || loadErr) && (
            <div className="offlinebar" role="status">
              <strong>{offline ? "غير متصل بالإنترنت" : "تعذر الاتصال بالسيرفر"}</strong>
              {stamp ? ` — تعرض آخر بيانات محفوظة (${stamp}).` : "."} راح تتحدث تلقائياً عند
              رجوع الاتصال.
            </div>
          )}

          <div className="list" role="table" aria-label="الدفعات">
            {!loaded ? (
              <div className="empty">
                <strong>جاري تحميل البيانات…</strong>
              </div>
            ) : loadErr && items.length === 0 ? (
              <div className="empty">
                <strong>تعذر الاتصال بقاعدة البيانات</strong>
                {loadErr}
              </div>
            ) : items.length === 0 ? (
              <div className="empty">
                <strong>ماكو دفعات مسجلة للحين</strong>
                اضغط زر «استلام» فوق وسجّل أول دفعة.
              </div>
            ) : rows.length === 0 ? (
              <div className="empty">
                <strong>ماكو نتائج</strong>
                جرّب بحث ثاني أو غيّر الفلتر.
              </div>
            ) : (
              <>
                <div className="row head" role="row">
                  <div className="c" role="columnheader">اسم المادة</div>
                  <div className="c" role="columnheader">الباج نمبر</div>
                  <div className="c" role="columnheader">تاريخ الانتهاء</div>
                  <div className="c" role="columnheader">الكمية</div>
                  <div className="c" role="columnheader">المصروف</div>
                  <div className="c" role="columnheader">المتبقي</div>
                  <div className="c" role="columnheader">مكان التخزين</div>
                  <div className="c" role="columnheader" />
                </div>
                {rows.map((b) => (
                  <Row
                    key={b.id}
                    b={b}
                    onOut={() => setModal({ kind: "withdraw", fixedId: b.id })}
                    onLog={() => setModal({ kind: "log", batch: b })}
                    onEdit={() => setModal({ kind: "unlockEdit", batch: b })}
                    onDelete={() => setModal({ kind: "delete", batch: b })}
                  />
                ))}
              </>
            )}
          </div>
        </section>

        <footer className="credit">
          <span className="credit-brand">
            <span className="credit-mark" aria-hidden="true">MT</span>
          </span>
          <span className="credit-meta">نظام إدارة مخزون الاستيكرات · الإصدار 1.0</span>
        </footer>
      </main>

      {modal?.kind === "receive" && <ReceiveModal names={names} onClose={closeModal} onSaved={saved} />}
      {modal?.kind === "unlockEdit" && (
        <UnlockEditModal
          onClose={closeModal}
          onUnlocked={() => setModal({ kind: "edit", batch: modal.batch })}
        />
      )}
      {modal?.kind === "edit" && (
        <ReceiveModal edit={modal.batch} names={names} onClose={closeModal} onSaved={saved} />
      )}
      {modal?.kind === "withdraw" && (
        <WithdrawModal items={items} fixedId={modal.fixedId} onClose={closeModal} onSaved={saved} />
      )}
      {modal?.kind === "log" && <LogModal batch={modal.batch} onClose={closeModal} />}
      {modal?.kind === "delete" && <DeleteModal batch={modal.batch} onClose={closeModal} onSaved={saved} />}
      {modal?.kind === "export" && <ExportModal items={items} onClose={closeModal} />}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </>
  );
}

function Row({
  b,
  onOut,
  onLog,
  onEdit,
  onDelete,
}: {
  b: Batch;
  onOut: () => void;
  onLog: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const left = rem(b);
  const days = daysLeft(b.expiry);
  const st = statusOf(b);
  const pct = b.received > 0 ? Math.round((left / b.received) * 100) : 0;

  return (
    <article className="row" role="row">
      <div className="c name" role="cell">
        <strong>{b.name}</strong>
        {st === "empty" && <span className="chip">خالصة</span>}
        {st === "expired" && <span className="chip bad">منتهية</span>}
        {st === "soon" && <span className="chip warn">قريبة الانتهاء</span>}
      </div>
      <div className="c" role="cell" data-l="الباج نمبر">
        <bdi className="mono">{b.batch}</bdi>
      </div>
      <div className="c" role="cell" data-l="تاريخ الانتهاء">
        <bdi className="num">{b.expiry}</bdi>
        {st !== "empty" && days !== null && days < 0 && <span className="sub bad">انتهت قبل {-days} يوم</span>}
        {st !== "empty" && days !== null && days >= 0 && days <= SOON && (
          <span className="sub warn">باقي {days} يوم</span>
        )}
      </div>
      <div className="c num" role="cell" data-l="الكمية">
        {b.received}
      </div>
      <div className="c num" role="cell" data-l="المصروف">
        {b.dispensed}
      </div>
      <div className="c" role="cell" data-l="المتبقي">
        <span className="num big">{left}</span>
        <span className={"bar" + (pct <= 10 ? " low" : "")}>
          <i style={{ width: `${pct}%` }} />
        </span>
      </div>
      <div className="c" role="cell" data-l="مكان التخزين">
        {b.location ? b.location : <span className="sub">غير محدد</span>}
      </div>
      <div className="c acts" role="cell">
        <button className="btn primary sm" type="button" onClick={onOut} disabled={left === 0}>
          صرف
        </button>
        <button className="btn sm" type="button" onClick={onLog}>
          السجل
        </button>
        <button className="btn sm" type="button" onClick={onEdit}>
          تعديل
        </button>
        <button className="btn sm" type="button" onClick={onDelete}>
          حذف
        </button>
      </div>
    </article>
  );
}
