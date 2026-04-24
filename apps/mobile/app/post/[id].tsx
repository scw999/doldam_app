import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable,
  Alert, ActivityIndicator, SafeAreaView, Modal, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/theme';
import { Avatar, Tag, GenderDot } from '@/ui/atoms';
import { useAuth } from '@/store/auth';
import { api } from '@/api';
import { patchBoardPost } from '../(tabs)/board';
import { getDivorceTitle } from '@/utils/divorce';

interface Post {
  id: string; title: string; content: string; category: string;
  user_id: string; nickname: string; gender: 'M' | 'F'; age_range: string;
  divorce_year: number | null; divorce_month: number | null;
  like_count: number; comment_count: number; created_at: number;
  myReaction?: number | null;
  reactionCounts?: Record<string, number>;
}

interface Comment {
  id: string; content: string; parent_id: string | null;
  nickname: string; gender: 'M' | 'F'; created_at: number;
  user_id?: string;
}

const CATEGORY_COLORS: Record<string, { label: string; color: string }> = {
  free: { label: '자유톡', color: '#6BAF7B' },
  heart: { label: '속마음', color: '#D4728C' },
  kids: { label: '양육일기', color: '#5B8FC9' },
  dating: { label: '연애/관계', color: '#C4956A' },
  legal: { label: '법률/돈', color: '#8C7B6B' },
  remarriage: { label: '재혼', color: '#B8739E' },
  men_only: { label: '남성방', color: '#5B8FC9' },
  women_only: { label: '여성방', color: '#D4728C' },
};

const REACTIONS = [
  { emoji: '💛', label: '공감돼요' },
  { emoji: '🫂', label: '안아줄게요' },
  { emoji: '💪', label: '힘내요' },
  { emoji: '😂', label: '웃겨요' },
];

const EDIT_CATEGORIES = [
  { id: 'free',       label: '자유톡',   color: '#6BAF7B' },
  { id: 'heart',      label: '속마음',   color: '#D4728C' },
  { id: 'kids',       label: '양육일기', color: '#5B8FC9' },
  { id: 'dating',     label: '연애/관계', color: '#C4956A' },
  { id: 'legal',      label: '법률/돈',  color: '#8C7B6B' },
  { id: 'remarriage', label: '재혼',     color: '#B8739E' },
  { id: 'men_only',   label: '🚹 남성방', color: '#5B8FC9' },
  { id: 'women_only', label: '🚺 여성방', color: '#D4728C' },
];

