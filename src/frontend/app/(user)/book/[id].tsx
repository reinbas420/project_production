import bookService from '@/api/services/bookService';
import axiosInstance from '@/api/axiosInstance';
import cartService from '@/api/services/cartService';
import { BookCover } from '@/components/BookCover';
import { NavBar, NAV_BOTTOM_PAD } from '@/components/NavBar';
import type { Book } from '@/constants/mockData';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import useAppStore from '@/store/useAppStore';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function mapBook(b: any): Book {
  return {
    id: b._id || b.id,
    title: b.title || 'Unknown Title',
    author: b.author || 'Unknown Author',
    pages: b.pageCount || null,
    releaseYear: b.publishedDate
      ? (parseInt(b.publishedDate.match(/\d{4}/)?.[0]) || new Date(b.createdAt || Date.now()).getFullYear())
      : new Date(b.createdAt || Date.now()).getFullYear(),
    genres: b.genre || [],
    summary: b.summary || '',
    rating: 4.5,
    coverColor: '#C5DDB8',
    coverAccent: '#4A7C59',
    isDigital: true,
    isPhysical: true,
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
    borderWidth: 2, borderColor: Colors.background,
  },
  title: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, lineHeight: 16 },
  author: { fontSize: 11, color: Colors.textSecondary },
  avail: { fontSize: 10, fontWeight: '600' },
});

function StarRow({ rating }: { rating: number }) {
  return (
    <Text style={{ color: Colors.accentPeach, fontSize: 14, letterSpacing: 1 }}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </Text>
  );
}

