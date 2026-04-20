import { useCallback, useState } from 'react';
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

interface Post {
  id: string; title: string; content: string; category: string;
  user_id: string; nickname: string; gender: 'M' | 'F'; age_range: string;
  divorce_year: number | null; divorce_month: number | null;
  like_count: number; comment_count: number; created_at: number;
  myReaction?: number | null;
}

function divorceTag(year: number | null, month: number | null): string {
  if (!year) return '';
  const now = new Date();
  const totalMonths = (now.getFullYear() - year) * 12 + (now.getMonth() + 1) - (month ?? 6);
  if (totalMonths < 1) return '이혼 예정';
  if (totalMonths < 12) return `이혼 ${totalMonths}개월차`;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  return m === 0 ? `이혼 ${y}년차` : `이혼 ${y}년 ${m}개월차`;
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
  men_only: { label: '남성방', color: '#5B8FC9' },
  women_only: { label: '여성방', color: '#D4728C' },
};

const REACTIONS = [
  { emoji: '💛', label: '공감돼요' },
  { emoji: '🫂', label: '안아줄게요' },
  { emoji: '💪', label: '힘내요' },
  { emoji: '😂', label: '웃겨요' },
];

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const myUserId = useAuth((s) => s.userId);
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [myReact, setMyReact] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; nickname: string } | null>(null);

  const [editVisible, setEditVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [editCommentSaving, setEditCommentSaving] = useState(false);

  const [reportTarget, setReportTarget] = useState<{ type: string; id: string } | null>(null);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      api.get<Post>(`/posts/${id}`),
      api.get<{ items: Comment[] }>(`/posts/${id}/comments`),
    ]);
    setPost(p);
    setComments(c.items);
    setMyReact(p.myReaction ?? null);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggleLike(i: number) {
    if (myReact === i) {
      setMyReact(null);
      setPost((p) => {
        const updated = p ? { ...p, like_count: Math.max(0, p.like_count - 1) } : p;
        if (updated) patchBoardPost(id, { like_count: updated.like_count });
        return updated;
      });
      try { await api.post(`/posts/${id}/like`, { reaction: i }); } catch {}
    } else if (myReact === null) {
      setMyReact(i);
      setPost((p) => {
        const updated = p ? { ...p, like_count: p.like_count + 1 } : p;
        if (updated) patchBoardPost(id, { like_count: updated.like_count });
        return updated;
      });
      try { await api.post(`/posts/${id}/like`, { reaction: i }); } catch {}
    } else {
      const prev = myReact;
      setMyReact(i);
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
    try {
      await api.post(`/posts/${id}/comments`, {
        content: draft,
        ...(replyTo ? { parentId: replyTo.id } : {}),
      });
      setDraft('');
      setReplyTo(null);
      load();
    } catch (e) { Alert.alert('댓글 실패', (e as Error).message); }
    finally { setSending(false); }
  }

  function openEdit() {
    if (!post) return;
    setEditTitle(post.title);
    setEditContent(post.content);
    setEditVisible(true);
  }

  async function saveEdit() {
    if (!editTitle.trim() || !editContent.trim()) return;
    setEditSaving(true);
    try {
      await api.patch(`/posts/${id}`, { title: editTitle.trim(), content: editContent.trim() });
      setEditVisible(false);
      load();
    } catch (e) { Alert.alert('수정 실패', (e as Error).message); }
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
                {divorceTag(post.divorce_year, post.divorce_month) || post.age_range} · {timeAgo(post.created_at)}
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
              const count = i === 0 ? (myReact === null || myReact === 0 ? post.like_count : 0) : (active ? 1 : 0);
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
            댓글 {comments.length}개
          </Text>
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}>
          {comments.map((c) => {
            const mine = c.user_id === myUserId;
            const isReply = !!c.parent_id;
            const isEditing = editingComment?.id === c.id;
            return (
              <View key={c.id} style={isReply ? { marginLeft: 28 } : undefined}>
                <View
                  style={{
                    padding: 14,
                    backgroundColor: isReply ? colors.bg : mine ? colors.accent + '66' : colors.card,
                    borderWidth: 1,
                    borderColor: isReply ? colors.border : mine ? colors.primary + '33' : colors.border,
                    borderRadius: 14,
                  }}
                >
                  {isReply && (
                    <Text style={{ fontSize: 10, color: colors.textLight, marginBottom: 4 }}>↳ 답글</Text>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Avatar gender={c.gender} size={24} />
                    <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.text }}>
                      {c.nickname?.split(' ')[0] ?? ''}
                      {mine && <Text style={{ color: colors.primaryDark, fontWeight: '700' }}> (나)</Text>}
                    </Text>
                    <GenderDot gender={c.gender} />
                    <View style={{ flex: 1 }} />
                    <Text style={{ fontSize: 10, color: colors.textLight }}>{timeAgo(c.created_at)}</Text>
                    <Pressable onPress={() => openCommentMenu(c)} style={{ padding: 4, marginLeft: 2 }}>
                      <Text style={{ fontSize: 16, color: colors.textSub }}>⋯</Text>
                    </Pressable>
                  </View>
                  {isEditing ? (
                    <View>
                      <TextInput
                        style={[styles.input, { marginBottom: 8 }]}
                        value={editCommentContent}
                        onChangeText={setEditCommentContent}
                        multiline
                        autoFocus
                      />
                      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                        <Pressable onPress={() => setEditingComment(null)} style={{ padding: 8 }}>
                          <Text style={{ fontSize: 13, color: colors.textSub }}>취소</Text>
                        </Pressable>
                        <Pressable
                          onPress={saveCommentEdit}
                          disabled={editCommentSaving}
                          style={{ padding: 8, backgroundColor: colors.primary, borderRadius: 8 }}
                        >
                          <Text style={{ fontSize: 13, color: '#fff', fontWeight: '700' }}>
                            {editCommentSaving ? '저장 중...' : '저장'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 13.5, color: colors.text, lineHeight: 21 }}>{c.content}</Text>
                  )}
                  {!isReply && !isEditing && (
                    <Pressable
                      onPress={() => setReplyTo({ id: c.id, nickname: c.nickname?.split(' ')[0] ?? '익명' })}
                      style={{ marginTop: 8, alignSelf: 'flex-start' }}
                    >
                      <Text style={{ fontSize: 11, color: colors.textSub }}>↩ 답글</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
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