export default function PostDetail() {
  const { id, commentId } = useLocalSearchParams<{ id: string; commentId?: string }>();
  const myUserId = useAuth((s) => s.userId);
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(commentId ?? null);

  useEffect(() => {
    if (!highlightCommentId) return;
    const t = setTimeout(() => setHighlightCommentId(null), 3000);
    return () => clearTimeout(t);
  }, [highlightCommentId]);
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [myReact, setMyReact] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; nickname: string } | null>(null);

  const [editVisible, setEditVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [editCommentSaving, setEditCommentSaving] = useState(false);

  const [reportTarget, setReportTarget] = useState<{ type: string; id: string } | null>(null);
  const [meProfile, setMeProfile] = useState<{ nickname: string; gender: 'M' | 'F' } | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [p, c, me] = await Promise.all([
      api.get<Post>(`/posts/${id}`),
      api.get<{ items: Comment[] }>(`/posts/${id}/comments`),
      api.get<{ nickname: string; gender: 'M' | 'F' }>('/auth/me').catch(() => null),
    ]);
    setPost(p);
    setComments(c.items);
    setMyReact(p.myReaction ?? null);
    if (me) setMeProfile({ nickname: me.nickname, gender: me.gender });
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // 하이라이트 대상이 답글이면 부모 그룹을 자동으로 펼친다
  useEffect(() => {
    if (!highlightCommentId || comments.length === 0) return;
    const target = comments.find((c) => c.id === highlightCommentId);
    if (target?.parent_id) {
      setExpandedParents((prev) => new Set([...prev, target.parent_id as string]));
    }
  }, [highlightCommentId, comments]);

  function bumpCounts(counts: Record<string, number> | undefined, delta: Record<number, number>) {
    const next = { ...(counts ?? {}) };
    for (const [k, d] of Object.entries(delta)) {
      const cur = next[k] ?? 0;
      next[k] = Math.max(0, cur + d);
    }
    return next;
  }

  async function toggleLike(i: number) {
    if (myReact === i) {
      // 취소
      setMyReact(null);
      setPost((p) => {
        if (!p) return p;
        const updated = {
          ...p,
          like_count: Math.max(0, p.like_count - 1),
          reactionCounts: bumpCounts(p.reactionCounts, { [i]: -1 }),
        };
        patchBoardPost(id, { like_count: updated.like_count });
        return updated;
      });
      try { await api.post(`/posts/${id}/like`, { reaction: i }); } catch {}
    } else if (myReact === null) {
      // 첫 반응
      setMyReact(i);
      setPost((p) => {
        if (!p) return p;
        const updated = {
          ...p,
          like_count: p.like_count + 1,
          reactionCounts: bumpCounts(p.reactionCounts, { [i]: 1 }),
        };
        patchBoardPost(id, { like_count: updated.like_count });
        return updated;
      });
      try { await api.post(`/posts/${id}/like`, { reaction: i }); } catch {}
    } else {
      // 변경 (이전 카운트 -1, 새 카운트 +1)
      const prev = myReact;
      setMyReact(i);
      setPost((p) => {
        if (!p) return p;
        return {
          ...p,
          reactionCounts: bumpCounts(p.reactionCounts, { [prev]: -1, [i]: 1 }),
        };
      });
      try {
        await api.post(`/posts/${id}/like`, { reaction: prev });
        await api.post(`/posts/${id}/like`, { reaction: i });
      } catch { setMyReact(prev); }
    }
  }

  async function deleteComment(commentId: string) {
    try {
      await api.delete(`/posts/${id}/comments/${commentId}`);
      load();
    } catch (e) { Alert.alert('삭제 실패', (e as Error).message); }
  }

  function openCommentMenu(c: Comment) {
    const mine = c.user_id === myUserId;
    if (mine) {
      Alert.alert('댓글 관리', '', [
        {
          text: '✏️ 수정하기', onPress: () => {
            setEditingComment(c);
            setEditCommentContent(c.content);
          },
        },
        {
          text: '🗑️ 삭제', style: 'destructive', onPress: () => {
            Alert.alert('댓글 삭제', '삭제하면 복구할 수 없어요.', [
              { text: '취소', style: 'cancel' },
              { text: '삭제', style: 'destructive', onPress: () => deleteComment(c.id) },
            ]);
          },
        },
        { text: '닫기', style: 'cancel' },
      ]);
    } else {
      Alert.alert('댓글 메뉴', '', [
        { text: '🚨 신고하기', onPress: () => setReportTarget({ type: 'comment', id: c.id }) },
        { text: '취소', style: 'cancel' },
      ]);
    }
  }

  async function saveCommentEdit() {
    if (!editingComment || !editCommentContent.trim()) return;
    setEditCommentSaving(true);
    try {
      await api.patch(`/posts/${id}/comments/${editingComment.id}`, { content: editCommentContent.trim() });
      setEditingComment(null);
      load();
    } catch (e) { Alert.alert('수정 실패', (e as Error).message); }
    finally { setEditCommentSaving(false); }
  }

  async function submitComment() {
    if (!draft.trim()) return;
    setSending(true);
    const content = draft;
    const parentId = replyTo?.id ?? null;
    setDraft('');
    setReplyTo(null);
    let tempId: string | null = null;
    if (meProfile) {
      const tid = `temp-${Date.now()}`;
      tempId = tid;
      setComments(prev => [...prev, {
        id: tid, content, parent_id: parentId,
        nickname: meProfile.nickname, gender: meProfile.gender,
        created_at: Date.now(), user_id: myUserId ?? undefined,
      }]);
      if (parentId) setExpandedParents(prev => new Set([...prev, parentId]));
    }
    try {
      await api.post(`/posts/${id}/comments`, {
        content,
        ...(parentId ? { parentId } : {}),
      });
      load();
    } catch (e) {
      if (tempId) setComments(prev => prev.filter(c => c.id !== tempId));
      setDraft(content);
      Alert.alert('댓글 실패', (e as Error).message);
    }
    finally { setSending(false); }
  }

  function openEdit() {
    if (!post) return;
    setEditTitle(post.title);
    setEditContent(post.content);
    setEditCategory(post.category);
    setEditVisible(true);
  }

  async function saveEdit() {
    if (!editTitle.trim() || !editContent.trim()) return;
    setEditSaving(true);
    try {
      await api.patch(`/posts/${id}`, {
        title: editTitle.trim(),
        content: editContent.trim(),
        category: editCategory,
      });
      setEditVisible(false);
      load();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('forbidden_category')) {
        Alert.alert('카테고리 변경 불가', '해당 게시판은 지정된 성별만 이용할 수 있어요');
      } else {
        Alert.alert('수정 실패', msg);
      }
    }
    finally { setEditSaving(false); }
  }

  function confirmDelete() {
    Alert.alert('게시글 삭제', '삭제하면 복구할 수 없어요. 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/posts/${id}`);
            router.back();
          } catch (e) { Alert.alert('삭제 실패', (e as Error).message); }
        },
      },
    ]);
  }

  async function submitReport(targetType: string, targetId: string, reason: string) {
    try {
      await api.post('/reports', { targetType, targetId, reason });
      Alert.alert('신고 완료', '검토 후 조치하겠습니다');
    } catch { Alert.alert('오류', '신고에 실패했어요'); }
  }

  function openMenu() {
    if (!post) return;
    if (post.user_id === myUserId) {
      Alert.alert('게시글 관리', '', [
        { text: '✏️ 수정', onPress: openEdit },
        { text: '🗑️ 삭제', style: 'destructive', onPress: confirmDelete },
        { text: '취소', style: 'cancel' },
      ]);
    } else {
      Alert.alert('게시글 메뉴', '', [
        { text: '🚨 신고하기', onPress: () => setReportTarget({ type: 'post', id }) },
        { text: '취소', style: 'cancel' },
      ]);
    }
  }

  const insets = useSafeAreaInsets();
  if (!post) return <ActivityIndicator style={{ marginTop: 40 }} />;
  const cat = CATEGORY_COLORS[post.category] ?? { label: post.category, color: colors.textSub };
  const isMine = post.user_id === myUserId;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 20) }]}>
        <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
          <Text style={{ fontSize: 22, color: colors.text }}>←</Text>
        </Pressable>
        <Tag label={cat.label} color={cat.color} />
        <View style={{ flex: 1 }} />
        <Pressable onPress={openMenu} style={{ padding: 8 }}>
          <Text style={{ fontSize: 20, color: colors.textSub }}>⋯</Text>
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* 본문 */}
        <View style={{ padding: 20, backgroundColor: colors.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Avatar gender={post.gender} size={36} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{post.nickname}</Text>
                <GenderDot gender={post.gender} />
              </View>
              <Text style={{ fontSize: 11, color: colors.textSub, marginTop: 2 }}>
                {[getDivorceTitle(post.divorce_year, post.divorce_month, post.gender), timeAgo(post.created_at)].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>

          <Text style={[typography.h1, { color: colors.text, marginBottom: 12, lineHeight: 30 }]}>
            {post.title}
          </Text>

          <Text style={{ fontSize: 15, color: colors.text, lineHeight: 26, letterSpacing: -0.1, marginBottom: 20 }}>
            {post.content}
          </Text>

          {/* 반응 픽커 */}
          <View style={styles.reactPicker}>
            {REACTIONS.map((r, i) => {
              const active = myReact === i;
              const count = post.reactionCounts?.[String(i)] ?? 0;
              return (
                <Pressable
                  key={r.emoji}
                  onPress={() => toggleLike(i)}
                  style={{
                    flex: 1, paddingVertical: 8,
                    backgroundColor: active ? colors.accent : 'transparent',
                    borderRadius: 10, alignItems: 'center', gap: 2,
                  }}
                >
                  <Text style={{ fontSize: 22, transform: [{ scale: active ? 1.15 : 1 }] }}>{r.emoji}</Text>
                  <Text style={{ fontSize: 10, fontWeight: active ? '700' : '500', color: active ? colors.primaryDark : colors.textSub }}>{r.label}</Text>
                  {count > 0 && <Text style={{ fontSize: 10, color: colors.textLight, fontWeight: '600' }}>{count}</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 댓글 */}
        <View style={{ padding: 14, paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSub, letterSpacing: -0.1 }}>
            댓글 {comments.filter(c => !c.parent_id).length}개
          </Text>
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}>
          {(() => {
            const topLevel = comments.filter(c => !c.parent_id);
            const byParent: Record<string, Comment[]> = {};
            for (const c of comments) {
              if (c.parent_id) (byParent[c.parent_id] ??= []).push(c);
            }
            const PREVIEW = 2;

            return topLevel.map(parent => {
              const replies = byParent[parent.id] ?? [];
              const isExpanded = expandedParents.has(parent.id);
              const visible = replies.length > PREVIEW && !isExpanded ? replies.slice(0, PREVIEW) : replies;
              const hiddenCount = replies.length - visible.length;
              const pMine = parent.user_id === myUserId;
              const isOP = parent.user_id === post!.user_id;
              const pEditing = editingComment?.id === parent.id;

              const pHighlight = parent.id === highlightCommentId;
              return (
                <View key={parent.id}>
                  {/* 부모 댓글 */}
                  <View style={{
                    padding: 14,
                    backgroundColor: pHighlight ? colors.accent : pMine ? colors.accent + '66' : colors.card,
                    borderWidth: 1,
                    borderColor: pHighlight ? colors.primary : pMine ? colors.primary + '33' : colors.border,
                    borderRadius: 14,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Avatar gender={parent.gender} size={24} />
                      <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.text }}>
                        {parent.nickname?.split(' ')[0] ?? ''}
                      </Text>
                      {pMine && <Text style={{ fontSize: 10, color: colors.primaryDark, fontWeight: '700' }}>(나)</Text>}
                      {isOP && (
                        <View style={{ paddingHorizontal: 5, paddingVertical: 1, backgroundColor: colors.primary + '22', borderRadius: 5 }}>
                          <Text style={{ fontSize: 9, color: colors.primary, fontWeight: '700' }}>작성자</Text>
                        </View>
                      )}
                      <GenderDot gender={parent.gender} />
                      <View style={{ flex: 1 }} />
                      <Text style={{ fontSize: 10, color: colors.textLight }}>{timeAgo(parent.created_at)}</Text>
                      <Pressable onPress={() => openCommentMenu(parent)} style={{ padding: 4, marginLeft: 2 }}>
                        <Text style={{ fontSize: 16, color: colors.textSub }}>⋯</Text>
                      </Pressable>
                    </View>
                    {pEditing ? (
                      <View>
                        <TextInput style={[styles.input, { marginBottom: 8 }]}
                          value={editCommentContent} onChangeText={setEditCommentContent}
                          multiline autoFocus />
                        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                          <Pressable onPress={() => setEditingComment(null)} style={{ padding: 8 }}>
                            <Text style={{ fontSize: 13, color: colors.textSub }}>취소</Text>
                          </Pressable>
                          <Pressable onPress={saveCommentEdit} disabled={editCommentSaving}
                            style={{ padding: 8, backgroundColor: colors.primary, borderRadius: 8 }}>
                            <Text style={{ fontSize: 13, color: '#fff', fontWeight: '700' }}>
                              {editCommentSaving ? '저장 중...' : '저장'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <Text style={{ fontSize: 13.5, color: colors.text, lineHeight: 21 }}>{parent.content}</Text>
                    )}
                    {!pEditing && (
                      <Pressable onPress={() => setReplyTo({ id: parent.id, nickname: parent.nickname?.split(' ')[0] ?? '익명' })}
                        style={{ marginTop: 8, alignSelf: 'flex-start' }}>
                        <Text style={{ fontSize: 11, color: colors.textSub }}>↩ 답글</Text>
                      </Pressable>
                    )}
                  </View>

                  {/* 대댓글 묶음 */}
                  {(visible.length > 0 || hiddenCount > 0) && (
                    <View style={{ marginLeft: 20, marginTop: 4, gap: 4 }}>
                      {visible.map(reply => {
                        const rMine = reply.user_id === myUserId;
                        const rIsOP = reply.user_id === post!.user_id;
                        const rEditing = editingComment?.id === reply.id;
                        const rHighlight = reply.id === highlightCommentId;
                        return (
                          <View key={reply.id} style={{
                            padding: 12,
                            backgroundColor: rHighlight ? colors.accent : colors.bg,
                            borderWidth: 1, borderColor: rHighlight ? colors.primary : colors.border,
                            borderLeftWidth: 3, borderLeftColor: colors.primary + '50',
                            borderRadius: 12,
                          }}>
                            <Text style={{ fontSize: 9, color: colors.textLight, marginBottom: 4 }}>↳ 답글</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                              <Avatar gender={reply.gender} size={20} />
                              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>
                                {reply.nickname?.split(' ')[0] ?? ''}
                              </Text>
                              {rMine && <Text style={{ fontSize: 10, color: colors.primaryDark, fontWeight: '700' }}>(나)</Text>}
                              {rIsOP && (
                                <View style={{ paddingHorizontal: 5, paddingVertical: 1, backgroundColor: colors.primary + '22', borderRadius: 5 }}>
                                  <Text style={{ fontSize: 9, color: colors.primary, fontWeight: '700' }}>작성자</Text>
                                </View>
                              )}
                              <GenderDot gender={reply.gender} />
                              <View style={{ flex: 1 }} />
                              <Text style={{ fontSize: 10, color: colors.textLight }}>{timeAgo(reply.created_at)}</Text>
                              <Pressable onPress={() => openCommentMenu(reply)} style={{ padding: 4 }}>
                                <Text style={{ fontSize: 15, color: colors.textSub }}>⋯</Text>
                              </Pressable>
                            </View>
                            {rEditing ? (
                              <View>
                                <TextInput style={[styles.input, { marginBottom: 8 }]}
                                  value={editCommentContent} onChangeText={setEditCommentContent}
                                  multiline autoFocus />
                                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                                  <Pressable onPress={() => setEditingComment(null)} style={{ padding: 8 }}>
                                    <Text style={{ fontSize: 13, color: colors.textSub }}>취소</Text>
                                  </Pressable>
                                  <Pressable onPress={saveCommentEdit} disabled={editCommentSaving}
                                    style={{ padding: 8, backgroundColor: colors.primary, borderRadius: 8 }}>
                                    <Text style={{ fontSize: 13, color: '#fff', fontWeight: '700' }}>
                                      {editCommentSaving ? '저장 중...' : '저장'}
                                    </Text>
                                  </Pressable>
                                </View>
                              </View>
                            ) : (
                              <Text style={{ fontSize: 13, color: colors.text, lineHeight: 20 }}>{reply.content}</Text>
                            )}
                            {!rEditing && (
                              <Pressable onPress={() => setReplyTo({ id: parent.id, nickname: parent.nickname?.split(' ')[0] ?? '익명' })}
                                style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                                <Text style={{ fontSize: 11, color: colors.textSub }}>↩ 답글</Text>
                              </Pressable>
                            )}
                          </View>
                        );
                      })}
                      {hiddenCount > 0 && (
                        <Pressable
                          onPress={() => setExpandedParents(prev => new Set([...prev, parent.id]))}
                          style={{ padding: 10, alignItems: 'center', backgroundColor: colors.tag, borderRadius: 10 }}>
                          <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                            ↓ 대댓글 {hiddenCount}개 더 보기
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            });
          })()}
        </View>
      </ScrollView>

      {/* 답글 대상 표시 */}
      {replyTo && (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, backgroundColor: colors.accent + '55', borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={{ flex: 1, fontSize: 12, color: colors.textSub }}>↩ {replyTo.nickname}에게 답글</Text>
          <Pressable onPress={() => setReplyTo(null)}>
            <Text style={{ fontSize: 16, color: colors.textSub, padding: 4 }}>✕</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={replyTo ? `${replyTo.nickname}에게 답글...` : '따뜻한 말 한마디...'}
          placeholderTextColor={colors.textLight}
          editable={!sending}
        />
        <Pressable
          onPress={submitComment}
          disabled={!draft.trim() || sending}
          style={{
            paddingHorizontal: 16, paddingVertical: 10,
            borderRadius: radius.full,
            backgroundColor: draft.trim() ? colors.primary : colors.tag,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: draft.trim() ? '#fff' : colors.textLight }}>
            {sending ? '...' : '등록'}
          </Text>
        </Pressable>
      </View>

      {/* 게시글 수정 모달 */}
      <Modal visible={editVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setEditVisible(false)}>
              <Text style={{ fontSize: 15, color: colors.textSub }}>취소</Text>
            </Pressable>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>게시글 수정</Text>
            <Pressable onPress={saveEdit} disabled={editSaving}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: editSaving ? colors.textLight : colors.primary }}>
                {editSaving ? '저장 중' : '저장'}
              </Text>
            </Pressable>
          </View>
          <ScrollView style={{ flex: 1, padding: 20 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSub, marginBottom: 8 }}>게시판</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {EDIT_CATEGORIES
                  .filter((c) => {
                    // 성별 전용 방은 해당 성별만 노출 (meProfile 없으면 모두 노출 — 서버가 최종 검증)
                    if (!meProfile) return true;
                    if (c.id === 'men_only' && meProfile.gender !== 'M') return false;
                    if (c.id === 'women_only' && meProfile.gender !== 'F') return false;
                    return true;
                  })
                  .map((c) => {
                    const active = editCategory === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setEditCategory(c.id)}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 8,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: active ? c.color : colors.border,
                          backgroundColor: active ? c.color : colors.card,
                        }}
                      >
                        <Text style={{ fontSize: 13, color: active ? '#fff' : colors.text, fontWeight: active ? '700' : '400' }}>
                          {c.label}
                        </Text>
                      </Pressable>
                    );
                  })}
              </View>
            </ScrollView>

            <TextInput
              style={styles.editTitle}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="제목"
              placeholderTextColor={colors.textLight}
              maxLength={100}
            />
            <TextInput
              style={styles.editContent}
              value={editContent}
              onChangeText={setEditContent}
              placeholder="내용을 입력하세요"
              placeholderTextColor={colors.textLight}
              multiline
              textAlignVertical="top"
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* 신고 모달 */}
      <Modal visible={!!reportTarget} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setReportTarget(null)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 }}>신고 사유 선택</Text>
                <Pressable onPress={() => setReportTarget(null)} style={{ padding: 4 }}>
                  <Text style={{ fontSize: 22, color: colors.textSub, lineHeight: 24 }}>✕</Text>
                </Pressable>
              </View>
              {[
                { label: '🔐 개인정보 포함', reason: '개인정보 포함' },
                { label: '🤬 욕설 / 혐오 발언', reason: '욕설/혐오 발언' },
                { label: '📢 스팸 / 홍보', reason: '스팸/홍보' },
                { label: '🚫 기타', reason: '기타' },
              ].map((opt) => (
                <Pressable
                  key={opt.reason}
                  onPress={async () => {
                    if (!reportTarget) return;
                    setReportTarget(null);
                    await submitReport(reportTarget.type, reportTarget.id, opt.reason);
                  }}
                  style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
                >
                  <Text style={{ fontSize: 15, color: colors.text }}>{opt.label}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setReportTarget(null)} style={{ paddingTop: 16, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: colors.textSub }}>취소</Text>
              </Pressable>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function timeAgo(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  reactPicker: {
    flexDirection: 'row', gap: 6, padding: 12,
    borderRadius: 14, backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
  },
  inputRow: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    padding: 14, paddingBottom: 18,
    backgroundColor: colors.card,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bg, fontSize: 13, color: colors.text,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  editTitle: {
    fontSize: 18, fontWeight: '700', color: colors.text,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingBottom: 14, marginBottom: 16,
  },
  editContent: {
    fontSize: 15, color: colors.text, lineHeight: 26,
    minHeight: 300,
  },
});
