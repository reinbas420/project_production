import librarianService from '@/api/services/librarianService';
import GenreSelector from '@/components/GenreSelector';
import { API_BASE_URL } from '@/constants/config';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import useAppStore from '@/store/useAppStore';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Stats configuration without hardcoded values
const STAT_TINTS = [Colors.accentSageLight, Colors.browseSurface, '#FDE8E8', '#E8F5E9'];

type Tab = 'issued' | 'returns' | 'add' | 'inventory';

function StatCard({ label, value, icon, tint }: { label: string; value: string; icon: string; tint: string }) {
  return (
    <View style={[sc.card, { backgroundColor: tint }]}>
      <Text style={sc.icon}>{icon}</Text>
      <Text style={sc.value}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  card: {
    flex: 1, borderRadius: Radius.lg, padding: Spacing.md,
    alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  icon: { fontSize: 24 },
  value: { fontSize: Typography.title + 2, fontWeight: '900', color: Colors.textPrimary },
  label: { fontSize: Typography.label - 1, color: Colors.textSecondary, fontWeight: '600', textAlign: 'center' },
});

export default function LibrarianDashboard() {
  const router = useRouter();
  const { clearAuth, token } = useAppStore();
  const [tab, setTab] = useState<Tab>('issued');
  const [menuVisible, setMenuVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [form, setForm] = useState({ title: '', author: '', isbn: '', minAge: '0', summary: '', coverImage: '' });
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [rawIssues, setRawIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIssues();
  }, [tab]);

  const fetchIssues = async () => {
    try {
      setLoading(true);
      const res = await librarianService.getIssuedBooks();
      setRawIssues(res.data?.issues || []);
    } catch (err) {
      console.warn('Failed to fetch issues', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async (issueId: string) => {
    try {
      await fetch(`${API_BASE_URL}/issues/${issueId}/return`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchIssues();
    } catch (err) {
      Alert.alert('Error', 'Could not process return.');
    }
  };

  const mappedIssues = rawIssues.filter(iss => iss.status !== 'RETURNED').map(iss => {
    const today = new Date();
    const due = new Date(iss.dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      id: iss._id,
      title: iss.copyId?.bookId?.title || 'Unknown Book',
      user: iss.userId?.profiles?.[0]?.name || iss.userId?.email || 'Unknown User',
      due: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      daysLeft: diffDays,
      overdue: diffDays < 0 || iss.status === 'OVERDUE',
    };
  });

  const ISSUED_BOOKS = mappedIssues.filter(b => !b.overdue);
  const PENDING_RETURNS = mappedIssues.filter(b => b.overdue);

  const STATS = [
    { label: 'Total Issues', value: String(rawIssues.length), icon: '📚', tint: STAT_TINTS[0] },
    { label: 'Active Issues', value: String(ISSUED_BOOKS.length), icon: '📤', tint: STAT_TINTS[1] },
    { label: 'Overdue', value: String(PENDING_RETURNS.length), icon: '⚠️', tint: STAT_TINTS[2] },
    { label: 'Returned', value: String(rawIssues.filter(i => i.status === 'RETURNED').length), icon: '✅', tint: STAT_TINTS[3] },
  ];

  const setField = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleSignOut = async () => {
    setMenuVisible(false);
    await clearAuth();
    router.replace('/(auth)/welcome');
  };

  const handleFetchBook = async () => {
    if (!form.isbn.trim()) {
      Alert.alert('ISBN required', 'Please enter an ISBN to fetch.');
      return;
    }
    setFetching(true);
    try {
      const res = await fetch(`${API_BASE_URL}/books/lookup?isbn=${form.isbn.trim()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to fetch book metadata');
      
      const md = json.data.metadata;
      setForm(f => ({
        ...f,
        title: md.title || '',
        author: md.author || '',
        coverImage: md.coverImage || '',
        minAge: md.minAge !== undefined ? String(md.minAge) : '0',
      }));
      if (md.genre && Array.isArray(md.genre)) {
        setSelectedGenres(md.genre);
      }
      setHasFetched(true);
    } catch (err: any) {
      Alert.alert('Not Found', err.message ?? 'Could not find book metadata.');
    } finally {
      setFetching(false);
    }
  };

  const handleAddBook = async () => {
    if (!form.isbn.trim()) {
      Alert.alert('ISBN required', 'Please enter an ISBN — all other details are fetched automatically.');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        isbn: Number(form.isbn),
      };

      // Optional overrides — only sent if the librarian filled them in
      if (form.title.trim()) body.title = form.title.trim();
      if (form.author.trim()) body.author = form.author.trim();
      if (form.summary.trim()) body.summary = form.summary.trim();
      if (form.coverImage.trim()) body.coverImage = form.coverImage.trim();
      if (selectedGenres.length > 0) body.genre = selectedGenres;
      const min = parseInt(form.minAge, 10);
      if (!isNaN(min)) body.minAge = min;

      const res = await fetch(`${API_BASE_URL}/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to add book');
      Alert.alert('✅ Book added!', 'The book has been added to the library.');
      setForm({ title: '', author: '', isbn: '', minAge: '0', summary: '', coverImage: '' });
      setSelectedGenres([]);
      setHasFetched(false);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const tabList: { id: Tab; label: string; emoji: string }[] = [
    { id: 'issued', label: 'Issued', emoji: '📤' },
    { id: 'returns', label: 'Overdue', emoji: '⚠️' },
    { id: 'add', label: 'Add Book', emoji: '➕' },
    { id: 'inventory', label: 'Inventory', emoji: '📦' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      {/* Sign-out menu modal */}
      <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={s.menuCard}>
            <Text style={s.menuTitle}>Librarian Panel</Text>
            <TouchableOpacity style={s.menuItem} onPress={handleSignOut}>
              <Text style={s.menuItemText}>Sign Out</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.menuCancel} onPress={() => setMenuVisible(false)}>
              <Text style={s.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={s.header}>
            <View>
              <Text style={s.title}>Librarian Panel</Text>
              <Text style={s.subtitle}>Koramangala Branch · Today, Mar 3</Text>
            </View>
            <TouchableOpacity style={s.profileBtn} onPress={() => setMenuVisible(true)}>
              <Text style={s.profileEmoji}>📚</Text>
            </TouchableOpacity>
          </View>

          {/* Stats row */}
          <View style={s.statsRow}>
            {STATS.map(stat => <StatCard key={stat.label} {...stat} />)}
          </View>

          {/* Tabs */}
          <View style={s.tabRow}>
            {tabList.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[s.tabBtn, tab === t.id && s.tabBtnActive]}
                onPress={() => {
                if (t.id === 'inventory') {
                  router.push('/(librarian)/inventory');
                } else {
                  setTab(t.id);
                }
              }}
              >
                <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>{t.emoji} {t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab content */}
          {tab === 'issued' && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Currently Issued ({ISSUED_BOOKS.length})</Text>
              {ISSUED_BOOKS.map(book => (
                <View key={book.id} style={[s.issueCard, book.overdue && s.issueCardOverdue]}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={s.issueName}>{book.title}</Text>
                    <Text style={s.issueUser}>{book.user}</Text>
                    <Text style={[s.issueDue, book.overdue && { color: Colors.error }]}>
                      {book.overdue ? `⚠️ Overdue by ${Math.abs(book.daysLeft)} days` : `Due: ${book.due} · ${book.daysLeft}d left`}
                    </Text>
                  </View>
                  <TouchableOpacity style={s.returnBtn} onPress={() => handleReturn(book.id)}>
                    <Text style={s.returnBtnText}>Return</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {tab === 'returns' && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Overdue Returns ({PENDING_RETURNS.length})</Text>
              {PENDING_RETURNS.length === 0 ? (
                <Text style={s.empty}>No overdue returns!</Text>
              ) : PENDING_RETURNS.map(book => (
                <View key={book.id} style={[s.issueCard, s.issueCardOverdue]}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={s.issueName}>{book.title}</Text>
                    <Text style={s.issueUser}>{book.user}</Text>
                    <Text style={[s.issueDue, { color: Colors.error }]}>
                      ⚠️ Overdue by {Math.abs(book.daysLeft)} days · Fine: ₹{Math.abs(book.daysLeft) * 2}
                    </Text>
                  </View>
                  <TouchableOpacity style={[s.returnBtn, { backgroundColor: Colors.error }]} onPress={() => handleReturn(book.id)}>
                    <Text style={[s.returnBtnText, { color: '#fff' }]}>Collect</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {tab === 'add' && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Add a new book</Text>
              
              {!hasFetched ? (
                <>
                  <Text style={{ fontSize: Typography.label, color: Colors.textMuted, marginBottom: Spacing.md, lineHeight: 18 }}>
                    Enter an ISBN to fetch book details before adding.
                  </Text>
                  <View style={{ gap: 5, marginBottom: Spacing.md }}>
                    <Text style={s.label}>ISBN</Text>
                    <TextInput
                      style={s.input}
                      placeholder="978-3-16-148410-0"
                      placeholderTextColor={Colors.textMuted}
                      value={form.isbn}
                      onChangeText={v => setField('isbn', v.replace(/[^0-9]/g, ''))}
                      keyboardType="numeric"
                    />
                  </View>
                  <TouchableOpacity style={[s.btnPrimary, fetching && { opacity: 0.6 }]} activeOpacity={0.82} onPress={handleFetchBook} disabled={fetching}>
                    {fetching
                      ? <ActivityIndicator color={Colors.buttonPrimaryText} />
                      : <Text style={s.btnPrimaryText}>Fetch Metadata</Text>
                    }
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: Typography.label, color: Colors.textMuted, marginBottom: Spacing.md, lineHeight: 18 }}>
                    Review and edit the fetched details before firmly adding to the catalog.
                  </Text>

                  {([
                    { key: 'isbn', label: 'ISBN (Editing not recommended)', ph: '', multi: false },
                    { key: 'title', label: 'Title', ph: 'Book Title', multi: false },
                    { key: 'author', label: 'Author', ph: 'Author Name', multi: false },
                    { key: 'coverImage', label: 'Cover Image URL', ph: 'https://...', multi: false },
                    { key: 'summary', label: 'Summary', ph: 'Description', multi: true },
                  ] as const).map(f => (
                    <View key={f.key} style={{ gap: 5, marginBottom: Spacing.md }}>
                      <Text style={s.label}>{f.label}</Text>
                      <TextInput
                        style={[s.input, f.multi && { height: 90, textAlignVertical: 'top' }]}
                        placeholder={f.ph}
                        placeholderTextColor={Colors.textMuted}
                        value={(form as any)[f.key]}
                        onChangeText={v => setField(f.key, f.key === 'isbn' ? v.replace(/[^0-9]/g, '') : v)}
                        keyboardType={f.key === 'isbn' ? 'numeric' : 'default'}
                        multiline={f.multi}
                        returnKeyType={f.multi ? 'default' : 'next'}
                      />
                    </View>
                  ))}

                  <View style={{ marginBottom: Spacing.md, marginTop: 4 }}>
                    <GenreSelector
                      selectedGenres={selectedGenres}
                      onGenresChange={setSelectedGenres}
                      isChild={false}
                      title="📚 Genres"
                    />
                  </View>

                  <Text style={s.label}>Minimum Recommended Age</Text>
                  <View style={{ gap: Spacing.sm, marginBottom: Spacing.md, marginTop: 8 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.xs, paddingBottom: 4 }}>
                      {Array.from({ length: 19 }).map((_, i) => (
                        <TouchableOpacity
                          key={`min-${i}`}
                          style={[s.ageChip, form.minAge === String(i) && s.ageChipActive]}
                          onPress={() => setField('minAge', String(i))}
                        >
                          <Text style={[s.ageChipText, form.minAge === String(i) && s.ageChipTextActive]}>{i}+</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
                    <TouchableOpacity style={[s.btnPrimary, { flex: 1, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.cardBorder }]} onPress={() => { setHasFetched(false); setForm({ title: '', author: '', isbn: '', minAge: '0', summary: '', coverImage: '' }); setSelectedGenres([]); }}>
                      <Text style={[s.btnPrimaryText, { color: Colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.btnPrimary, saving && { opacity: 0.6 }, { flex: 2 }]} activeOpacity={0.82} onPress={handleAddBook} disabled={saving}>
                      {saving
                        ? <ActivityIndicator color={Colors.buttonPrimaryText} />
                        : <Text style={s.btnPrimaryText}>Confirm & Add</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Delete books — admin only */}
              <View style={{ marginTop: Spacing.lg, backgroundColor: Colors.browseSurface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.cardBorder }}>
                <Text style={{ fontSize: Typography.label, fontWeight: '700', color: Colors.textSecondary }}>
                  🗑️ Deleting books
                </Text>
                <Text style={{ fontSize: Typography.label, color: Colors.textMuted, marginTop: 4, lineHeight: 18 }}>
                  Only admins can permanently delete a book from the catalog. Contact your admin or use the Admin Dashboard → Books tab.
                </Text>
              </View>
            </View>
          )}

          {/* Issue history link */}
          <TouchableOpacity style={s.historyLink} onPress={() => router.push('/(librarian)/history')}>
            <Text style={s.historyLinkText}>Full issue history →</Text>
          </TouchableOpacity>

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.librarianTint },
  scroll: { paddingBottom: Spacing.xl },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
  },
  title: { fontSize: Typography.display, fontWeight: '800', color: Colors.accentSage },
  subtitle: { fontSize: Typography.label, color: Colors.textSecondary, marginTop: 2 },
  profileBtn: {
    width: 48, height: 48, borderRadius: Radius.full,
    backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.cardBorder,
  },
  profileEmoji: { fontSize: 22 },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg },

  tabRow: {
    flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg,
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: Radius.full,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.cardBorder, alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: Colors.accentSage, borderColor: Colors.accentSage },
  tabText: { fontSize: Typography.label, fontWeight: '700', color: Colors.textSecondary },
  tabTextActive: { color: Colors.textOnDark },

  section: { paddingHorizontal: Spacing.xl },
  sectionTitle: { fontSize: Typography.body + 1, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.md },
  empty: { fontSize: Typography.body, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.xl },

  issueCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  issueCardOverdue: { borderColor: Colors.error, backgroundColor: '#FFF5F5' },
  issueName: { fontSize: Typography.body, fontWeight: '700', color: Colors.textPrimary },
  issueUser: { fontSize: Typography.label, color: Colors.textSecondary },
  issueDue: { fontSize: Typography.label, color: Colors.textSecondary, fontWeight: '600' },
  returnBtn: {
    backgroundColor: Colors.accentSage, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
  },
  returnBtnText: { fontSize: Typography.label, fontWeight: '800', color: Colors.textOnDark },

  label: { fontSize: Typography.label, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    borderWidth: 1.5, borderColor: Colors.cardBorder,
    fontSize: Typography.body, color: Colors.textPrimary,
  },

  btnPrimary: {
    backgroundColor: Colors.buttonPrimary, borderRadius: Radius.full,
    paddingVertical: 16, alignItems: 'center', marginTop: Spacing.sm,
  },
  btnPrimaryText: { fontSize: Typography.body, fontWeight: '800', color: Colors.buttonPrimaryText },

  historyLink: {
    marginHorizontal: Spacing.xl, marginTop: Spacing.xl,
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  historyLinkText: { fontSize: Typography.body, fontWeight: '700', color: Colors.textPrimary },

  // Modal / menu
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 80, paddingRight: Spacing.xl },
  menuCard: { backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.md, minWidth: 200, borderWidth: 1.5, borderColor: Colors.cardBorder, gap: Spacing.xs },
  menuTitle: { fontSize: Typography.label, fontWeight: '700', color: Colors.textMuted, paddingHorizontal: Spacing.sm, paddingBottom: 4 },
  menuItem: { paddingVertical: 12, paddingHorizontal: Spacing.sm, borderRadius: Radius.lg },
  menuItemText: { fontSize: Typography.body, fontWeight: '700', color: Colors.error },
  menuCancel: { paddingVertical: 12, paddingHorizontal: Spacing.sm, borderRadius: Radius.lg, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  menuCancelText: { fontSize: Typography.body, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },

  // Age rating chips
  ageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.md, marginTop: 4 },
  ageChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.cardBorder },
  ageChipActive: { backgroundColor: Colors.accentSage, borderColor: Colors.accentSage },
  ageChipText: { fontSize: Typography.label, fontWeight: '700', color: Colors.textSecondary },
  ageChipTextActive: { color: Colors.textOnDark },
});
