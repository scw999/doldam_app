// 메인 셸 — iOS 프레임 + 탭 + Tweaks

const TABS = [
  { id: 'home', label: '홈', icon: (a) => <HomeIcon active={a} /> },
  { id: 'board', label: '게시판', icon: (a) => <BoardIcon active={a} /> },
  { id: 'vote', label: '투표', icon: (a) => <VoteIcon active={a} /> },
  { id: 'chat', label: '채팅', icon: (a) => <ChatIcon active={a} /> },
  { id: 'my', label: '마이', icon: (a) => <MyIcon active={a} /> },
];

// 미니멀 라인 아이콘 (이모지 대신)
function HomeIcon({ active }) {
  const c = active ? COLORS.primary : COLORS.tabInactive;
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M3 11l9-7 9 7v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2v-9z"
      stroke={c} strokeWidth={active ? 2 : 1.7} strokeLinejoin="round"
      fill={active ? c + '22' : 'none'} />
  </svg>;
}
function BoardIcon({ active }) {
  const c = active ? COLORS.primary : COLORS.tabInactive;
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="4" width="16" height="16" rx="3" stroke={c} strokeWidth={active ? 2 : 1.7} fill={active ? c + '22' : 'none'}/>
    <path d="M8 9h8M8 13h8M8 17h5" stroke={c} strokeWidth="1.7" strokeLinecap="round"/>
  </svg>;
}
function VoteIcon({ active }) {
  const c = active ? COLORS.primary : COLORS.tabInactive;
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M12 3v18M5 7l-2 4h4l-2-4zm14 0l-2 4h4l-2-4z"
      stroke={c} strokeWidth={active ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round"
      fill={active ? c + '22' : 'none'} />
  </svg>;
}
function ChatIcon({ active }) {
  const c = active ? COLORS.primary : COLORS.tabInactive;
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2h-8l-4 4v-4H6a2 2 0 01-2-2V6z"
      stroke={c} strokeWidth={active ? 2 : 1.7} strokeLinejoin="round"
      fill={active ? c + '22' : 'none'} />
  </svg>;
}
function MyIcon({ active }) {
  const c = active ? COLORS.primary : COLORS.tabInactive;
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke={c} strokeWidth={active ? 2 : 1.7} fill={active ? c + '22' : 'none'}/>
    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke={c} strokeWidth={active ? 2 : 1.7} strokeLinecap="round" fill="none"/>
  </svg>;
}

function BrandBar({ ae, points = 187 }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '56px 16px 10px', background: COLORS.bg,
      position: 'sticky', top: 0, zIndex: 20,
    }}>
      {/* 로고 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: `linear-gradient(135deg, ${COLORS.primaryDark}, ${COLORS.primary})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(164,120,80,0.28)',
        }}>
          {/* 돌담 심볼 — 돌이 쌓인 형태 */}
          <svg width="18" height="16" viewBox="0 0 18 16">
            <rect x="1" y="10" width="7" height="5" rx="1.5" fill="#fff" opacity="0.95"/>
            <rect x="10" y="10" width="7" height="5" rx="1.5" fill="#fff" opacity="0.95"/>
            <rect x="5.5" y="4" width="7" height="5" rx="1.5" fill="#fff" opacity="0.95"/>
            <circle cx="9" cy="2" r="1.3" fill="#fff" opacity="0.9"/>
          </svg>
        </div>
        <div style={{
          fontSize: 18, fontWeight: 700, color: COLORS.text,
          letterSpacing: '-0.03em', fontFamily: ae.titleFont,
        }}>돌담</div>
      </div>

      <div style={{ flex: 1 }} />

      {/* 포인트 칩 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '5px 11px 5px 8px', borderRadius: 999,
        background: COLORS.accent, cursor: 'pointer',
      }}>
        <span style={{ fontSize: 12 }}>💎</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.primaryDark, letterSpacing: '-0.01em' }}>
          {points}P
        </span>
      </div>

      {/* 알림 */}
      <button style={{
        width: 36, height: 36, borderRadius: 18, border: 'none',
        background: COLORS.card, position: 'relative', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M18 16v-5a6 6 0 10-12 0v5l-2 2h16l-2-2z M10 20a2 2 0 004 0"
            stroke={COLORS.text} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{
          position: 'absolute', top: 8, right: 9,
          width: 7, height: 7, borderRadius: 4,
          background: COLORS.badge, border: `1.5px solid ${COLORS.card}`,
        }} />
      </button>
    </div>
  );
}

