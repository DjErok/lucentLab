type AtomProps = {
  symbol: string;
  size?: number;
  color: string;
  x?: number;
  y?: number;
  scale?: number;
  glow?: boolean;
};

export default function Atom({ symbol, size = 56, color, x, y, scale = 1, glow = false }: AtomProps) {
  return (
    <div
      style={{
        position: x !== undefined ? 'absolute' : 'relative',
        left: x !== undefined ? `${x}px` : undefined,
        top: y !== undefined ? `${y}px` : undefined,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: `radial-gradient(circle at 32% 30%, ${color} 0%, ${shade(color, -25)} 70%, ${shade(color, -45)} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Fraunces, serif',
        fontWeight: 600,
        fontSize: `${size * 0.38}px`,
        color: getTextColor(color),
        boxShadow: glow
          ? `0 0 0 1px rgba(0,0,0,0.5), 0 0 24px ${color}66, inset -2px -3px 6px rgba(0,0,0,0.35), inset 2px 2px 5px rgba(255,255,255,0.3)`
          : `0 0 0 1px rgba(0,0,0,0.5), 0 6px 16px rgba(0,0,0,0.5), inset -2px -3px 6px rgba(0,0,0,0.35), inset 2px 2px 5px rgba(255,255,255,0.3)`,
        transform: `scale(${scale})`,
        userSelect: 'none',
        transition: 'transform 300ms cubic-bezier(0.2,0.7,0.2,1)',
      }}
    >
      {symbol}
    </div>
  );
}

function shade(hex: string, percent: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const adj = (c: number) => Math.max(0, Math.min(255, c + (c * percent) / 100));
  return `rgb(${adj(r)}, ${adj(g)}, ${adj(b)})`;
}

function getTextColor(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.55 ? '#0a0908' : '#f5f1e8';
}
