import type { ReactNode } from 'react';

/**
 * Wrapper that frames each animation with student-facing context:
 * - What you're seeing
 * - Why it matters (AP-relevant takeaway)
 * - Key terms / equations
 */

type Props = {
  title: string;
  unitTag: string;
  whatYouSee: string;
  whyItMatters: string;
  keyTerms?: string[];
  equation?: string;
  children: ReactNode;
};

export default function AnimationFrame({ title, unitTag, whatYouSee, whyItMatters, keyTerms, equation, children }: Props) {
  return (
    <section style={{
      borderTop: '1px solid var(--line)',
      paddingTop: 40,
      marginTop: 40,
    }}>
      <div className="animframe-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 48, marginBottom: 28 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{unitTag}</div>
          <h3 className="serif" style={{ fontSize: 36, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
            {title}
          </h3>
          {equation && (
            <div className="mono" style={{
              marginTop: 14,
              padding: '8px 14px',
              border: '1px solid var(--line-strong)',
              borderRadius: 4,
              display: 'inline-block',
              fontSize: 13,
              color: 'var(--paper)',
            }}>
              {equation}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <Block label="What you're seeing" body={whatYouSee} />
          <Block label="Why it matters" body={whyItMatters} accent />
          {keyTerms && keyTerms.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {keyTerms.map((k) => (
                <span key={k} className="tag"><span className="dot" />{k}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        {children}
      </div>
    </section>
  );
}

function Block({ label, body, accent }: { label: string; body: string; accent?: boolean }) {
  return (
    <div style={{ borderLeft: `2px solid ${accent ? 'var(--oxygen)' : 'var(--line-strong)'}`, paddingLeft: 14 }}>
      <div className="eyebrow" style={{ color: accent ? 'var(--oxygen)' : 'var(--paper-dim)', marginBottom: 4 }}>{label}</div>
      <div style={{ color: 'var(--paper)', fontSize: 15, lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}
