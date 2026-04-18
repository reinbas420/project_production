const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Auth = require('../../src/models/Auth');

describe('Auth Endpoints', () => {
  describe('POST /api/v1/auth/register', () => {
    test('should register a new user successfully', async () => {
      const userData = {
        email: `test${Date.now()}@example.com`,
        password: 'password123',
        phone: '9876543210',
        name: 'Test User',
        preferredGenres: ['Fiction']
      };
      
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect('Content-Type', /json/)
        .expect(201);
      
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).toHaveProperty('email', userData.email);
    });
    
    test('should fail with missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@example.com' })
        .expect(400);
      
      expect(response.body.status).toBe('fail');
    });
    
    test('should fail with invalid email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          phone: '9876543210',
          name: 'Test User'
        })
        .expect(400);
      
      expect(response.body.status).toBe('fail');
    });
    
    test('should fail to register duplicate email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'password123',
        phone: '9876543210',
        name: 'First User',
        preferredGenres: ['Fiction']
      };
      
      // Register first time
      await request(app)
        .post('/api/v1/auth/register')
        .send(userData);
      
      // Try to register again with same email
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);
      
      expect(response.body.status).toBe('fail');
      expect(response.body.message).toContain('already registered');
    });
  });
  
  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Create a test user before each login test
      const user = await User.create({
        email: 'logintest@example.com',
        phone: '9876543210',
        profiles: [{
          name: 'Test User',
          accountType: 'PARENT'
        }]
      });
      
      await Auth.create({
        email: 'logintest@example.com',
        password: 'password123',
        userId: user._id
      });
    });
    
    test('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'password123'
        })
        .expect(200);
      
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).toHaveProperty('email', 'logintest@example.com');
    });
    
    test('should fail with incorrect password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'wrongpassword'
        })
        .expect(401);
      
      expect(response.body.message).toContain('Incorrect');
    });
    
    test('should fail with non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
        .expect(401);
      
      expect(response.body.message).toContain('Incorrect');
    });
    
    test('should fail with missing credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);
      
      expect(response.body.status).toBe('fail');
    });
  });
  
  describe('GET /api/v1/auth/me', () => {
    let token;
    let userId;
    
    beforeEach(async () => {
      // Create and login a user to get a valid token
      const userData = {
        email: `me${Date.now()}@example.com`,
        password: 'password123',
        phone: '9876543210',
        name: 'Me User',
        preferredGenres: ['Fiction']
      };
      
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData);
      
      token = response.body.data.token;
      userId = response.body.data.user.id;
    });
    
    test('should return user info with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.id).toBe(userId);
    });
    
    test('should fail without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .expect(401);
      
      expect(response.body.status).toBe('fail');
    });
    
    test('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token-here')
        .expect(401);
      
      expect(response.body.status).toBe('fail');
    });
  });
});

describe('Health Check', () => {
  test('GET /health should return 200', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body.status).toBe('success');
    expect(response.body).toHaveProperty('timestamp');
  });
});
