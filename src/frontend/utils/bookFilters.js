export function hasCoverImage(book) {
  return Boolean(book && typeof book.coverImage === 'string' && book.coverImage.trim());
}

export function filterBooksWithCovers(books) {
  if (!Array.isArray(books)) return [];
  return books.filter(hasCoverImage);
}
