// 공통 UI 원자 — 배지, 칩, 프로그레스, 아바타, 구분선

function Avatar({ gender, size = 36, emoji = '🌿' }) {
  const bg = gender === 'M' ? '#DCE7F3' : gender === 'F' ? '#F3DCE3' : '#E8D5C0';
  return (
    <div style={{
      width: size, height: size, borderRadius: size/2,
      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.5, flexShrink: 0,
    }}>{emoji}</div>
  );
}

function CatChip({ label, color, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      height: 32, padding: '0 14px', borderRadius: 999,
      border: active ? `1px solid ${color}` : `1px solid ${COLORS.border}`,
      background: active ? color + '18' : COLORS.card,
      color: active ? color : COLORS.textSub,
      fontSize: 13, fontWeight: active ? 600 : 500,
      whiteSpace: 'nowrap', cursor: 'pointer',
      letterSpacing: '-0.02em',
    }}>{label}</button>
  );
}

function Tag({ label, color, compact = false }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: compact ? '1px 7px' : '3px 9px',
      borderRadius: 6,
      background: color + '1A',
      color: color,
      fontSize: compact ? 10 : 11, fontWeight: 600,
      letterSpacing: '-0.01em',
    }}>{label}</span>
  );
}

function VerifiedBadge({ size = 14 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: size/2,
      background: COLORS.green, color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.65, fontWeight: 700, flexShrink: 0,
    }}>✓</span>
  );
}

function Progress({ value, max = 100, color = COLORS.primary, bg = COLORS.accent, h = 6 }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ height: h, borderRadius: h, background: bg, overflow: 'hidden' }}>
      <div style={{
        width: `${pct}%`, height: '100%',
        background: typeof color === 'string' && color.startsWith('linear') ? color : color,
        transition: 'width 600ms cubic-bezier(.2,.8,.2,1)',
      }} />
    </div>
  );
}

function Divider({ m = 0 }) {
  return <div style={{ height: 1, background: COLORS.border, margin: `${m}px 0` }} />;
}

function GenderDot({ gender, size = 5 }) {
  const c = gender === 'M' ? COLORS.male : gender === 'F' ? COLORS.female : COLORS.textLight;
  return <span style={{ width: size, height: size, borderRadius: size, background: c, display: 'inline-block' }} />;
}

// 공감 반응 요약 — 0인 건 숨김
function ReactionRow({ reactions, compact = false }) {
  const entries = Object.entries(reactions).filter(([,v]) => v > 0);
  return (
    <div style={{ display: 'flex', gap: compact ? 6 : 8, alignItems: 'center' }}>
      {entries.map(([e, n]) => (
        <div key={e} style={{
          display: 'flex', alignItems: 'center', gap: 3,
          padding: compact ? '2px 7px' : '3px 9px',
          borderRadius: 999, background: COLORS.tag,
          fontSize: compact ? 11 : 12, color: COLORS.textSub,
        }}>
          <span style={{ fontSize: compact ? 12 : 13 }}>{e}</span>
          <span style={{ fontWeight: 600 }}>{n}</span>
        </div>
      ))}
    </div>
  );
}

// 남은 시간 포맷 (72시간 기준)
function fmtTimeLeft(h) {
  const d = Math.floor(h / 24);
  const hh = h % 24;
  if (d > 0) return `${d}일 ${hh}시간`;
  return `${hh}시간`;
}

// Hot/status pill
function Pill({ children, color, bg, icon }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 999,
      background: bg, color, fontSize: 11, fontWeight: 600,
      letterSpacing: '-0.01em',
    }}>{icon}{children}</span>
  );
}

Object.assign(window, {
  Avatar, CatChip, Tag, VerifiedBadge, Progress, Divider,
  GenderDot, ReactionRow, fmtTimeLeft, Pill,
});
