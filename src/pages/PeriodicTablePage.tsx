import { useState } from 'react';
import { ELEMENTS, EXTRA, CATEGORY_COLOR, CATEGORY_NAME } from '../data/elements';
import type { Category, Element } from '../data/elements';

/**
 * Interactive periodic table — hover or click any element for full details.
 * Filter by category, search by name/symbol, color cells by trend.
 */

type ColorMode = 'category' | 'radius' | 'EN' | 'IE';

export default function PeriodicTablePage() {
  const [selected, setSelected] = useState<Element | null>(ELEMENTS[5]); // Carbon
  const [hover, setHover] = useState<Element | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>('category');
  const [search, setSearch] = useState('');

  const focused = hover ?? selected;

  // For trend coloring
  const trendValue = (e: Element): number | undefined => {
    const ex = EXTRA[e.z];
    if (!ex) return undefined;
    return colorMode === 'radius' ? ex.radius :
           colorMode === 'EN'     ? ex.EN     :
           colorMode === 'IE'     ? ex.IE     :
           undefined;
  };
  const allTrendVals = ELEMENTS.map(trendValue).filter((v): v is number => v !== undefined && v > 0);
  const trendMax = Math.max(...allTrendVals);
  const trendMin = Math.min(...allTrendVals);

  // Category color when in category mode; gradient when in trend mode
  const cellColor = (e: Element): { bg: string; border: string } => {
    if (colorMode === 'category') {
      const c = CATEGORY_COLOR[e.category];
      return { bg: `${c}22`, border: `${c}aa` };
    }
    const v = trendValue(e);
    if (v === undefined) return { bg: 'var(--ink-2)', border: 'var(--line)' };
    const t = (v - trendMin) / (trendMax - trendMin);
    // Use orange (high) → blue (low) gradient
    const r = Math.round(93 + t * (255 - 93));
    const g = Math.round(208 - t * (208 - 91));
    const b = Math.round(255 - t * (255 - 53));
    return { bg: `rgba(${r}, ${g}, ${b}, ${0.15 + t * 0.4})`, border: `rgba(${r}, ${g}, ${b}, 0.7)` };
  };

  // Filtering by search
  const matchesSearch = (e: Element) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.name.toLowerCase().includes(q) || e.sym.toLowerCase().includes(q) || String(e.z) === q;
  };

  return (
    <section style={{ paddingTop: 60, paddingBottom: 80 }}>
      <div className="shell">
        {/* Header */}
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow">§ Reference</div>
            <h1 className="h-display" style={{ fontSize: 'clamp(40px, 5vw, 64px)', marginTop: 8 }}>
              The Periodic <em>Table</em>
            </h1>
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)', maxWidth: 320, lineHeight: 1.6 }}>
            Hover or click any element. Switch the color mode to see periodic trends sweep across the table.
          </div>
        </div>

        {/* Controls */}
        <div className="pt-controls" role="toolbar" aria-label="Color mode and search" style={{ display: 'flex', gap: 16, marginBottom: 22, alignItems: 'center', flexWrap: 'wrap' }}>
          <div role="group" aria-label="Color mode" style={{ display: 'flex', gap: 0 }}>
            {(['category', 'radius', 'EN', 'IE'] as ColorMode[]).map((m, i) => {
              const active = colorMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setColorMode(m)}
                  aria-pressed={active}
                  className="mono"
                  style={{
                    padding: '10px 16px', fontSize: 11, letterSpacing: '0.16em',
                    textTransform: 'uppercase', border: '1px solid var(--line-strong)',
                    background: active ? 'var(--paper)' : 'transparent',
                    color: active ? 'var(--ink-0)' : 'var(--paper-dim)',
                    borderLeftWidth: i === 0 ? 1 : 0,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {m === 'category' ? 'Category' : m === 'radius' ? 'Atomic radius' : m === 'EN' ? 'Electronegativity' : 'Ionization energy'}
                </button>
              );
            })}
          </div>

          <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="visually-hidden" style={{
              position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
              overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
            }}>Search elements</span>
            <input
              type="search"
              placeholder="Search element by name, symbol, or Z…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mono"
              aria-label="Search element by name, symbol, or atomic number"
              style={{
                padding: '10px 14px', fontSize: 12,
                background: 'var(--ink-1)', border: '1px solid var(--line-strong)',
                color: 'var(--paper)', minWidth: 280, width: '100%',
                borderRadius: 4,
              }}
            />
          </label>
        </div>

        {/* Detail panel above table */}
        {focused && <DetailPanel el={focused} />}

        {/* Table */}
        <div style={{
          marginTop: 24,
          background: 'var(--ink-1)',
          border: '1px solid var(--line)',
          borderRadius: 6,
          padding: 16,
          overflowX: 'auto',
        }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(18, minmax(48px, 1fr))',
              gridAutoRows: 'minmax(56px, 60px)',
              gap: 4,
              minWidth: 920,
            }}>
              {ELEMENTS.filter(e => e.period <= 7).map((e) => (
                <Cell key={e.z} el={e}
                  color={cellColor(e)}
                  trend={colorMode !== 'category' ? trendValue(e) : undefined}
                  trendUnit={colorMode === 'radius' ? 'pm' : colorMode === 'EN' ? '' : 'kJ/mol'}
                  isSelected={selected?.z === e.z}
                  isMatched={matchesSearch(e)}
                  onHover={() => setHover(e)}
                  onLeave={() => setHover(null)}
                  onClick={() => setSelected(e)}
                />
              ))}
              {/* Placeholder markers for lanthanide/actinide series */}
              <Placeholder gridColumn={3} gridRow={6} label="57–71" title="Lanthanides (57–71) shown below" color={CATEGORY_COLOR['lanthanide']} />
              <Placeholder gridColumn={3} gridRow={7} label="89–103" title="Actinides (89–103) shown below" color={CATEGORY_COLOR['actinide']} />
            </div>

            {/* Lanthanide/actinide rows below — aligned under main table */}
            <div style={{ marginTop: 18, minWidth: 920 }}>
              <SubRow marker="*" label="Lanthanides · period 6, group 3" elements={ELEMENTS.filter(e => e.category === 'lanthanide')} cellColor={cellColor} colorMode={colorMode} trendValue={trendValue} matchesSearch={matchesSearch} selected={selected} onHover={setHover} onLeave={() => setHover(null)} onClick={setSelected} />
              <SubRow marker="**" label="Actinides · period 7, group 3" elements={ELEMENTS.filter(e => e.category === 'actinide')} cellColor={cellColor} colorMode={colorMode} trendValue={trendValue} matchesSearch={matchesSearch} selected={selected} onHover={setHover} onLeave={() => setHover(null)} onClick={setSelected} />
            </div>
          </div>
        </div>

        {/* Legend */}
        {colorMode === 'category' && (
          <div style={{ marginTop: 18, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {(Object.keys(CATEGORY_COLOR) as Category[]).map((c) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: 2,
                  background: `${CATEGORY_COLOR[c]}33`, border: `1px solid ${CATEGORY_COLOR[c]}aa`,
                }} />
                <span className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)', letterSpacing: '0.1em' }}>
                  {CATEGORY_NAME[c]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

type CellProps = {
  el: Element;
  color: { bg: string; border: string };
  trend?: number;
  trendUnit?: string;
  isSelected: boolean;
  isMatched: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
};

function Cell({ el, color, trend, trendUnit, isSelected, isMatched, onHover, onLeave, onClick }: CellProps) {
  const subLabel = trend !== undefined
    ? `${trend}${trendUnit ? ` ${trendUnit.split('/')[0]}` : ''}`
    : el.mass.toFixed(el.mass > 100 ? 1 : 2);
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onFocus={onHover}
      onBlur={onLeave}
      onClick={onClick}
      aria-label={`${el.name}, atomic number ${el.z}, mass ${el.mass}`}
      aria-pressed={isSelected}
      className="pt-cell"
      style={{
        gridColumn: el.group,
        gridRow: el.period,
        background: color.bg,
        border: `1px solid ${isSelected ? 'var(--paper)' : color.border}`,
        boxShadow: isSelected ? '0 0 0 2px var(--paper), 0 4px 14px rgba(245,241,232,0.18)' : 'none',
        borderRadius: 4,
        padding: '4px 3px',
        cursor: 'pointer',
        position: 'relative',
        opacity: isMatched ? 1 : 0.18,
        transition: 'transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease, opacity 120ms ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        font: 'inherit',
        color: 'inherit',
        overflow: 'hidden',
      }}
    >
      <span className="mono" aria-hidden="true" style={{ position: 'absolute', top: 3, left: 4, fontSize: 9, color: 'var(--paper-faint)', letterSpacing: 0 }}>
        {el.z}
      </span>
      <span className="serif" aria-hidden="true" style={{ fontSize: 20, fontWeight: 500, color: 'var(--paper)', lineHeight: 1, marginTop: 4 }}>
        {el.sym}
      </span>
      <span className="mono" aria-hidden="true" style={{ fontSize: 8.5, color: 'var(--paper-dim)', letterSpacing: 0, lineHeight: 1 }}>
        {subLabel}
      </span>
    </button>
  );
}

type SubRowProps = {
  label: string;
  marker: string;
  elements: Element[];
  cellColor: (e: Element) => { bg: string; border: string };
  colorMode: ColorMode;
  trendValue: (e: Element) => number | undefined;
  matchesSearch: (e: Element) => boolean;
  selected: Element | null;
  onHover: (e: Element) => void;
  onLeave: () => void;
  onClick: (e: Element) => void;
};

function SubRow({ label, marker, elements, cellColor, colorMode, trendValue, matchesSearch, selected, onHover, onLeave, onClick }: SubRowProps) {
  // Offset start: lanthanides begin at z=57 (atomic-number-based column 1),
  // actinides at z=89. Place under groups 3-17 of main table by mapping to 18-col grid.
  const offset = elements[0]?.z === 57 ? 56 : 88;
  return (
    <div style={{ marginTop: 10 }}>
      <div className="mono" style={{ fontSize: 9, color: 'var(--paper-faint)', letterSpacing: '0.16em', marginBottom: 6, paddingLeft: 4 }}>
        <span style={{ color: 'var(--paper-dim)', marginRight: 6 }}>{marker}</span>{label}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(18, minmax(48px, 1fr))',
        gridAutoRows: 'minmax(56px, 60px)',
        gap: 4,
        minWidth: 920,
      }}>
        {elements.map((e) => {
          const color = cellColor(e);
          const trend = colorMode !== 'category' ? trendValue(e) : undefined;
          const trendUnit = colorMode === 'radius' ? 'pm' : colorMode === 'EN' ? '' : 'kJ/mol';
          // Place lanthanides under columns 3-17 of main table (15 cells starting at column 3)
          const subCol = e.z - offset + 2;
          return (
            <Cell key={e.z} el={{ ...e, group: subCol, period: 1 }}
              color={color}
              trend={trend}
              trendUnit={trendUnit}
              isSelected={selected?.z === e.z}
              isMatched={matchesSearch(e)}
              onHover={() => onHover(e)}
              onLeave={onLeave}
              onClick={() => onClick(e)}
            />
          );
        })}
      </div>
    </div>
  );
}

function Placeholder({ gridColumn, gridRow, label, title, color }: { gridColumn: number; gridRow: number; label: string; title: string; color: string }) {
  return (
    <div
      aria-hidden="true"
      title={title}
      style={{
        gridColumn,
        gridRow,
        border: `1px dashed ${color}88`,
        background: `${color}11`,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: `${color}cc`,
        fontFamily: 'JetBrains Mono',
        fontSize: 10,
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </div>
  );
}

function DetailPanel({ el }: { el: Element }) {
  const ex = EXTRA[el.z];
  const c = CATEGORY_COLOR[el.category];
  return (
    <div className="pt-detail" style={{
      background: 'var(--ink-1)',
      border: `1px solid var(--line)`,
      borderRadius: 6,
      padding: 24,
      display: 'grid',
      gridTemplateColumns: '1fr 2fr 1.5fr',
      gap: 32,
      alignItems: 'flex-start',
    }}>
      {/* Big card */}
      <div style={{
        position: 'relative',
        padding: 20, borderRadius: 4,
        background: `${c}11`,
        border: `1px solid ${c}66`,
        minHeight: 180,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        <div className="mono" style={{ fontSize: 12, color: c, letterSpacing: '0.16em' }}>{el.z}</div>
        <div>
          <div className="serif" style={{ fontSize: 64, lineHeight: 1, color: 'var(--paper)', fontWeight: 500 }}>{el.sym}</div>
          <div className="serif" style={{ fontSize: 18, color: 'var(--paper-dim)', marginTop: 6, fontStyle: 'italic' }}>{el.name}</div>
        </div>
        <div className="mono" style={{ fontSize: 12, color: c, letterSpacing: '0.14em' }}>{el.mass} g/mol</div>
      </div>

      {/* Stats column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Stat label="Category" value={CATEGORY_NAME[el.category]} accent={c} />
        <Stat label="Group / Period" value={`${el.group} · ${el.period}`} />
        <Stat label="Electron config." value={el.cfg} mono />
        {ex?.radius && <Stat label="Atomic radius" value={`${ex.radius} pm`} />}
        {ex?.EN !== undefined && <Stat label="Electronegativity" value={ex.EN > 0 ? ex.EN.toFixed(2) : 'n/a'} />}
        {ex?.IE && <Stat label="1st ionization energy" value={`${ex.IE} kJ/mol`} />}
        {ex?.melt !== undefined && <Stat label="Melting point" value={`${ex.melt} K`} />}
        {ex?.boil !== undefined && <Stat label="Boiling point" value={`${ex.boil} K`} />}
        {ex?.density !== undefined && <Stat label="Density" value={`${ex.density} g/cm³`} />}
      </div>

      {/* Visual: shell diagram */}
      <ShellDiagram el={el} accent={c} />
    </div>
  );
}

function Stat({ label, value, accent, mono }: { label: string; value: string; accent?: string; mono?: boolean }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div className={mono ? 'mono' : 'serif'} style={{ fontSize: mono ? 12 : 18, color: accent ?? 'var(--paper)' }}>{value}</div>
    </div>
  );
}

function ShellDiagram({ el, accent }: { el: Element; accent: string }) {
  // Build shell electron counts from electron config (simplified)
  // Shell capacities (ignoring d/f subtleties): 2, 8, 18, 32, ...
  // We compute by parsing config — but simpler: assign electrons to shells by Z, max per shell
  const shells: number[] = [];
  let remaining = el.z;
  const caps = [2, 8, 18, 32, 32, 32, 32];
  for (const cap of caps) {
    if (remaining <= 0) break;
    const n = Math.min(cap, remaining);
    shells.push(n);
    remaining -= n;
  }

  return (
    <div style={{
      position: 'relative',
      aspectRatio: '1 / 1',
      background: `radial-gradient(circle at 50% 50%, ${accent}11 0%, transparent 70%)`,
      borderRadius: 6,
    }}>
      <svg viewBox="-100 -100 200 200" style={{ width: '100%', height: '100%' }}>
        <defs>
          <radialGradient id={`pt-nuc-${el.z}`}>
            <stop offset="0%" stopColor="#fff4d2" />
            <stop offset="100%" stopColor={accent} />
          </radialGradient>
        </defs>

        {/* Shells as circles */}
        {shells.map((count, i) => {
          const r = 14 + (i + 1) * 11;
          const electrons = [];
          for (let k = 0; k < count; k++) {
            const angle = (k / count) * Math.PI * 2 - Math.PI / 2;
            const ex = r * Math.cos(angle);
            const ey = r * Math.sin(angle);
            electrons.push(<circle key={k} cx={ex} cy={ey} r="2.2" fill="#5dd0ff" />);
          }
          return (
            <g key={i}>
              <circle cx="0" cy="0" r={r} fill="none" stroke="rgba(245,241,232,0.18)" strokeWidth="0.5" />
              {electrons}
            </g>
          );
        })}

        {/* Nucleus */}
        <circle cx="0" cy="0" r="11" fill={`url(#pt-nuc-${el.z})`} />
        <text x="0" y="3" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="6" fill="#0a0908">
          {el.z}
        </text>
      </svg>
      <div className="mono" style={{
        position: 'absolute', bottom: 6, left: 0, right: 0,
        textAlign: 'center', fontSize: 10, color: 'var(--paper-dim)',
        letterSpacing: '0.14em',
      }}>
        SHELLS: {shells.join(' · ')}
      </div>
    </div>
  );
}