function TabBar({ active, onChange }) {
  return (
    <div style={{
      display: 'flex', background: COLORS.tabBg,
      borderTop: `1px solid ${COLORS.border}`,
      paddingBottom: 28, paddingTop: 6,
      boxShadow: '0 -4px 14px rgba(44,36,32,0.04)',
    }}>
      {TABS.map(t => {
        const a = t.id === active;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px 4px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 3,
          }}>
            {t.icon(a)}
            <div style={{
              fontSize: 10.5, fontWeight: a ? 700 : 500,
              color: a ? COLORS.primary : COLORS.tabInactive,
              letterSpacing: '-0.02em',
            }}>{t.label}</div>
          </button>
        );
      })}
    </div>
  );
}

// Tweaks 패널
function TweaksPanel({ open, state, setState, onClose }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', right: 16, bottom: 16, zIndex: 999,
      width: 280, borderRadius: 18, overflow: 'hidden',
      background: '#fff', border: `1px solid ${COLORS.border}`,
      boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
      fontFamily: 'Pretendard, -apple-system, system-ui, sans-serif',
    }}>
      <div style={{
        padding: '12px 14px', background: COLORS.text, color: '#fff',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Tweaks</span>
        <span style={{ marginLeft: 'auto', fontSize: 16, cursor: 'pointer' }} onClick={onClose}>×</span>
      </div>
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        <TweakRow label="비주얼 방향">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(AESTHETICS).map(([k, v]) => (
              <label key={k} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 8,
                background: state.aesthetic === k ? COLORS.accent : COLORS.bg,
                cursor: 'pointer', fontSize: 12,
                border: `1px solid ${state.aesthetic === k ? COLORS.primary : COLORS.border}`,
              }}>
                <input type="radio" checked={state.aesthetic === k}
                  onChange={() => setState({ aesthetic: k })}
                  style={{ accentColor: COLORS.primary }} />
                <span style={{ fontWeight: state.aesthetic === k ? 700 : 500, color: COLORS.text }}>
                  {v.label}
                </span>
              </label>
            ))}
          </div>
        </TweakRow>

        <TweakRow label="Primary 색상">
          <div style={{ display: 'flex', gap: 8 }}>
            {['#C4956A','#8B7355','#A67B5B','#B5835A','#6B5544'].map(c => (
              <button key={c} onClick={() => setState({ primaryColor: c })}
                style={{
                  width: 28, height: 28, borderRadius: 14, cursor: 'pointer',
                  background: c, border: state.primaryColor === c
                    ? `2px solid ${COLORS.text}` : '2px solid transparent',
                }} />
            ))}
          </div>
        </TweakRow>

        <TweakRow label={`카드 radius · ${state.cardRadius}px`}>
          <input type="range" min="4" max="24" value={state.cardRadius}
            onChange={e => setState({ cardRadius: +e.target.value })}
            style={{ width: '100%', accentColor: COLORS.primary }} />
        </TweakRow>

        <TweakRow label="정보 밀도">
          <div style={{ display: 'flex', gap: 6 }}>
            {['compact', 'normal', 'loose'].map(d => (
              <button key={d} onClick={() => setState({ density: d })}
                style={{
                  flex: 1, padding: '6px 8px', borderRadius: 8,
                  border: `1px solid ${state.density === d ? COLORS.primary : COLORS.border}`,
                  background: state.density === d ? COLORS.accent : '#fff',
                  color: state.density === d ? COLORS.primaryDark : COLORS.textSub,
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>{d}</button>
            ))}
          </div>
        </TweakRow>

        <TweakRow label="카테고리 색 스트라이프">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={state.stripe}
              onChange={e => setState({ stripe: e.target.checked })}
              style={{ accentColor: COLORS.primary }} />
            <span style={{ fontSize: 12, color: COLORS.textSub }}>왼쪽 가장자리에 카테고리 색</span>
          </label>
        </TweakRow>
      </div>
    </div>
  );
}

function TweakRow({ label, children }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: COLORS.textSub,
        marginBottom: 6, letterSpacing: '-0.01em',
      }}>{label}</div>
      {children}
    </div>
  );
}

Object.assign(window, { BrandBar, TabBar, TweaksPanel, TABS });
