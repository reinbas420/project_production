import { useEffect, useState } from 'react';
import bookService from '../api/services/bookService';
import useAuthStore from '../store/authStore';
import useBookStore from '../store/bookStore';
import useNetworkStore from '../store/networkStore';

/**
 * useAppInit Hook
 *
 * Orchestrates the app startup sequence for instant load + background sync:
 *
 *  1. Load JWT from SecureStore → hydrate authStore
 *  2. Load cached books from AsyncStorage → hydrate bookStore (instant UI)
 *  3. Attempt background fetch from API → update cache if successful
 *  4. On network failure → set isOffline in networkStore
 *
 * Usage: call once in the root layout/component.
 */
export default function useAppInit() {
    const [isReady, setIsReady] = useState(false);

    const loadSession = useAuthStore((state) => state.loadSession);
    const loadCachedBooks = useBookStore((state) => state.loadCachedBooks);
    const setBooks = useBookStore((state) => state.setBooks);
    const setLoading = useBookStore((state) => state.setLoading);
    const setOffline = useNetworkStore((state) => state.setOffline);
    const setOnline = useNetworkStore((state) => state.setOnline);

    useEffect(() => {
        const initialize = async () => {
            try {
                // ── Step 1: Hydrate auth session from SecureStore ──
                await loadSession();

                // ── Step 2: Load cached books for instant display ──
                await loadCachedBooks();

                // ── Step 3: Background sync from API ──
                setLoading(true);
                try {
                    const freshBooks = await bookService.getBooks();
                    await setBooks(freshBooks); // updates state + cache
                    setOnline();
                } catch (networkError) {
                    // ── Step 4: Graceful fallback on network failure ──
                    console.warn('Background sync failed, using cached data:', networkError.message);
                    setOffline();
                } finally {
                    setLoading(false);
                }
            } catch (error) {
                console.error('App initialization error:', error);
            } finally {
                setIsReady(true);
            }
        };

        initialize();
    }, []);

    return { isReady };
}