export default function UserBookDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, activeProfileId, selectedBranchId } = useAppStore();
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<{ source: string, text: string }[]>([]);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [expandedReviews, setExpandedReviews] = useState<{[key: number]: boolean}>({});
  const [similarBooks, setSimilarBooks] = useState<Book[]>([]);
  const [similarGenre, setSimilarGenre] = useState<string>('');
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [cartLoading, setCartLoading] = useState(false);

  // ─── Resolve User Location ──────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    if (!userId) {
      setUserCoords(null);
      return;
    }

    const resolveFromSavedDeliveryAddress = async () => {
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
      } catch { /* Fall back to GPS */ }
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
        const params = userCoords ? { lat: userCoords.latitude, lng: userCoords.longitude, genre: genre1, limit: 12 } : { genre: genre1, limit: 12 };
        const res1 = await bookService.getBooks(params);
        let results: Book[] = (res1?.data?.books || [])
          .filter((b: any) => (b._id || b.id) !== book.id)
          .map(toCard);

        if (results.length < 3 && book.genres.length > 1) {
          const genre2 = book.genres[1];
          const params2 = userCoords ? { lat: userCoords.latitude, lng: userCoords.longitude, genre: genre2, limit: 12 } : { genre: genre2, limit: 12 };
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

        if (active) setSimilarBooks(results.slice(0, 10));
      } catch {
        // silently fail — similar books are non-critical
      }
    };

    fetchSimilar();
    return () => { active = false; };
  }, [book, userCoords]);

  // Re-fetch every time this screen comes into focus so availableCopies
  // reflects the latest inventory after an order is placed.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      const fetchBook = async () => {
        try {
          const params = userCoords ? { lat: userCoords.latitude, lng: userCoords.longitude } : {};
          const response = await bookService.getBookById(id as string, params);
          
          // Telemetry: Log view activity for the Smart Recommendation AI
          if (userId && activeProfileId) {
             axiosInstance.post(`/users/${userId}/profiles/${activeProfileId}/activity`, { bookId: id, action: 'VIEW' }).catch(() => {});
          }

          if (active && response?.data?.book) {
            setBook(mapBook(response.data.book));
            
            // Background fetch live reviews from aggregator
            axiosInstance.get(`/books/${id}/reviews`).then(revRes => {
              if (active && revRes.data?.data?.reviews) {
                setReviews(revRes.data.data.reviews);
              }
            }).catch(e => console.warn('Reviews fetch failed', e));

          } else if (active) {
            setBook(null);
          }
        } catch (err) {
          console.warn('Failed to fetch book detail', err);
          if (active) setBook(null);
        } finally {
          if (active) setLoading(false);
        }
      };
      fetchBook();
      return () => { active = false; };
    }, [id, userCoords, userId, activeProfileId])
  );

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.accentSage} />
      </SafeAreaView>
    );
  }

  if (!book) return null;

  const showLibraryConflictPrompt = (message: string) => {
    if (Platform.OS === 'web') {
      const replaceConfirmed = typeof globalThis !== 'undefined'
        ? (globalThis as any).confirm?.(`${message}\n\nPress OK to replace current cart with this book. Press Cancel for other options.`)
        : false;

      if (replaceConfirmed) {
        handleAddToCart(true);
        return;
      }

      const orderFirst = typeof globalThis !== 'undefined'
        ? (globalThis as any).confirm?.('Do you want to order the current cart first? Press OK to open cart, Cancel to stay on this page.')
        : false;

      if (orderFirst) {
        router.push('/(user)/cart');
      }
      return;
    }

    Alert.alert(
      'Replace cart?',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Order current cart first',
          onPress: () => router.push('/(user)/cart'),
        },
        {
          text: 'Clear & Add',
          style: 'destructive',
          onPress: () => handleAddToCart(true),
        },
      ],
    );
  };

  const handleAddToCart = async (forceReplace = false) => {
    if (!selectedBranchId) {
      Alert.alert('Select Library', 'Please select a library first from the Home screen.');
      return;
    }

    if (!forceReplace) {
      try {
        const cartRes = await cartService.getCart();
        const existingCartLibraryId = cartRes?.data?.cart?.library_id;
        const hasItems = Array.isArray(cartRes?.data?.cart?.items) && cartRes.data.cart.items.length > 0;

        if (hasItems && existingCartLibraryId && String(existingCartLibraryId) !== String(selectedBranchId)) {
          showLibraryConflictPrompt('Your cart contains books from another library. Do you want to replace cart or order current cart first?');
          return;
        }
      } catch (precheckError) {
        console.warn('Cart precheck failed, continuing with backend validation', precheckError);
      }
    }

    const payload = {
      book_id: book.id,
      library_id: selectedBranchId,
      force_replace: forceReplace,
    };

    try {
      setCartLoading(true);
      await cartService.addToCart(payload);
      Alert.alert('✅ Book added to cart!');
    } catch (error: any) {
      const status = error?.response?.status;
      const data = error?.response?.data;

      if (status === 409 && data?.requires_confirmation) {
        showLibraryConflictPrompt(
          data?.message || 'Your cart contains books from another library. Do you want to replace cart or order current cart first?',
        );
      } else {
        console.warn('Failed to add to cart', error);
        Alert.alert('Error', 'Could not add this book to cart. Please try again.');
      }
    } finally {
      setCartLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      {Platform.OS === 'web' && <NavBar role="user" active="home" />}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Back */}
        <TouchableOpacity style={s.backBtn} onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/(user)'); } }}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Cover */}
        <View style={s.coverRow}>
          <BookCover book={book} width={140} height={200} fontSize={13} />
          <View style={s.coverMeta}>
            <Text style={s.title}>{book.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={s.author}>by {book.author}</Text>
              <TouchableOpacity
                style={{ backgroundColor: Colors.buttonPrimary, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}
                onPress={() => router.push({ pathname: '/(user)/author-detail', params: { name: book.author, fromDB: '1' } })}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.buttonPrimaryText }}>View Author</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <StarRow rating={Math.round(book.rating)} />
              <Text style={s.ratingNum}>{book.rating}</Text>
            </View>
            {/* Digital / Physical badges */}
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
            </View>
            <Text style={[s.avail, { color: book.availableCopies > 0 ? Colors.success : Colors.error }]}>
              {book.availableCopies > 0
                ? `✓ ${book.availableCopies} copies available`
                : '✗ Currently unavailable'}
            </Text>
          </View>
        </View>

        {/* Metadata table */}
        <View style={s.metaTable}>
          {[
            ['Pages', book.pages ? `${book.pages} pages` : '—'],
            ['Published', `${book.releaseYear}`],
            ['Genre', book.genres.join(', ')],
            ['Age range', `${book.ageMin}–${book.ageMax} years`],
            ['Nearest library', book.nearestLibrary],
          ].map(([label, value]) => (
            <View key={label} style={s.metaRow}>
              <Text style={s.metaLabel}>{label}</Text>
              <Text style={s.metaValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Keywords */}
        <View style={s.keywordsRow}>
          {book.keyWords.map(k => (
            <View key={k} style={s.keyword}><Text style={s.keywordText}>#{k}</Text></View>
          ))}
        </View>

        {/* Summary */}
        <View style={s.summaryBox}>
          <Text style={s.summaryLabel}>About this book</Text>
          <Text style={s.summaryText}>{book.summary}</Text>
        </View>

        {/* Similar Books */}
        {similarBooks.length > 0 && (
          <View style={s.similarSection}>
            <View style={s.similarHeader}>
              <Text style={s.similarTitle}>
                {similarGenre ? `More in ${similarGenre}` : 'More like this'}
              </Text>
              <TouchableOpacity onPress={() => router.replace('/(user)')}>
                <Text style={s.similarSeeAll}>See all →</Text>
              </TouchableOpacity>
            </View>
            {/* Genre chips showing what the current book covers */}
            {book.genres.length > 0 && (
              <View style={s.genreChipRow}>
                {book.genres.map(g => (
                  <View key={g} style={s.genreChip}>
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
                  onPress={() => router.push(`/(user)/book/${item.id}`)}
                />
              )}
              contentContainerStyle={{ paddingVertical: 4 }}
            />
          </View>
        )}

        {/* Reviews & Comments */}
        <View style={s.reviewsSection}>
          <Text style={s.reviewsTitle}>Real User Reviews</Text>
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
                      <View style={s.reviewAvatar}>
                        <Text style={s.reviewAvatarText}>{review.source[0]}</Text>
                      </View>
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
                        <Text style={{ color: Colors.accentSage, fontSize: 13, fontWeight: '700', marginTop: 4 }}>Read more</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              {!showAllReviews && reviews.length > 2 && (
                <TouchableOpacity onPress={() => setShowAllReviews(true)} style={{ alignItems: 'center', paddingVertical: 10 }}>
                  <Text style={{ color: Colors.accentSage, fontSize: 13, fontWeight: '700' }}>Read all {reviews.length} reviews →</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Actions */}
        <View style={s.actions}>
          {book.availableCopies > 0 ? (
            <TouchableOpacity
              style={s.btnPrimary}
              disabled={cartLoading}
              activeOpacity={0.82}
              onPress={() => handleAddToCart(false)}
            >
              <Text style={s.btnPrimaryText}>{cartLoading ? 'Adding...' : '🛒 Add to cart'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.btnWaitlist} activeOpacity={0.82}>
              <Text style={s.btnWaitlistText}>🔔 Join waitlist</Text>
            </TouchableOpacity>
          )}

          {book.isDigital && (
            <TouchableOpacity
              style={s.btnRead}
              activeOpacity={0.82}
              onPress={() => router.push(`/(user)/read/${book.id}`)}
            >
              <Text style={s.btnReadText}>Read digitally</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.btnGhost} activeOpacity={0.82}>
            <View style={s.btnGhostContent}>
              <Text style={s.btnGhostIcon}>💬</Text>
              <Text style={s.btnGhostText}>Speak to a Librarian</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {Platform.OS !== 'web' && <NavBar role="user" active="home" />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: NAV_BOTTOM_PAD + Spacing.xl },

  backBtn: { marginTop: Spacing.md, marginBottom: Spacing.lg },
  backText: { fontSize: Typography.body, color: Colors.accentSage, fontWeight: '700' },

  coverRow: {
    flexDirection: 'row', gap: Spacing.lg, alignItems: 'flex-start', marginBottom: Spacing.lg,
  },
  coverMeta: { flex: 1, gap: 5 },
  title: { fontSize: Typography.title, fontWeight: '800', color: Colors.accentSage, lineHeight: 28 },
  author: { fontSize: Typography.body, color: Colors.textSecondary },
  ratingNum: { fontSize: Typography.label, color: Colors.textMuted, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  badge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: Typography.label - 1, fontWeight: '700' },
  avail: { fontSize: Typography.label, fontWeight: '700', marginTop: 4 },

  metaTable: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: Spacing.sm, overflow: 'hidden',
  },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  metaLabel: { fontSize: Typography.label, color: Colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { fontSize: Typography.body, color: Colors.textPrimary, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },

  keywordsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.lg },
  keyword: {
    backgroundColor: Colors.browseSurface, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  keywordText: { fontSize: Typography.label, color: Colors.accentPeriwinkle, fontWeight: '600' },

  summaryBox: {
    backgroundColor: Colors.readSurface, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.lg, gap: 6,
  },
  summaryLabel: { fontSize: Typography.body, fontWeight: '800', color: Colors.textPrimary },
  summaryText: { fontSize: Typography.body, color: Colors.textSecondary, lineHeight: 24 },

  similarSection: { marginBottom: Spacing.xl },
  similarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  similarTitle: { fontSize: Typography.body + 1, fontWeight: '800', color: Colors.textPrimary },
  similarSeeAll: { fontSize: Typography.label, fontWeight: '700', color: Colors.accentSage },
  genreChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.md },
  genreChip: {
    backgroundColor: Colors.accentSageLight, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  genreChipText: { fontSize: Typography.label - 1, fontWeight: '700', color: Colors.accentSage },

  reviewsSection: { marginBottom: Spacing.lg, gap: Spacing.sm },
  reviewsTitle: { fontSize: Typography.body, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  reviewCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.cardBorder, gap: 8,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.accentSageLight, alignItems: 'center', justifyContent: 'center',
  },
  reviewAvatarText: { fontSize: Typography.body, fontWeight: '800', color: Colors.accentSage },
  reviewName: { fontSize: Typography.label, fontWeight: '700', color: Colors.textPrimary },
  reviewStars: { fontSize: 12, color: Colors.accentPeach, letterSpacing: 1 },
  reviewComment: { fontSize: Typography.label, color: Colors.textSecondary, lineHeight: 20 },

  actions: { gap: Spacing.md },
  btnPrimary: {
    backgroundColor: Colors.buttonPrimary, borderRadius: Radius.full,
    paddingVertical: 16, alignItems: 'center',
  },
  btnPrimaryText: { fontSize: Typography.body, fontWeight: '800', color: Colors.buttonPrimaryText },
  btnWaitlist: {
    backgroundColor: Colors.browseSurface, borderRadius: Radius.full,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 2, borderColor: Colors.accentPeriwinkle,
  },
  btnWaitlistText: { fontSize: Typography.body, fontWeight: '800', color: Colors.accentPeriwinkle },
  btnRead: {
    backgroundColor: Colors.readSurface, borderRadius: Radius.full,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 2, borderColor: Colors.accentSage,
  },
  btnReadText: { fontSize: Typography.body, fontWeight: '800', color: Colors.accentSage },
  btnGhost: {
    borderRadius: Radius.full, paddingVertical: 14, alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.cardBorder,
  },
  btnGhostContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
  },
  btnGhostIcon: { fontSize: Typography.body },
  btnGhostText: {
    fontSize: Typography.body,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    flexShrink: 1,
  },
});
