export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--line)',
      marginTop: 80,
      padding: '40px 0 60px',
    }}>
      <div className="shell footer-grid" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 40, flexWrap: 'wrap' }}>
        <div>
          <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>
            Lucent <em style={{ fontWeight: 300 }}>Lab</em>
          </div>
          <div style={{ color: 'var(--paper-dim)', fontSize: 13, maxWidth: 320 }}>
            A visual atlas for AP Chemistry. Built for students who learn by watching the molecules move.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 40 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Curriculum</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)', lineHeight: 2 }}>
              <div>9 units</div>
              <div>54 topics</div>
              <div>15+ live animations</div>
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Reference</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--paper-dim)', lineHeight: 2 }}>
              <div>College Board CED</div>
              <div>OpenStax Chemistry</div>
              <div>NIST WebBook</div>
            </div>
          </div>
        </div>

        <div className="mono" style={{ fontSize: 10, color: 'var(--paper-faint)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          © 2026 · For educational use
        </div>
      </div>
    </footer>
  );
}
