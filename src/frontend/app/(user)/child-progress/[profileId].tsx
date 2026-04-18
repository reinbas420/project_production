import issueService from '@/api/services/issueService';
import { NavBar, NAV_BOTTOM_PAD } from '@/components/NavBar';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import useAppStore from '@/store/useAppStore';
import useChildTrackingStore, { type QuizResult } from '@/store/useChildTrackingStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function PctBar({ pct }: { pct: number }) {
  const color = pct >= 75 ? Colors.success : pct >= 50 ? Colors.accentSage : Colors.accentPeach;
  return (
    <View style={p.track}>
      <View style={[p.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}
const p = StyleSheet.create({
  track: { height: 6, backgroundColor: Colors.cardBorder, borderRadius: Radius.full, overflow: 'hidden', flex: 1 },
  fill: { height: '100%', borderRadius: Radius.full },
});

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ emoji, value, label, color }: { emoji: string; value: number; label: string; color: string }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statEmoji}>{emoji}</Text>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ChildProgressScreen() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const router = useRouter();
  const { userId, profiles } = useAppStore();
  const { getQuizResults, getQuizzesPassed } = useChildTrackingStore();

  const child = profiles.find(p => p.profileId === profileId);

  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const quizResults: QuizResult[] = getQuizResults(profileId ?? '');
  const quizzesPassed = getQuizzesPassed(profileId ?? '');
  const booksActive = issues.filter(i => i.status === 'ISSUED').length;
  const booksReturned = issues.filter(i => i.status === 'RETURNED').length;

  useEffect(() => {
    if (!userId || !profileId) { setLoading(false); return; }
    let active = true;
    issueService.getUserIssues(userId, profileId).then((res: any) => {
      if (active) setIssues(res?.data?.issues || []);
    }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, profileId]);

  return (
    <SafeAreaView style={s.safe}>
      {Platform.OS === 'web' && <NavBar role="user" active="home" />}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Back */}
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.childAvatar}>🧒</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.childName}>{child?.name ?? 'Child'}</Text>
            <Text style={s.childSub}>Reading & Quiz progress</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <StatCard emoji="📚" value={issues.length} label="Borrowed" color={Colors.accentSage} />
          <StatCard emoji="📖" value={booksActive} label="Active" color={Colors.accentPeriwinkle} />
          <StatCard emoji="✅" value={booksReturned} label="Returned" color={Colors.success} />
          <StatCard emoji="🧠" value={quizzesPassed} label="Quizzes passed" color={Colors.accentPeach} />
        </View>

        {/* ── Borrowed books ── */}
        <Text style={s.sectionTitle}>Books Borrowed</Text>
        {loading ? (
          <ActivityIndicator color={Colors.accentSage} style={{ marginVertical: Spacing.lg }} />
        ) : issues.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>No books borrowed yet.</Text>
            <Text style={s.emptySub}>Books borrowed by {child?.name ?? 'your child'} will appear here.</Text>
          </View>
        ) : (
          issues.map((issue) => {
            const bookTitle = issue.copyId?.bookId?.title ?? issue.bookId?.title ?? 'Unknown Book';
            const bookAuthor = issue.copyId?.bookId?.author ?? issue.bookId?.author ?? '';
            const libraryName = issue.copyId?.branchId?.name ?? '';
            const isOverdue = issue.status === 'ISSUED' && new Date(issue.dueDate) < new Date();
            const statusColor = issue.status === 'RETURNED'
              ? Colors.success
              : isOverdue ? Colors.error : Colors.accentSage;
            const statusLabel = issue.status === 'RETURNED' ? '✅ Returned'
              : isOverdue ? '⚠️ Overdue' : '📖 Borrowed';

            return (
              <View key={issue._id} style={s.bookCard}>
                <View style={[s.bookDot, { backgroundColor: statusColor }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.bookTitle} numberOfLines={1}>{bookTitle}</Text>
                  {bookAuthor ? <Text style={s.bookAuthor}>by {bookAuthor}{libraryName ? `  ·  ${libraryName}` : ''}</Text> : null}
                  <View style={s.bookMeta}>
                    <Text style={[s.bookStatus, { color: statusColor }]}>{statusLabel}</Text>
                    {issue.dueDate && issue.status === 'ISSUED' && (
                      <Text style={[s.bookDue, isOverdue && { color: Colors.error }]}>
                        Due {fmtDate(issue.dueDate)}
                      </Text>
                    )}
                    {issue.issueDate && (
                      <Text style={s.bookDue}>Issued {fmtDate(issue.issueDate)}</Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* ── Quiz history ── */}
        <Text style={[s.sectionTitle, { marginTop: Spacing.xl }]}>Quiz History</Text>
        {quizResults.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>No quizzes taken yet.</Text>
            <Text style={s.emptySub}>Quiz results will appear here after {child?.name ?? 'your child'} completes a quiz.</Text>
          </View>
        ) : (
          quizResults.map((result, idx) => {
            const passed = result.pct >= 50;
            const emoji = result.pct === 100 ? '🏆' : result.pct >= 75 ? '🌟' : passed ? '👍' : '📖';
            return (
              <View key={idx} style={s.quizCard}>
                <View style={s.quizTop}>
                  <Text style={s.quizEmoji}>{emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.quizBook} numberOfLines={1}>{result.bookTitle}</Text>
                    <Text style={s.quizDate}>{fmtDate(result.date)}</Text>
                  </View>
                  <View style={[s.quizScorePill, { backgroundColor: passed ? Colors.accentSageLight : Colors.browseSurface }]}>
                    <Text style={[s.quizScoreText, { color: passed ? Colors.accentSage : Colors.textMuted }]}>
                      {result.score}/{result.total}
                    </Text>
                  </View>
                </View>
                <View style={s.quizBarRow}>
                  <PctBar pct={result.pct} />
                  <Text style={[s.quizPct, { color: passed ? Colors.success : Colors.textMuted }]}>{result.pct}%</Text>
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
      {Platform.OS !== 'web' && <NavBar role="user" active="home" />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: NAV_BOTTOM_PAD + Spacing.xl },

  backBtn: { marginTop: Spacing.md, marginBottom: Spacing.lg },
  backText: { fontSize: Typography.body, color: Colors.accentSage, fontWeight: '700' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  childAvatar: { fontSize: 40 },
  childName: { fontSize: Typography.title, fontWeight: '800', color: Colors.accentSage },
  childSub: { fontSize: Typography.label, color: Colors.textSecondary, marginTop: 2 },

  statsRow: {
    flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg,
    paddingVertical: Spacing.md, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  statEmoji: { fontSize: 20 },
  statValue: { fontSize: Typography.title, fontWeight: '800' },
  statLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },

  sectionTitle: {
    fontSize: Typography.body + 1, fontWeight: '800',
    color: Colors.textPrimary, marginBottom: Spacing.sm,
  },

  emptyBox: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.lg, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  emptyText: { fontSize: Typography.body, fontWeight: '700', color: Colors.textPrimary },
  emptySub: { fontSize: Typography.label, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Book cards
  bookCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  bookDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  bookTitle: { fontSize: Typography.body, fontWeight: '700', color: Colors.textPrimary },
  bookAuthor: { fontSize: Typography.label, color: Colors.textSecondary, marginTop: 2 },
  bookMeta: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' },
  bookStatus: { fontSize: Typography.label, fontWeight: '700' },
  bookDue: { fontSize: Typography.label - 1, color: Colors.textMuted, fontWeight: '600' },

  // Quiz cards
  quizCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.cardBorder, gap: Spacing.sm,
  },
  quizTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  quizEmoji: { fontSize: 28 },
  quizBook: { fontSize: Typography.body, fontWeight: '700', color: Colors.textPrimary },
  quizDate: { fontSize: Typography.label, color: Colors.textMuted, marginTop: 2 },
  quizScorePill: {
    borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6,
  },
  quizScoreText: { fontSize: Typography.body, fontWeight: '800' },
  quizBarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  quizPct: { fontSize: Typography.label, fontWeight: '800', minWidth: 38, textAlign: 'right' },
});
