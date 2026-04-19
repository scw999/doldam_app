// 투표 스크린 (목록 + 상세 모달)

function VoteScreen({ ae, onOpenVote }) {
  const [filter, setFilter] = React.useState('all'); // all/M/F

  return (
    <div style={{ padding: '8px 20px 40px' }}>
      {/* 성별 필터 */}
      <div style={{
        display: 'flex', gap: 6, padding: '8px 0 14px',
      }}>
        {[
          { id: 'all', label: '전체' },
          { id: 'M', label: '남성만' },
          { id: 'F', label: '여성만' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '7px 14px', borderRadius: 999,
            border: `1px solid ${filter === f.id ? COLORS.text : COLORS.border}`,
            background: filter === f.id ? COLORS.text : COLORS.card,
            color: filter === f.id ? '#fff' : COLORS.textSub,
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}>{f.label}</button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: COLORS.textLight, alignSelf: 'center' }}>
          {VOTES.length}개
        </div>
      </div>

      {/* 투표 카드 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {VOTES.map(v => (
          <VoteCard key={v.id} vote={v} ae={ae} genderFilter={filter}
            onClick={() => onOpenVote(v.id)} />
        ))}
      </div>
    </div>
  );
}

function VoteCard({ vote, ae, genderFilter, onClick }) {
  const pct = genderFilter === 'M' ? vote.byGender.M.pro
           : genderFilter === 'F' ? vote.byGender.F.pro
           : vote.proPct;
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer',
      background: COLORS.card, borderRadius: ae.cardRadius,
      border: `1px solid ${COLORS.border}`, boxShadow: ae.cardShadow,
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {vote.hot && <Pill bg="#E85D4A18" color="#E85D4A" icon="🔥">HOT</Pill>}
        <span style={{ fontSize: 11, color: COLORS.textSub }}>
          {vote.total.toLocaleString()}명 · 💬 {vote.comments}
        </span>
      </div>
      <div style={{
        fontSize: 15.5, fontWeight: 600, color: COLORS.text,
        letterSpacing: '-0.02em', lineHeight: 1.45,
        marginBottom: 14, textWrap: 'pretty',
        fontFamily: ae.titleFont,
      }}>{vote.question}</div>
      {/* 찬반 바 */}
      <div style={{ position: 'relative' }}>
        <div style={{
          display: 'flex', height: 38, borderRadius: 10,
          overflow: 'hidden', background: COLORS.tag,
        }}>
          <div style={{
            width: `${pct}%`, background: COLORS.votePro + '35',
            display: 'flex', alignItems: 'center', paddingLeft: 12,
            fontSize: 12, fontWeight: 600, color: COLORS.votePro,
            transition: 'width 600ms cubic-bezier(.2,.8,.2,1)',
          }}>
            <span>⭕ {vote.pro}</span>
          </div>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center',
            justifyContent: 'flex-end', paddingRight: 12,
            fontSize: 12, fontWeight: 600, color: COLORS.voteCon,
            background: COLORS.voteCon + '20',
          }}>
            <span>{vote.con} ❌</span>
          </div>
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginTop: 6, fontSize: 11, color: COLORS.textSub,
        }}>
          <span style={{ color: COLORS.votePro, fontWeight: 700 }}>{pct}%</span>
          <span style={{ color: COLORS.voteCon, fontWeight: 700 }}>{100-pct}%</span>
        </div>
      </div>
    </button>
  );
}

