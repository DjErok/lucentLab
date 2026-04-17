import { useRef, useState, type CSSProperties } from 'react';

/**
 * Slider — Lucent Lab's pure-CSS-var equivalent of the 21st.dev Feedback
 * Slider. Single-thumb range with a value bubble that floats above the thumb
 * while dragging or focused. No external deps.
 */
export type SliderProps = {
  label?: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  accent?: string;
  disabled?: boolean;
  unit?: string; // optional trailing unit e.g. " mL"
};

export default function Slider({
  label, value, onChange, min, max, step = 1,
  format, accent = 'var(--phos)', disabled, unit,
}: SliderProps) {
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLInputElement | null>(null);
  const frac = (value - min) / (max - min || 1);
  const display = format ? format(value) : `${roundForStep(value, step)}${unit ?? ''}`;

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="eyebrow">{label}</span>
          <span className="mono" style={{ fontSize: 11, color: accent }}>{display}</span>
        </div>
      )}
      <div style={{ position: 'relative', height: 26 }}>
        {/* Bubble */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: `calc(${frac * 100}% )`,
            transform: 'translate(-50%, -100%)',
            top: -4,
            opacity: active ? 1 : 0,
            transition: 'opacity 120ms ease',
            pointerEvents: 'none',
            background: accent,
            color: '#0a0908',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            fontWeight: 600,
            padding: '3px 7px',
            borderRadius: 3,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          {display}
        </div>
        {/* Track */}
        <div style={trackStyle} />
        <div style={{ ...fillStyle, width: `${frac * 100}%`, background: accent }} />
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={e => onChange(parseFloat(e.target.value))}
          onPointerDown={() => setActive(true)}
          onPointerUp={() => setActive(false)}
          onFocus={() => setActive(true)}
          onBlur={() => setActive(false)}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            opacity: 0, cursor: disabled ? 'not-allowed' : 'pointer', margin: 0,
          }}
        />
        {/* Thumb (cosmetic) */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: `calc(${frac * 100}% )`,
            transform: 'translate(-50%, -50%)',
            top: '50%',
            width: active ? 16 : 12, height: active ? 16 : 12,
            borderRadius: '50%',
            background: accent,
            border: '2px solid var(--ink-1)',
            boxShadow: active ? `0 0 0 4px ${accentAlpha(accent, 0.18)}` : 'none',
            transition: 'width 120ms, height 120ms, box-shadow 120ms',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}

const trackStyle: CSSProperties = {
  position: 'absolute',
  top: '50%', left: 0, right: 0,
  height: 4, transform: 'translateY(-50%)',
  background: 'var(--ink-2)',
  border: '1px solid var(--line)',
  borderRadius: 2,
};

const fillStyle: CSSProperties = {
  position: 'absolute',
  top: '50%', left: 0,
  height: 4, transform: 'translateY(-50%)',
  borderRadius: 2,
  opacity: 0.5,
};

function roundForStep(v: number, step: number): string {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  return v.toFixed(decimals);
}

function accentAlpha(c: string, a: number): string {
  // CSS var: assume opacity controlled by external; fall back to translucent yellow.
  if (c.startsWith('var')) return `rgba(255,200,120,${a})`;
  return c;
}

// Fixed-step convenience export — matches old `<input type="range" />` usage.
export { Slider };
