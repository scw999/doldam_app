// 홈 스크린

function HomeScreen({ ae, onOpenPost, onOpenVote, onOpenMood, onGoTab }) {
  const [mood, setMood] = React.useState(null);
  const [toast, setToast] = React.useState(null);

  const selectMood = (i) => {
    setMood(i);
    setToast('+3P 기분 기록 완료');
    setTimeout(() => setToast(null), 1800);
  };

  return (
    <div style={{ padding: '12px 20px 40px', position: 'relative' }}>
      {/* 인사 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 13, color: COLORS.textSub,
          letterSpacing: '-0.01em', marginBottom: 4,
        }}>4월 18일 금요일</div>
        <div style={{
          fontFamily: ae.titleFont, fontSize: 22, fontWeight: ae.titleWeight,
          color: COLORS.text, letterSpacing: '-0.03em', lineHeight: 1.35,
        }}>
          오늘은 어떤 하루를 보내고 계신가요,<br/>
          <span style={{ color: COLORS.primaryDark }}>따뜻한 고양이</span>님.
        </div>
      </div>

      {/* 오늘의 기분 */}
      <Section ae={ae} title="오늘의 기분" hint={mood !== null ? '기록됨' : '하루 한 번, +3P'}>
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0 6px',
          scrollbarWidth: 'none',
        }}>
          {MOODS.map((m, i) => {
            const active = mood === i;
            return (
              <button key={i} onClick={() => selectMood(i)} style={{
                flexShrink: 0, minWidth: 68,
                padding: '10px 6px 8px', borderRadius: 14,
                border: active ? `1.5px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`,
                background: active ? COLORS.accent : COLORS.card,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                cursor: 'pointer',
                transform: active ? 'scale(1.04)' : 'scale(1)',
                transition: 'all 200ms',
              }}>
                <div style={{ fontSize: 26, lineHeight: 1 }}>{m.e}</div>
                <div style={{
                  fontSize: 11, color: active ? COLORS.primaryDark : COLORS.textSub,
                  fontWeight: active ? 600 : 500, letterSpacing: '-0.02em',
                }}>{m.label}</div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* 포인트 카드 */}
      <div style={{
        marginTop: 14,
        background: `linear-gradient(135deg, ${COLORS.primaryDark} 0%, ${COLORS.primary} 100%)`,
        borderRadius: ae.cardRadius, padding: '18px 20px',
        color: '#fff', position: 'relative', overflow: 'hidden',
        boxShadow: '0 6px 20px rgba(164,120,80,0.22)',
      }}>
        <div style={{
          position: 'absolute', top: -30, right: -30, width: 120, height: 120,
          borderRadius: '50%', background: 'rgba(255,255,255,0.07)',
        }} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em' }}>187</div>
          <div style={{ fontSize: 14, opacity: 0.85, fontWeight: 500 }}>P</div>
          <div style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.8 }}>30일 만료 · 오늘 +3P</div>
        </div>
        <div style={{ marginTop: 14, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, opacity: 0.92 }}>내 방 개설까지</div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>13P 남음</div>
        </div>
        <Progress value={187} max={200} color="rgba(255,255,255,0.9)" bg="rgba(255,255,255,0.2)" h={4} />
      </div>

      {/* 핫 투표 */}
      <Section ae={ae} title="🔥 이번 주 핫 투표" hint="더보기" onHintClick={() => onGoTab('vote')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {HOT_TOPICS.map((t) => (
            <button key={t.rank} onClick={() => onOpenVote(t.rank)} style={{
              background: COLORS.card, borderRadius: ae.cardRadius,
              border: `1px solid ${COLORS.border}`, boxShadow: ae.cardShadow,
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
              cursor: 'pointer', textAlign: 'left', width: '100%',
              borderLeft: ae.accentStripe ? `3px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 14,
                background: t.rank === 1 ? COLORS.primary : COLORS.tag,
                color: t.rank === 1 ? '#fff' : COLORS.primaryDark,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, flexShrink: 0,
              }}>{t.rank}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: COLORS.text,
                  letterSpacing: '-0.02em', marginBottom: 4,
                  textWrap: 'pretty',
                }}>{t.title}</div>
                <div style={{
                  fontSize: 11, color: COLORS.textSub,
                  display: 'flex', gap: 8, alignItems: 'center',
                }}>
                  <span>{t.votes.toLocaleString()}명 참여</span>
                  <span style={{ color: COLORS.textLight }}>·</span>
                  <span style={{ color: COLORS.votePro, fontWeight: 600 }}>찬성 {t.pro}%</span>
                </div>
              </div>
              {t.hot && <div style={{ fontSize: 16 }}>🔥</div>}
            </button>
          ))}
        </div>
      </Section>

      {/* 인기 글 */}
      <Section ae={ae} title="💬 지금 나누고 있는 이야기" hint="더보기" onHintClick={() => onGoTab('board')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {BOARD_POSTS.slice(0, 2).map((p) => (
            <MiniPostCard key={p.id} post={p} ae={ae} onClick={() => onOpenPost(p.id)} />
          ))}
        </div>
      </Section>

      {/* 미션 배너 */}
      <div style={{
        marginTop: 18, padding: '16px 18px', borderRadius: ae.cardRadius,
        background: `linear-gradient(135deg, ${COLORS.accent} 0%, ${COLORS.tag} 100%)`,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 22,
          background: 'rgba(255,255,255,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>💌</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, letterSpacing: '-0.02em' }}>
            3일 안에 10개 답변하면 100P
          </div>
          <div style={{ fontSize: 11, color: COLORS.textSub, marginTop: 2 }}>
            오늘의 Q&A 미션 · 4/10 진행중
          </div>
        </div>
        <div style={{
          fontSize: 20, color: COLORS.primaryDark,
        }}>→</div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 110, left: '50%', transform: 'translateX(-50%)',
          background: COLORS.text, color: '#fff',
          padding: '10px 18px', borderRadius: 999,
          fontSize: 13, fontWeight: 500,
          animation: 'toastIn 200ms ease-out',
          zIndex: 100,
        }}>{toast}</div>
      )}
    </div>
  );
}

function Section({ ae, title, hint, onHintClick, children }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 10, padding: '0 2px',
      }}>
        <h3 style={{
          margin: 0, fontSize: 15, fontWeight: 700, color: COLORS.text,
          letterSpacing: '-0.02em', fontFamily: ae.titleFont,
        }}>{title}</h3>
        {hint && (
          <button onClick={onHintClick} style={{
            background: 'none', border: 'none', cursor: onHintClick ? 'pointer' : 'default',
            fontSize: 12, color: COLORS.textSub, padding: 0,
          }}>{hint} {onHintClick && <span style={{ fontSize: 10 }}>›</span>}</button>
        )}
      </div>
      {children}
    </div>
  );
}

function MiniPostCard({ post, ae, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer',
      background: COLORS.card, borderRadius: ae.cardRadius,
      border: `1px solid ${COLORS.border}`, boxShadow: ae.cardShadow,
      padding: '14px 16px',
      borderLeft: ae.accentStripe ? `3px solid ${post.catColor}` : `1px solid ${COLORS.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Tag label={post.catLabel} color={post.catColor} compact />
        <span style={{ fontSize: 11, color: COLORS.textLight }}>{post.nick.split(' #')[0]}</span>
        <span style={{ fontSize: 11, color: COLORS.textLight }}>·</span>
        <span style={{ fontSize: 11, color: COLORS.textLight }}>{post.time}</span>
      </div>
      <div style={{
        fontSize: 15, fontWeight: 600, color: COLORS.text,
        letterSpacing: '-0.02em', marginBottom: 4, textWrap: 'pretty',
        lineHeight: 1.4,
      }}>{post.title}</div>
      <div style={{
        fontSize: 12.5, color: COLORS.textSub, lineHeight: 1.55,
        marginBottom: 10,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>{post.body}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ReactionRow reactions={post.reactions} compact />
        <div style={{ marginLeft: 'auto', fontSize: 11, color: COLORS.textSub }}>
          💬 {post.comments}
        </div>
      </div>
    </button>
  );
}

Object.assign(window, { HomeScreen, Section, MiniPostCard });
