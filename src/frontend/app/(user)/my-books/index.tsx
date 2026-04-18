import issueService from '@/api/services/issueService';
import { NavBar, NAV_BOTTOM_PAD } from '@/components/NavBar';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import useAppStore from '@/store/useAppStore';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

type DeliveryStatus = 'SCHEDULED' | 'DISPATCHED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
type BookStatus = 'placed' | 'dispatched' | 'out_for_delivery' | 'delivered' | 'returned' | 'overdue' | 'active';

interface BorrowRecord {
  id: string;
  bookId: string;
  title: string;
  author: string;
  coverColor: string;
  coverAccent: string;
  coverImage?: string;
  borrowedDate: string;
  dueDate: string;
  returnedDate?: string;
  status: BookStatus;
  fine?: number;
  library: string;
  deliveryStatus?: DeliveryStatus | null;
}

const STATUS_CONFIG: Record<BookStatus, { label: string; bg: string; text: string }> = {
  placed:            { label: '📋 Order Placed',       bg: '#EEF2FF', text: '#5B5EA6' },
  dispatched:        { label: '📦 Packed at Library',  bg: '#FFF8E1', text: '#F57F17' },
  out_for_delivery:  { label: '🛵 Out for Delivery',   bg: '#FFF3E0', text: '#E65100' },
  delivered:         { label: '📬 Delivered',          bg: '#E8F5E9', text: Colors.success },
  active:            { label: '📖 Borrowed',            bg: '#E8F5E9', text: Colors.success },
  returned:          { label: '✅ Returned',            bg: Colors.accentSageLight + '80', text: Colors.accentSage },
  overdue:           { label: '⚠️ Overdue',            bg: '#FFEBEE', text: Colors.error },
};

type Filter = 'all' | 'active' | 'returned' | 'overdue';

