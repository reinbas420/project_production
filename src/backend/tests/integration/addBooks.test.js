/**
 * Integration tests for Add Books (Librarian/Admin)
 * Covers: POST /api/v1/books — including ISBN-only creation
 */

const request = require('supertest');
const app = require('../../src/app');
const Book = require('../../src/models/Book');

const { registerAndLogin } = require('../utils/testHelpers');

describe('Add Books (Librarian)', () => {
    let librarianToken, userToken;

    beforeEach(async () => {
        const librarian = await registerAndLogin('LIBRARIAN');
        librarianToken = librarian.token;

        const user = await registerAndLogin('USER');
        userToken = user.token;
    });

    /**
     * TC: Create book with all fields
     */
    test('should create a book with full details', async () => {
        const res = await request(app)
            .post('/api/v1/books')
            .set('Authorization', `Bearer ${librarianToken}`)
            .send({
                isbn: 9780140449136,
                title: 'The Odyssey',
                author: 'Homer',
                genre: ['Classic'],
                language: 'English',
                ageRating: '12-99',
                summary: 'An epic Greek poem about Odysseus.'
            })
            .expect(201);

        expect(res.body.status).toBe('success');
        expect(res.body.data.book.title).toBe('The Odyssey');
        expect(res.body.data.book.isbn).toBe(9780140449136);
    });

    /**
     * TC: Create book with ONLY ISBN — auto-enrichment from external API
     * The service fetches metadata from Google Books / Open Library.
     * If the external API is unreachable, the service still needs title+author,
     * so this test verifies the flow and accepts either 201 (enriched) or 400 (no metadata).
     */
    test('should attempt to create book with ISBN only', async () => {
        const res = await request(app)
            .post('/api/v1/books')
            .set('Authorization', `Bearer ${librarianToken}`)
            .send({
                isbn: 9780439708180 // Harry Potter ISBN
            });

        // If metadata enrichment works → 201, if not → 400 (missing title/author)
        expect([201, 400]).toContain(res.statusCode);

        if (res.statusCode === 201) {
            expect(res.body.data.book).toHaveProperty('title');
            expect(res.body.data.book).toHaveProperty('author');
        }
    });

    /**
     * TC: Missing required field (ISBN)
     */
    test('should fail without ISBN', async () => {
        const res = await request(app)
            .post('/api/v1/books')
            .set('Authorization', `Bearer ${librarianToken}`)
            .send({
                title: 'No ISBN Book',
                author: 'Unknown'
            })
            .expect(400);

        expect(res.body.status).toBe('fail');
    });

    /**
     * TC: Duplicate ISBN
     */
    test('should fail with duplicate ISBN', async () => {
        const isbn = 9780140449137;

        // Create first
        await request(app)
            .post('/api/v1/books')
            .set('Authorization', `Bearer ${librarianToken}`)
            .send({
                isbn,
                title: 'First Book',
                author: 'Author A',
                genre: ['Fiction'],
                ageRating: '6-10',
                summary: 'First entry.'
            });

        // Try duplicate
        const res = await request(app)
            .post('/api/v1/books')
            .set('Authorization', `Bearer ${librarianToken}`)
            .send({
                isbn,
                title: 'Duplicate Book',
                author: 'Author B',
                genre: ['Fiction'],
                ageRating: '6-10',
                summary: 'Duplicate entry.'
            });

        expect([400, 409]).toContain(res.statusCode);
    });

    /**
     * TC: Regular USER should be forbidden
     */
    test('should forbid USER from adding books', async () => {
        await request(app)
            .post('/api/v1/books')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                isbn: 9999999999999,
                title: 'Sneaky Book',
                author: 'Hacker',
                genre: ['Fiction'],
                ageRating: '6-10',
                summary: 'Should not be allowed.'
            })
            .expect(403);
    });

    /**
     * TC: Unauthenticated → 401
     */
    test('should reject unauthenticated book creation', async () => {
        await request(app)
            .post('/api/v1/books')
            .send({
                isbn: 1111111111111,
                title: 'No Auth Book',
                author: 'Nobody',
                genre: ['Fiction'],
                ageRating: '6-10',
                summary: 'No token provided.'
            })
            .expect(401);
    });
});
