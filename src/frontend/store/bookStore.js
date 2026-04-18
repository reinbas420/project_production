import { create } from 'zustand';
import { cacheStorage } from '../utils/storage';

/**
 * Book Store
 * Manages the book catalog, search results, and loading states.
 * Implements cache-first pattern: loads from AsyncStorage first,
 * then updates from API in the background.
 */
const useBookStore = create((set, get) => ({
    // ── State ──────────────────────────────────────────
    books: [],
    searchResults: [],
    selectedBook: null,
    isLoading: false,

    // ── Actions ────────────────────────────────────────

    /**
     * Load books from AsyncStorage cache for instant display on app launch.
     */
    loadCachedBooks: async () => {
        try {
            const cachedBooks = await cacheStorage.getCachedBooks();
            if (cachedBooks && cachedBooks.length > 0) {
                set({ books: cachedBooks });
            }
        } catch (error) {
            console.error('Failed to load cached books:', error);
        }
    },

    /**
     * Set books from API response and persist to AsyncStorage cache.
     */
    setBooks: async (books) => {
        set({ books });
        try {
            await cacheStorage.setCachedBooks(books);
        } catch (error) {
            console.error('Failed to cache books:', error);
        }
    },

    /**
     * Update search results (no caching needed for search).
     */
    setSearchResults: (results) => set({ searchResults: results }),

    /**
     * Select a single book for the detail view.
     */
    setSelectedBook: (book) => set({ selectedBook: book }),

    /**
     * Set loading state for book-related API calls.
     */
    setLoading: (isLoading) => set({ isLoading }),

    /**
     * Clear search results.
     */
    clearSearch: () => set({ searchResults: [] }),
}));

export default useBookStore;
