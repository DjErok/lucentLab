import { useEffect, useRef, useState } from 'react';

// Email address is intentionally never rendered in the UI; the API endpoint
// owns the recipient and the API key (server-side via /api/feedback).
const FEEDBACK_TAG = '[Lucent Lab Feedback]';

type SendState = 'idle' | 'sending' | 'sent' | 'error';

type Category = 'bug' | 'suggestion' | 'content' | 'praise' | 'other';

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'bug',        label: 'Bug' },
  { id: 'suggestion', label: 'Suggestion' },
  { id: 'content',    label: 'Content fix' },
  { id: 'praise',     label: 'Praise' },
  { id: 'other',      label: 'Other' },
];

export default function Feedback() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>('suggestion');
  const [body, setBody] = useState('');
  const [from, setFrom] = useState('');
  const [sendState, setSendState] = useState<SendState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // Close on Escape; click outside the panel
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const tgt = e.target as HTMLElement;
        // Don't close if the click is on the FAB itself
        if (!tgt.closest('[data-feedback-fab]')) setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open]);

  // Focus the textarea when opening
  useEffect(() => {
    if (open) setTimeout(() => taRef.current?.focus(), 60);
  }, [open]);

  function currentRoute() {
    return typeof window !== 'undefined' ? window.location.pathname + window.location.hash : '';
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || sendState === 'sending') return;
    setSendState('sending');
    setErrorMsg('');
    const catLabel = CATEGORIES.find(c => c.id === category)?.label ?? 'Other';
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          category,
          categoryLabel: catLabel,
          message: body.trim(),
          from: from.trim(),
          page: currentRoute(),
          ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server returned ${res.status}`);
      }
      setSendState('sent');
      setTimeout(() => {
        setSendState('idle');
        setOpen(false);
        setBody('');
        setFrom('');
      }, 1800);
    } catch (err: any) {
      setSendState('error');
      setErrorMsg(err?.message ?? 'Failed to send');
    }
  }

  async function copyToClipboard() {
    const catLabel = CATEGORIES.find(c => c.id === category)?.label ?? 'Other';
    const text = [
      `Subject: ${FEEDBACK_TAG} [${catLabel}] ${currentRoute()}`,
      '',
      body.trim(),
      '',
      `Category: ${catLabel} (${category})`,
      `Page: ${currentRoute()}`,
      from.trim() ? `Reply to: ${from.trim()}` : null,
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setSendState('sent');
      setTimeout(() => setSendState('idle'), 1400);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      {/* Floating action button (visible on every page) */}
      <button
        type="button"
        data-feedback-fab
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label="Send feedback"
        className="mono"
        style={{
          position: 'fixed',
          right: 22,
          bottom: 22,
          zIndex: 100,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '11px 16px',
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--paper)',
          background: 'var(--ink-1)',
          border: '1px solid var(--line-strong)',
          borderRadius: 999,
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          transition: 'transform 140ms ease, background 140ms ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
      >
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--phos)' }} />
        Feedback
      </button>

      {/* Slide-out panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Feedback form"
          aria-modal="false"
          style={{
            position: 'fixed',
            right: 22,
            bottom: 76,
            zIndex: 100,
            width: 'min(380px, calc(100vw - 44px))',
            background: 'var(--ink-0, var(--ink-1))',
            border: '1px solid var(--line-strong)',
            borderRadius: 8,
            boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="serif" style={{ fontSize: 18 }}>
              Send <em style={{ fontWeight: 300 }}>feedback</em>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close feedback"
              className="mono"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--paper-dim)',
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          <p style={{ margin: 0, fontSize: 12, color: 'var(--paper-dim)', lineHeight: 1.55 }}>
            Spotted a bug, want a feature, or have content to fix? It opens your mail app with the message pre-filled.
          </p>

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Category chips */}
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Category</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CATEGORIES.map(c => {
                  const active = category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className="mono"
                      style={{
                        padding: '5px 10px',
                        fontSize: 10,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        border: `1px solid ${active ? 'var(--phos)' : 'var(--line-strong)'}`,
                        background: active ? 'rgba(105,227,107,0.12)' : 'transparent',
                        color: active ? 'var(--phos)' : 'var(--paper-dim)',
                        borderRadius: 999,
                        cursor: 'pointer',
                      }}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="eyebrow">Message</span>
              <textarea
                ref={taRef}
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={5}
                placeholder="What's on your mind? Be as specific as you can — page, browser, what you expected vs. what happened."
                required
                style={{
                  width: '100%',
                  resize: 'vertical',
                  padding: 10,
                  background: 'var(--ink-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 4,
                  color: 'var(--paper)',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  lineHeight: 1.5,
                  outline: 'none',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--phos)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--line)'; }}
              />
            </label>

            {/* Optional reply email */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="eyebrow">Your email <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--paper-faint)' }}>(optional, if you want a reply)</span></span>
              <input
                type="email"
                value={from}
                onChange={e => setFrom(e.target.value)}
                placeholder="you@school.edu"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'var(--ink-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 4,
                  color: 'var(--paper)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12,
                  outline: 'none',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--phos)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--line)'; }}
              />
            </label>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                type="submit"
                disabled={!body.trim() || sendState === 'sending'}
                className="mono"
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  background: body.trim() ? 'var(--phos)' : 'var(--ink-2)',
                  color: body.trim() ? '#0a0908' : 'var(--paper-faint)',
                  border: '1px solid var(--line-strong)',
                  borderRadius: 4,
                  cursor: body.trim() && sendState !== 'sending' ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                }}
              >
                {sendState === 'sending' ? 'Sending…'
                  : sendState === 'sent' ? '✓ Sent'
                  : sendState === 'error' ? '↻ Retry'
                  : '↗ Send'}
              </button>
              <button
                type="button"
                onClick={copyToClipboard}
                disabled={!body.trim()}
                title="Copy the message to your clipboard"
                className="mono"
                style={{
                  padding: '10px 12px',
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  background: 'transparent',
                  color: body.trim() ? 'var(--paper)' : 'var(--paper-faint)',
                  border: '1px solid var(--line-strong)',
                  borderRadius: 4,
                  cursor: body.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Copy
              </button>
            </div>

            {/* Status / footer line */}
            {sendState === 'error' ? (
              <div className="mono" style={{ fontSize: 10, color: 'var(--hot)', letterSpacing: '0.06em', marginTop: 2 }}>
                Could not send: {errorMsg}. Try again or use Copy.
              </div>
            ) : sendState === 'sent' ? (
              <div className="mono" style={{ fontSize: 10, color: 'var(--phos)', letterSpacing: '0.06em', marginTop: 2 }}>
                ✓ Thanks — your feedback was delivered.
              </div>
            ) : (
              <div className="mono" style={{ fontSize: 9, color: 'var(--paper-faint)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 2 }}>
                → Sent to maintainer
              </div>
            )}
          </form>
        </div>
      )}
    </>
  );
}
