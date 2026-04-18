/**
 * BookCover — placeholder cover using the book's color palette.
 * Swap the inner content for an <Image> once real cover assets exist.
 */
import type { Book } from '@/constants/mockData';
import { Radius } from '@/constants/theme';
import { Image } from 'expo-image';
import React from 'react';
import { BookCoverFallback } from './BookCoverFallback';
import { StyleSheet } from 'react-native';

interface Props {
  book: Book & { isbn?: string };
  width: number;
  height: number;
  fontSize?: number;
  onImageError?: () => void;
  onImageLoad?: () => void;
}

export function BookCover({ book, width, height, fontSize = 13, onImageError, onImageLoad }: Props) {
  // Stage: 'primary' → try coverImage, 'fallback' → try Open Library by ISBN, 'error' → text placeholder
  const [stage, setStage] = React.useState<'primary' | 'fallback' | 'error'>('primary');

  const primaryUrl = book.coverImage || null;
  const fallbackUrl = book.isbn
    ? `https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg`
    : null;

  const handleError = () => {
    // Only advance to 'fallback' if we were actually showing the primaryUrl.
    // If primaryUrl was null and we jumped straight to fallbackUrl, an error
    // should go directly to 'error' (no point retrying the same URL).
    if (stage === 'primary' && primaryUrl && fallbackUrl) {
      setStage('fallback');
    } else {
      setStage('error');
      onImageError?.();
    }
  };

  let coverUrl: string | null = null;
  if (stage === 'primary' && primaryUrl) coverUrl = primaryUrl;
  else if (stage === 'fallback' && fallbackUrl) coverUrl = fallbackUrl;
  else if (stage === 'primary' && !primaryUrl && fallbackUrl) coverUrl = fallbackUrl;

  if (coverUrl && stage !== 'error') {
    return (
      <Image
        source={{ uri: coverUrl }}
        style={[styles.cover, { width, height, borderRadius: Radius.md, backgroundColor: '#f0f0f0' }]}
        contentFit="cover"
        transition={200}
        onError={handleError}
        onLoad={(e) => {
          // Open Library returns a tiny "No Cover" placeholder (~1×1 or <50px)
          // when an ISBN has no cover. Treat undersized images as failures.
          const { width: w, height: h } = e.source;
          if (w < 50 || h < 50) {
            handleError();
          } else {
            onImageLoad?.();
          }
        }}
      />
    );
  }

  // Genre-aware fallback cover
  return (
    <BookCoverFallback
      title={book.title}
      genre={book.genres?.[0]}
      width={width}
      height={height}
    />
  );
}

const styles = StyleSheet.create({
  cover: {
    overflow: 'hidden',
  },
});
