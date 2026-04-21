import bookService from '@/api/services/bookService';
import catalogService, { type CatalogAuthorDetails } from '@/api/services/catalogService';
import { BookCoverFallback } from '@/components/BookCoverFallback';
import { NavBar, NAV_BOTTOM_PAD } from '@/components/NavBar';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { filterBooksWithCovers } from '@/utils/bookFilters';
import { Image } from 'expo-image';
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

// Map subjects → genre string for BookCoverFallback
function subjectToGenre(subjects: string[]): string | undefined {
  if (!subjects?.length) return undefined;
  const joined = subjects.join(' ').toLowerCase();
  if (joined.includes('fantasy') || joined.includes('magic')) return 'Fantasy';
  if (joined.includes('science fiction') || joined.includes('sci-fi')) return 'Sci-Fi';
  if (joined.includes('mystery') || joined.includes('detective') || joined.includes('crime')) return 'Mystery';
  if (joined.includes('romance') || joined.includes('love')) return 'Romance';
  if (joined.includes('history') || joined.includes('historical')) return 'History';
  return undefined;
}

// Partial-name match: does a book's author field belong to this canonical author?
function authorMatches(bookAuthor: string, canonical: string): boolean {
  const a = bookAuthor.toLowerCase().trim();
  const c = canonical.toLowerCase().trim();
  return a === c || a.includes(c) || c.includes(a);
}

// Attempt Open Library photo (cosmetic only — gracefully fails)
function getPhotoUrl(authorKey: string): string | null {
  const olid = String(authorKey || '').replace('/authors/', '').trim();
  if (!olid) return null;
  return `https://covers.openlibrary.org/a/olid/${olid}-L.jpg`;
}

