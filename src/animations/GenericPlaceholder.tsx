/**
 * Used for topics that share/link to other animations.
 * Shows a tasteful informative card.
 */
type Props = { title: string; blurb: string; equation?: string };

export default function GenericPlaceholder({ title, blurb, equation }: Props) {
  return (
    <div style={{
      background: 'var(--ink-1)',
      border: '1px solid var(--line)',
      borderRadius: 6,
      padding: 48,
      minHeight: 320,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      gap: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 50% 50%, rgba(255,107,53,0.05) 0%, transparent 60%)',
      }} />
      <div className="eyebrow" style={{ position: 'relative' }}>Concept · in development</div>
      <div className="serif" style={{ fontSize: 36, fontStyle: 'italic', position: 'relative', maxWidth: 520, lineHeight: 1.1 }}>{title}</div>
      <div style={{ color: 'var(--paper-dim)', maxWidth: 460, fontSize: 15, lineHeight: 1.55, position: 'relative' }}>{blurb}</div>
      {equation && (
        <div className="mono" style={{ marginTop: 8, padding: '10px 18px', border: '1px solid var(--line-strong)', borderRadius: 4, fontSize: 14, color: 'var(--paper)' }}>
          {equation}
        </div>
      )}
    </div>
  );
}
