// 채팅 스크린 + 채팅방 상세

function ChatScreen({ ae, onOpenRoom }) {
  const [tab, setTab] = React.useState('my'); // my / theme / match

  return (
    <div style={{ padding: '8px 0 40px' }}>
      {/* 탭 */}
      <div style={{
        display: 'flex', gap: 4, padding: '8px 20px 12px',
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        {[
          { id: 'my', label: '내 방', c: CHAT_ROOMS.length },
          { id: 'theme', label: '🔥 테마방', c: 1 },
          { id: 'match', label: '매칭' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 4px', marginRight: 14,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: tab === t.id ? 700 : 500,
            color: tab === t.id ? COLORS.text : COLORS.textSub,
            borderBottom: tab === t.id ? `2px solid ${COLORS.primary}` : '2px solid transparent',
            marginBottom: -13,
          }}>
            {t.label} {t.c !== undefined && <span style={{ fontSize: 11, color: COLORS.textLight }}>{t.c}</span>}
          </button>
        ))}
      </div>

      {tab === 'my' && (
        <div style={{ padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {CHAT_ROOMS.map(r => <RoomCard key={r.id} room={r} ae={ae} onClick={() => onOpenRoom(r.id)} />)}
        </div>
      )}

      {tab === 'theme' && (
        <div style={{ padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {CHAT_ROOMS.filter(r => r.kind === 'themed').map(r =>
            <RoomCard key={r.id} room={r} ae={ae} onClick={() => onOpenRoom(r.id)} />
          )}
          <div style={{
            padding: '20px', background: COLORS.card, borderRadius: ae.cardRadius,
            border: `1px dashed ${COLORS.border}`, textAlign: 'center',
            fontSize: 12, color: COLORS.textSub, lineHeight: 1.7,
          }}>
            🔥 핫 투표 500명+ 참여시<br/>테마방이 자동으로 열려요
          </div>
        </div>
      )}

      {tab === 'match' && <MatchCta ae={ae} />}
    </div>
  );
}

function RoomCard({ room, ae, onClick }) {
  const urgent = room.timeLeft_h < 24;
  return (
    <button onClick={onClick} style={{
      width: '100%', textAlign: 'left', cursor: 'pointer',
      background: COLORS.card, borderRadius: ae.cardRadius,
      border: `1px solid ${COLORS.border}`, boxShadow: ae.cardShadow,
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {room.kind === 'themed' && <span style={{ fontSize: 14 }}>🔥</span>}
        <div style={{
          fontSize: 14.5, fontWeight: 700, color: COLORS.text,
          letterSpacing: '-0.02em', flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{room.name}</div>
        {room.unread > 0 && (
          <div style={{
            minWidth: 20, height: 20, borderRadius: 10, padding: '0 6px',
            background: COLORS.badge, color: '#fff',
            fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{room.unread}</div>
        )}
      </div>
      <div style={{
        fontSize: 12.5, color: COLORS.textSub, marginBottom: 10,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{room.lastMsg}</div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11, color: COLORS.textLight,
      }}>
        <span>👥 {room.members}/{room.max}</span>
        <span>·</span>
        <span>{room.ageRange}</span>
        <span style={{
          marginLeft: 'auto',
          color: urgent ? COLORS.badge : COLORS.textSub,
          fontWeight: urgent ? 700 : 500,
        }}>⏱ {fmtTimeLeft(room.timeLeft_h)}</span>
      </div>
    </button>
  );
}

function MatchCta({ ae }) {
  return (
    <div style={{ padding: '24px 20px 0' }}>
      <div style={{
        background: `linear-gradient(160deg, ${COLORS.primaryDark}, ${COLORS.primary})`,
        borderRadius: ae.cardRadius, padding: '28px 22px', color: '#fff',
        boxShadow: '0 10px 30px rgba(164,120,80,0.25)',
      }}>
        <div style={{ fontSize: 34, marginBottom: 14 }}>🫂</div>
        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.35, marginBottom: 8 }}>
          6~8명이 모이는<br/>작은 소그룹, 3일
        </div>
        <div style={{ fontSize: 13, opacity: 0.92, lineHeight: 1.65, marginBottom: 20 }}>
          연령·성별·지역이 비슷한 사람들과<br/>
          익명으로 대화해보세요.<br/>
          유지 투표로 이어가거나, 200P로 부활도 가능.
        </div>
        <button style={{
          width: '100%', padding: '14px', border: 'none',
          borderRadius: 12, background: '#fff', color: COLORS.primaryDark,
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>지금 매칭 시작</button>
      </div>
      <div style={{
        marginTop: 14, padding: '14px 16px', background: COLORS.card,
        border: `1px solid ${COLORS.border}`, borderRadius: ae.cardRadius,
        fontSize: 12, color: COLORS.textSub, lineHeight: 1.7,
      }}>
        💡 대기 중 평균 시간: <b style={{ color: COLORS.text }}>8분</b><br/>
        오늘의 매칭 대기자: <b style={{ color: COLORS.text }}>23명</b>
      </div>
    </div>
  );
}

// 채팅방 상세
function RoomDetail({ roomId, ae, onClose }) {
  const room = CHAT_ROOMS.find(r => r.id === roomId) || CHAT_ROOMS[0];
  const urgent = room.timeLeft_h < 24;
  const [input, setInput] = React.useState('');
  const messages = [
    { id: 1, nick: '용감한 커피', gender: 'M', body: '다들 요즘 어떻게 지내세요?', time: '14:02', mine: false },
    { id: 2, nick: '따뜻한 고양이', gender: 'F', body: '오늘 상담 다녀왔어요. 생각보다 후련하네요.', time: '14:08', mine: true },
    { id: 3, nick: '별빛 나무', gender: 'F', body: '저도 상담 고민중이었는데 용기 얻었어요', time: '14:10', mine: false },
    { id: 4, nick: '용감한 커피', gender: 'M', body: '저도 같은 경험 있어요 ㅎㅎ 처음이 제일 힘들지 상담받고 나면 한결 나아요', time: '14:12', mine: false },
  ];

  return (
    <div style={{
      position: 'absolute', inset: 0, background: COLORS.bg,
      zIndex: 30, display: 'flex', flexDirection: 'column',
      animation: 'slideUp 280ms cubic-bezier(.2,.8,.2,1)',
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '12px 16px 14px', background: COLORS.card,
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 22, padding: 4, color: COLORS.text,
          }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, letterSpacing: '-0.02em' }}>
              {room.kind === 'themed' && '🔥 '}{room.name}
            </div>
            <div style={{ fontSize: 11, color: COLORS.textSub, marginTop: 2 }}>
              👥 {room.members}명 · {room.ageRange} · {room.regions}
            </div>
          </div>
          <button style={{
            background: COLORS.tag, border: 'none', padding: '6px 10px',
            borderRadius: 8, fontSize: 11, color: COLORS.primaryDark, cursor: 'pointer',
          }}>요약</button>
        </div>
        {/* 남은시간 + 유지투표 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', background: urgent ? COLORS.badge + '14' : COLORS.tag,
          borderRadius: 10,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: urgent ? COLORS.badge : COLORS.primaryDark,
          }}>⏱ {fmtTimeLeft(room.timeLeft_h)} 남음</span>
          <span style={{ fontSize: 10, color: COLORS.textSub, marginLeft: 'auto' }}>
            유지 4 / 폭파 2
          </span>
          <button style={{
            padding: '4px 10px', borderRadius: 999, border: 'none',
            background: COLORS.green, color: '#fff',
            fontSize: 10, fontWeight: 600, cursor: 'pointer',
          }}>유지 투표</button>
        </div>
      </div>

      {/* 메시지 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 12px' }}>
        <div style={{
          padding: '10px 14px', background: COLORS.accent + '80',
          borderRadius: 10, fontSize: 11, color: COLORS.primaryDark,
          textAlign: 'center', marginBottom: 14,
        }}>🔒 본인인증된 돌싱만 입장 가능한 방이에요</div>
        {messages.map(m => <Bubble key={m.id} msg={m} />)}
      </div>

      {/* 입력 */}
      <div style={{
        padding: '10px 14px 18px', background: COLORS.card,
        borderTop: `1px solid ${COLORS.border}`,
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          placeholder="메시지 보내기"
          style={{
            flex: 1, padding: '11px 14px', borderRadius: 999,
            border: `1px solid ${COLORS.border}`, background: COLORS.bg,
            fontSize: 13, color: COLORS.text, outline: 'none',
          }} />
        <button style={{
          width: 40, height: 40, borderRadius: 20, border: 'none',
          background: input ? COLORS.primary : COLORS.tag,
          color: input ? '#fff' : COLORS.textLight,
          cursor: 'pointer', fontSize: 15, fontWeight: 700,
        }}>↑</button>
      </div>
    </div>
  );
}

function Bubble({ msg }) {
  const mine = msg.mine;
  return (
    <div style={{
      display: 'flex', gap: 8, marginBottom: 12,
      flexDirection: mine ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
    }}>
      {!mine && <Avatar gender={msg.gender} size={28} emoji={msg.gender === 'M' ? '🌊' : '🌿'} />}
      <div style={{ maxWidth: '74%' }}>
        {!mine && (
          <div style={{ fontSize: 10.5, color: COLORS.textSub, marginBottom: 3, marginLeft: 2 }}>
            {msg.nick}
          </div>
        )}
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 6,
          flexDirection: mine ? 'row-reverse' : 'row',
        }}>
          <div style={{
            padding: '10px 13px',
            background: mine ? COLORS.primary : COLORS.card,
            color: mine ? '#fff' : COLORS.text,
            borderRadius: 16,
            borderBottomRightRadius: mine ? 4 : 16,
            borderBottomLeftRadius: mine ? 16 : 4,
            fontSize: 13.5, lineHeight: 1.5, letterSpacing: '-0.01em',
            boxShadow: mine ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
            textWrap: 'pretty',
          }}>{msg.body}</div>
          <div style={{ fontSize: 10, color: COLORS.textLight }}>{msg.time}</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ChatScreen, RoomDetail });
