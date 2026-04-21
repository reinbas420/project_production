import bookService from '@/api/services/bookService';
import { NavBar, NAV_BOTTOM_PAD } from '@/components/NavBar';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { filterBooksWithCovers } from '@/utils/bookFilters';
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface DBAuthor {
  canonicalName: string;
  bookCount: number;
  topBook: string | null;
  coverImage: string | null;
  genres: string[];
}

// ─── Partial-name deduplication ──────────────────────────────────────────────
// "Roald Dahl" ⊂ "Roald Dahl X"  → canonical "Roald Dahl"
// "Roald Dahl" vs "Roald Dall"    → different authors (no containment)

function extractAuthorsFromBooks(books: any[]): DBAuthor[] {
  // 1. Collect every distinct raw author string + their books
  const rawMap = new Map<string, any[]>();
  for (const b of books) {
    const raw: string = (b.author || '').trim();
    if (!raw) continue;
    const prev = rawMap.get(raw) ?? [];
    rawMap.set(raw, [...prev, b]);
  }

  // 2. Resolve canonical names via substring containment
  const rawNames = Array.from(rawMap.keys());
  // Maps each raw name → its canonical (initially itself)
  const canonicalOf = new Map<string, string>(rawNames.map((n) => [n, n]));

  for (let i = 0; i < rawNames.length; i++) {
    for (let j = i + 1; j < rawNames.length; j++) {
      const a = rawNames[i].toLowerCase();
      const b = rawNames[j].toLowerCase();
      if (a.includes(b) || b.includes(a)) {
        // Shorter string is the canonical
        const canonical = rawNames[i].length <= rawNames[j].length ? rawNames[i] : rawNames[j];
        const redundant = canonical === rawNames[i] ? rawNames[j] : rawNames[i];
        // Remap redundant → canonical (and anything that was pointing to redundant)
        const redundantCanon = canonicalOf.get(redundant)!;
        const canonicalCanon = canonicalOf.get(canonical)!;
        // Resolve both to the shorter final canonical
        const finalCanon =
          canonicalCanon.length <= redundantCanon.length ? canonicalCanon : redundantCanon;
        for (const [k, v] of canonicalOf.entries()) {
          if (v === redundantCanon || v === canonicalCanon) {
            canonicalOf.set(k, finalCanon);
          }
        }
      }
    }
  }

  // 3. Merge books under each canonical
  const merged = new Map<string, any[]>();
  for (const [raw, bks] of rawMap.entries()) {
    const canon = canonicalOf.get(raw) ?? raw;
    const prev = merged.get(canon) ?? [];
    merged.set(canon, [...prev, ...bks]);
  }

  // 4. Build DBAuthor list
  const result: DBAuthor[] = [];
  for (const [canonicalName, bks] of merged.entries()) {
    const topBook = bks[0]?.title ?? null;
    const coverImage = bks.find((b: any) => b.coverImage)?.coverImage ?? null;
    const genres: string[] = Array.from(new Set(bks.flatMap((b: any) => b.genre ?? [])));
    result.push({ canonicalName, bookCount: bks.length, topBook, coverImage, genres });
  }

  return result.sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
}

// ─── AuthorCard ───────────────────────────────────────────────────────────────

function AuthorCard({ author, onPress }: { author: DBAuthor; onPress: () => void }) {
  const initial = author.canonicalName.charAt(0).toUpperCase();
  return (
    <View style={card.wrap}>
      <View style={card.avatar}>
        <Text style={card.avatarText}>{initial}</Text>
      </View>
      <Text style={card.name} numberOfLines={2}>{author.canonicalName}</Text>
      <Text style={card.meta}>{author.bookCount} book{author.bookCount !== 1 ? 's' : ''} in library</Text>
      {author.topBook ? (
        <Text style={card.topWork} numberOfLines={1}>e.g. {author.topBook}</Text>
      ) : null}
      <TouchableOpacity style={card.btn} onPress={onPress}>
        <Text style={card.btnText}>View Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AuthorsScreen() {
  const router = useRouter();
  const [allAuthors, setAllAuthors] = useState<DBAuthor[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await bookService.getBooks({ limit: 500 });
        const books: any[] = filterBooksWithCovers(res?.data?.books ?? res?.books ?? []);
        setAllAuthors(extractAuthorsFromBooks(books));
      } catch (e) {
        console.warn('Failed to load authors from DB', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const displayed = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return allAuthors;
    return allAuthors.filter((a) => a.canonicalName.toLowerCase().includes(q));
  })();

  return (
    <SafeAreaView style={s.safe}>
      {Platform.OS === 'web' && <NavBar role="user" active="home" />}
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Author Explorer</Text>
        <Text style={s.subtitle}>Authors from our library collection.</Text>

        <View style={s.searchWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Filter by name..."
            placeholderTextColor={Colors.textMuted}
            style={s.searchInput}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={s.clearBtn}>
              <Text style={s.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="small" color={Colors.accentSage} style={{ marginTop: Spacing.lg }} />
        ) : displayed.length === 0 ? (
          <Text style={s.empty}>
            {query ? `No authors matching "${query}".` : 'No authors found in library.'}
          </Text>
        ) : null}

        <View style={s.grid}>
          {displayed.map((author) => (
            <AuthorCard
              key={author.canonicalName}
              author={author}
              onPress={() =>
                router.push({
                  pathname: '/(user)/author-detail',
                  params: { name: author.canonicalName, fromDB: '1' },
                })
              }
            />
          ))}
        </View>
      </ScrollView>
      {Platform.OS !== 'web' && <NavBar role="user" active="home" />}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_MIN = 180;
const PHOTO_SIZE = 64;

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
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
    backgroundColor: Colors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: { fontSize: 26, fontWeight: '800', color: Colors.buttonPrimaryText },
  name: { fontSize: Typography.body, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  meta: { fontSize: Typography.label, color: Colors.textSecondary },
  topWork: { fontSize: Typography.caption, color: Colors.textMuted, textAlign: 'center' },
  btn: {
    marginTop: 6,
    backgroundColor: Colors.buttonPrimary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  btnText: { fontSize: Typography.label, fontWeight: '700', color: Colors.buttonPrimaryText },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.xl, paddingBottom: NAV_BOTTOM_PAD + Spacing.xl, gap: Spacing.md },
  backBtn: { alignSelf: 'flex-start' },
  backText: { color: Colors.accentSage, fontWeight: '700', fontSize: Typography.body },
  title: { fontSize: Typography.title + 2, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { color: Colors.textSecondary, fontSize: Typography.label },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: Typography.body,
  },
  clearBtn: { padding: 4 },
  clearBtnText: { color: Colors.textMuted, fontSize: 14 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  empty: { color: Colors.textMuted, fontSize: Typography.label, textAlign: 'center', paddingVertical: Spacing.md },
});