// 투표 상세 (모달형)
function VoteDetail({ vote, ae, onClose }) {
  const [selected, setSelected] = React.useState(null);
  const v = vote;
  const pct = selected !== null ? v.proPct : null;

  return (
    <div style={{
      position: 'absolute', inset: 0, background: COLORS.bg,
      zIndex: 30, display: 'flex', flexDirection: 'column',
      animation: 'slideUp 280ms cubic-bezier(.2,.8,.2,1)',
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.card,
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 22, color: COLORS.text, padding: 4,
        }}>←</button>
        <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.text }}>돌싱 딜레마</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 40px' }}>
        {v.hot && (
          <div style={{ marginBottom: 12 }}>
            <Pill bg="#E85D4A18" color="#E85D4A" icon="🔥">HOT 투표 · 500명+</Pill>
          </div>
        )}
        <div style={{
          fontSize: 22, fontWeight: 700, color: COLORS.text,
          letterSpacing: '-0.03em', lineHeight: 1.35, marginBottom: 10,
          textWrap: 'pretty', fontFamily: ae.titleFont,
        }}>{v.question}</div>
        <div style={{
          fontSize: 13, color: COLORS.textSub, lineHeight: 1.6,
          marginBottom: 20,
        }}>{v.description}</div>

        {/* 선택 버튼 또는 결과 */}
        {selected === null ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <VoteBigButton label={v.pro} emoji="⭕" color={COLORS.votePro}
              onClick={() => setSelected('pro')} />
            <VoteBigButton label={v.con} emoji="❌" color={COLORS.voteCon}
              onClick={() => setSelected('con')} />
          </div>
        ) : (
          <VoteResult vote={v} selected={selected} ae={ae} />
        )}

        {/* 500명+ 테마방 배너 */}
        {selected !== null && v.total > 500 && (
          <div style={{
            marginTop: 20, padding: '14px 16px',
            borderRadius: ae.cardRadius,
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.tag})`,
            display: 'flex', alignItems: 'center', gap: 12,
            border: `1px solid ${COLORS.primary}33`,
          }}>
            <div style={{ fontSize: 22 }}>🔥</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, letterSpacing: '-0.02em' }}>
                이 주제로 테마방이 열렸어요
              </div>
              <div style={{ fontSize: 11, color: COLORS.textSub, marginTop: 2 }}>
                현재 8명 대화중 · 남은 자리 0
              </div>
            </div>
            <button style={{
              border: 'none', background: COLORS.primary, color: '#fff',
              padding: '8px 14px', borderRadius: 999,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>입장</button>
          </div>
        )}

        {/* 공유카드 CTA */}
        {selected !== null && (
          <button style={{
            marginTop: 16, width: '100%', padding: '14px',
            border: `1px solid ${COLORS.primary}`,
            background: COLORS.card, color: COLORS.primaryDark,
            borderRadius: ae.cardRadius,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>📤 공유카드 만들기</button>
        )}
      </div>
    </div>
  );
}

function VoteBigButton({ label, emoji, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '24px 14px',
      background: COLORS.card, border: `2px solid ${color}40`,
      borderRadius: 18, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      transition: 'all 180ms',
    }}
      onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
      onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
    >
      <div style={{ fontSize: 32 }}>{emoji}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{label}</div>
    </button>
  );
}

function VoteResult({ vote, selected, ae }) {
  return (
    <div>
      {/* 내 선택 */}
      <div style={{
        padding: '12px 14px', background: COLORS.accent,
        borderRadius: 12, marginBottom: 16,
        fontSize: 12, color: COLORS.primaryDark, fontWeight: 600,
      }}>
        내 선택: {selected === 'pro' ? `⭕ ${vote.pro}` : `❌ ${vote.con}`}
      </div>
      {/* 바 */}
      <div style={{
        display: 'flex', height: 48, borderRadius: 12,
        overflow: 'hidden', background: COLORS.tag, marginBottom: 18,
      }}>
        <div style={{
          width: `${vote.proPct}%`, background: COLORS.votePro,
          display: 'flex', alignItems: 'center', paddingLeft: 14,
          color: '#fff', fontSize: 14, fontWeight: 700,
          transition: 'width 800ms cubic-bezier(.2,.8,.2,1)',
        }}>{vote.proPct}%</div>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          paddingRight: 14, background: COLORS.voteCon,
          color: '#fff', fontSize: 14, fontWeight: 700,
        }}>{100-vote.proPct}%</div>
      </div>
      {/* 성별 분포 */}
      <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSub, marginBottom: 10 }}>
        성별 분포
      </div>
      {[
        { l: '남성', pro: vote.byGender.M.pro, color: COLORS.male },
        { l: '여성', pro: vote.byGender.F.pro, color: COLORS.female },
      ].map(g => (
        <div key={g.l} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
            <span style={{ color: g.color, fontWeight: 600 }}>● {g.l}</span>
            <span style={{ color: COLORS.textSub }}>
              찬성 {g.pro}% · 반대 {100-g.pro}%
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 8, background: COLORS.tag, overflow: 'hidden' }}>
            <div style={{
              width: `${g.pro}%`, height: '100%', background: g.color,
              transition: 'width 800ms cubic-bezier(.2,.8,.2,1)',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { VoteScreen, VoteDetail, VoteCard });
