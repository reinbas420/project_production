import bookService from '@/api/services/bookService';
import axiosInstance from '@/api/axiosInstance';
import { BookCover } from '@/components/BookCover';
import { NavBar, NAV_BOTTOM_PAD } from '@/components/NavBar';
import { type Book } from '@/constants/mockData';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import useAppStore from '@/store/useAppStore';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function mapBook(b: any): Book {
  return {
    id: b._id || b.id,
    title: b.title || 'Unknown Title',
    author: b.author || 'Unknown Author',
    pages: b.pages || 200,
    releaseYear: b.publishedDate
      ? (parseInt(b.publishedDate.match(/\d{4}/)?.[0]) || new Date(b.createdAt || Date.now()).getFullYear())
      : new Date(b.createdAt || Date.now()).getFullYear(),
    genres: b.genre || [],
    summary: b.summary || 'A fantastic new adventure awaits...',
    rating: 4.5,
    coverColor: b.coverColor || '#C5DDB8',
    coverAccent: b.coverAccent || '#4A7C59',
    // Default to true when the backend has no `format` field yet
    isDigital: b.format ? (b.format === 'DIGITAL' || b.format === 'BOTH') : true,
    isPhysical: b.format ? (b.format === 'PHYSICAL' || b.format === 'BOTH') : true,
    availableCopies: parseInt(b?.availableCopies ?? 0),
    nearestLibrary: 'Local Library',
    ageMin: b.minAge ?? (parseInt(String(b.ageRating || '').split("-")[0]) || 0),
    ageMax: 99,
    keyWords: [],
    coverImage: b.coverImage,
    isbn: b.isbn != null ? String(b.isbn) : undefined,
  };
}

function SimilarCard({ book, onPress }: { book: Book; onPress: () => void }) {
  const avail = book.availableCopies > 0;
  return (
    <TouchableOpacity style={sc.wrap} onPress={onPress} activeOpacity={0.82}>
      <View>
        <BookCover book={book} width={110} height={158} fontSize={10} />
        <View style={[sc.dot, { backgroundColor: avail ? Colors.success : Colors.error }]} />
      </View>
      <Text style={sc.title} numberOfLines={2}>{book.title}</Text>
      <Text style={sc.author} numberOfLines={1}>{book.author}</Text>
      <Text style={[sc.avail, { color: avail ? Colors.success : Colors.error }]}>
        {avail ? `${book.availableCopies} available` : 'Unavailable'}
      </Text>
    </TouchableOpacity>
  );
}
const sc = StyleSheet.create({
  wrap: { width: 110, gap: 4, marginRight: Spacing.lg },
  dot: {
    position: 'absolute', bottom: 6, right: 6,
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 2, borderColor: Colors.browseSurface,
  },
  title: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, lineHeight: 16 },
  author: { fontSize: 11, color: Colors.textSecondary },
  avail: { fontSize: 10, fontWeight: '600' },
});

