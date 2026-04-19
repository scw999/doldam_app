// 글 상세 모달

function PostDetail({ postId, ae, onClose }) {
  const post = BOARD_POSTS.find(p => p.id === postId) || BOARD_POSTS[0];
  const [myReact, setMyReact] = React.useState(null);
  const [input, setInput] = React.useState('');

  return (
    <div style={{
      position: 'absolute', inset: 0, background: COLORS.bg,
      zIndex: 30, display: 'flex', flexDirection: 'column',
      animation: 'slideUp 280ms cubic-bezier(.2,.8,.2,1)',
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '12px 16px', background: COLORS.card,
        borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 22, padding: 4, color: COLORS.text,
        }}>←</button>
        <Tag label={post.catLabel} color={post.catColor} />
        <div style={{ marginLeft: 'auto', fontSize: 18, color: COLORS.textSub, cursor: 'pointer' }}>
          {post.scrap ? '🔖' : '🤍'}
        </div>
        <div style={{ fontSize: 18, color: COLORS.textSub, cursor: 'pointer' }}>⋯</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* 본문 */}
        <div style={{ padding: '20px 20px 18px', background: COLORS.card }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Avatar gender={post.gender} size={36} emoji={post.gender === 'M' ? '🌊' : '🌿'} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                  {post.nick}
                </span>
                <GenderDot gender={post.gender} />
              </div>
              <div style={{ fontSize: 11, color: COLORS.textSub, marginTop: 2 }}>
                {post.age} · {post.time}
              </div>
            </div>
          </div>

          <h1 style={{
            margin: '0 0 12px', fontSize: 22, fontWeight: 700,
            color: COLORS.text, letterSpacing: '-0.03em',
            lineHeight: 1.35, textWrap: 'pretty',
            fontFamily: ae.titleFont,
          }}>{post.title}</h1>

          <div style={{
            fontSize: 15, color: COLORS.text, lineHeight: 1.75,
            letterSpacing: '-0.01em', textWrap: 'pretty',
            marginBottom: 20, whiteSpace: 'pre-wrap',
          }}>{post.body}</div>

          {/* 반응 픽커 */}
          <div style={{
            display: 'flex', gap: 6, padding: '12px', borderRadius: 14,
            background: COLORS.bg, border: `1px solid ${COLORS.border}`,
          }}>
            {REACTIONS.map((r, i) => {
              const count = post.reactions[r.emoji] || 0;
              const active = myReact === i;
              return (
                <button key={i} onClick={() => setMyReact(active ? null : i)} style={{
                  flex: 1, padding: '8px 4px', border: 'none',
                  background: active ? COLORS.accent : 'transparent',
                  borderRadius: 10, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  transition: 'all 180ms',
                }}>
                  <div style={{
                    fontSize: 22,
                    transform: active ? 'scale(1.15)' : 'scale(1)',
                    transition: 'transform 200ms',
                  }}>{r.emoji}</div>
                  <div style={{
                    fontSize: 10, color: active ? COLORS.primaryDark : COLORS.textSub,
                    fontWeight: active ? 700 : 500, letterSpacing: '-0.02em',
                  }}>{r.label}</div>
                  {count > 0 && (
                    <div style={{ fontSize: 10, color: COLORS.textLight, fontWeight: 600 }}>
                      {count + (active ? 1 : 0)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 댓글 구분 */}
        <div style={{
          padding: '14px 20px 10px', fontSize: 12, fontWeight: 700,
          color: COLORS.textSub, letterSpacing: '-0.01em',
        }}>
          댓글 {post.comments}개
        </div>

        <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {COMMENTS.map(c => <CommentBubble key={c.id} c={c} ae={ae} />)}
        </div>
      </div>

      {/* 댓글 입력 */}
      <div style={{
        padding: '10px 14px 16px', background: COLORS.card,
        borderTop: `1px solid ${COLORS.border}`,
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          placeholder="따뜻한 말 한마디..."
          style={{
            flex: 1, padding: '11px 14px', borderRadius: 999,
            border: `1px solid ${COLORS.border}`, background: COLORS.bg,
            fontSize: 13, color: COLORS.text, outline: 'none',
          }} />
        <button style={{
          padding: '10px 16px', borderRadius: 999, border: 'none',
          background: input ? COLORS.primary : COLORS.tag,
          color: input ? '#fff' : COLORS.textLight,
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>등록</button>
      </div>
    </div>
  );
}

function CommentBubble({ c, ae }) {
  const mine = c.mine;
  return (
    <div style={{
      padding: '14px 16px',
      background: mine ? COLORS.accent + '66' : COLORS.card,
      border: `1px solid ${mine ? COLORS.primary + '33' : COLORS.border}`,
      borderRadius: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Avatar gender={c.gender} size={24} emoji={c.gender === 'M' ? '🌊' : '🌿'} />
        <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.text }}>
          {c.nick.split(' #')[0]}
          {mine && <span style={{ marginLeft: 4, color: COLORS.primaryDark, fontWeight: 700 }}>(나)</span>}
        </div>
        <GenderDot gender={c.gender} />
        <div style={{ fontSize: 10, color: COLORS.textLight }}>{c.age}</div>
        <div style={{ marginLeft: 'auto', fontSize: 10, color: COLORS.textLight }}>{c.time}</div>
      </div>
      <div style={{
        fontSize: 13.5, color: COLORS.text, lineHeight: 1.6,
        letterSpacing: '-0.01em', textWrap: 'pretty', marginBottom: 8,
      }}>{c.body}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, color: COLORS.textSub, padding: 0,
        }}>💛 {c.likes}</button>
        <button style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, color: COLORS.textSub, padding: 0,
        }}>답글</button>
      </div>
    </div>
  );
}

Object.assign(window, { PostDetail, CommentBubble });
