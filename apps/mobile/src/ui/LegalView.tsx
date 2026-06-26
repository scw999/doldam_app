import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, typography, radius } from '@/theme';
import type { LegalDoc } from '@/legal/content';

export function LegalView({ doc }: { doc: LegalDoc }) {
  return (
    <ScrollView style={s.container} contentContainerStyle={s.scroll}>
      <Text style={s.title}>{doc.title}</Text>
      <Text style={s.effective}>시행일: {doc.effectiveDate}</Text>

      {doc.intro && (
        <View style={s.introBox}>
          <Text style={s.intro}>{doc.intro}</Text>
        </View>
      )}

      {doc.sections.map((sec, i) => (
        <View key={i} style={s.section}>
          <Text style={s.sectionTitle}>{sec.title}</Text>
          {sec.paragraphs.map((p, j) => (
            p ? <Text key={j} style={s.paragraph}>{p}</Text> : <View key={j} style={{ height: 8 }} />
          ))}
          {sec.bullets && sec.bullets.length > 0 && (
            <View style={s.bullets}>
              {sec.bullets.map((b, j) => (
                <View key={j} style={s.bulletRow}>
                  <Text style={s.bulletDot}>•</Text>
                  <Text style={s.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

  title: { ...typography.h1, color: colors.text, marginBottom: 4 },
  effective: { fontSize: 12, color: colors.textSub, marginBottom: spacing.lg },

  introBox: {
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  intro: { fontSize: 13, color: colors.text, lineHeight: 20 },

  section: { marginBottom: spacing.lg },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  paragraph: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 21,
    marginBottom: 6,
  },
  bullets: { marginTop: 4 },
  bulletRow: { flexDirection: 'row', paddingVertical: 3 },
  bulletDot: {
    fontSize: 13,
    color: colors.primary,
    marginRight: 8,
    marginTop: 1,
    fontWeight: '700',
  },
  bulletText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 20 },
});
