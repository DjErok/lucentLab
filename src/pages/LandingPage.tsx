import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { UNITS } from '../data/curriculum';
import EndoExo from '../animations/EndoExo';
import AnimationFrame from '../components/AnimationFrame';

export default function LandingPage() {
  return (
    <>
      {/* HERO */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="shell" style={{ paddingTop: 80, paddingBottom: 100, position: 'relative' }}>
          {/* Decorative orbital — sits behind the stats panel, hidden on small screens */}
          <LazyAtom />

          <div className="hero-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 760px) 1fr', gap: 60, alignItems: 'end' }}>
            <div>
              <div className="eyebrow fade-up" style={{ animationDelay: '0ms' }}>
                Vol. I · 2026 · Edition for AP Students
              </div>
              <h1 className="h-display fade-up" style={{
                fontSize: 'clamp(56px, 8vw, 120px)',
                marginTop: 18,
                animationDelay: '120ms',
              }}>
                The chemistry<br />
                <em>that you can</em><br />
                watch unfold.
              </h1>

              <p className="fade-up" style={{
                marginTop: 32,
                maxWidth: 520,
                fontSize: 18,
                lineHeight: 1.55,
                color: 'var(--paper-dim)',
                animationDelay: '240ms',
              }}>
                A visual atlas for the entire AP Chemistry curriculum. Particulate-level
                animations, live energy diagrams, and interactive simulations for every
                concept on the exam — built so the molecules tell their own story.
              </p>

              <div className="fade-up" style={{ marginTop: 36, display: 'flex', gap: 14, animationDelay: '360ms' }}>
                <a href="#units" className="btn btn-primary">
                  Browse 9 Units
                  <span>→</span>
                </a>
                <a href="#preview" className="btn btn-ghost">
                  See an animation
                </a>
              </div>
            </div>

            {/* Stats panel */}
            <div className="fade-up" style={{ animationDelay: '480ms', position: 'relative', zIndex: 2, background: 'var(--ink-0)', padding: 16, borderRadius: 6 }}>
              <div className="hairline" style={{ marginBottom: 20 }} />
              {[
                { k: 'Units mapped', v: '9 / 9' },
                { k: 'Topics covered', v: '54' },
                { k: 'Live animations', v: '15+' },
                { k: 'Aligned with', v: 'CED 2024' },
              ].map((s, i) => (
                <div key={s.k} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  padding: '10px 0', borderBottom: i === 3 ? 'none' : '1px solid var(--line)',
                }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{s.k}</span>
                  <span className="serif" style={{ fontSize: 22, color: 'var(--paper)' }}>{s.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE OF ELEMENTS */}
      <ElementMarquee />

      {/* UNITS GRID */}
      <section id="units" style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="shell">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 36, gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div className="eyebrow">§ Curriculum</div>
              <h2 className="h-display" style={{ fontSize: 56, marginTop: 8 }}>
                Nine units. <em>One atlas.</em>
              </h2>
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)', maxWidth: 320, lineHeight: 1.6, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Aligned 1:1 with the College Board's AP Chemistry Course & Exam Description.
            </div>
          </div>

          <div className="units-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {UNITS.map((u, i) => (
              <Link
                key={u.slug}
                to={`/unit/${u.slug}`}
                className="fade-up unit-card"
                aria-label={`Unit ${u.number}: ${u.title}`}
                style={{
                  ['--hue' as string]: u.hue,
                  display: 'block',
                  position: 'relative',
                  background: 'var(--ink-1)',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  padding: 28,
                  minHeight: 240,
                  transition: 'background 200ms ease, border-color 200ms ease, transform 200ms ease',
                  animationDelay: `${i * 60}ms`,
                  overflow: 'hidden',
                } as React.CSSProperties}
              >
                <div style={{
                  position: 'absolute', top: 0, right: 0, width: 200, height: 200,
                  background: `radial-gradient(circle, ${u.hue}33 0%, transparent 70%)`,
                  pointerEvents: 'none',
                }} />

                <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="mono" style={{ fontSize: 11, color: u.hue, letterSpacing: '0.18em' }}>
                    UNIT {u.number}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)', letterSpacing: '0.12em' }}>
                    {u.weight}
                  </div>
                </div>

                <h3 className="serif" style={{
                  position: 'relative',
                  fontSize: 26,
                  fontWeight: 400,
                  letterSpacing: '-0.015em',
                  lineHeight: 1.1,
                  marginTop: 24,
                  color: 'var(--paper)',
                }}>
                  {u.title}
                </h3>

                <p style={{ position: 'relative', color: 'var(--paper-dim)', fontSize: 14, lineHeight: 1.5, marginTop: 12 }}>
                  {u.subtitle}
                </p>

                <div style={{
                  position: 'relative',
                  marginTop: 22,
                  paddingTop: 16,
                  borderTop: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)' }}>
                    {u.topics.length} topics
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--paper)' }}>
                    {u.topics.filter(t => t.animationKey).length} animations →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PREVIEW ANIMATION */}
      <section id="preview" style={{ paddingTop: 80, paddingBottom: 60 }}>
        <div className="shell">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div className="eyebrow">§ Featured · Unit 6</div>
              <h2 className="h-display" style={{ fontSize: 56, marginTop: 8 }}>
                See it once. <em>Understand it forever.</em>
              </h2>
            </div>
            <Link to="/unit/thermodynamics" className="btn btn-ghost">
              Open Unit 6 →
            </Link>
          </div>

          <AnimationFrame
            title="Endothermic vs Exothermic"
            unitTag="UNIT 6 · THERMODYNAMICS · TOPIC 6.1"
            equation="ΔH < 0 → exothermic     ·     ΔH > 0 → endothermic"
            whatYouSee="Two synchronized panels. On the left, four reactant molecules collide, pass through a transition state, and form products. On the right, a marble traces the same reaction along its potential-energy diagram — climbing the activation barrier, then falling to the product level."
            whyItMatters="The sign of ΔH tells you which way energy flows between the system and its surroundings. When the products sit lower than the reactants, energy is released as heat (the surroundings get warmer). When they sit higher, the system absorbs heat from the surroundings. This single idea unlocks calorimetry, Hess's law, and bond-energy calculations."
            keyTerms={['ΔH', 'activation energy', 'transition state', 'q', 'system vs. surroundings']}
          >
            <LazyEndoExo />
          </AnimationFrame>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" style={{ padding: '100px 0 40px' }}>
        <div className="shell about-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 60 }}>
          <div>
            <div className="eyebrow">§ About</div>
            <h2 className="h-display" style={{ fontSize: 48, marginTop: 8 }}>
              Built for the<br /><em>AP exam.</em>
            </h2>
          </div>
          <div style={{ display: 'grid', gap: 22 }}>
            <Principle
              n="01"
              title="Particulate-first"
              body="Every concept is shown at the molecular level, not just abstract symbols. You see the bonds break, the electrons move, the ions float free."
            />
            <Principle
              n="02"
              title="Synchronized graphs"
              body="Each animation pairs the molecular view with its graph form — pH curves, energy diagrams, concentration plots — so you build the bridge between symbol and reality."
            />
            <Principle
              n="03"
              title="Aligned to the CED"
              body="Topics map directly to the College Board's Course & Exam Description. If it's tested, it's here."
            />
          </div>
        </div>
      </section>
    </>
  );
}

