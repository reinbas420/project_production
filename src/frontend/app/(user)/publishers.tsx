import catalogService, { type CatalogPublisherSearchResult } from '@/api/services/catalogService';
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

// Keep highest mentions per unique name
function deduplicatePublishers(results: CatalogPublisherSearchResult[]): CatalogPublisherSearchResult[] {
  const map = new Map<string, CatalogPublisherSearchResult>();
  for (const p of results) {
    const key = p.name.toLowerCase().trim();
    const existing = map.get(key);
    if (!existing || (p.mentions ?? 0) > (existing.mentions ?? 0)) {
      map.set(key, p);
    }
  }
  return Array.from(map.values());
}

function PublisherCard({ publisher, onPress }: { publisher: CatalogPublisherSearchResult; onPress: () => void }) {
  const initial = publisher.name?.charAt(0).toUpperCase() ?? '?';
  return (
    <View style={card.wrap}>
      <View style={card.avatar}>
        <Text style={card.avatarText}>{initial}</Text>
      </View>
      <Text style={card.name} numberOfLines={2}>{publisher.name}</Text>
      <Text style={card.meta}>{publisher.mentions} book mention{publisher.mentions !== 1 ? 's' : ''}</Text>
      {publisher.sampleTitles.length > 0 ? (
        <Text style={card.sample} numberOfLines={1}>e.g. {publisher.sampleTitles[0]}</Text>
      ) : null}
      <TouchableOpacity style={card.btn} onPress={onPress}>
        <Text style={card.btnText}>View Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function PublishersScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('Penguin');
  const [publishers, setPublishers] = useState<CatalogPublisherSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) { setPublishers([]); return; }
    setLoading(true);
    try {
      const raw = await catalogService.searchPublishers(q, 20);
      setPublishers(deduplicatePublishers(raw));
    } catch (e) {
      console.warn('Publisher search failed', e);
      setPublishers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { runSearch(); }, []);

  return (
    <SafeAreaView style={s.safe}>
      {Platform.OS === 'web' && <NavBar role="user" active="home" />}
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Publisher Explorer</Text>
        <Text style={s.subtitle}>Discover publishers and related catalog data from our library collection.</Text>

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
        {publishers.length === 0 && !loading ? (
          <Text style={s.empty}>No publishers found. Try a different name.</Text>
        ) : null}

        <View style={s.grid}>
          {publishers.map((publisher) => (
            <PublisherCard
              key={publisher.name}
              publisher={publisher}
              onPress={() => router.push({ pathname: '/(user)/publisher-detail', params: { name: publisher.name } })}
            />
          ))}
        </View>
      </ScrollView>
      {Platform.OS !== 'web' && <NavBar role="user" active="home" />}
    </SafeAreaView>
  );
}

const CARD_MIN = 180;
const AVATAR_SIZE = 64;

const card = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: CARD_MIN,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 6,
    alignItems: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.buttonPrimaryText,
  },
  name: {
    fontSize: Typography.body,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  meta: { fontSize: Typography.label, color: Colors.textSecondary },
  sample: {
    fontSize: Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  btn: {
    marginTop: 6,
    backgroundColor: Colors.buttonPrimary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  btnText: {
    fontSize: Typography.label,
    fontWeight: '700',
    color: Colors.buttonPrimaryText,
  },
});

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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  empty: { color: Colors.textMuted, fontSize: Typography.label, textAlign: 'center', paddingVertical: Spacing.md },
});