export default function MyBooks() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: '📖 Borrowed' },
    { id: 'overdue', label: '⚠️ Overdue' },
    { id: 'returned', label: '✅ Returned' },
  ];

  const { userId, activeProfileId } = useAppStore();
  const [borrowHistory, setBorrowHistory] = useState<BorrowRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadIssues = async () => {
      if (!userId || !activeProfileId) {
        if (active) setLoading(false);
        return;
      }
      try {
        const response = await issueService.getUserIssues(userId, activeProfileId);
        if (active && response.data?.issues) {
          const mapped: BorrowRecord[] = response.data.issues.map((i: any) => {
            const isReturned = i.status === 'RETURNED';
            const dueObj = new Date(i.dueDate);
            const isOverdue = !isReturned && new Date() > dueObj;

            const fmt = (d: Date) => `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;

            const dlv: DeliveryStatus | null = i.delivery?.status ?? null;

            let status: BookStatus;
            if (isReturned) {
              status = 'returned';
            } else if (isOverdue) {
              status = 'overdue';
            } else if (dlv === 'OUT_FOR_DELIVERY') {
              status = 'out_for_delivery';
            } else if (dlv === 'DISPATCHED') {
              status = 'dispatched';
            } else if (dlv === 'DELIVERED') {
              status = 'delivered';
            } else if (dlv === 'SCHEDULED') {
              status = 'placed';
            } else {
              status = 'active'; // digital or unknown delivery state
            }

            return {
              id: i._id,
              bookId: i.copyId?.bookId?._id || i.copyId?.bookId,
              title: i.copyId?.bookId?.title || 'Unknown Title',
              author: i.copyId?.bookId?.author || 'Unknown Author',
              coverColor: i.copyId?.bookId?.coverColor || '#C5DDB8',
              coverAccent: i.copyId?.bookId?.coverAccent || '#4A7C59',
              coverImage: i.copyId?.bookId?.coverImage,
              borrowedDate: fmt(new Date(i.issueDate)),
              dueDate: fmt(dueObj),
              returnedDate: i.returnDate ? fmt(new Date(i.returnDate)) : undefined,
              status,
              fine: i.fineAmount > 0 ? i.fineAmount : undefined,
              library: i.copyId?.branchId?.name || 'Local Library',
              deliveryStatus: dlv,
            };
          });
          setBorrowHistory(mapped);
        }
      } catch (err) {
        console.warn('Failed to fetch user issues', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadIssues();
    return () => { active = false; };
  }, [userId, activeProfileId]);

  // For the filter pills, 'active' covers all in-progress statuses (placed/dispatched/out/delivered/active)
  const ACTIVE_STATUSES: BookStatus[] = ['placed', 'dispatched', 'out_for_delivery', 'delivered', 'active'];
  const shown = filter === 'all' ? borrowHistory
    : filter === 'active' ? borrowHistory.filter(b => ACTIVE_STATUSES.includes(b.status))
    : borrowHistory.filter(b => b.status === filter);
  const totalFine = borrowHistory.filter(b => b.fine).reduce((a, b) => a + (b.fine ?? 0), 0);

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.accentSage} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {Platform.OS === 'web' && <NavBar role="user" active="mybooks" />}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.title}>My Orders</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Fine banner */}
        {totalFine > 0 && (
          <View style={s.fineBanner}>
            <Text style={s.fineBannerText}>⚠️  You have ₹{totalFine} in outstanding fines</Text>
            <TouchableOpacity style={s.payBtn}>
              <Text style={s.payBtnText}>Pay now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Summary strip */}
        <View style={s.summaryStrip}>
          {[
            ['📖', `${borrowHistory.filter(b => b.status === 'active').length}`, 'Active'],
            ['⚠️', `${borrowHistory.filter(b => b.status === 'overdue').length}`, 'Overdue'],
            ['✅', `${borrowHistory.filter(b => b.status === 'returned').length}`, 'Returned'],
          ].map(([icon, val, label]) => (
            <View key={label} style={s.summaryItem}>
              <Text style={s.summaryIcon}>{icon}</Text>
              <Text style={s.summaryVal}>{val}</Text>
              <Text style={s.summaryLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Filter pills */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
          style={{ marginBottom: Spacing.md }}
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

        {/* Book list */}
        <View style={s.list}>
          {shown.length === 0 && (
            <View style={s.emptyState}>
              <Text style={s.emptyText}>No books here yet</Text>
            </View>
          )}
          {shown.map(record => {
            const cfg = STATUS_CONFIG[record.status];
            return (
              <TouchableOpacity
                key={record.id}
                style={s.bookCard}
                activeOpacity={0.85}
                onPress={() => router.push(`/(user)/track/${record.id}`)}
              >
                {/* Mini cover */}
                {record.coverImage ? (
                  <Image source={{ uri: record.coverImage }} style={s.miniCover} resizeMode="cover" />
                ) : (
                  <View style={[s.miniCover, { backgroundColor: record.coverColor }]}>
                    <View style={[s.miniCoverAccent, { backgroundColor: record.coverAccent }]} />
                  </View>
                )}

                <View style={s.bookInfo}>
                  <Text style={s.bookTitle} numberOfLines={1}>{record.title}</Text>
                  <Text style={s.bookAuthor}>{record.author}</Text>
                  <Text style={s.bookLibrary}>🏛️ {record.library}</Text>

                  {/* Status pill — always shown prominently */}
                  <View style={[s.statusPill, { backgroundColor: cfg.bg, alignSelf: 'flex-start', marginTop: 4 }]}>
                    <Text style={[s.statusPillText, { color: cfg.text }]}>{cfg.label}</Text>
                  </View>

                  <Text style={[s.dateText, { marginTop: 3 }]}>
                    {record.status === 'returned'
                      ? `Returned ${record.returnedDate}`
                      : record.status === 'overdue'
                        ? `Due ${record.dueDate} · ⚠️ overdue`
                        : `Due ${record.dueDate}`}
                  </Text>
                  {record.fine && (
                    <Text style={s.fineText}>Fine: ₹{record.fine}</Text>
                  )}
                </View>

                <Text style={s.arrowIcon}>→</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
      {Platform.OS !== 'web' && <NavBar role="user" active="mybooks" />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: NAV_BOTTOM_PAD + Spacing.xl },

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

  fineBanner: {
    marginHorizontal: Spacing.xl, marginBottom: Spacing.md,
    backgroundColor: '#FFEBEE', borderRadius: Radius.lg,
    padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: '#FFCDD2',
  },
  fineBannerText: { flex: 1, fontSize: Typography.label, fontWeight: '700', color: Colors.error },
  payBtn: {
    backgroundColor: Colors.error, borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  payBtnText: { fontSize: Typography.label, fontWeight: '800', color: '#fff' },

  summaryStrip: {
    flexDirection: 'row', marginHorizontal: Spacing.xl, marginBottom: Spacing.lg,
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden',
  },
  summaryItem: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.md, gap: 3,
    borderRightWidth: 1, borderRightColor: Colors.cardBorder,
  },
  summaryIcon: { fontSize: 20 },
  summaryVal: { fontSize: Typography.title, fontWeight: '900', color: Colors.textPrimary },
  summaryLabel: { fontSize: Typography.label - 1, fontWeight: '600', color: Colors.textSecondary },

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

  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: Typography.body, color: Colors.textMuted, fontWeight: '600' },

  bookCard: {
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.cardBorder,
    padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
  },
  miniCover: {
    width: 56, height: 80, borderRadius: Radius.sm,
    overflow: 'hidden', justifyContent: 'flex-end',
  },
  miniCoverAccent: { height: 12, opacity: 0.6 },
  bookInfo: { flex: 1, gap: 3 },
  bookTitle: { fontSize: Typography.body, fontWeight: '800', color: Colors.textPrimary },
  bookAuthor: { fontSize: Typography.label, color: Colors.textSecondary, fontWeight: '600' },
  bookLibrary: { fontSize: Typography.label - 1, color: Colors.textMuted },
  bookBottomRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  statusPill: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: Typography.label - 1, fontWeight: '700' },
  dateText: { fontSize: Typography.label - 1, color: Colors.textMuted },
  fineText: { fontSize: Typography.label - 1, fontWeight: '800', color: Colors.error, marginTop: 2 },
  arrowIcon: { fontSize: 20, color: Colors.textMuted, fontWeight: '300' },
});