function useInView<T extends Element>(rootMargin = '200px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    let fired = false;
    const io = new IntersectionObserver(([e]) => { fired = true; setInView(e.isIntersecting); }, { rootMargin });
    io.observe(el);
    // Defensive: if IO never fires (some embedded/headless envs), mount anyway after a beat.
    const fallback = window.setTimeout(() => { if (!fired) setInView(true); }, 800);
    return () => { io.disconnect(); window.clearTimeout(fallback); };
  }, [rootMargin]);
  return [ref, inView] as const;
}

function LazyAtom() {
  const [ref, inView] = useInView<HTMLDivElement>('200px');
  return (
    <div
      ref={ref}
      aria-hidden
      className="hide@md"
      style={{
        position: 'absolute', top: 120, right: 'clamp(220px, 22vw, 380px)',
        width: 'clamp(220px, 26vw, 360px)',
        aspectRatio: '1 / 1',
        opacity: 0.45,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {inView && <DecorativeAtom />}
    </div>
  );
}

function LazyEndoExo() {
  const [ref, inView] = useInView<HTMLDivElement>('300px');
  return (
    <div ref={ref} style={{ minHeight: 480 }}>
      {inView ? <EndoExo /> : null}
    </div>
  );
}

function Principle({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '60px 1fr', gap: 24,
      borderTop: '1px solid var(--line)', paddingTop: 18,
    }}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)', letterSpacing: '0.18em' }}>{n}</div>
      <div>
        <h4 className="serif" style={{ fontSize: 24, fontWeight: 400, color: 'var(--paper)', marginBottom: 8 }}>{title}</h4>
        <p style={{ color: 'var(--paper-dim)', fontSize: 15, lineHeight: 1.55 }}>{body}</p>
      </div>
    </div>
  );
}

