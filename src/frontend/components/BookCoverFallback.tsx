/**
 * BookCoverFallback
 * A genre-aware book-cover placeholder rendered entirely in React Native.
 * Displays a spine accent on the left, a centered title, and a subtle genre
 * label — all without any network request.
 *
 * Props
 *   title  – book title (required)
 *   genre  – primary genre string (optional, falls back to 'Default')
 *   width  – rendered width  (default 100)
 *   height – rendered height (default 150)  →  approx 2:3 aspect ratio
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

// ─── Genre → visual style mapping ────────────────────────────────────────────
// Intentionally avoids Sage Green (#E2EFDA / #d1e7d0) so covers always
// contrast against the app's primary background.

interface GenreStyle {
  background: string;
  spine: string;       // slightly darkened version of background
  title: string;
  genre: string;       // label colour (same as title or slightly lighter)
}

const GENRE_STYLES: Record<string, GenreStyle> = {
  Fantasy: {
    background: '#D8CEF0', // Soft Lavender
    spine:      '#A98FD8', // Medium Purple
    title:      '#3B1F6E', // Deep Purple
    genre:      '#5B3498',
  },
  'Sci-Fi': {
    background: '#0F172A', // Slate-900
    spine:      '#1E3A5F',
    title:      '#67E8F9', // Cyan-300
    genre:      '#A5F3FC',
  },
  Mystery: {
    background: '#27272A', // Zinc-800
    spine:      '#18181B',
    title:      '#FCD34D', // Amber-400
    genre:      '#FDE68A',
  },
  Romance: {
    background: '#F2C4CE', // Muted Rose
    spine:      '#D48A9A',
    title:      '#6B1A2A', // Maroon
    genre:      '#8B2A3A',
  },
  History: {
    background: '#F5F0E0', // Cream / Parchment
    spine:      '#C8B89A',
    title:      '#5C4A2A', // Sepia Brown
    genre:      '#7A6040',
  },
  Academic: {
    background: '#F5F0E0',
    spine:      '#C8B89A',
    title:      '#5C4A2A',
    genre:      '#7A6040',
  },
  Default: {
    background: '#E5E7EB', // Neutral Grey-200
    spine:      '#9CA3AF',
    title:      '#374151', // Grey-700
    genre:      '#6B7280',
  },
};

function resolveStyle(genre?: string): GenreStyle {
  if (!genre) return GENRE_STYLES.Default;
  // Exact match first, then case-insensitive prefix match
  const exact = GENRE_STYLES[genre];
  if (exact) return exact;
  const key = Object.keys(GENRE_STYLES).find(
    (k) => k.toLowerCase() === genre.toLowerCase()
  );
  return key ? GENRE_STYLES[key] : GENRE_STYLES.Default;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BookCoverFallbackProps {
  title: string;
  genre?: string;
  width?: number;
  height?: number;
}

export function BookCoverFallback({
  title,
  genre,
  width = 100,
  height = 150,
}: BookCoverFallbackProps) {
  const styles_g = resolveStyle(genre);
  const spineWidth = Math.max(6, Math.round(width * 0.07));
  const fontSize = Math.max(10, Math.round(width * 0.13));
  const labelSize = Math.max(8, Math.round(width * 0.09));

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          backgroundColor: styles_g.background,
        },
      ]}
    >
      {/* Left spine accent */}
      <View
        style={[
          styles.spine,
          {
            width: spineWidth,
            backgroundColor: styles_g.spine,
          },
        ]}
      />

      {/* Text area — sits to the right of the spine */}
      <View style={styles.body}>
        {/* Genre label — top */}
        {genre ? (
          <Text
            style={[styles.genreLabel, { color: styles_g.genre, fontSize: labelSize }]}
            numberOfLines={1}
          >
            {genre.toUpperCase()}
          </Text>
        ) : null}

        {/* Title — vertically centred */}
        <Text
          style={[styles.title, { color: styles_g.title, fontSize }]}
          numberOfLines={4}
        >
          {title}
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    // Subtle outer shadow to reinforce the "physical book" feel
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  spine: {
    height: '100%',
    // The spine inherits its backgroundColor dynamically from the genre style
  },
  body: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  genreLabel: {
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: 6,
    textAlign: 'center',
    opacity: 0.75,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: undefined, // let RN compute from fontSize
  },
});
