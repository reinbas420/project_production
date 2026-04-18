const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./utils/AppError');

// ── Platform Services Layer — Aryan 2 (Security) ──────
const {
  helmetMiddleware,
  apiLimiter,
  authLimiter,
  enforceHTTPS
} = require('./middleware/security');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const bookRoutes = require('./routes/bookRoutes');
const libraryRoutes = require('./routes/libraryRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const circulationRoutes = require('./routes/circulationRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
// Stub routes enabled for prototype - controllers use stub services (no MySQL)
const paymentRoutes  = require('./routes/paymentRoutes');
const penaltyRoutes  = require('./routes/penaltyRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const quizRoutes     = require('./routes/quizRoutes');
const cartRoutes     = require('./routes/cartRoutes');
const app = express();

// ── CORS must come first — before Helmet and rate limiters ──
// In development, allow the Expo web dev server (8081) and any localhost port.
// In production, lock this down to your actual domain.
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean)
  : true; // allow all origins in development

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors()); // handle preflight for all routes

// ── Security Middleware (Platform Services — Aryan 2) ──
app.use(helmetMiddleware);       // Helmet: HSTS, CSP, X-Frame, etc.
app.use(enforceHTTPS);           // HTTPS redirect in production
app.use('/api/', apiLimiter);         // 100 req / 15 min (passthrough in test)
app.use('/api/v1/auth', authLimiter); // 10 req / 15 min (passthrough in test)

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Hyper Local Cloud Library API is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/books', bookRoutes);
app.use('/api/v1/libraries', libraryRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/issues', circulationRoutes);
app.use('/api/v1/notifications', notificationRoutes); // Platform Services — Aryan
app.use('/api/v1/catalog', catalogRoutes);
// Stub routes - validate & log data without MySQL
app.use('/api/v1/payments',  paymentRoutes);
app.use('/api/v1/penalties', penaltyRoutes);
// Delivery routes (stub mode - gig API calls are logged, not sent)
app.use('/api/v1/delivery',  deliveryRoutes);
// Shiprocket shipment routes (Platform Services — Aryan)
app.use('/api/v1/shipments', shipmentRoutes);
// AI Quiz Engine Routes
app.use('/api/v1/quizzes', quizRoutes);
// Cart routes (single-library cart behavior)
app.use('/api/v1/cart', cartRoutes);

// Handle undefined routes
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handler
app.use(errorHandler);

module.exports = app;
