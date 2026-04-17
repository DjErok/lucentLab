import { Link, useParams } from 'react-router-dom';
import { UNITS } from '../data/curriculum';
import { ANIMATIONS } from '../animations/registry';
import AnimationFrame from '../components/AnimationFrame';
import { useEffect } from 'react';

export default function UnitPage() {
  const { slug } = useParams<{ slug: string }>();
  const unit = UNITS.find((u) => u.slug === slug);

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);

  if (!unit) {
    return (
      <div className="shell" style={{ padding: '120px 32px' }}>
        <div className="eyebrow">404</div>
        <h2 className="h-display" style={{ fontSize: 64, marginTop: 12 }}>Unit not found.</h2>
        <Link to="/" className="btn btn-ghost" style={{ marginTop: 24 }}>← Back to atlas</Link>
      </div>
    );
  }

  const idx = UNITS.findIndex((u) => u.slug === unit.slug);
  const prev = idx > 0 ? UNITS[idx - 1] : null;
  const next = idx < UNITS.length - 1 ? UNITS[idx + 1] : null;

  return (
    <>
      {/* HEADER */}
      <section style={{ borderBottom: '1px solid var(--line)', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{
          position: 'absolute', top: -100, right: -150,
          width: 500, height: 500,
          background: `radial-gradient(circle, ${unit.hue}33 0%, transparent 60%)`,
          pointerEvents: 'none',
        }} />

        <div className="shell" style={{ paddingTop: 80, paddingBottom: 60, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
            <Link to="/" className="mono" style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--paper-dim)', textTransform: 'uppercase' }}>
              ← Atlas
            </Link>
            <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)', letterSpacing: '0.16em' }}>
              {idx + 1} / {UNITS.length}
            </div>
          </div>

          <div className="unit-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'end' }}>
            <div>
              <div className="mono" style={{ fontSize: 12, color: unit.hue, letterSpacing: '0.18em', marginBottom: 10 }}>
                UNIT {unit.number} · WEIGHT {unit.weight}
              </div>
              <h1 className="h-display" style={{ fontSize: 'clamp(48px, 6vw, 80px)' }}>
                {unit.title.split(' ').slice(0, -1).join(' ')} <em>{unit.title.split(' ').slice(-1)}</em>
              </h1>
              <p style={{ marginTop: 20, fontSize: 19, color: 'var(--paper-dim)', maxWidth: 540, lineHeight: 1.55 }}>
                {unit.subtitle}
              </p>
            </div>

            {/* Topics index */}
            <div>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Topics in this unit</div>
              <ol style={{ listStyle: 'none' }}>
                {unit.topics.map((t, i) => (
                  <li key={t.id}>
                    <a
                      href={`#topic-${t.id}`}
                      className="topic-link"
                      style={{
                        display: 'flex', alignItems: 'baseline', gap: 8,
                        padding: '10px 6px',
                        borderTop: i === 0 ? '1px solid var(--line)' : 'none',
                        borderBottom: '1px solid var(--line)',
                        transition: 'background 150ms ease, color 150ms ease',
                        borderRadius: 2,
                      }}
                    >
                      <span className="mono" aria-hidden="true" style={{ width: 50, fontSize: 11, color: 'var(--paper-faint)' }}>{t.id}</span>
                      <span className="serif" style={{ flex: 1, fontSize: 16 }}>{t.title}</span>
                      {t.animationKey && (
                        <span className="mono" aria-label="has animation" style={{ fontSize: 10, color: unit.hue, letterSpacing: '0.16em' }}>
                          ▶ ANIM
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* TOPICS WITH ANIMATIONS */}
      <section style={{ paddingTop: 60, paddingBottom: 60 }}>
        <div className="shell">
          {(() => {
            // Deduplicate: when the same animationKey is reused inside one unit
            // (e.g. heat-transfer + calorimetry both demoed by Calorimetry's
            // mixing-waters and coffee-cup tabs), render the full animation only
            // for the first topic and show a "see above" pointer for the rest.
            const firstSeenTopicId = new Map<string, string>();
            return unit.topics.map((topic) => {
              if (!topic.animationKey) return (
                <article key={topic.id} id={`topic-${topic.id}`} style={{ borderTop: '1px solid var(--line)', paddingTop: 40, marginTop: 40 }}>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>TOPIC {topic.id}</div>
                  <h3 className="serif" style={{ fontSize: 32, fontWeight: 400, letterSpacing: '-0.015em' }}>
                    {topic.title}
                  </h3>
                  <p style={{ marginTop: 12, color: 'var(--paper-dim)', maxWidth: 720, fontSize: 16, lineHeight: 1.6 }}>
                    {topic.blurb}
                  </p>
                </article>
              );

              const anim = ANIMATIONS[topic.animationKey];
              if (!anim) return null;

              const seenIn = firstSeenTopicId.get(topic.animationKey);
              if (seenIn) {
                return (
                  <article key={topic.id} id={`topic-${topic.id}`} style={{ borderTop: '1px solid var(--line)', paddingTop: 40, marginTop: 40 }}>
                    <div className="eyebrow" style={{ marginBottom: 8 }}>TOPIC {topic.id}</div>
                    <h3 className="serif" style={{ fontSize: 28, fontWeight: 400, letterSpacing: '-0.015em' }}>
                      {topic.title}
                    </h3>
                    <p style={{ marginTop: 12, color: 'var(--paper-dim)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
                      {topic.blurb}
                    </p>
                    <a href={`#topic-${seenIn}`} className="mono" style={{
                      display: 'inline-block', marginTop: 16,
                      padding: '10px 14px', fontSize: 11, letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      border: '1px solid var(--line-strong)',
                      color: 'var(--paper)', textDecoration: 'none', borderRadius: 4,
                    }}>
                      ↑ See {anim.title} (Topic {seenIn})
                    </a>
                  </article>
                );
              }
              firstSeenTopicId.set(topic.animationKey, topic.id);

              const C = anim.Component;
              return (
                <article key={topic.id} id={`topic-${topic.id}`}>
                  <AnimationFrame
                    title={anim.title}
                    unitTag={`UNIT ${unit.number} · TOPIC ${topic.id}`}
                    whatYouSee={anim.whatYouSee}
                    whyItMatters={anim.whyItMatters}
                    keyTerms={anim.keyTerms}
                    equation={anim.equation}
                  >
                    <C />
                  </AnimationFrame>
                </article>
              );
            });
          })()}
        </div>
      </section>

      {/* PREV / NEXT */}
      <section style={{ borderTop: '1px solid var(--line)', padding: '40px 0' }}>
        <div className="shell unit-prevnext" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {prev ? (
            <Link to={`/unit/${prev.slug}`} style={{
              padding: 24, border: '1px solid var(--line)', borderRadius: 6,
              display: 'block', background: 'var(--ink-1)',
            }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>← PREVIOUS · UNIT {prev.number}</div>
              <div className="serif" style={{ fontSize: 22 }}>{prev.title}</div>
            </Link>
          ) : <div />}
          {next ? (
            <Link to={`/unit/${next.slug}`} style={{
              padding: 24, border: '1px solid var(--line)', borderRadius: 6,
              display: 'block', background: 'var(--ink-1)', textAlign: 'right',
            }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>NEXT · UNIT {next.number} →</div>
              <div className="serif" style={{ fontSize: 22 }}>{next.title}</div>
            </Link>
          ) : <div />}
        </div>
      </section>
    </>
  );
}
