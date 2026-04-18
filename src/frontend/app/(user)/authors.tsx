import catalogService, { type CatalogAuthorDetails, type CatalogAuthorSearchResult } from '@/api/services/catalogService';
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

export default function AuthorsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('Roald Dahl');
  const [authors, setAuthors] = useState<CatalogAuthorSearchResult[]>([]);
  const [selected, setSelected] = useState<CatalogAuthorDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) {
      setAuthors([]);
      setSelected(null);
      return;
    }

    setLoading(true);
    try {
      const results = await catalogService.searchAuthors(q, 12);
      setAuthors(results);
      setSelected(null);
    } catch (error) {
      console.warn('Author search failed', error);
      setAuthors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSearch();
  }, []);

  const openAuthor = async (authorKey: string) => {
    setDetailsLoading(true);
    try {
      const details = await catalogService.getAuthorDetails(authorKey);
      setSelected(details);
    } catch (error) {
      console.warn('Author details failed', error);
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

        <Text style={s.title}>Author Explorer</Text>
        <Text style={s.subtitle}>Search open-source author profiles and works from Open Library.</Text>

        <View style={s.searchWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search author name..."
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
          {authors.length === 0 && !loading ? <Text style={s.empty}>No authors found.</Text> : null}
          {authors.map((author) => (
            <TouchableOpacity key={author.key} style={s.row} onPress={() => openAuthor(author.key)}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{author.name}</Text>
                <Text style={s.rowMeta}>
                  {author.workCount} works {author.topWork ? `· Top: ${author.topWork}` : ''}
                </Text>
              </View>
              <Text style={s.rowArrow}>→</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>Author Details</Text>
          {detailsLoading ? <ActivityIndicator size="small" color={Colors.accentSage} /> : null}
          {!detailsLoading && !selected ? <Text style={s.empty}>Tap an author above to load details.</Text> : null}
          {!detailsLoading && selected ? (
            <View style={{ gap: 8 }}>
              <Text style={s.detailsTitle}>{selected.name}</Text>
              {selected.birthDate || selected.deathDate ? (
                <Text style={s.detailsMeta}>Life: {selected.birthDate || '?'} - {selected.deathDate || 'Present'}</Text>
              ) : null}
              {selected.bio ? <Text style={s.detailsText}>{selected.bio}</Text> : null}
              {selected.topSubjects.length > 0 ? (
                <Text style={s.detailsMeta}>Subjects: {selected.topSubjects.slice(0, 6).join(', ')}</Text>
              ) : null}
              <Text style={[s.detailsMeta, { marginTop: 4 }]}>Popular Works</Text>
              {selected.works.slice(0, 8).map((work, idx) => (
                <Text key={`${work.key || work.title}-${idx}`} style={s.workItem}>
                  • {work.title} {work.firstPublishYear ? `(${work.firstPublishYear})` : ''}
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
