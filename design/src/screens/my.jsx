// 마이페이지

function MyScreen({ ae }) {
  return (
    <div style={{ padding: '8px 20px 40px' }}>
      {/* 프로필 카드 */}
      <div style={{
        background: COLORS.card, borderRadius: ae.cardRadius,
        border: `1px solid ${COLORS.border}`, boxShadow: ae.cardShadow,
        padding: '20px', marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 30,
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.tag})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, border: `2px solid ${COLORS.primary}40`,
          }}>🌿</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{
                fontSize: 17, fontWeight: 700, color: COLORS.text,
                letterSpacing: '-0.02em',
              }}>따뜻한 고양이</div>
              <VerifiedBadge size={15} />
            </div>
            <div style={{ fontSize: 12, color: COLORS.textSub }}>
              여 · 30대 후반 · 서울
            </div>
            <div style={{
              marginTop: 6, display: 'inline-block',
              fontSize: 11, fontWeight: 600,
              background: COLORS.accent, color: COLORS.primaryDark,
              padding: '3px 10px', borderRadius: 999,
            }}>이혼 2년차</div>
          </div>
        </div>

        {/* 통계 */}
        <div style={{
          marginTop: 18, padding: '14px 0 4px',
          borderTop: `1px solid ${COLORS.border}`,
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
        }}>
          <Stat label="포인트" value="187" unit="P" color={COLORS.primary} />
          <Stat label="매칭 온도" value="36.5" unit="°" color={COLORS.female} />
          <Stat label="뱃지" value="3" unit=" / 5" color={COLORS.green} />
        </div>
      </div>

      {/* 뱃지 */}
      <div style={{
        background: COLORS.card, borderRadius: ae.cardRadius,
        border: `1px solid ${COLORS.border}`, boxShadow: ae.cardShadow,
        padding: '16px 18px', marginBottom: 12,
      }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: COLORS.text,
          letterSpacing: '-0.02em', marginBottom: 12,
          fontFamily: ae.titleFont,
        }}>내 뱃지</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {BADGES.map((b, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              opacity: b.unlocked ? 1 : 0.35,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 22,
                background: b.unlocked ? b.color + '22' : COLORS.tag,
                color: b.unlocked ? b.color : COLORS.textLight,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700,
                border: `1.5px solid ${b.unlocked ? b.color + '55' : COLORS.border}`,
              }}>{b.unlocked ? b.e : '🔒'}</div>
              <div style={{ fontSize: 10, color: COLORS.textSub, letterSpacing: '-0.02em' }}>
                {b.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 메뉴 리스트 */}
      <div style={{
        background: COLORS.card, borderRadius: ae.cardRadius,
        border: `1px solid ${COLORS.border}`, overflow: 'hidden',
        boxShadow: ae.cardShadow,
      }}>
        {[
          { i: '📝', l: '내가 쓴 글', c: '12' },
          { i: '🔖', l: '스크랩', c: '8' },
          { i: '🎨', l: '감정 타임라인', c: '오늘 기록됨', color: COLORS.green },
          { i: '✅', l: '돌싱 체크리스트', c: '3 / 10' },
          { i: '💎', l: '포인트 내역', c: '+3P 오늘' },
          { i: '📖', l: 'Q&A 미션', c: '4 / 10', color: COLORS.primaryDark },
          { i: '⚙️', l: '설정' },
        ].map((m, i, arr) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 18px', cursor: 'pointer',
            borderBottom: i < arr.length - 1 ? `1px solid ${COLORS.border}` : 'none',
          }}>
            <div style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{m.i}</div>
            <div style={{ flex: 1, fontSize: 14, color: COLORS.text, letterSpacing: '-0.02em' }}>
              {m.l}
            </div>
            {m.c && (
              <div style={{ fontSize: 12, color: m.color || COLORS.textSub, fontWeight: 500 }}>
                {m.c}
              </div>
            )}
            <div style={{ fontSize: 14, color: COLORS.textLight }}>›</div>
          </div>
        ))}
      </div>

      <div style={{
        textAlign: 'center', fontSize: 11, color: COLORS.textLight,
        padding: '24px 0 8px', letterSpacing: '-0.01em',
      }}>
        로그아웃 · 계정 삭제
      </div>
    </div>
  );
}

function Stat({ label, value, unit, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: COLORS.textSub, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color, letterSpacing: '-0.03em' }}>{value}</span>
        <span style={{ fontSize: 11, color: COLORS.textSub, fontWeight: 600 }}>{unit}</span>
      </div>
    </div>
  );
}

Object.assign(window, { MyScreen });
