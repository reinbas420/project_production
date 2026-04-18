import catalogService, { type CatalogPublisherDetails, type CatalogPublisherSearchResult } from '@/api/services/catalogService';
import { NavBar, NAV_BOTTOM_PAD } from '@/components/NavBar';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PublishersScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('Penguin');
  const [publishers, setPublishers] = useState<CatalogPublisherSearchResult[]>([]);
  const [selected, setSelected] = useState<CatalogPublisherDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) {
      setPublishers([]);
      setSelected(null);
      return;
    }

    setLoading(true);
    try {
      const results = await catalogService.searchPublishers(q, 14);
      setPublishers(results);
      setSelected(null);
    } catch (error) {
      console.warn('Publisher search failed', error);
      setPublishers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSearch();
  }, []);

  const openPublisher = async (name: string) => {
    setDetailsLoading(true);
    try {
      const details = await catalogService.getPublisherDetails(name);
      setSelected(details);
    } catch (error) {
      console.warn('Publisher details failed', error);
      setSelected(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      {Platform.OS === 'web' && <NavBar role="user" active="home" />}
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={s.title}>Publisher Explorer</Text>
        <Text style={s.subtitle}>Discover publishers and related catalog data from Open Library.</Text>

        <View style={s.searchWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search publisher name..."
            placeholderTextColor={Colors.textMuted}
            style={s.searchInput}
            returnKeyType="search"
            onSubmitEditing={runSearch}
          />
          <TouchableOpacity style={s.searchBtn} onPress={runSearch}>
            <Text style={s.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>

        {loading ? <ActivityIndicator size="small" color={Colors.accentSage} /> : null}

        <View style={s.card}>
          <Text style={s.sectionTitle}>Results</Text>
          {publishers.length === 0 && !loading ? <Text style={s.empty}>No publishers found.</Text> : null}
          {publishers.map((publisher) => (
            <TouchableOpacity key={publisher.name} style={s.row} onPress={() => openPublisher(publisher.name)}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{publisher.name}</Text>
                <Text style={s.rowMeta}>
                  Mentioned in {publisher.mentions} indexed books
                </Text>
                {publisher.sampleTitles.length > 0 ? (
                  <Text style={s.rowMeta}>Sample: {publisher.sampleTitles.join(', ')}</Text>
                ) : null}
              </View>
              <Text style={s.rowArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>Publisher Details</Text>
          {detailsLoading ? <ActivityIndicator size="small" color={Colors.accentSage} /> : null}
          {!detailsLoading && !selected ? <Text style={s.empty}>Tap a publisher above to load details.</Text> : null}
          {!detailsLoading && selected ? (
            <View style={{ gap: 8 }}>
              <Text style={s.detailsTitle}>{selected.name}</Text>
              {selected.location ? <Text style={s.detailsMeta}>Location: {selected.location}</Text> : null}
              {selected.founded ? <Text style={s.detailsMeta}>Founded: {selected.founded}</Text> : null}
              {selected.website ? <Text style={s.detailsMeta}>Website: {selected.website}</Text> : null}
              {selected.description ? <Text style={s.detailsText}>{selected.description}</Text> : null}
              <Text style={[s.detailsMeta, { marginTop: 4 }]}>Sample Books</Text>
              {selected.books.slice(0, 10).map((book, idx) => (
                <Text key={`${book.title}-${idx}`} style={s.workItem}>
                  • {book.title}
                  {book.firstPublishYear ? ` (${book.firstPublishYear})` : ''}
                  {book.authorNames.length > 0 ? ` · ${book.authorNames.join(', ')}` : ''}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
      {Platform.OS !== 'web' && <NavBar role="user" active="home" />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.xl, paddingBottom: NAV_BOTTOM_PAD + Spacing.xl, gap: Spacing.md },
  backBtn: { alignSelf: 'flex-start' },
  backText: { color: Colors.accentSage, fontWeight: '700', fontSize: Typography.body },
  title: { fontSize: Typography.title + 2, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { color: Colors.textSecondary, fontSize: Typography.label },
  searchWrap: { flexDirection: 'row', gap: Spacing.sm },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.textPrimary,
  },
  searchBtn: {
    backgroundColor: Colors.accentSage,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  searchBtnText: { color: Colors.textOnDark, fontWeight: '700' },
  card: {
    backgroundColor: Colors.card,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 8,
  },
  sectionTitle: { fontSize: Typography.body, fontWeight: '800', color: Colors.textPrimary },
  empty: { color: Colors.textMuted, fontSize: Typography.label },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.md,
    padding: 10,
    gap: 8,
  },
  rowTitle: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '700' },
  rowMeta: { color: Colors.textSecondary, fontSize: Typography.label },
  rowArrow: { color: Colors.textMuted, fontSize: Typography.body, fontWeight: '700' },
  detailsTitle: { color: Colors.textPrimary, fontSize: Typography.body + 1, fontWeight: '800' },
  detailsMeta: { color: Colors.textSecondary, fontSize: Typography.label },
  detailsText: { color: Colors.textPrimary, fontSize: Typography.label, lineHeight: 20 },
  workItem: { color: Colors.textPrimary, fontSize: Typography.label },
});
