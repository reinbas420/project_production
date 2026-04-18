/**
 * Integration tests for UC-8: Browse Books
 * Based on TestPlan.xls — TC-8.1 through TC-8.10
 */

const request = require('supertest');
const app = require('../../src/app');
const Book = require('../../src/models/Book');
const BookCopy = require('../../src/models/BookCopy');

const { registerAndLogin } = require('../utils/testHelpers');

describe('UC-8: Browse Books', () => {
    // Seed a catalog of books before each test
    beforeEach(async () => {
        await Book.create([
            {
                title: 'Harry Potter and the Sorcerer\'s Stone',
                author: 'J.K. Rowling',
                isbn: 9780439708180,
                genre: ['Fantasy', 'Adventure'],
                language: 'English',
                ageRating: '8-12',
                summary: 'A boy discovers he is a wizard.'
            },
            {
                title: 'The Jungle Book',
                author: 'Rudyard Kipling',
                isbn: 9780141325293,
                genre: ['Adventure'],
                language: 'English',
                ageRating: '6-10',
                summary: 'Mowgli raised by wolves in the jungle.'
            },
            {
                title: 'Panchatantra Stories',
                author: 'Vishnu Sharma',
                isbn: 9788175994713,
                genre: ['Fiction', 'Moral'],
                language: 'Hindi',
                ageRating: '4-8',
                summary: 'Collection of ancient Indian fables.'
            },
            {
                title: 'The Cat in the Hat',
                author: 'Dr. Seuss',
                isbn: 9780394800011,
                genre: ['Fiction'],
                language: 'English',
                ageRating: '3-6',
                summary: 'A mischievous cat visits two children.'
            },
            {
                title: 'Charlotte\'s Web',
                author: 'E.B. White',
                isbn: 9780061124952,
                genre: ['Fiction'],
                language: 'English',
                ageRating: '6-10',
                summary: 'A pig named Wilbur and his friend Charlotte the spider.'
            },
            {
                title: 'Matilda',
                author: 'Roald Dahl',
                isbn: 9780142410370,
                genre: ['Fiction', 'Fantasy'],
                language: 'English',
                ageRating: '6-10',
                summary: 'A brilliant girl with telekinetic powers.'
            }
        ]);
    });

    /**
     * TC-8.1: Get all books (no filters)
     */
    test('TC-8.1 — should return all books without filters', async () => {
        const res = await request(app)
            .get('/api/v1/books')
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data.books.length).toBe(6);
    });

    /**
     * TC-8.2: Search by title keyword
     */
    test('TC-8.2 — should search books by title', async () => {
        const res = await request(app)
            .get('/api/v1/books?search=Harry')
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data.books.length).toBeGreaterThanOrEqual(1);
        expect(res.body.data.books[0].title).toMatch(/Harry/i);
    });

    /**
     * TC-8.3: Search by author name
     */
    test('TC-8.3 — should search books by author', async () => {
        const res = await request(app)
            .get('/api/v1/books?search=Rowling')
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data.books.length).toBeGreaterThanOrEqual(1);
        expect(res.body.data.books[0].author).toMatch(/Rowling/i);
    });

    /**
     * TC-8.4: Filter by age rating
     * maxAge=8 should return books whose ageRating minimum ≤ 8
     * (i.e., "3-6", "4-8", "6-10", "8-12" qualify; all have min ≤ 8)
     */
    test('TC-8.4 — should filter books by age', async () => {
        const res = await request(app)
            .get('/api/v1/books?maxAge=6')
            .expect(200);

        expect(res.body.status).toBe('success');
        // Books with ageRating min ≤ 6: "3-6" (Cat), "4-8" (Panchatantra), "6-10" (Jungle,Charlotte,Matilda)
        expect(res.body.data.books.length).toBeGreaterThanOrEqual(1);
        // Should NOT include "8-12" (Harry Potter) since 8 > 6
        const titles = res.body.data.books.map(b => b.title);
        expect(titles).not.toContain('Harry Potter and the Sorcerer\'s Stone');
    });

    /**
     * TC-8.5: Filter by genre
     */
    test('TC-8.5 — should filter books by genre', async () => {
        const res = await request(app)
            .get('/api/v1/books?genre=Adventure')
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data.books.length).toBe(2); // Harry Potter + Jungle Book
        res.body.data.books.forEach(book => {
            expect(book.genre).toContain('Adventure');
        });
    });

    /**
     * TC-8.6: Filter by language
     */
    test('TC-8.6 — should filter books by language', async () => {
        const res = await request(app)
            .get('/api/v1/books?language=Hindi')
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data.books.length).toBe(1);
        expect(res.body.data.books[0].title).toBe('Panchatantra Stories');
    });

    /**
     * TC-8.7: Sort by title
     */
    test('TC-8.7 — should sort books by title alphabetically', async () => {
        const res = await request(app)
            .get('/api/v1/books?sort=title')
            .expect(200);

        expect(res.body.status).toBe('success');
        const titles = res.body.data.books.map(b => b.title);
        const sortedTitles = [...titles].sort();
        expect(titles).toEqual(sortedTitles);
    });

    /**
     * TC-8.8: Limit (pagination)
     */
    test('TC-8.8 — should limit results to specified count', async () => {
        const res = await request(app)
            .get('/api/v1/books?limit=3')
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data.books.length).toBeLessThanOrEqual(3);
    });

    /**
     * TC-8.9: No results for non-existent search
     */
    test('TC-8.9 — should return empty array for non-existent search', async () => {
        const res = await request(app)
            .get('/api/v1/books?search=NonExistentBook12345')
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data.books.length).toBe(0);
    });

    /**
     * TC-8.10: Public access — no JWT required
     */
    test('TC-8.10 — should allow public access without JWT', async () => {
        // No Authorization header
        const res = await request(app)
            .get('/api/v1/books')
            .expect(200);

        expect(res.body.status).toBe('success');
        expect(res.body.data.books).toBeDefined();
    });
});
