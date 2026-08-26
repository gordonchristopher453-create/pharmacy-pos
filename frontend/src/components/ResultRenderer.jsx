import { FlaskConical, AlertTriangle, CheckCircle, ArrowUp, ArrowDown } from 'lucide-react';

const FLAG_COLORS = {
  high: { bg: '#ef444415', text: '#ef4444', icon: ArrowUp, label: 'HIGH' },
  low: { bg: '#3b82f615', text: '#3b82f6', icon: ArrowDown, label: 'LOW' },
  normal: { bg: '#10b98115', text: '#10b981', icon: CheckCircle, label: 'Normal' },
};

export default function ResultRenderer({ result, testName }) {
  if (!result) return <div style={{ color:'var(--text-muted)', fontSize:13 }}>No results</div>;

  // Check if result is structured template output (has sections with params)
  const hasTemplate = result.includes('Results:') && result.includes(':');

  if (!hasTemplate) {
    // Simple text result
    return (
      <pre style={{ whiteSpace:'pre-wrap', fontSize:13, color:'var(--text-primary)', background:'var(--bg-elevated)', padding:16, borderRadius:10, lineHeight:1.7, fontFamily:'DM Sans, sans-serif', margin:0 }}>
        {result}
      </pre>
    );
  }

  // Parse template sections
  const sections = [];
  const lines = result.split('\n');
  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.endsWith('Results:')) {
      // Title
      continue;
    }

    if (trimmed.endsWith(':') && !trimmed.startsWith('  ')) {
      // Section header
      currentSection = { title: trimmed.replace(':', ''), rows: [] };
      sections.push(currentSection);
      continue;
    }

    // Parse row: "  Param: Value Unit (Ref: X - Y) [FLAG]"
    const match = trimmed.match(/^(.+?):\s*(.+?)\s+(.+?)\s+\(Ref:\s*([^)]+)\)\s*\[(.+?)\]$/);
    if (match && currentSection) {
      const [, param, value, unit, refRange, flag] = match;
      currentSection.rows.push({ param: param.trim(), value: value.trim(), unit: unit.trim(), refRange: refRange.trim(), flag: flag.trim() });
    }
  }

  if (sections.length === 0) {
    return (
      <pre style={{ whiteSpace:'pre-wrap', fontSize:13, color:'var(--text-primary)', background:'var(--bg-elevated)', padding:16, borderRadius:10, lineHeight:1.7, fontFamily:'DM Sans, sans-serif', margin:0 }}>
        {result}
      </pre>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {sections.map((section, si) => (
        <div key={si} style={{ background:'var(--bg-elevated)', borderRadius:12, border:'1px solid var(--border)', overflow:'hidden' }}>
          <div style={{ padding:'10px 16px', background:'var(--bg-surface)', borderBottom:'1px solid var(--border)', fontSize:13, fontWeight:700, color:'var(--accent)', display:'flex', alignItems:'center', gap:8 }}>
            <FlaskConical size={14} />
            {section.title}
          </div>
          <div style={{ padding:4 }}>
            {section.rows.map((row, ri) => {
              const flagStyle = FLAG_COLORS[row.flag.toLowerCase()] || FLAG_COLORS.normal;
              const FlagIcon = flagStyle.icon;
              const isAbnormal = row.flag.toLowerCase() !== 'normal';

              return (
                <div key={ri} style={{
                  display:'flex', alignItems:'center', padding:'8px 16px',
                  borderBottom: ri < section.rows.length - 1 ? '1px solid var(--border)' : 'none',
                  background: isAbnormal ? flagStyle.bg : 'transparent',
                  transition:'background 0.15s'
                }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:2 }}>{row.param}</div>
                    <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                      <span style={{ fontSize:15, fontWeight:700, color: isAbnormal ? flagStyle.text : 'var(--text-primary)' }}>{row.value}</span>
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>{row.unit}</span>
                    </div>
                  </div>
                  <div style={{ textAlign:'right', marginRight:12 }}>
                    <div style={{ fontSize:10, color:'var(--text-faint)' }}>Ref: {row.refRange}</div>
                  </div>
                  <div style={{
                    display:'flex', alignItems:'center', gap:4,
                    padding:'4px 10px', borderRadius:8,
                    background: flagStyle.bg, color: flagStyle.text,
                    fontSize:11, fontWeight:700
                  }}>
                    <FlagIcon size={12} />
                    {flagStyle.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
