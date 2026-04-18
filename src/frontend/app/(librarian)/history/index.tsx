import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

const { width } = Dimensions.get('window');

interface IssueRecord {
  id: string;
  memberName: string;
  memberType: 'adult' | 'child';
  bookTitle: string;
  issueDate: string;
  dueDate: string;
  returnDate?: string;
  status: 'active' | 'returned' | 'overdue';
  fine?: number;
}

const HISTORY: IssueRecord[] = [
  { id: 'h1', memberName: 'Priya M.',   memberType: 'adult', bookTitle: 'The Alchemist',              issueDate: 'Feb 20', dueDate: 'Mar 12', status: 'active' },
  { id: 'h2', memberName: 'Aarav S.',   memberType: 'child', bookTitle: 'Charlotte\'s Web',            issueDate: 'Feb 18', dueDate: 'Mar 4',  status: 'overdue', fine: 4 },
  { id: 'h3', memberName: 'Rahul T.',   memberType: 'adult', bookTitle: 'Harry Potter (Book 1)',       issueDate: 'Feb 14', dueDate: 'Feb 28', status: 'returned', returnDate: 'Feb 27' },
  { id: 'h4', memberName: 'Meera K.',   memberType: 'adult', bookTitle: 'To Kill a Mockingbird',       issueDate: 'Feb 10', dueDate: 'Feb 24', status: 'returned', returnDate: 'Feb 23' },
  { id: 'h5', memberName: 'Sia L.',     memberType: 'child', bookTitle: 'Matilda',                     issueDate: 'Feb 8',  dueDate: 'Feb 22', status: 'overdue', fine: 10 },
  { id: 'h6', memberName: 'Dev P.',     memberType: 'adult', bookTitle: 'The Great Gatsby',            issueDate: 'Jan 30', dueDate: 'Feb 13', status: 'returned', returnDate: 'Feb 12' },
  { id: 'h7', memberName: 'Ananya R.',  memberType: 'adult', bookTitle: 'The Hobbit',                  issueDate: 'Jan 20', dueDate: 'Feb 3',  status: 'returned', returnDate: 'Feb 3' },
  { id: 'h8', memberName: 'Kiran W.',   memberType: 'child', bookTitle: 'The Very Hungry Caterpillar', issueDate: 'Jan 12', dueDate: 'Jan 26', status: 'returned', returnDate: 'Jan 24' },
];

const STATUS_CFG: Record<string, { label: string; bg: string; textColor: string }> = {
  active:   { label: '📖 Active',  bg: '#E8F5E9', textColor: Colors.success },
  returned: { label: '✅ Returned', bg: Colors.accentSageLight + '55', textColor: Colors.accentSage },
  overdue:  { label: '⚠️ Overdue', bg: '#FFEBEE', textColor: Colors.error },
};

type Filter = 'all' | 'active' | 'returned' | 'overdue';