export default function AuthorDetailScreen() {
  const router = useRouter();
  const { key: rawKey, name, fromDB } = useLocalSearchParams<{ key: string; name: string; fromDB?: string }>();
  const isFromDB = fromDB === '1';

  const [resolvedKey, setResolvedKey] = useState<string | null>(rawKey ?? null);
  const [author, setAuthor] = useState<CatalogAuthorDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoFailed, setPhotoFailed] = useState(false);

  // DB-sourced books for this author (used when fromDB=1, also enriches OL view)
  const [dbBooks, setDBBooks] = useState<any[]>([]);
  // Open Library works list (bibliography)
  const [olWorks, setOlWorks] = useState<CatalogAuthorDetails['works']>([]);

  useEffect(() => {
    (async () => {
      try {
        if (isFromDB) {
          // ── DB mode: load all books, filter by author partial match ──
          const res = await bookService.getBooks({ limit: 500 });
          const all: any[] = res?.data?.books ?? res?.books ?? [];
          const matched = filterBooksWithCovers(all).filter((b: any) => authorMatches(b.author || '', name || ''));
          setDBBooks(matched);

          // Build a synthetic CatalogAuthorDetails from DB data
          const genres: string[] = Array.from(new Set(matched.flatMap((b: any) => b.genre ?? [])));
          setAuthor({
            key: '',
            name: name ?? 'Author',
            bio: null,
            birthDate: null,
            deathDate: null,
            alternateNames: [],
            topSubjects: genres,
            works: matched.map((b: any) => ({
              key: b._id || b.id,
              title: b.title,
              firstPublishYear: b.publishedDate ? parseInt(b.publishedDate.match(/\d{4}/)?.[0]) || null : null,
              subjects: b.genre ?? [],
            })),
          });

          // Resolve OL key for photo + bio + works
          try {
            const results = await catalogService.searchAuthors((name || '').trim(), 1);
            const olKey = results?.[0]?.key ?? null;
            if (olKey) {
              setResolvedKey(olKey);
              // Fetch OL details for bio, dates, alternateNames, works
              try {
                const olDetails = await catalogService.getAuthorDetails(olKey);
                setAuthor(prev => prev ? {
                  ...prev,
                  bio: olDetails.bio,
                  birthDate: olDetails.birthDate,
                  deathDate: olDetails.deathDate,
                  alternateNames: olDetails.alternateNames,
                } : prev);
                if (olDetails.works?.length) setOlWorks(olDetails.works);
              } catch { /* bio non-critical */ }
            }
          } catch { /* key lookup cosmetic — fail silently */ }
        } else {
          // ── OL mode: resolve key, fetch from Open Library ──
          let keyToUse = rawKey;
          if (!keyToUse && name) {
            const results = await catalogService.searchAuthors(name.trim(), 1);
            keyToUse = results?.[0]?.key ?? null;
            if (keyToUse) setResolvedKey(keyToUse);
          }
          if (!keyToUse) { setLoading(false); return; }
          const details = await catalogService.getAuthorDetails(keyToUse);
          setAuthor(details);
          if (details.works?.length) setOlWorks(details.works);

          // Also fetch matching DB books for Available Books grid
          if (details?.name) {
            try {
              const res = await bookService.searchBooks(details.name);
              const books: any[] = filterBooksWithCovers(res?.data?.books ?? res?.books ?? []);
              setDBBooks(books);
            } catch { /* non-critical */ }
          }
        }
      } catch (e) {
        console.warn('Author details failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [rawKey, name, fromDB]);

  const displayName = author?.name ?? name ?? 'Author';
  const initial = displayName.charAt(0).toUpperCase();
  const photoUrl = resolvedKey ? getPhotoUrl(resolvedKey) : null;
  const genre = author ? subjectToGenre(author.topSubjects) : undefined;

  return (
    <SafeAreaView style={s.safe}>
      {Platform.OS === 'web' && <NavBar role="user" active="home" />}
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        {/* ── Hero section ── */}
        <View style={s.hero}>
          {photoUrl && !photoFailed ? (
            <Image
              source={{ uri: photoUrl }}
              style={s.photo}
              contentFit="cover"
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <View style={s.avatarFallback}>
              <Text style={s.avatarText}>{initial}</Text>
            </View>
          )}
          <Text style={s.authorName}>{displayName}</Text>
          {loading && <ActivityIndicator size="small" color={Colors.accentSage} style={{ marginTop: 8 }} />}
          {!loading && author && (author.birthDate || author.deathDate) ? (
            <Text style={s.lifeDates}>
              {author.birthDate || '?'} — {author.deathDate || 'Present'}
            </Text>
          ) : null}
        </View>

        {!loading && author ? (
          <View style={s.contentWrap}>
            {/* Subjects */}
            {author.topSubjects.length > 0 ? (
              <View style={s.section}>
                <Text style={s.sectionHeading}>Top Subjects</Text>
                <View style={s.chipRow}>
                  {author.topSubjects.slice(0, 8).map((sub) => (
                    <View key={sub} style={s.chip}>
                      <Text style={s.chipText}>{sub}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Available Books — DB books in our library */}
            {dbBooks.length > 0 ? (
              <View style={s.section}>
                <Text style={s.sectionHeading}>Available Books</Text>
                <View style={s.worksGrid}>
                  {dbBooks.slice(0, 18).map((book: any, idx: number) => (
                    <TouchableOpacity
                      key={`db-${book._id || book.id}-${idx}`}
                      activeOpacity={0.85}
                      onPress={() => router.push(`/(user)/book/${book._id || book.id}`)}
                    >
                      <View style={s.workCover}>
                        <Image
                          source={{ uri: book.coverImage }}
                          style={{ width: WORK_W, height: WORK_H, borderRadius: Radius.sm }}
                          contentFit="cover"
                        />
                        <View style={s.availBadge}>
                          <Text style={s.availBadgeText}>📖</Text>
                        </View>
                        <Text style={s.workCoverTitle} numberOfLines={2}>{book.title}</Text>
                        {book.publishedDate ? (
                          <Text style={s.workCoverYear}>
                            {book.publishedDate.match(/\d{4}/)?.[0] ?? ''}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Bio */}
            {author.bio ? (
              <View style={s.section}>
                <Text style={s.sectionHeading}>About</Text>
                <Text style={s.bio}>{author.bio}</Text>
              </View>
            ) : null}

            {/* Works — full bibliography from Open Library */}
            {olWorks.length > 0 ? (
              <View style={s.section}>
                <Text style={s.sectionHeading}>Works</Text>
                <View style={s.olWorksList}>
                  {olWorks.slice(0, 30).map((work, idx) => (
                    <View key={`ol-${work.key || work.title}-${idx}`} style={s.olWorkRow}>
                      <View style={s.olWorkDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.olWorkTitle}>{work.title}</Text>
                        {work.firstPublishYear ? (
                          <Text style={s.olWorkYear}>{work.firstPublishYear}</Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {!loading && !author ? (
          <Text style={s.empty}>Could not load author details.</Text>
        ) : null}
      </ScrollView>
      {Platform.OS !== 'web' && <NavBar role="user" active="home" />}
    </SafeAreaView>
  );
}

const PHOTO_SIZE = 280;
const WORK_W = 110;
const WORK_H = 160;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.xl, paddingBottom: NAV_BOTTOM_PAD + Spacing.xl, gap: Spacing.lg },
  backBtn: { alignSelf: 'flex-start' },
  backText: { color: Colors.accentSage, fontWeight: '700', fontSize: Typography.body },

  hero: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: Spacing.xl,
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
    backgroundColor: Colors.cardBorder,
  },
  avatarFallback: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
    backgroundColor: Colors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 120,
    fontWeight: '800',
    color: Colors.buttonPrimaryText,
  },
  authorName: {
    fontSize: Typography.title + 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  lifeDates: {
    fontSize: Typography.label,
    color: Colors.textSecondary,
  },

  // Max-width content wrapper (for web readability)
  contentWrap: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    gap: Spacing.xl,
  },

  section: {
    gap: 12,
  },

  // Bold dark-green section headings
  sectionHeading: {
    fontSize: Typography.title,
    fontWeight: '800',
    color: Colors.accentSage,
    letterSpacing: 0.3,
  },

  bio: {
    fontSize: Typography.body + 4,
    color: Colors.textPrimary,
    lineHeight: 34,
    maxWidth: 700,
  },
  meta: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    lineHeight: 28,
  },

  // Subject chips (periwinkle)
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: Colors.browseSurface,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: Typography.label,
    color: Colors.textPrimary,
    fontWeight: '600',
  },

  // "Also known as" chips (light peach)
  nameChip: {
    backgroundColor: Colors.buttonPrimary,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  nameChipText: {
    fontSize: Typography.label,
    color: Colors.buttonPrimaryText,
    fontWeight: '600',
  },

  // Works cover grid
  worksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  workCover: {
    width: WORK_W,
    gap: 5,
    position: 'relative',
  },
  workCoverUnavailable: {
    opacity: 0.75,
  },
  availBadge: {
    position: 'absolute',
    top: 5,
    right: 4,
    backgroundColor: Colors.accentSage,
    borderRadius: Radius.full,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  availBadgeText: {
    fontSize: 12,
  },
  workCoverTitle: {
    fontSize: Typography.caption,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 15,
  },
  workCoverYear: {
    fontSize: Typography.caption,
    color: Colors.textMuted,
  },

  // OL works list styles
  olWorksList: {
    gap: 10,
  },
  olWorkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  olWorkDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.accentSage,
    marginTop: 6,
    flexShrink: 0,
  },
  olWorkTitle: {
    fontSize: Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  olWorkYear: {
    fontSize: Typography.caption,
    color: Colors.textMuted,
  },

  empty: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: Typography.body,
    paddingTop: Spacing.xl,
  },
});