export default function ChildBookDetail() {
  const { id, viewingChildId } = useLocalSearchParams<{ id: string; viewingChildId?: string }>();
  const router = useRouter();
  const { profiles, activeProfileId, userId } = useAppStore();

  // Derive the same age cap used in ChildHome so similar-books respect the child's age.
  const activeProfile = profiles.find(p => p.profileId === activeProfileId);
  const childProfile =
    (viewingChildId ? profiles.find(p => p.profileId === viewingChildId) : undefined)
    ?? (activeProfile?.accountType === 'CHILD' ? activeProfile : undefined)
    ?? profiles.find(p => p.accountType === 'CHILD');
  const childMaxAge: number = (() => {
    const ag = childProfile?.ageGroup ?? '';
    if (!ag) return 12;
    if (ag.endsWith('+')) return parseInt(ag, 10);
    const min = parseInt(ag.split('-')[0], 10);
    return isNaN(min) ? 12 : min;
  })();

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<{ source: string, text: string }[]>([]);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [expandedReviews, setExpandedReviews] = useState<{[key: number]: boolean}>({});
  const [similarBooks, setSimilarBooks] = useState<Book[]>([]);
  const [similarGenre, setSimilarGenre] = useState<string>('');
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // ─── Resolve User Location ──────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const resolveFromSavedDeliveryAddress = async () => {
      if (!userId) return false;
      try {
        const addrRes = await axiosInstance.get(`/users/${userId}/addresses`);
        const addresses = Array.isArray(addrRes?.data?.data?.addresses)
          ? addrRes.data.data.addresses
          : Array.isArray((addrRes as any)?.addresses)
            ? (addrRes as any).addresses
          : [];
        const selected = addresses.find((a: any) => a?.isDefault) || addresses[0];
        const coords = selected?.location?.coordinates;
        if (Array.isArray(coords) && coords.length === 2 && active) {
          setUserCoords({ latitude: coords[1], longitude: coords[0] });
          return true;
        }
      } catch { /* skip */ }
      return false;
    };

    const requestLocation = async () => {
      try {
        const hasSaved = await resolveFromSavedDeliveryAddress();
        if (hasSaved) return;

        const webNavigator: any = typeof globalThis !== "undefined" ? (globalThis as any).navigator : undefined;
        if (Platform.OS === "web" && webNavigator?.geolocation) {
          webNavigator.geolocation.getCurrentPosition(
            (pos: any) => active && setUserCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            () => active && setUserCoords(null),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
          );
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (active) setUserCoords(null);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (active) setUserCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch {
        if (active) setUserCoords(null);
      }
    };

    requestLocation();
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!book || book.genres.length === 0) return;
    let active = true;

    const toCard = (b: any): Book => ({
      id: b._id || b.id,
      title: b.title || 'Unknown Title',
      author: b.author || 'Unknown Author',
      pages: 200,
      releaseYear: new Date(b.createdAt || Date.now()).getFullYear(),
      genres: b.genre || [],
      summary: b.summary || '',
      rating: 4.5,
      coverColor: '#C5DDB8',
      coverAccent: '#4A7C59',
      isDigital: true,
      isPhysical: true,
      availableCopies: parseInt(b.availableCopies ?? 0),
      nearestLibrary: 'Local Library',
      ageMin: 0, ageMax: 99,
      keyWords: [],
      coverImage: b.coverImage,
      isbn: b.isbn != null ? String(b.isbn) : undefined,
    });

    const fetchSimilar = async () => {
      try {
        const genre1 = book.genres[0];
        const params = userCoords 
          ? { lat: userCoords.latitude, lng: userCoords.longitude, genre: genre1, limit: 12, maxAge: childMaxAge }
          : { genre: genre1, limit: 12, maxAge: childMaxAge };
        const res1 = await bookService.getBooks(params);
        let results: Book[] = (res1?.data?.books || [])
          .filter((b: any) => (b._id || b.id) !== book.id)
          .map(toCard);

        if (results.length < 3 && book.genres.length > 1) {
          const genre2 = book.genres[1];
          const params2 = userCoords
            ? { lat: userCoords.latitude, lng: userCoords.longitude, genre: genre2, limit: 12, maxAge: childMaxAge }
            : { genre: genre2, limit: 12, maxAge: childMaxAge };
          const res2 = await bookService.getBooks(params2);
          const extra: Book[] = (res2?.data?.books || [])
            .filter((b: any) => (b._id || b.id) !== book.id && !results.find(r => r.id === (b._id || b.id)))
            .map(toCard);
          results = [...results, ...extra];
          if (extra.length > 0) setSimilarGenre(genre2);
          else setSimilarGenre(genre1);
        } else {
          setSimilarGenre(genre1);
        }

        if (active) setSimilarBooks(results.filter(b => b.ageMin <= childMaxAge).slice(0, 10));
      } catch {
        // silently fail — similar books are non-critical
      }
    };

    fetchSimilar();
    return () => { active = false; };
  }, [book?.id, childMaxAge, userCoords]);

  useEffect(() => {
    let active = true;
    const fetchBook = async () => {
      try {
        const params = userCoords ? { lat: userCoords.latitude, lng: userCoords.longitude } : {};
        const response = await bookService.getBookById(id as string, params);
        if (active && response.data?.book) {
          // Telemetry: Log view activity for the Smart Recommendation AI
          if (userId && activeProfileId) {
             axiosInstance.post(`/users/${userId}/profiles/${activeProfileId}/activity`, { bookId: id, action: 'VIEW' }).catch(() => {});
          }
          setBook(mapBook(response.data.book));

          axiosInstance.get(`/books/${id}/reviews`).then(revRes => {
            if (active && revRes.data?.data?.reviews) {
              setReviews(revRes.data.data.reviews);
            }
          }).catch(e => console.warn('Child Reviews fetch failed', e));
        }
      } catch (err) {
        console.warn('Failed to fetch child book detail', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchBook();
    return () => { active = false; };
  }, [id, userCoords]);

  if (loading || !book) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.accentSage} />
      </SafeAreaView>
    );
  }

  const stars = Array.from({ length: 5 }).map((_, i) =>
    i < Math.round(book.rating) ? '★' : '☆'
  );

  return (
    <SafeAreaView style={s.safe}>
      {Platform.OS === 'web' && <NavBar role="child" active="home" />}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Back */}
        <TouchableOpacity style={s.backBtn} onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/(child)'); } }}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Cover — centred, big */}
        <View style={s.coverWrap}>
          <BookCover book={book} width={180} height={260} fontSize={16} />
        </View>

        {/* Badges */}
        <View style={s.badgeRow}>
          {book.isDigital && (
            <View style={[s.badge, { backgroundColor: Colors.browseSurface }]}>
              <Text style={[s.badgeText, { color: Colors.accentPeriwinkle }]}>Digital</Text>
            </View>
          )}
          {book.isPhysical && (
            <View style={[s.badge, { backgroundColor: Colors.accentSageLight }]}>
              <Text style={[s.badgeText, { color: Colors.accentSage }]}>Physical</Text>
            </View>
          )}
          {book.availableCopies === 0 && (
            <View style={[s.badge, { backgroundColor: '#FDE8E8' }]}>
              <Text style={[s.badgeText, { color: Colors.error }]}>Not Available</Text>
            </View>
          )}
        </View>

        {/* Title + author */}
        <Text style={s.title}>{book.title}</Text>
        <Text style={s.author}>by {book.author}</Text>

        {/* Big emoji stars — child-friendly rating */}
        <View style={s.starsRow}>
          {stars.map((st, i) => (
            <Text key={i} style={s.star}>{st}</Text>
          ))}
          <Text style={s.ratingNum}>{book.rating}</Text>
        </View>

        {/* Genres */}
        <View style={s.genreRow}>
          {book.genres.map(g => (
            <View key={g} style={s.genreChip}>
              <Text style={s.genreText}>{g}</Text>
            </View>
          ))}
        </View>

        {/* Summary — kept brief for kids */}
        <View style={s.summaryBox}>
          <Text style={s.summaryLabel}>📖 What's it about?</Text>
          <Text style={s.summaryText}>{book.summary}</Text>
        </View>

        {/* Similar Books */}
        {similarBooks.length > 0 && (
          <View style={s.similarSection}>
            <View style={s.similarHeader}>
              <Text style={s.similarTitle}>
                {similarGenre ? `More in ${similarGenre}` : 'More like this'}
              </Text>
              <TouchableOpacity onPress={() => router.replace('/(child)')}>
                <Text style={s.similarSeeAll}>See all →</Text>
              </TouchableOpacity>
            </View>
            {book.genres.length > 0 && (
              <View style={s.genreChipRow}>
                {book.genres.map(g => (
                  <View key={g} style={s.genreChipSimilar}>
                    <Text style={s.genreChipText}>{g}</Text>
                  </View>
                ))}
              </View>
            )}
            <FlatList
              data={similarBooks}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(b) => b.id}
              renderItem={({ item }) => (
                <SimilarCard
                  book={item}
                  onPress={() => router.push(`/(child)/book/${item.id}`)}
                />
              )}
              contentContainerStyle={{ paddingVertical: 4 }}
            />
          </View>
        )}

        {/* Reviews & Comments */}
        <View style={s.reviewsSection}>
          <Text style={s.reviewsTitle}>What readers say</Text>
          {reviews.length === 0 ? (
            <Text style={s.reviewComment}>No reviews available yet.</Text>
          ) : (
            <>
              {reviews.slice(0, showAllReviews ? reviews.length : 2).map((review, idx) => {
                const isExpanded = expandedReviews[idx];
                const isLong = review.text.length > 150;
                return (
                  <View key={idx} style={s.reviewCard}>
                    <View style={s.reviewHeader}>
                      <Text style={s.reviewEmoji}>📖</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.reviewName}>{review.source} Reader</Text>
                      </View>
                    </View>
                    <Text 
                      style={s.reviewComment}
                      numberOfLines={isExpanded ? undefined : 3}
                    >
                      {review.text}
                    </Text>
                    {isLong && !isExpanded && (
                      <TouchableOpacity onPress={() => setExpandedReviews(prev => ({ ...prev, [idx]: true }))}>
                        <Text style={{ color: Colors.accentPeriwinkle, fontSize: 13, fontWeight: '800', marginTop: 4 }}>Read more</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              {!showAllReviews && reviews.length > 2 && (
                <TouchableOpacity onPress={() => setShowAllReviews(true)} style={{ alignItems: 'center', paddingVertical: 10 }}>
                  <Text style={{ color: Colors.accentPeriwinkle, fontSize: 13, fontWeight: '800' }}>Read all {reviews.length} reviews →</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Quick facts — simple for children */}
        <View style={s.factsRow}>
          <View style={s.factCard}>
            <Text style={s.factValue}>{book.pages ?? '—'}</Text>
            <Text style={s.factLabel}>pages</Text>
          </View>
          <View style={s.factCard}>
            <Text style={s.factValue}>{book.releaseYear}</Text>
            <Text style={s.factLabel}>published</Text>
          </View>
          <View style={s.factCard}>
            <Text style={s.factValue}>{book.availableCopies}</Text>
            <Text style={s.factLabel}>available</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={s.actions}>
          {book.isDigital ? (
            <TouchableOpacity
              style={s.btnPrimary}
              activeOpacity={0.82}
              onPress={() => router.push(`/(child)/read/${book.id}`)}
            >
              <Text style={s.btnPrimaryText}>Read now</Text>
            </TouchableOpacity>
          ) : (
            <View style={[s.btnPrimary, { opacity: 0.45 }]}>
              <Text style={s.btnPrimaryText}>Not available to read digitally</Text>
            </View>
          )}

          <TouchableOpacity
            style={s.btnSecondary}
            activeOpacity={0.82}
            onPress={() => router.push(`/(child)/quiz/${book.id}`)}
          >
            <Text style={s.btnSecondaryText}>🧠 Take a quiz!</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.btnGhost} activeOpacity={0.82}>
            <Text style={s.btnGhostText}>💬 Speak to a librarian</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
      {Platform.OS !== 'web' && <NavBar role="child" active="home" />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.browseSurface },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: NAV_BOTTOM_PAD + Spacing.xl },

  backBtn: { marginTop: Spacing.md, marginBottom: Spacing.lg },
  backText: { fontSize: Typography.body, color: Colors.accentSage, fontWeight: '700' },

  coverWrap: { alignItems: 'center', marginBottom: Spacing.lg },

  badgeRow: { flexDirection: 'row', gap: Spacing.xs, justifyContent: 'center', marginBottom: Spacing.sm },
  badge: { borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontSize: Typography.label, fontWeight: '700' },

  title: {
    fontSize: Typography.titleChild, fontWeight: '800',
    color: Colors.accentSage, textAlign: 'center', lineHeight: 34,
  },
  author: {
    fontSize: Typography.bodyChild - 2, color: Colors.textSecondary,
    textAlign: 'center', marginTop: 4, marginBottom: Spacing.sm,
  },

  starsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, marginBottom: Spacing.sm,
  },
  star: { fontSize: 24, color: Colors.accentPeach },
  ratingNum: { fontSize: Typography.body, color: Colors.textMuted, fontWeight: '700', marginLeft: 4 },

  genreRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: Spacing.lg },
  genreChip: {
    backgroundColor: Colors.card, borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  genreText: { fontSize: Typography.label, color: Colors.textSecondary, fontWeight: '600' },

  summaryBox: {
    backgroundColor: Colors.readSurface, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.lg, gap: 6,
  },
  summaryLabel: { fontSize: Typography.body, fontWeight: '800', color: Colors.textPrimary },
  summaryText: { fontSize: Typography.bodyChild - 2, color: Colors.textSecondary, lineHeight: 24 },

  similarSection: { marginBottom: Spacing.xl },
  similarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  similarTitle: { fontSize: Typography.body + 1, fontWeight: '800', color: Colors.textPrimary },
  similarSeeAll: { fontSize: Typography.label, fontWeight: '700', color: Colors.accentSage },
  genreChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.md },
  genreChipSimilar: {
    backgroundColor: Colors.accentSageLight, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  genreChipText: { fontSize: Typography.label - 1, fontWeight: '700', color: Colors.accentSage },

  reviewsSection: { marginBottom: Spacing.lg, gap: Spacing.sm },
  reviewsTitle: { fontSize: Typography.bodyChild - 2, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4, textAlign: 'center' },
  reviewCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.cardBorder, gap: 8,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewEmoji: { fontSize: 28 },
  reviewName: { fontSize: Typography.label, fontWeight: '700', color: Colors.textPrimary },
  reviewStars: { fontSize: 14, letterSpacing: 1 },
  reviewComment: { fontSize: Typography.bodyChild - 2, color: Colors.textSecondary, lineHeight: 22 },

  factsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  factCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg,
    paddingVertical: Spacing.md, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  factValue: { fontSize: Typography.title, fontWeight: '800', color: Colors.accentSage },
  factLabel: { fontSize: Typography.label, color: Colors.textMuted, fontWeight: '600', marginTop: 2 },

  actions: { gap: Spacing.md },
  btnPrimary: {
    backgroundColor: Colors.buttonPrimary, borderRadius: Radius.full,
    paddingVertical: 16, alignItems: 'center',
  },
  btnPrimaryText: { fontSize: Typography.bodyChild - 2, fontWeight: '800', color: Colors.buttonPrimaryText },
  btnSecondary: {
    backgroundColor: Colors.browseSurface, borderRadius: Radius.full,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 2, borderColor: Colors.accentPeriwinkle,
  },
  btnSecondaryText: { fontSize: Typography.bodyChild - 2, fontWeight: '800', color: Colors.accentPeriwinkle },
  btnGhost: {
    borderRadius: Radius.full, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.cardBorder,
  },
  btnGhostText: { fontSize: Typography.body, fontWeight: '600', color: Colors.textSecondary },
});
