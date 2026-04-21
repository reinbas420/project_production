import catalogService, { type CatalogPublisherDetails } from '@/api/services/catalogService';
import { NavBar, NAV_BOTTOM_PAD } from '@/components/NavBar';
import { Colors, Spacing, Typography } from '@/constants/theme';
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

export default function PublisherDetailScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const [publisher, setPublisher] = useState<CatalogPublisherDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!name) return;
    (async () => {
      try {
        const details = await catalogService.getPublisherDetails(name);
        setPublisher(details);
      } catch (e) {
        console.warn('Publisher details failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [name]);

  const displayName = publisher?.name ?? name ?? 'Publisher';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={s.safe}>
      {Platform.OS === 'web' && <NavBar role="user" active="home" />}
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>

        {/* ── Hero ── */}
        <View style={s.hero}>
          <View style={s.avatarFallback}>
            <Text style={s.avatarText}>{initial}</Text>
          </View>
          <Text style={s.publisherName}>{displayName}</Text>
          {loading && <ActivityIndicator size="small" color={Colors.accentSage} style={{ marginTop: 8 }} />}
        </View>

        {!loading && publisher ? (
          <View style={s.contentWrap}>
            {/* Meta */}
            {(publisher.location || publisher.founded || publisher.website) ? (
              <View style={s.section}>
                <Text style={s.sectionHeading}>Info</Text>
                {publisher.location ? <Text style={s.meta}>📍 {publisher.location}</Text> : null}
                {publisher.founded ? <Text style={s.meta}>🗓 Founded: {publisher.founded}</Text> : null}
                {publisher.website ? <Text style={s.meta}>🌐 {publisher.website}</Text> : null}
              </View>
            ) : null}

            {/* Description */}
            {publisher.description ? (
              <View style={s.section}>
                <Text style={s.sectionHeading}>About</Text>
                <Text style={s.bio}>{publisher.description}</Text>
              </View>
            ) : null}

            {/* Books */}
            {publisher.books.length > 0 ? (
              <View style={s.section}>
                <Text style={s.sectionHeading}>Catalog Sample</Text>
                {publisher.books.slice(0, 12).map((book, idx) => (
                  <View key={`${book.title}-${idx}`} style={s.workRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.workTitle}>{book.title}</Text>
                      {book.authorNames.length > 0 ? (
                        <Text style={s.workAuthor}>{book.authorNames.join(', ')}</Text>
                      ) : null}
                    </View>
                    {book.firstPublishYear ? (
                      <Text style={s.workYear}>{book.firstPublishYear}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {!loading && !publisher ? (
          <Text style={s.empty}>Could not load publisher details.</Text>
        ) : null}
      </ScrollView>
      {Platform.OS !== 'web' && <NavBar role="user" active="home" />}
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 160;

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
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 68,
    fontWeight: '800',
    color: Colors.buttonPrimaryText,
  },
  publisherName: {
    fontSize: Typography.title + 10,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },

  contentWrap: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    gap: Spacing.xl,
  },
  section: {
    gap: 12,
  },
  sectionHeading: {
    fontSize: Typography.title,
    fontWeight: '800',
    color: Colors.accentSage,
    letterSpacing: 0.3,
  },
  bio: {
    fontSize: Typography.body + 2,
    color: Colors.textPrimary,
    lineHeight: 30,
    maxWidth: 700,
  },
  meta: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    lineHeight: 28,
  },
  workRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.12)',
    paddingVertical: 10,
  },
  workTitle: {
    fontSize: Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  workAuthor: {
    fontSize: Typography.label,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  workYear: {
    fontSize: Typography.label,
    color: Colors.textMuted,
    marginLeft: 8,
  },
  empty: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: Typography.body,
    paddingTop: Spacing.xl,
  },
});
