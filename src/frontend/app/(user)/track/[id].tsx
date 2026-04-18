import issueService from '@/api/services/issueService';
import { NavBar, NAV_BOTTOM_PAD } from '@/components/NavBar';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const formatTimelineTime = (value?: string | Date | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function TrackOrderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [issue, setIssue] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadIssue = async () => {
      try {
        const response = await issueService.getIssueDetails(id);
        if (active && response.data) {
          setIssue(response.data.issue);
          setDelivery(response.data.delivery);
        }
      } catch (err) {
        console.warn('Failed to load issue', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadIssue();
    return () => { active = false; };
  }, [id]);

  const getStepIndex = () => {
    if (!delivery) return 0;
    if (delivery.status === 'DELIVERED' || issue?.status === 'RETURNED') return 4;
    if (delivery.status === 'OUT_FOR_DELIVERY') return 3;
    if (delivery.status === 'DISPATCHED') return 2;
    if (delivery.status === 'SCHEDULED') return 1;
    return 0; // PLACED
  };

  const CURRENT_STEP = getStepIndex();
  const deliveryFailed = delivery?.status === 'FAILED' || delivery?.status === 'CANCELLED';
  const steps = [
    {
      key: 'placed',
      label: 'Order Placed',
      icon: '📋',
      desc: formatTimelineTime(issue?.issueDate) || 'Pending',
    },
    {
      key: 'packed',
      label: 'Packed at Library',
      icon: '📦',
      desc: formatTimelineTime(delivery?.scheduledAt || delivery?.createdAt) || 'Pending',
    },
    {
      key: 'shipped',
      label: 'Shipped',
      icon: '🚚',
      desc: formatTimelineTime(delivery?.dispatchedAt) || 'Pending',
    },
    {
      key: 'out',
      label: 'Out for Delivery',
      icon: '🛵',
      desc: delivery?.status === 'OUT_FOR_DELIVERY'
        ? (formatTimelineTime(delivery?.updatedAt) || 'In progress')
        : 'Pending',
    },
    {
      key: 'delivered',
      label: 'Delivered',
      icon: '✅',
      desc: formatTimelineTime(delivery?.deliveredAt) || (deliveryFailed ? 'Delivery failed' : 'Pending'),
    },
  ];

  return (
    <SafeAreaView style={s.safe}>
      {Platform.OS === 'web' && <NavBar role="user" active="mybooks" />}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={s.title}>Track Order</Text>
        <Text style={s.orderId}>{loading ? 'Loading order...' : `Issue #${issue ? issue._id.substring(0, 8).toUpperCase() : '...'}`}</Text>

        {/* Book info */}
        <View style={s.bookCard}>
          <Text style={s.bookEmoji}>📖</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.bookTitle}>{issue?.copyId?.bookId?.title || 'Loading book...'}</Text>
            <Text style={s.bookAuthor}>{issue ? `by ${issue.copyId?.bookId?.author} · ${issue.copyId?.branchId?.name}` : 'Loading...'}</Text>
          </View>
          <View style={s.statusPill}>
            <Text style={s.statusText}>{deliveryFailed ? 'Delivery Failed' : (steps[CURRENT_STEP]?.label || 'Loading...')}</Text>
          </View>
        </View>

        {/* ETA banner */}
        <View style={s.etaBanner}>
          <Text style={s.etaEmoji}>⏱️</Text>
          <View>
            <Text style={s.etaTitle}>
              {deliveryFailed
                ? 'Delivery failed'
                : (delivery?.status === 'DELIVERED'
                  ? 'Delivered!'
                  : `Expected by ${delivery?.scheduledAt ? new Date(delivery.scheduledAt).toLocaleDateString() : 'soon'}`)}
            </Text>
            <Text style={s.etaSub}>Return by: {issue?.dueDate ? new Date(issue.dueDate).toLocaleDateString() : '...'}</Text>
          </View>
        </View>

        {/* Progress stepper */}
        <View style={s.stepperCard}>
          {steps.map((step, i) => {
            const isDone = i < CURRENT_STEP;
            const isCurrent = i === CURRENT_STEP;
            const isPending = i > CURRENT_STEP;
            return (
              <View key={step.key} style={s.stepRow}>
                {/* Connector line */}
                <View style={s.connectorCol}>
                  <View style={[
                    s.stepCircle,
                    isDone && s.stepCircleDone,
                    isCurrent && s.stepCircleCurrent,
                    isPending && s.stepCirclePending,
                  ]}>
                    <Text style={[s.stepIcon, isPending && { opacity: 0.3 }]}>{step.icon}</Text>
                  </View>
                  {i < steps.length - 1 && (
                    <View style={[s.line, isDone && s.lineDone]} />
                  )}
                </View>
                {/* Text */}
                <View style={s.stepText}>
                  <Text style={[
                    s.stepLabel,
                    isCurrent && { color: Colors.accentSage, fontWeight: '800' },
                    isPending && { color: Colors.textMuted },
                  ]}>{step.label}</Text>
                  <Text style={[s.stepDesc, isPending && { color: Colors.cardBorder }]}>{step.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Return info */}
        <View style={s.returnCard}>
          <Text style={s.returnTitle}>📅 Return Information</Text>
          <Text style={s.returnItem}>Return deadline: <Text style={{ fontWeight: '800', color: Colors.textPrimary }}>{issue?.dueDate ? new Date(issue.dueDate).toLocaleDateString() : '...'}</Text></Text>
          <Text style={s.returnItem}>Late fee: <Text style={{ fontWeight: '800', color: Colors.warning }}>₹2/day after deadline</Text></Text>
          <Text style={s.returnItem}>Return window: <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>Mon–Sat, 9 AM–6 PM</Text></Text>
        </View>

        <TouchableOpacity style={s.btnGhost} activeOpacity={0.82}>
          <Text style={s.btnGhostText}>🔔 Return this book</Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
      {Platform.OS !== 'web' && <NavBar role="user" active="mybooks" />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: NAV_BOTTOM_PAD + Spacing.xl },

  backBtn: { marginTop: Spacing.md, marginBottom: Spacing.lg },
  backText: { fontSize: Typography.body, color: Colors.accentSage, fontWeight: '700' },

  title: { fontSize: Typography.display, fontWeight: '800', color: Colors.accentSage },
  orderId: { fontSize: Typography.label, color: Colors.textMuted, fontWeight: '600', marginBottom: Spacing.lg },

  bookCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: Spacing.md,
  },
  bookEmoji: { fontSize: 36 },
  bookTitle: { fontSize: Typography.body, fontWeight: '800', color: Colors.textPrimary },
  bookAuthor: { fontSize: Typography.label, color: Colors.textSecondary, marginTop: 2 },
  statusPill: {
    backgroundColor: Colors.buttonPrimary, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  statusText: { fontSize: Typography.label - 1, fontWeight: '700', color: Colors.buttonPrimaryText },

  etaBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.accentSage, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.xl,
  },
  etaEmoji: { fontSize: 28 },
  etaTitle: { fontSize: Typography.body, fontWeight: '800', color: Colors.textOnDark },
  etaSub: { fontSize: Typography.label, color: '#C5DDB8', marginTop: 2 },

  stepperCard: {
    backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: Spacing.xl,
  },
  stepRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: 0 },
  connectorCol: { alignItems: 'center', width: 44 },
  stepCircle: {
    width: 44, height: 44, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.cardBorder,
  },
  stepCircleDone: { backgroundColor: Colors.accentSageLight },
  stepCircleCurrent: { backgroundColor: Colors.buttonPrimary },
  stepCirclePending: { backgroundColor: Colors.background },
  stepIcon: { fontSize: 20 },
  line: {
    width: 2, flex: 1, minHeight: 24, backgroundColor: Colors.cardBorder, marginVertical: 2,
  },
  lineDone: { backgroundColor: Colors.accentSageLight },
  stepText: { flex: 1, paddingTop: 10, paddingBottom: 16 },
  stepLabel: { fontSize: Typography.body, fontWeight: '700', color: Colors.textPrimary },
  stepDesc: { fontSize: Typography.label, color: Colors.textSecondary, marginTop: 2 },

  returnCard: {
    backgroundColor: Colors.readSurface, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.md, gap: 8,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  returnTitle: { fontSize: Typography.body, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  returnItem: { fontSize: Typography.body - 1, color: Colors.textSecondary, lineHeight: 22 },

  btnGhost: {
    borderRadius: Radius.full, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.cardBorder,
  },
  btnGhostText: { fontSize: Typography.body, fontWeight: '700', color: Colors.textSecondary },
});
