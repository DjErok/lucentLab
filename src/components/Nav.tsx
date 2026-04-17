import { Link, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { UNITS } from '../data/curriculum';

export default function Nav() {
  const loc = useLocation();
  const isHome = loc.pathname === '/';
  const isTable = loc.pathname === '/table';
  const isUnit = loc.pathname.startsWith('/unit/');
  const activeUnit = isUnit ? UNITS.find(u => loc.pathname.endsWith('/' + u.slug)) : null;

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(10,9,8,0.96)',
      borderBottom: '1px solid var(--line)',
    }}>
      <div className="shell" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 64,
        gap: 16,
      }}>
        <Link to="/" aria-label="Lucent Lab — home" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <Logo />
          <div style={{ minWidth: 0 }}>
            <div className="serif" style={{ fontSize: 16, lineHeight: 1, letterSpacing: '-0.01em' }}>
              Lucent <em style={{ fontWeight: 300 }}>Lab</em>
            </div>
            <div className="mono" style={{ fontSize: 9, color: 'var(--paper-faint)', letterSpacing: '0.18em', marginTop: 2 }}>
              AP CHEMISTRY · VISUAL ATLAS
            </div>
          </div>
        </Link>

        <nav aria-label="Primary" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Link
            to="/"
            aria-current={isHome ? 'page' : undefined}
            className="mono nav-link"
            style={{
              fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
              color: isHome ? 'var(--paper)' : 'var(--paper-dim)',
            }}
          >
            Atlas
          </Link>
          <Link
            to="/table"
            aria-current={isTable ? 'page' : undefined}
            className="mono nav-link"
            style={{
              fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
              color: isTable ? 'var(--paper)' : 'var(--paper-dim)',
            }}
          >
            Periodic Table
          </Link>

          <UnitsDropdown active={activeUnit?.slug ?? null} />

          <span className="tag hide@md" aria-hidden="true">
            <span className="dot" style={{ background: 'var(--phos)' }} />v1.1
          </span>
        </nav>
      </div>
    </header>
  );
}

function UnitsDropdown({ active }: { active: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="mono nav-link"
        style={{
          fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
          background: 'transparent', border: 'none',
          color: active || open ? 'var(--paper)' : 'var(--paper-dim)',
          cursor: 'pointer', padding: 0,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
      >
        9 Units
        <span aria-hidden style={{ fontSize: 8, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 120ms' }}>▼</span>
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 12px)',
            minWidth: 360,
            background: 'var(--ink-1)',
            border: '1px solid var(--line-strong)',
            borderRadius: 6,
            padding: 6,
            boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
            display: 'grid', gap: 2,
          }}
        >
          {UNITS.map(u => {
            const isActive = u.slug === active;
            return (
              <Link
                key={u.slug}
                to={`/unit/${u.slug}`}
                role="menuitem"
                onClick={() => setOpen(false)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr auto',
                  gap: 12, alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: 4,
                  textDecoration: 'none',
                  background: isActive ? 'rgba(245,241,232,0.06)' : 'transparent',
                  borderLeft: `2px solid ${isActive ? u.hue : 'transparent'}`,
                  transition: 'background 120ms',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,241,232,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isActive ? 'rgba(245,241,232,0.06)' : 'transparent'; }}
              >
                <span className="mono" style={{ fontSize: 11, color: u.hue, letterSpacing: '0.12em' }}>{u.number}</span>
                <span style={{ minWidth: 0 }}>
                  <div className="serif" style={{ fontSize: 14, color: 'var(--paper)', lineHeight: 1.2 }}>{u.title}</div>
                  <div className="mono" style={{ fontSize: 9, color: 'var(--paper-faint)', letterSpacing: '0.14em', marginTop: 2, textTransform: 'uppercase' }}>{u.weight}</div>
                </span>
                <span aria-hidden style={{ color: 'var(--paper-faint)', fontSize: 11 }}>→</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="3" fill="var(--oxygen)" />
      <ellipse cx="16" cy="16" rx="13" ry="5" stroke="var(--paper)" strokeWidth="0.7" opacity="0.7" />
      <ellipse cx="16" cy="16" rx="13" ry="5" stroke="var(--paper)" strokeWidth="0.7" opacity="0.5" transform="rotate(60 16 16)" />
      <ellipse cx="16" cy="16" rx="13" ry="5" stroke="var(--paper)" strokeWidth="0.7" opacity="0.3" transform="rotate(120 16 16)" />
    </svg>
  );
}
