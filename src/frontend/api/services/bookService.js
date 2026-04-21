import api from '../axiosInstance';
import { filterBooksWithCovers } from '../../utils/bookFilters';

function getBooksArray(payload) {
    return payload?.data?.books ?? payload?.books ?? [];
}

/**
 * Book Service
 * Handles all book-related API calls: browse, search, availability,
 * issue, and return operations.
 */
const bookService = {
    /**
     * Fetch the full book catalog.
     * The response is cached in AsyncStorage by the bookStore.
     */
    getBooks: async (params = {}) => {
        if (params?.branchId && !params?.branchIds) {
            const branchId = params.branchId;
            const { branchId: _branchId, ...rest } = params;
            const response = await api.get(`/books/branch/${branchId}`, { params: rest });
            const books = getBooksArray(response.data);
            if (Array.isArray(books)) {
                if (response.data?.data?.books) response.data.data.books = filterBooksWithCovers(books);
                if (response.data?.books) response.data.books = filterBooksWithCovers(books);
            }
            return response.data;
        }

        const response = await api.get('/books', { params });
        const books = getBooksArray(response.data);
        if (Array.isArray(books)) {
            if (response.data?.data?.books) response.data.data.books = filterBooksWithCovers(books);
            if (response.data?.books) response.data.books = filterBooksWithCovers(books);
        }
        return response.data;
    },

    /**
     * Search books by title, author, or genre.
     * @param {string} query - Search term
     */
    searchBooks: async (query) => {
        const response = await api.get('/books/search', { params: { q: query } });
        const books = getBooksArray(response.data);
        if (Array.isArray(books)) {
            if (response.data?.data?.books) response.data.data.books = filterBooksWithCovers(books);
            if (response.data?.books) response.data.books = filterBooksWithCovers(books);
        }
        return response.data;
    },

    /**
     * Get a single book by ID
     * @param {string} bookId 
     * @param {object} params - Optional { lat, lng }
     */
    getBookById: async (bookId, params = {}) => {
        const response = await api.get(`/books/${bookId}`, { params });
        return response.data;
    },

    /**
     * Check availability of a specific book across nearby libraries.
     * @param {string} bookId
     * @param {number} [lat] - Optional latitude of user's delivery address
     * @param {number} [lng] - Optional longitude of user's delivery address
     */
    getBookAvailability: async (bookId, lat, lng) => {
        const params = {};
        if (lat != null && lng != null) { params.lat = lat; params.lng = lng; }
        const response = await api.get(`/books/${bookId}/availability`, { params });
        return response.data;
    },

    /**
     * Fetch all copies of a book (with status, condition, branch info).
     * @param {string} bookId
     */
    getBookCopies: async (bookId) => {
        const response = await api.get(`/books/${bookId}/copies`);
        return response.data;
    },

    /**
     * Issue (rent) a book copy to a profile.
     * @param {string} bookId - Book ID
     * @param {string} branchId - Library branch ID
     * @param {string} profileId - User Profile ID
     */
    issueBook: async (bookId, branchId, profileId) => {
        const response = await api.post('/issues', { bookId, branchId, profileId, type: 'PHYSICAL' });
        return response.data;
    },

    /**
     * Return an issued book.
     * @param {string} issueId
     */
    returnBook: async (issueId) => {
        const response = await api.put(`/issues/${issueId}/return`);
        return response.data;
    },
};

export default bookService;