function ElementMarquee() {
  const items = [
    { sym: 'H', n: 1, m: '1.008', col: '#f0e6d2' },
    { sym: 'C', n: 6, m: '12.011', col: '#7f6f5b' },
    { sym: 'N', n: 7, m: '14.007', col: '#4ea8ff' },
    { sym: 'O', n: 8, m: '15.999', col: '#ff5b3c' },
    { sym: 'Na', n: 11, m: '22.990', col: '#c084fc' },
    { sym: 'Cl', n: 17, m: '35.45', col: '#69e36b' },
    { sym: 'Fe', n: 26, m: '55.845', col: '#d97757' },
    { sym: 'Cu', n: 29, m: '63.546', col: '#5dd0ff' },
    { sym: 'Au', n: 79, m: '196.967', col: '#fbbf24' },
  ];
  return (
    <div style={{
      borderTop: '1px solid var(--line)',
      borderBottom: '1px solid var(--line)',
      overflow: 'hidden',
      background: 'var(--ink-1)',
    }}>
      <div style={{
        display: 'flex',
        gap: 0,
        animation: 'marquee 40s linear infinite',
        whiteSpace: 'nowrap',
      }}>
        {[...items, ...items, ...items].map((e, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 28px',
            borderRight: '1px solid var(--line)',
            flexShrink: 0,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 4,
              border: `1px solid ${e.col}66`,
              background: `${e.col}11`,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Fraunces',
              color: e.col,
            }}>
              <div style={{ fontSize: 8, opacity: 0.6, marginBottom: -2 }}>{e.n}</div>
              <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1 }}>{e.sym}</div>
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--paper-dim)', letterSpacing: '0.1em' }}>
              {e.m} g/mol
            </div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}

function DecorativeAtom() {
  // Each orbit is a <g> rotated by a fixed angle. Inside that group, an electron
  // follows the un-rotated elliptical path via animateMotion. This guarantees
  // that the electron actually travels around the ellipse.
  const orbits = [
    { rot:   0, rx: 70,  ry: 22, dur: 5.5, dir: 1 },
    { rot:  60, rx: 80,  ry: 25, dur: 7.5, dir: -1 },
    { rot: 120, rx: 90,  ry: 28, dur: 9,   dir: 1 },
    { rot:  30, rx: 100, ry: 32, dur: 11,  dir: -1 },
  ];

  return (
    <svg viewBox="-130 -130 260 260" width="100%" height="100%">
      <defs>
        <radialGradient id="hero-nuc" cx="0.4" cy="0.4">
          <stop offset="0%" stopColor="#fff4d2" />
          <stop offset="40%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#ff5b3c" />
        </radialGradient>
        <radialGradient id="hero-elec">
          <stop offset="0%" stopColor="#a8e7ff" />
          <stop offset="100%" stopColor="#5dd0ff" />
        </radialGradient>
      </defs>

      {/* Orbits */}
      {orbits.map((o, i) => {
        // Build the closed elliptical path the electron will follow.
        // Two consecutive arcs to make a full ellipse.
        const path = `M ${o.rx} 0 A ${o.rx} ${o.ry} 0 1 ${o.dir > 0 ? 1 : 0} -${o.rx} 0 A ${o.rx} ${o.ry} 0 1 ${o.dir > 0 ? 1 : 0} ${o.rx} 0 Z`;

        return (
          <g key={i} transform={`rotate(${o.rot})`}>
            {/* Orbit line */}
            <ellipse
              cx="0" cy="0" rx={o.rx} ry={o.ry}
              fill="none"
              stroke="rgba(245,241,232,0.25)"
              strokeWidth="0.6"
            />
            {/* Electron */}
            <circle r="3.6" fill="url(#hero-elec)">
              <animateMotion
                dur={`${o.dur}s`}
                repeatCount="indefinite"
                path={path}
                calcMode="linear"
                begin={`-${(i * o.dur) / orbits.length}s`}
              />
            </circle>
          </g>
        );
      })}

      {/* Nucleus on top */}
      <circle cx="0" cy="0" r="16" fill="url(#hero-nuc)" />
    </svg>
  );
}
