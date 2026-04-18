import useAuthStore from './store/authStore';
import useBookStore from './store/bookStore';
import useIssueStore from './store/issueStore';
import useNetworkStore from './store/networkStore';
import useProfileStore from './store/profileStore';
import { cacheStorage, secureStorage } from './utils/storage';

export async function runAllTests() {
    console.log('═══ TESTING LOGIC LAYER ═══');

    // 1. Stores initialize with correct defaults
    console.log('\n1️⃣ Zustand Stores:');
    console.log('  Auth default:', useAuthStore.getState().isAuthenticated === false ? '✅ PASS' : '❌ FAIL');
    console.log('  Auth user null:', useAuthStore.getState().user === null ? '✅ PASS' : '❌ FAIL');
    console.log('  Network default:', useNetworkStore.getState().isOffline === false ? '✅ PASS' : '❌ FAIL');
    console.log('  Books default:', useBookStore.getState().books.length === 0 ? '✅ PASS' : '❌ FAIL');
    console.log('  Profile default:', useProfileStore.getState().isParentMode === false ? '✅ PASS' : '❌ FAIL');
    console.log('  Issues default:', useIssueStore.getState().issues.length === 0 ? '✅ PASS' : '❌ FAIL');
    console.log('  Issue active null:', useIssueStore.getState().activeIssue === null ? '✅ PASS' : '❌ FAIL');

    // 2. Profile switching (DB V1 fields: accountType, ageGroup)
    console.log('\n2️⃣ Profile Actions:');
    useProfileStore.getState().setProfiles([
        { profileId: '1', name: 'Aarav', ageGroup: '5-8', accountType: 'CHILD' },
        { profileId: '2', name: 'Priya', ageGroup: '25-35', accountType: 'PARENT' },
    ]);
    console.log('  Profiles set:', useProfileStore.getState().profiles.length === 2 ? '✅ PASS' : '❌ FAIL');

    useProfileStore.getState().selectProfile('1');
    console.log('  Child selected:', useProfileStore.getState().activeProfile?.name === 'Aarav' ? '✅ PASS' : '❌ FAIL');
    console.log('  Parent mode off:', useProfileStore.getState().isParentMode === false ? '✅ PASS' : '❌ FAIL');

    useProfileStore.getState().switchProfile('2');
    console.log('  Switched to parent:', useProfileStore.getState().activeProfile?.name === 'Priya' ? '✅ PASS' : '❌ FAIL');
    console.log('  Parent mode on:', useProfileStore.getState().isParentMode === true ? '✅ PASS' : '❌ FAIL');

    // 3. Network store actions
    console.log('\n3️⃣ Network Store:');
    useNetworkStore.getState().setOffline();
    console.log('  Set offline:', useNetworkStore.getState().isOffline === true ? '✅ PASS' : '❌ FAIL');
    useNetworkStore.getState().setOnline();
    console.log('  Set online:', useNetworkStore.getState().isOffline === false ? '✅ PASS' : '❌ FAIL');
    useNetworkStore.getState().setLoading(true);
    console.log('  Loading on:', useNetworkStore.getState().isLoading === true ? '✅ PASS' : '❌ FAIL');
    useNetworkStore.getState().setLoading(false);
    console.log('  Loading off:', useNetworkStore.getState().isLoading === false ? '✅ PASS' : '❌ FAIL');

    // 4. Storage roundtrip
    console.log('\n4️⃣ Storage (SecureStore + AsyncStorage):');
    try {
        await secureStorage.setToken('test-jwt-token-xyz');
        const token = await secureStorage.getToken();
        console.log('  SecureStore set/get:', token === 'test-jwt-token-xyz' ? '✅ PASS' : '❌ FAIL');
        await secureStorage.removeToken();
        const removed = await secureStorage.getToken();
        console.log('  SecureStore remove:', removed === null ? '✅ PASS' : '❌ FAIL');
    } catch (e) {
        console.log('  SecureStore error:', '❌ FAIL -', e.message);
    }

    try {
        await cacheStorage.setCachedBooks([
            { title: 'The Cat in the Hat', author: 'Dr. Seuss' },
            { title: 'Goodnight Moon', author: 'Margaret Wise Brown' },
        ]);
        const cachedBooks = await cacheStorage.getCachedBooks();
        console.log('  AsyncStorage set/get:', cachedBooks.length === 2 ? '✅ PASS' : '❌ FAIL');
        console.log('  Book title check:', cachedBooks[0].title === 'The Cat in the Hat' ? '✅ PASS' : '❌ FAIL');
        await cacheStorage.clearCache();
        const cleared = await cacheStorage.getCachedBooks();
        console.log('  AsyncStorage clear:', cleared.length === 0 ? '✅ PASS' : '❌ FAIL');
    } catch (e) {
        console.log('  AsyncStorage error:', '❌ FAIL -', e.message);
    }

    // 5. Auth store login/logout flow
    console.log('\n5️⃣ Auth Store Login/Logout:');
    try {
        await useAuthStore.getState().login({ email: 'test@test.com', name: 'Test User' }, 'fake-jwt-token');
        console.log('  Login sets user:', useAuthStore.getState().user?.name === 'Test User' ? '✅ PASS' : '❌ FAIL');
        console.log('  Login sets auth:', useAuthStore.getState().isAuthenticated === true ? '✅ PASS' : '❌ FAIL');
        const storedToken = await secureStorage.getToken();
        console.log('  Login stores JWT:', storedToken === 'fake-jwt-token' ? '✅ PASS' : '❌ FAIL');

        await useAuthStore.getState().logout();
        console.log('  Logout clears user:', useAuthStore.getState().user === null ? '✅ PASS' : '❌ FAIL');
        console.log('  Logout clears auth:', useAuthStore.getState().isAuthenticated === false ? '✅ PASS' : '❌ FAIL');
        const clearedToken = await secureStorage.getToken();
        console.log('  Logout clears JWT:', clearedToken === null ? '✅ PASS' : '❌ FAIL');
    } catch (e) {
        console.log('  Auth flow error:', '❌ FAIL -', e.message);
    }

    // 6. Book store cache-first pattern
    console.log('\n6️⃣ Book Store Cache-First:');
    try {
        await useBookStore.getState().setBooks([{ title: 'Cached Book' }]);
        console.log('  setBooks updates state:', useBookStore.getState().books.length === 1 ? '✅ PASS' : '❌ FAIL');
        const fromCache = await cacheStorage.getCachedBooks();
        console.log('  setBooks writes cache:', fromCache.length === 1 ? '✅ PASS' : '❌ FAIL');

        // Reset state but load from cache
        useBookStore.setState({ books: [] });
        await useBookStore.getState().loadCachedBooks();
        console.log('  loadCachedBooks restores:', useBookStore.getState().books.length === 1 ? '✅ PASS' : '❌ FAIL');
        console.log('  Cache data intact:', useBookStore.getState().books[0].title === 'Cached Book' ? '✅ PASS' : '❌ FAIL');
        await cacheStorage.clearCache();
    } catch (e) {
        console.log('  Book cache error:', '❌ FAIL -', e.message);
    }

    // 7. Issue store actions
    console.log('\n7️⃣ Issue Store:');
    const mockIssues = [
        { issueId: 'iss1', copyId: 'c1', profileId: '1', status: 'ISSUED' },
        { issueId: 'iss2', copyId: 'c2', profileId: '1', status: 'RETURNED' },
    ];
    useIssueStore.getState().setIssues(mockIssues);
    console.log('  setIssues:', useIssueStore.getState().issues.length === 2 ? '✅ PASS' : '❌ FAIL');

    useIssueStore.getState().setActiveIssue(mockIssues[0]);
    console.log('  setActiveIssue:', useIssueStore.getState().activeIssue?.issueId === 'iss1' ? '✅ PASS' : '❌ FAIL');

    useIssueStore.getState().setPayments([{ transactionId: 'tx1', paymentAmount: 50 }]);
    console.log('  setPayments:', useIssueStore.getState().payments.length === 1 ? '✅ PASS' : '❌ FAIL');

    useIssueStore.getState().setPenalty({ fineAmount: 20, fineStatus: 'PENDING' });
    console.log('  setPenalty:', useIssueStore.getState().penalty?.fineStatus === 'PENDING' ? '✅ PASS' : '❌ FAIL');

    useIssueStore.getState().setDelivery({ status: 'DELIVERED', deliveryAddress: '123 Main St' });
    console.log('  setDelivery:', useIssueStore.getState().delivery?.status === 'DELIVERED' ? '✅ PASS' : '❌ FAIL');

    useIssueStore.getState().clearIssues();
    console.log('  clearIssues:', useIssueStore.getState().issues.length === 0 ? '✅ PASS' : '❌ FAIL');
    console.log('  clearIssues active:', useIssueStore.getState().activeIssue === null ? '✅ PASS' : '❌ FAIL');

    console.log('\n═══ ALL TESTS COMPLETE ═══');
}
