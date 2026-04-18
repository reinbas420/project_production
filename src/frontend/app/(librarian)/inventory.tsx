import { API_BASE_URL } from '@/constants/config';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import useAppStore from '@/store/useAppStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const IMPORT_HINT_KEY = 'bulk_import_hint_dismissed';

type Mode = 'book' | 'branch';
type Condition = 'GOOD' | 'FAIR' | 'POOR';

interface BranchStat {
  branchId: string;
  branchName: string;
  total: number;
  available: number;
  issued: number;
  damaged: number;
  lost: number;
}

const CONDITIONS: Condition[] = ['GOOD', 'FAIR', 'POOR'];

export default function InventoryScreen() {
  const router = useRouter();
  const { token } = useAppStore();

  const [mode, setMode] = useState<Mode>('book');

  // By-book
  const [books, setBooks] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [bookInventory, setBookInventory] = useState<BranchStat[]>([]);
  const [loadingBookInv, setLoadingBookInv] = useState(false);

  // By-branch
  const [branches, setBranches] = useState<any[]>([]);
  const [branchStats, setBranchStats] = useState<Record<string, any>>({});
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [branchInventory, setBranchInventory] = useState<any[]>([]);
  const [loadingBranchInv, setLoadingBranchInv] = useState(false);

  // Search inside expand panels
  const [branchSearch, setBranchSearch] = useState('');      // filter branches in By-Book panel
  const [bookInBranchSearch, setBookInBranchSearch] = useState(''); // filter books in By-Branch panel

  // Add copies modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalCtx, setModalCtx] = useState({ bookId: '', bookTitle: '', branchId: '', branchName: '' });
  const [addQty, setAddQty] = useState('1');
  const [addCondition, setAddCondition] = useState<Condition>('GOOD');
  const [saving, setSaving] = useState(false);

  // Bulk import
  const [importing, setImporting] = useState(false);
  const [importBranchId, setImportBranchId] = useState<string>('');
  const [importResult, setImportResult] = useState<{ importedCount: number; skippedCount: number; errors: any[] } | null>(null);
  const [importResultVisible, setImportResultVisible] = useState(false);
  const [branchPickerVisible, setBranchPickerVisible] = useState(false);
  const [instructionVisible, setInstructionVisible] = useState(false);
  const [doNotShowHint, setDoNotShowHint] = useState(false);

  // Chatbot tag editor
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [tagBook, setTagBook] = useState<{ id: string; title: string } | null>(null);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [savingTags, setSavingTags] = useState(false);

  const hdrs = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) return;
    fetchBooks();
    fetchBranches();
    // Load the "don't show import hint" preference
    AsyncStorage.getItem(IMPORT_HINT_KEY).then((val) => {
      if (val === 'true') setDoNotShowHint(true);
    }).catch(() => {});
  }, [token]);

  const fetchBooks = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/books`, { headers: hdrs });
      const json = await res.json();
      setBooks(json.data?.books ?? []);
    } catch {
      Alert.alert('Error', 'Could not load books.');
    } finally {
      setLoadingBooks(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/libraries`, { headers: hdrs });
      const json = await res.json();
      const list: any[] = json.data?.libraries ?? [];
      setBranches(list);
      // Fetch stats for all branches in parallel
      const stats: Record<string, any> = {};
      await Promise.all(
        list.map(async (b) => {
          try {
            const r = await fetch(`${API_BASE_URL}/inventory/branch/${b._id}/stats`, { headers: hdrs });
            const j = await r.json();
            stats[b._id] = j.data?.stats;
          } catch { /* stats are optional */ }
        })
      );
      setBranchStats(stats);
    } catch {
      Alert.alert('Error', 'Could not load branches.');
    } finally {
      setLoadingBranches(false);
    }
  };

  const selectBook = async (bookId: string) => {
    if (selectedBookId === bookId) {
      setSelectedBookId(null);
      setBranchSearch('');
      return;
    }
    setSelectedBookId(bookId);
    setBranchSearch('');
    setLoadingBookInv(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/book/${bookId}`, { headers: hdrs });
      const json = await res.json();
      setBookInventory(json.data?.inventory ?? []);
    } catch {
      Alert.alert('Error', 'Could not load inventory for this book.');
    } finally {
      setLoadingBookInv(false);
    }
  };

  const selectBranch = async (branchId: string) => {
    if (selectedBranchId === branchId) {
      setSelectedBranchId(null);
      setBookInBranchSearch('');
      return;
    }
    setSelectedBranchId(branchId);
    setBookInBranchSearch('');
    setLoadingBranchInv(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory/branch/${branchId}`, { headers: hdrs });
      const json = await res.json();
      setBranchInventory(json.data?.inventory ?? []);
    } catch {
      Alert.alert('Error', 'Could not load branch inventory.');
    } finally {
      setLoadingBranchInv(false);
    }
  };

  const openAddModal = (bookId: string, bookTitle: string, branchId: string, branchName: string) => {
    setAddQty('1');
    setAddCondition('GOOD');
    setModalCtx({ bookId, bookTitle, branchId, branchName });
    setModalVisible(true);
  };

  const handleAddCopies = async () => {
    const qty = parseInt(addQty, 10);
    if (!qty || qty < 1 || qty > 100) {
      Alert.alert('Invalid quantity', 'Enter a number between 1 and 100.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/inventory`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({
          bookId: modalCtx.bookId,
          branchId: modalCtx.branchId,
          quantity: qty,
          condition: addCondition,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to add copies');

      Alert.alert('✅ Done', `Added ${qty} cop${qty === 1 ? 'y' : 'ies'} to ${modalCtx.branchName}.`);
      setModalVisible(false);

      // Refresh the active view
      if (selectedBookId) selectBook(selectedBookId);
      if (selectedBranchId) selectBranch(selectedBranchId);
      fetchBranches();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  // ── Bulk import ────────────────────────────────────────────────────────────
  const handleBulkImport = async (targetBranchId: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'application/csv',
          '*/*', // fallback for devices that don't expose exact MIME
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      const file = result.assets[0];

      setImporting(true);

      const formData = new FormData();
      // On web, expo-document-picker provides a real browser File object via `file.file`.
      // On native it only provides { uri, name, mimeType } — multer cannot use a plain object.
      if ((file as any).file instanceof File) {
        // Web: append the real File object so multer can read the bytes
        formData.append('file', (file as any).file, file.name);
      } else {
        // Native (iOS / Android): use the RN FormData { uri, name, type } shape
        formData.append('file', {
          uri:  file.uri,
          name: file.name,
          type: file.mimeType ?? 'application/octet-stream',
        } as any);
      }
      formData.append('branchId', targetBranchId);

      const res = await fetch(`${API_BASE_URL}/inventory/bulk-import`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` }, // NO Content-Type — fetch sets multipart boundary
        body:    formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || `Server returned ${res.status}`);
      }
      
      setImportResult(json);
      setImportResultVisible(true);

      // Refresh data so the new books appear immediately
      fetchBooks();
      fetchBranches();
      if (selectedBranchId) selectBranch(selectedBranchId);
    } catch (err: any) {
      Alert.alert('Import Error', err.message ?? 'Something went wrong.');
    } finally {
      setImporting(false);
    }
  };

  // Show instruction hint (if not dismissed), then branch picker
  const openImportFlow = () => {
    if (branches.length === 0) {
      Alert.alert('No branches', 'Load branches first.');
      return;
    }
    // If the librarian already dismissed the hint, skip straight to branch picker
    if (doNotShowHint) {
      setBranchPickerVisible(true);
    } else {
      setInstructionVisible(true);
    }
  };

  const handleInstructionProceed = async () => {
    if (doNotShowHint) {
      await AsyncStorage.setItem(IMPORT_HINT_KEY, 'true').catch(() => {});
    }
    setInstructionVisible(false);
    setBranchPickerVisible(true);
  };

  // ── Chatbot tag editor ──────────────────────────────────────────────────────
  const openTagEditor = (book: any) => {
    setTagBook({ id: book._id, title: book.title });
    setEditTags(Array.isArray(book.chatbotTags) ? [...book.chatbotTags] : []);
    setTagInput('');
    setTagModalVisible(true);
  };

  const addTag = () => {
    const raw = tagInput.trim().toLowerCase().replace(/[^a-z0-9\-\s]/g, '');
    const newTags = raw.split(',').map(t => t.trim()).filter(t => t.length > 0);
    setEditTags(prev => {
      const merged = [...prev];
      for (const t of newTags) {
        if (!merged.includes(t)) merged.push(t);
      }
      return merged;
    });
    setTagInput('');
  };

  const removeTag = (tag: string) => setEditTags(prev => prev.filter(t => t !== tag));

  const saveTagEdit = async () => {
    if (!tagBook) return;
    setSavingTags(true);
    try {
      const res = await fetch(`${API_BASE_URL}/books/${tagBook.id}`, {
        method: 'PUT',
        headers: hdrs,
        body: JSON.stringify({ chatbotTags: editTags }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Failed to save tags');
      // Update local books list so badge refreshes without a full reload
      setBooks(prev => prev.map(b =>
        b._id === tagBook.id ? { ...b, chatbotTags: editTags } : b
      ));
      setTagModalVisible(false);
      Alert.alert('✅ Tags saved', `Chatbot tags updated for "${tagBook.title}".`);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Something went wrong.');
    } finally {
      setSavingTags(false);
    }
  };

  const filteredBooks = books.filter((b) =>
    !search.trim() ||
    b.title?.toLowerCase().includes(search.toLowerCase()) ||
    b.author?.toLowerCase().includes(search.toLowerCase()) ||
    String(b.isbn).includes(search)
  );

  // Group branchInventory copies by distinct book, initializing with ALL global books
  const branchBookMap: Record<string, { bookId: string; title: string; available: number; issued: number; damaged: number; total: number }> = {};
  
  // Initialize map with every global book so we can always search and add copies even if count is 0
  for (const bk of books) {
    if (bk._id) {
      branchBookMap[bk._id] = { bookId: bk._id, title: bk.title ?? 'Unknown', available: 0, issued: 0, damaged: 0, total: 0 };
    }
  }

  // Populate counts from actual branch inventory
  for (const copy of branchInventory) {
    const bk = copy.bookId;
    if (!bk) continue;
    const id = bk._id;
    if (branchBookMap[id]) {
      branchBookMap[id].total++;
      if (copy.status === 'AVAILABLE')             branchBookMap[id].available++;
      else if (copy.status === 'ISSUED')           branchBookMap[id].issued++;
      else if (copy.status === 'DAMAGED' || copy.status === 'LOST') branchBookMap[id].damaged++;
    }
  }
  const branchBooks = Object.values(branchBookMap);

  // Build the branch list for the By-Book expand panel:
  // merge all known branches with inventory data already fetched.
  // Branches with no copies show zeros.
  const invByBranchId: Record<string, BranchStat> = {};
  for (const stat of bookInventory) invByBranchId[stat.branchId] = stat;

  const filteredBranchesForBook = branches.filter((b) =>
    !branchSearch.trim() ||
    b.name?.toLowerCase().includes(branchSearch.toLowerCase())
  );

  const filteredBooksInBranch = branchBooks.filter((bk) =>
    !bookInBranchSearch.trim() ||
    bk.title.toLowerCase().includes(bookInBranchSearch.toLowerCase())
  );

  return (
    <SafeAreaView style={s.safe}>
      {/* ── Chatbot Tag Editor Modal ───────────────────────────────────── */}
      <Modal
        transparent
        visible={tagModalVisible}
        animationType="slide"
        onRequestClose={() => setTagModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: '80%' }]}>
            <Text style={s.modalTitle}>🏷️ Chatbot Tags</Text>
            <Text style={s.modalSub} numberOfLines={1}>{tagBook?.title}</Text>
            <Text style={{ fontSize: Typography.label, color: Colors.textMuted, marginBottom: Spacing.sm, lineHeight: 18 }}>
              These tags help the chatbot find this book. Add descriptive keywords like topic, mood, or theme.
            </Text>

            {/* Current tag chips */}
            <ScrollView style={{ maxHeight: 120 }} contentContainerStyle={s.tagChipWrap}>
              {editTags.length === 0 ? (
                <Text style={{ fontSize: Typography.label, color: Colors.textMuted, fontStyle: 'italic' }}>No tags yet</Text>
              ) : editTags.map(tag => (
                <TouchableOpacity key={tag} style={s.tagChip} onPress={() => removeTag(tag)} activeOpacity={0.7}>
                  <Text style={s.tagChipText}>{tag}</Text>
                  <Text style={s.tagChipRemove}>✕</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Tag input */}
            <View style={s.tagInputRow}>
              <TextInput
                style={[s.modalInput, { flex: 1 }]}
                placeholder="adventure, animals, bedtime…"
                placeholderTextColor={Colors.textMuted}
                value={tagInput}
                onChangeText={setTagInput}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={addTag}
              />
              <TouchableOpacity style={s.tagAddBtn} onPress={addTag}>
                <Text style={s.tagAddBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 11, color: Colors.textMuted, marginBottom: Spacing.md }}>
              Tip: separate multiple tags with commas. Tap a tag to remove it.
            </Text>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <TouchableOpacity
                style={[s.modalBtn, { flex: 1 }]}
                onPress={() => setTagModalVisible(false)}
              >
                <Text style={s.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnPrimary, { flex: 2 }, savingTags && { opacity: 0.6 }]}
                onPress={saveTagEdit}
                disabled={savingTags}
              >
                {savingTags
                  ? <ActivityIndicator color={Colors.textOnDark} size="small" />
                  : <Text style={[s.modalBtnText, { color: Colors.textOnDark }]}>Save Tags</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add Copies Modal ──────────────────────────────────────────── */}
      <Modal
        transparent
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Add Copies</Text>
            <Text style={s.modalMeta} numberOfLines={1}>📖 {modalCtx.bookTitle}</Text>
            <Text style={s.modalMeta}>🏛️ {modalCtx.branchName}</Text>

            <Text style={[s.label, { marginTop: Spacing.md }]}>Quantity</Text>
            <TextInput
              style={s.input}
              value={addQty}
              onChangeText={(v) => setAddQty(v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
              placeholder="1"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={[s.label, { marginTop: Spacing.md }]}>Condition</Text>
            <View style={s.chipRow}>
              {CONDITIONS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[s.chip, addCondition === c && s.chipActive]}
                  onPress={() => setAddCondition(c)}
                >
                  <Text style={[s.chipText, addCondition === c && s.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.modalBtns}>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.cardBorder }]}
                onPress={() => setModalVisible(false)}
                disabled={saving}
              >
                <Text style={[s.modalBtnText, { color: Colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnPrimary, saving && { opacity: 0.6 }]}
                onPress={handleAddCopies}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={Colors.textOnDark} />
                  : <Text style={[s.modalBtnText, { color: Colors.textOnDark }]}>Add Copies</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Import Instructions Modal ─────────────────────────────────── */}
      <Modal
        transparent
        visible={instructionVisible}
        animationType="slide"
        onRequestClose={() => setInstructionVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>📋 Prepare Your Spreadsheet</Text>
            <Text style={[s.modalMeta, { marginBottom: Spacing.md }]}>
              Your Excel (.xlsx) or CSV file should have the following columns:
            </Text>

            {/* Column reference table */}
            <View style={s.hintTable}>
              {([
                ['ISBN', 'Recommended', '13-digit ISBN (e.g. 9780439708180)'],
                ['Title', 'Required if no ISBN', 'Used to search online if ISBN is missing'],
                ['Quantity', '✅ Required', 'Number of physical copies to add'],
                ['Condition', 'Optional', 'GOOD · FAIR · POOR · NEW · DAMAGED'],
                ['Author', 'Fallback', 'Used only if online lookup fails'],
                ['Genre', 'Fallback', 'Semicolon-separated, e.g. Fiction;Drama'],
                ['Summary', 'Fallback', 'Required if online lookup finds nothing'],
                ['Language', 'Fallback', 'Defaults to English'],
                ['MinAge', 'Fallback', 'Minimum reader age, e.g. 12'],
              ] as [string, string, string][]).map(([col, req, desc]) => (
                <View key={col} style={s.hintRow}>
                  <View style={{ width: 72 }}>
                    <Text style={s.hintCol}>{col}</Text>
                    <Text style={s.hintReq}>{req}</Text>
                  </View>
                  <Text style={s.hintDesc} numberOfLines={2}>{desc}</Text>
                </View>
              ))}
            </View>

            <Text style={[s.modalMeta, { marginTop: Spacing.md, fontStyle: 'italic' }]}>
              💡 Tip: If a book has an ISBN, all other columns are optional — we'll fetch the metadata automatically!
            </Text>

            {/* Don't show again toggle */}
            <TouchableOpacity
              style={s.dontShowRow}
              onPress={() => setDoNotShowHint(prev => !prev)}
              activeOpacity={0.7}
            >
              <View style={[s.checkbox, doNotShowHint && s.checkboxChecked]}>
                {doNotShowHint && <Text style={s.checkmark}>✓</Text>}
              </View>
              <Text style={s.dontShowText}>Don't show this again</Text>
            </TouchableOpacity>

            <View style={s.modalBtns}>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.cardBorder }]}
                onPress={() => setInstructionVisible(false)}
              >
                <Text style={[s.modalBtnText, { color: Colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnPrimary]}
                onPress={handleInstructionProceed}
              >
                <Text style={[s.modalBtnText, { color: Colors.textOnDark }]}>Proceed →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Branch Picker Modal (for bulk import) ─────────────────────── */}
      <Modal
        transparent
        visible={branchPickerVisible}
        animationType="slide"
        onRequestClose={() => setBranchPickerVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Select Target Branch</Text>
            <Text style={[s.modalMeta, { marginBottom: Spacing.md }]}>
              Choose which branch the imported books will be added to.
            </Text>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {branches.map((b) => (
                <TouchableOpacity
                  key={b._id}
                  style={[s.card, { marginBottom: Spacing.xs }]}
                  onPress={() => {
                    setBranchPickerVisible(false);
                    setImportBranchId(b._id);
                    handleBulkImport(b._id);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>{b.name}</Text>
                    <Text style={s.cardMeta}>{b.address}</Text>
                  </View>
                  <Text style={{ fontSize: 18 }}>→</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[s.modalBtn, { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.cardBorder, marginTop: Spacing.md }]}
              onPress={() => setBranchPickerVisible(false)}
            >
              <Text style={[s.modalBtnText, { color: Colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Import Result Modal ───────────────────────────────────────── */}
      <Modal
        transparent
        visible={importResultVisible}
        animationType="slide"
        onRequestClose={() => setImportResultVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>📊 Import Report</Text>
            {importResult != null && (
              <>
                <View style={s.importSummaryRow}>
                  <View style={[s.importBadge, { backgroundColor: '#d1fad7' }]}>
                    <Text style={[s.importBadgeNum, { color: '#1a7a33' }]}>{importResult.importedCount ?? 0}</Text>
                    <Text style={[s.importBadgeLabel, { color: '#1a7a33' }]}>Imported</Text>
                  </View>
                  <View style={[s.importBadge, { backgroundColor: (importResult.skippedCount ?? 0) > 0 ? '#fde8d8' : '#f0f0f0' }]}>
                    <Text style={[s.importBadgeNum, { color: (importResult.skippedCount ?? 0) > 0 ? '#b94a00' : '#888' }]}>{importResult.skippedCount ?? 0}</Text>
                    <Text style={[s.importBadgeLabel, { color: (importResult.skippedCount ?? 0) > 0 ? '#b94a00' : '#888' }]}>Skipped</Text>
                  </View>
                </View>

                {(importResult.errors ?? []).length > 0 && (
                  <>
                    <Text style={[s.label, { marginTop: Spacing.md }]}>Row Errors</Text>
                    <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator>
                      {(importResult.errors ?? []).map((e: any, i: number) => (
                        <View key={i} style={s.errorRow}>
                          <Text style={s.errorRowText}>
                            Row {e.row}{e.isbn ? ` · ISBN ${e.isbn}` : ''}{e.title ? ` · "${e.title}"` : ''}:
                            {'\n'}{e.reason}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  </>
                )}
              </>
            )}
            <TouchableOpacity
              style={[s.modalBtn, s.modalBtnPrimary, { marginTop: Spacing.xl }]}
              onPress={() => setImportResultVisible(false)}
            >
              <Text style={[s.modalBtnText, { color: Colors.textOnDark }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>
          <Text style={s.title}>Inventory</Text>
          {/* Import via spreadsheet */}
          <TouchableOpacity
            style={[s.importBtn, importing && { opacity: 0.5 }]}
            onPress={openImportFlow}
            disabled={importing}
          >
            {importing
              ? <ActivityIndicator color={Colors.textOnDark} size="small" />
              : <Text style={s.importBtnText}>📤 Import</Text>
            }
          </TouchableOpacity>
        </View>

        {/* ── Mode tabs ────────────────────────────────────────────────── */}
        <View style={s.tabRow}>
          {(['book', 'branch'] as Mode[]).map((id) => (
            <TouchableOpacity
              key={id}
              style={[s.tabBtn, mode === id && s.tabBtnActive]}
              onPress={() => setMode(id)}
            >
              <Text style={[s.tabText, mode === id && s.tabTextActive]}>
                {id === 'book' ? '📖 By Book' : '🏛️ By Branch'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── BY BOOK ──────────────────────────────────────────────────── */}
        {mode === 'book' && (
          <View style={s.section}>
            <TextInput
              style={s.search}
              placeholder="Search title, author or ISBN…"
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />

            {loadingBooks ? (
              <ActivityIndicator color={Colors.accentSage} style={{ marginTop: Spacing.xl }} />
            ) : filteredBooks.length === 0 ? (
              <Text style={s.empty}>No books found.</Text>
            ) : (
              filteredBooks.map((book) => (
                <View key={book._id}>
                  <TouchableOpacity
                    style={[s.card, selectedBookId === book._id && s.cardSelected]}
                    onPress={() => selectBook(book._id)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle} numberOfLines={1}>{book.title}</Text>
                      <Text style={s.cardSub}>{book.author}</Text>
                      <Text style={s.cardMeta}>
                        Age {book.minAge !== undefined ? `${book.minAge}+` : 'Unknown'} · ISBN {book.isbn}
                      </Text>
                      {/* Tag count badge */}
                      {Array.isArray(book.chatbotTags) && book.chatbotTags.length > 0 && (
                        <View style={s.tagBadgeRow}>
                          <Text style={s.tagBadge}>🏷️ {book.chatbotTags.length} tag{book.chatbotTags.length !== 1 ? 's' : ''}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: Spacing.xs }}>
                      <Text style={s.chevron}>{selectedBookId === book._id ? '▲' : '▼'}</Text>
                      <TouchableOpacity
                        style={s.editTagsBtn}
                        onPress={(e) => { e.stopPropagation?.(); openTagEditor(book); }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={s.editTagsBtnText}>🏷️</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>

                  {selectedBookId === book._id && (
                    <View style={s.expandPanel}>
                      {/* Branch search */}
                      <TextInput
                        style={s.searchInner}
                        placeholder="Search branches…"
                        placeholderTextColor={Colors.textMuted}
                        value={branchSearch}
                        onChangeText={setBranchSearch}
                      />
                      {loadingBookInv ? (
                        <ActivityIndicator color={Colors.accentSage} />
                      ) : filteredBranchesForBook.length === 0 ? (
                        <Text style={s.empty}>No branches match.</Text>
                      ) : (
                        filteredBranchesForBook.map((b) => {
                          const stat = invByBranchId[b._id];
                          return (
                            <View key={b._id} style={s.detailRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={s.detailName}>{b.name}</Text>
                                {stat ? (
                                  <Text style={s.detailStats}>
                                    ✅ {stat.available} avail · 📤 {stat.issued} issued
                                    {stat.damaged > 0 ? ` · ⚠️ ${stat.damaged} dmg` : ''}
                                    {stat.lost > 0 ? ` · ❌ ${stat.lost} lost` : ''}
                                    {' · '}total {stat.total}
                                  </Text>
                                ) : (
                                  <Text style={s.detailStats}>No copies yet</Text>
                                )}
                              </View>
                              <TouchableOpacity
                                style={s.addBtn}
                                onPress={() => openAddModal(book._id, book.title, b._id, b.name)}
                              >
                                <Text style={s.addBtnText}>+ Add</Text>
                              </TouchableOpacity>
                            </View>
                          );
                        })
                      )}
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* ── BY BRANCH ────────────────────────────────────────────────── */}
        {mode === 'branch' && (
          <View style={s.section}>
            {loadingBranches ? (
              <ActivityIndicator color={Colors.accentSage} style={{ marginTop: Spacing.xl }} />
            ) : (
              branches.map((branch) => {
                const stats = branchStats[branch._id];
                return (
                  <View key={branch._id}>
                    <TouchableOpacity
                      style={[s.card, selectedBranchId === branch._id && s.cardSelected]}
                      onPress={() => selectBranch(branch._id)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.cardTitle}>{branch.name}</Text>
                        {stats ? (
                          <Text style={s.cardSub}>
                            📚 {stats.total} total · ✅ {stats.available} avail · 📤 {stats.issued} issued
                            {stats.damaged > 0 ? ` · ⚠️ ${stats.damaged} dmg` : ''}
                            {stats.lost > 0 ? ` · ❌ ${stats.lost} lost` : ''}
                          </Text>
                        ) : (
                          <Text style={s.cardSub}>Loading stats…</Text>
                        )}
                      </View>
                      <Text style={s.chevron}>{selectedBranchId === branch._id ? '▲' : '▼'}</Text>
                    </TouchableOpacity>

                    {selectedBranchId === branch._id && (
                      <View style={s.expandPanel}>
                        {/* Book search */}
                        <TextInput
                          style={s.searchInner}
                          placeholder="Search books in this branch…"
                          placeholderTextColor={Colors.textMuted}
                          value={bookInBranchSearch}
                          onChangeText={setBookInBranchSearch}
                        />
                        {loadingBranchInv ? (
                          <ActivityIndicator color={Colors.accentSage} />
                        ) : filteredBooksInBranch.length === 0 ? (
                          <Text style={s.empty}>{branchBooks.length === 0 ? 'No inventory records for this branch.' : 'No books match.'}</Text>
                        ) : (
                          filteredBooksInBranch.map((bk) => (
                            <View key={bk.bookId} style={s.detailRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={s.detailName} numberOfLines={1}>{bk.title}</Text>
                                <Text style={s.detailStats}>
                                  ✅ {bk.available} avail · 📤 {bk.issued} issued
                                  {bk.damaged > 0 ? ` · ⚠️ ${bk.damaged} dmg/lost` : ''}
                                  {' · '}total {bk.total}
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={s.addBtn}
                                onPress={() => openAddModal(bk.bookId, bk.title, branch._id, branch.name)}
                              >
                                <Text style={s.addBtnText}>+ Add</Text>
                              </TouchableOpacity>
                            </View>
                          ))
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.librarianTint },
  scroll: { paddingBottom: Spacing.xl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 24, color: Colors.accentSage, fontWeight: '700' },
  title: { fontSize: Typography.title, fontWeight: '800', color: Colors.accentSage },

  tabRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: Radius.full,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.cardBorder,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: Colors.accentSage, borderColor: Colors.accentSage },
  tabText: { fontSize: Typography.label, fontWeight: '700', color: Colors.textSecondary },
  tabTextActive: { color: Colors.textOnDark },

  section: { paddingHorizontal: Spacing.xl },

  search: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    fontSize: Typography.body,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardSelected: { borderColor: Colors.accentSage, borderWidth: 1.5 },
  cardTitle: { fontSize: Typography.body, fontWeight: '700', color: Colors.textPrimary },
  cardSub: { fontSize: Typography.label, color: Colors.textSecondary, marginTop: 2 },
  cardMeta: { fontSize: Typography.caption, color: Colors.textMuted, marginTop: 1 },
  chevron: { fontSize: 12, color: Colors.textMuted, marginLeft: Spacing.sm },

  expandPanel: {
    backgroundColor: Colors.browseSurface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  detailName: { fontSize: Typography.label, fontWeight: '700', color: Colors.textPrimary },
  detailStats: { fontSize: Typography.caption, color: Colors.textSecondary, marginTop: 2 },

  addBtn: {
    backgroundColor: Colors.accentSage,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
  },
  addBtnText: { fontSize: Typography.caption, fontWeight: '800', color: Colors.textOnDark },

  empty: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: Typography.body,
    paddingVertical: Spacing.lg,
  },

  searchInner: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    fontSize: Typography.label,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xs,
  },
  modalTitle: {
    fontSize: Typography.title,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  modalMeta: { fontSize: Typography.label, color: Colors.textSecondary },

  label: {
    fontSize: Typography.label,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    fontSize: Typography.body,
    color: Colors.textPrimary,
  },

  chipRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    borderWidth: 1.5, borderColor: Colors.cardBorder,
  },
  chipActive: { backgroundColor: Colors.accentSage, borderColor: Colors.accentSage },
  chipText: { fontSize: Typography.label, fontWeight: '700', color: Colors.textSecondary },
  chipTextActive: { color: Colors.textOnDark },

  modalBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xl },
  modalBtn: {
    flex: 1, paddingVertical: 14, borderRadius: Radius.full, alignItems: 'center',
  },
  modalBtnPrimary: { flex: 2, backgroundColor: Colors.accentSage },
  modalBtnText: { fontSize: Typography.body, fontWeight: '800' },

  // Import button in header
  importBtn: {
    backgroundColor: Colors.accentSage,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importBtnText: { fontSize: Typography.label, fontWeight: '800', color: Colors.textOnDark },

  // Import result modal
  importSummaryRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginVertical: Spacing.md,
  },
  importBadge: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  importBadgeNum: { fontSize: 32, fontWeight: '900' },
  importBadgeLabel: { fontSize: Typography.label, fontWeight: '700', marginTop: 2 },
  errorRow: {
    backgroundColor: '#fff4f0',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: '#e05c00',
  },
  errorRowText: { fontSize: Typography.caption, color: '#5c2200', lineHeight: 18 },

  // Import instruction modal
  hintTable: {
    gap: 6,
    marginTop: 4,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  hintCol: {
    fontSize: Typography.label,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  hintReq: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  hintDesc: {
    flex: 1,
    fontSize: Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  dontShowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  checkboxChecked: {
    backgroundColor: Colors.accentSage,
    borderColor: Colors.accentSage,
  },
  checkmark: {
    fontSize: 13,
    color: Colors.textOnDark,
    fontWeight: '900',
    lineHeight: 16,
  },
  dontShowText: {
    fontSize: Typography.label,
    color: Colors.textSecondary,
    fontWeight: '600',
  },

  // chatbot tag editor styles
  tagChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 8, marginBottom: 8 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#E8F5E9', borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#6B9E78',
  },
  tagChipText: { fontSize: 12, fontWeight: '700', color: '#6B9E78' },
  tagChipRemove: { fontSize: 12, color: '#6B9E78', fontWeight: '900' },
  tagInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  tagAddBtn: { backgroundColor: '#6B9E78', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 10 },
  tagAddBtnText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  tagBadgeRow: { marginTop: 4 },
  tagBadge: { fontSize: 11, fontWeight: '700', color: '#6B9E78' },
  editTagsBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#6B9E78',
  },
  editTagsBtnText: { fontSize: 14 },
});