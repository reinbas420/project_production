import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useRouter } from 'expo-router';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

/** Simple decorative bookshelf illustration built entirely from Views */
function BookshelfIllustration() {
  const books = [
    { color: '#B8D4A8', width: 30, height: 90 },
    { color: '#FFDAB9', width: 22, height: 110 },
    { color: '#C5D5EA', width: 26, height: 80 },
    { color: '#F4C2C2', width: 20, height: 100 },
    { color: '#B8D4A8', width: 28, height: 95 },
    { color: '#FFDAB9', width: 18, height: 85 },
    { color: '#C5D5EA', width: 32, height: 105 },
    { color: '#F4C2C2', width: 24, height: 88 },
    { color: '#D4C5EA', width: 20, height: 92 },
    { color: '#B8D4A8', width: 26, height: 78 },
  ];

  return (
    <View style={illusStyles.container}>
      {/* Shelf plank */}
      <View style={illusStyles.shelf}>
        {books.map((book, i) => (
          <View
            key={i}
            style={[
              illusStyles.book,
              {
                backgroundColor: book.color,
                width: book.width,
                height: book.height,
                marginHorizontal: 3,
                borderRadius: 3,
              },
            ]}
          />
        ))}
      </View>
      <View style={illusStyles.shelfPlank} />

      {/* Floating owl mascot */}
      <View style={illusStyles.owlContainer}>
        <Text style={illusStyles.owl}>🦉</Text>
      </View>
    </View>
  );
}

const illusStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    height: 180,
  },
  shelf: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
  },
  book: {
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  shelfPlank: {
    width: '90%',
    height: 12,
    backgroundColor: '#C5A882',
    borderRadius: 6,
    marginTop: 2,
  },
  owlContainer: {
    position: 'absolute',
    top: -10,
    right: 40,
    backgroundColor: Colors.card,
    borderRadius: Radius.full,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.1)',
    elevation: 4,
  },
  owl: {
    fontSize: 32,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* ── Illustration area ── */}
        <View style={styles.illustrationArea}>
          <BookshelfIllustration />
        </View>

        {/* ── Branding ── */}
        <View style={styles.brandingArea}>
          <Text style={styles.tagline}>
            Books delivered to your doorstep,{'\n'}stories to every curious mind.
          </Text>
        </View>

        {/* ── Actions ── */}
        <View style={styles.actionsArea}>
          <TouchableOpacity
            style={styles.btnPrimary}
            activeOpacity={0.82}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.btnPrimaryText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSecondary}
            activeOpacity={0.82}
            onPress={() => router.push('/(auth)/signup')}
          >
            <Text style={styles.btnSecondaryText}>Create Account</Text>
          </TouchableOpacity>
        </View>

        {/* ── Footer ── */}
        <Text style={styles.footer}>
          A library in your pocket — for every age.
        </Text>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    justifyContent: 'space-between',
  },

  // Illustration
  illustrationArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Spacing.xxl,
  },

  // Branding
  brandingArea: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  appName: {
    fontSize: Typography.display,
    fontWeight: '800',
    color: Colors.accentSage,
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },

  // Buttons
  actionsArea: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  btnPrimary: {
    backgroundColor: Colors.buttonPrimary,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    boxShadow: '0px 4px 8px rgba(232, 168, 124, 0.3)',
    elevation: 4,
  },
  btnPrimaryText: {
    fontSize: Typography.body,
    fontWeight: '700',
    color: Colors.buttonPrimaryText,
    letterSpacing: 0.3,
  },
  btnSecondary: {
    backgroundColor: Colors.card,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.accentSage,
  },
  btnSecondaryText: {
    fontSize: Typography.body,
    fontWeight: '700',
    color: Colors.accentSage,
    letterSpacing: 0.3,
  },

  // Footer
  footer: {
    textAlign: 'center',
    fontSize: Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
});