export default function LibrarianHistory() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');

  const filters: { id: Filter; label: string }[] = [
    { id: 'all',      label: 'All' },
    { id: 'active',   label: '📖 Active' },
    { id: 'overdue',  label: '⚠️ Overdue' },
    { id: 'returned', label: '✅ Returned' },
  ];

  const shown = filter === 'all' ? HISTORY : HISTORY.filter(h => h.status === filter);
  const totalFines = HISTORY.filter(h => h.fine).reduce((a, h) => a + (h.fine ?? 0), 0);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.title}>Issue History</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Summary strip */}
        <View style={s.summaryStrip}>
          {[
            ['📤', `${HISTORY.filter(h => h.status === 'active').length}`, 'Active'],
            ['⚠️', `${HISTORY.filter(h => h.status === 'overdue').length}`, 'Overdue'],
            ['✅', `${HISTORY.filter(h => h.status === 'returned').length}`, 'Returned'],
            ['💰', `₹${totalFines}`, 'Fines Due'],
          ].map(([icon, val, label], i, arr) => (
            <View key={label} style={[s.summaryItem, i < arr.length - 1 && s.summaryBorder]}>
              <Text style={s.summaryIcon}>{icon}</Text>
              <Text style={s.summaryVal}>{val}</Text>
              <Text style={s.summaryLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Filters */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
          style={{ marginBottom: Spacing.lg }}
        >
          {filters.map(f => (
            <TouchableOpacity
              key={f.id}
              style={[s.pill, filter === f.id && s.pillActive]}
              onPress={() => setFilter(f.id)}
            >
              <Text style={[s.pillText, filter === f.id && s.pillTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* List */}
        <View style={s.list}>
          {shown.map(record => {
            const cfg = STATUS_CFG[record.status];
            return (
              <View key={record.id} style={[s.card, record.status === 'overdue' && s.cardOverdue]}>
                {/* Top row: member + status */}
                <View style={s.cardTopRow}>
                  <View style={s.memberInfo}>
                    <Text style={s.memberEmoji}>{record.memberType === 'child' ? '🧒' : '👤'}</Text>
                    <View>
                      <Text style={s.memberName}>{record.memberName}</Text>
                      <Text style={s.memberType}>{record.memberType === 'child' ? 'Child' : 'Adult'}</Text>
                    </View>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: cfg.bg }]}>
                    <Text style={[s.statusPillText, { color: cfg.textColor }]}>{cfg.label}</Text>
                  </View>
                </View>

                {/* Book title */}
                <Text style={s.bookTitle} numberOfLines={1}>📚 {record.bookTitle}</Text>

                {/* Dates */}
                <View style={s.datesRow}>
                  <Text style={s.dateItem}>🗓️ Issued: {record.issueDate}</Text>
                  <Text style={s.dateItem}>📅 Due: {record.dueDate}</Text>
                  {record.returnDate && <Text style={s.dateItem}>✅ Returned: {record.returnDate}</Text>}
                </View>

                {/* Fine */}
                {record.fine && (
                  <View style={s.fineRow}>
                    <Text style={s.fineText}>⚠️  Fine accrued: ₹{record.fine}</Text>
                    <TouchableOpacity style={s.collectBtn}>
                      <Text style={s.collectBtnText}>Mark collected</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Return action for active/overdue */}
                {record.status !== 'returned' && (
                  <TouchableOpacity style={s.returnBtn} activeOpacity={0.82}>
                    <Text style={s.returnBtnText}>Mark as Returned</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.librarianTint },
  scroll: { paddingBottom: Spacing.xl },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontSize: 20, color: Colors.accentSage, fontWeight: '700' },
  title: { fontSize: Typography.title + 2, fontWeight: '800', color: Colors.textPrimary },

  summaryStrip: {
    flexDirection: 'row', marginHorizontal: Spacing.xl, marginBottom: Spacing.lg,
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden',
  },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, gap: 2 },
  summaryBorder: { borderRightWidth: 1, borderRightColor: Colors.cardBorder },
  summaryIcon: { fontSize: 18 },
  summaryVal: { fontSize: Typography.body + 1, fontWeight: '900', color: Colors.textPrimary },
  summaryLabel: { fontSize: Typography.label - 2, fontWeight: '600', color: Colors.textSecondary },

  filterRow: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  pill: {
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderRadius: Radius.full, backgroundColor: Colors.card,
    borderWidth: 1.5, borderColor: Colors.cardBorder,
  },
  pillActive: { backgroundColor: Colors.accentSage, borderColor: Colors.accentSage },
  pillText: { fontSize: Typography.label, fontWeight: '700', color: Colors.textSecondary },
  pillTextActive: { color: Colors.textOnDark },

  list: { paddingHorizontal: Spacing.xl, gap: Spacing.md },

  card: {
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.cardBorder,
    padding: Spacing.md, gap: Spacing.sm,
  },
  cardOverdue: { borderColor: Colors.error + '60', backgroundColor: '#FFFAFA' },

  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  memberInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  memberEmoji: { fontSize: 24 },
  memberName: { fontSize: Typography.body, fontWeight: '800', color: Colors.textPrimary },
  memberType: { fontSize: Typography.label - 1, color: Colors.textSecondary, fontWeight: '600' },
  statusPill: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: { fontSize: Typography.label - 1, fontWeight: '700' },

  bookTitle: { fontSize: Typography.body, fontWeight: '700', color: Colors.textPrimary },

  datesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  dateItem: { fontSize: Typography.label - 1, color: Colors.textMuted, fontWeight: '600' },

  fineRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFEBEE', borderRadius: Radius.md, padding: Spacing.sm,
  },
  fineText: { fontSize: Typography.label, fontWeight: '700', color: Colors.error },
  collectBtn: {
    backgroundColor: Colors.error, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  collectBtnText: { fontSize: Typography.label - 1, fontWeight: '800', color: '#fff' },

  returnBtn: {
    backgroundColor: Colors.accentSage, borderRadius: Radius.full,
    paddingVertical: 10, alignItems: 'center', marginTop: Spacing.xs,
  },
  returnBtnText: { fontSize: Typography.label, fontWeight: '800', color: Colors.textOnDark },
});
