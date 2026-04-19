// 게시판 스크린

function BoardScreen({ ae, onOpenPost, onCompose }) {
  const [cat, setCat] = React.useState('all');
  const filtered = cat === 'all' ? BOARD_POSTS : BOARD_POSTS.filter(p => p.cat === cat);

  return (
    <div style={{ padding: '8px 0 40px' }}>
      {/* 카테고리 칩 */}
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto',
        padding: '8px 20px 14px', scrollbarWidth: 'none',
      }}>
        {CATEGORIES.map(c => (
          <CatChip key={c.id} label={c.label} color={c.color}
            active={cat === c.id} onClick={() => setCat(c.id)} />
        ))}
      </div>

      {/* 글 리스트 */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(p => (
          <PostCard key={p.id} post={p} ae={ae} onClick={() => onOpenPost(p.id)} />
        ))}
      </div>

      {/* 매칭 배너 */}
      <div style={{
        margin: '22px 20px 0', padding: '16px 18px',
        borderRadius: ae.cardRadius,
        background: COLORS.card,
        border: `1px dashed ${COLORS.primary}66`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 24 }}>🫂</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, letterSpacing: '-0.02em' }}>
            이 주제로 대화하고 싶다면?
          </div>
          <div style={{ fontSize: 11, color: COLORS.textSub, marginTop: 2 }}>
            6~8명 소그룹 · 3일 후 자동 종료
          </div>
        </div>
        <button style={{
          border: 'none', background: COLORS.primary, color: '#fff',
          padding: '8px 14px', borderRadius: 999,
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>참여</button>
      </div>

      {/* FAB */}
      <button onClick={onCompose} style={{
        position: 'absolute', bottom: 96, right: 20,
        width: 56, height: 56, borderRadius: 28, border: 'none',
        background: COLORS.primary, color: '#fff',
        boxShadow: '0 6px 18px rgba(164,120,80,0.32)',
        fontSize: 24, fontWeight: 300, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        lineHeight: 1,
      }}>✎</button>
    </div>
  );
}

function PostCard({ post, ae, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer',
      background: COLORS.card, borderRadius: ae.cardRadius,
      border: `1px solid ${COLORS.border}`, boxShadow: ae.cardShadow,
      padding: '16px 18px',
      borderLeft: ae.accentStripe ? `3px solid ${post.catColor}` : `1px solid ${COLORS.border}`,
    }}>
      {/* 메타 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Tag label={post.catLabel} color={post.catColor} />
        <div style={{ marginLeft: 'auto', fontSize: 11, color: COLORS.textLight }}>{post.time}</div>
      </div>
      {/* 제목 */}
      <div style={{
        fontSize: 16, fontWeight: 600, color: COLORS.text,
        letterSpacing: '-0.02em', lineHeight: 1.4,
        marginBottom: 6, textWrap: 'pretty',
        fontFamily: ae.titleFont,
      }}>{post.title}</div>
      {/* 본문 */}
      <div style={{
        fontSize: 13, color: COLORS.textSub, lineHeight: 1.6,
        marginBottom: 12,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>{post.body}</div>
      {/* 작성자 + 반응 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <GenderDot gender={post.gender} />
        <div style={{ fontSize: 11, color: COLORS.textSub }}>
          {post.nick} · {post.age}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ReactionRow reactions={post.reactions} compact />
          <span style={{ fontSize: 11, color: COLORS.textSub }}>💬 {post.comments}</span>
        </div>
      </div>
    </button>
  );
}

Object.assign(window, { BoardScreen, PostCard });
