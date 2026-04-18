import api from '../axiosInstance';

/**
 * Librarian Service
 * Admin/Librarian-only API calls: manage book inventory and issued books.
 */
const librarianService = {
    /**
     * Add a new book to the library catalog.
     * @param {Object} bookData - { title, author, isbn, genre, language, ageRating, collectionName, bookURL }
     */
    addBook: async (bookData) => {
        const response = await api.post('/librarian/books', bookData);
        return response.data;
    },

    /**
     * Add a new copy of a book to a branch.
     * @param {Object} copyData - { bookId, branchId, barcode, condition }
     */
    addBookCopy: async (copyData) => {
        const response = await api.post('/librarian/copies', copyData);
        return response.data;
    },

    /**
     * Update the status or condition of a book copy.
     * @param {string} copyId
     * @param {Object} data - { status, condition }
     * status: AVAILABLE | ISSUED | LOST | DAMAGED
     * condition: GOOD | FAIR | POOR
     */
    updateBookCopy: async (copyId, data) => {
        const response = await api.put(`/librarian/copies/${copyId}`, data);
        return response.data;
    },

    /**
     * Get all currently issued books.
     */
    getIssuedBooks: async () => {
        const response = await api.get('/issues');
        return response.data;
    },

    /**
     * Update the status of an issued book (e.g., mark as returned).
     * @param {string} issueId
     * @param {string} status - ISSUED | RETURNED | OVERDUE
     */
    updateIssueStatus: async (issueId, status) => {
        const response = await api.put(`/librarian/issued/${issueId}`, { status });
        return response.data;
    },
};

export default librarianService;
