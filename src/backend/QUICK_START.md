# Quick Reference - Hyper Local Cloud Library Backend

## 🚀 Getting Started (5 Minutes)

```bash
# 1. Navigate to backend folder
cd backend

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env

# 4. Set up MySQL tables
mysql -u root -p < src/config/mysql-schema.sql

# 5. Seed sample data (MongoDB + MySQL)
npm run seed

# 6. Start development server
npm run dev

# Server running at: http://localhost:5000
```

## 🔑 Test Credentials (After Seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@library.com | admin123 |
| Librarian | librarian@library.com | librarian123 |
| User | parent@example.com | password123 |

## 📡 Core API Endpoints

### Authentication
```bash
POST /api/v1/auth/register  # Register new user
POST /api/v1/auth/login     # Login
GET  /api/v1/auth/me        # Get current user info
```

### Books & Libraries
```bash
GET  /api/v1/books                    # Browse books
GET  /api/v1/books/:id/availability   # Check availability (Haversine check!)
GET  /api/v1/libraries/nearby         # Find nearby libraries
```

### Issue & Return (Core Feature)
```bash
POST /api/v1/issues           # Issue book (with 8km validation)
PUT  /api/v1/issues/:id/return # Return book
GET  /api/v1/issues/:id       # Track issue status
```

### Penalties & Payments
```bash
GET  /api/v1/users/:id/fines/total  # Get total pending fines
POST /api/v1/payments               # Create payment
PUT  /api/v1/penalties/:id/pay      # Pay penalty
```

## 🛠️ NPM Scripts

```bash
npm run dev         # Development with nodemon
npm start           # Production server
npm test            # Run tests with coverage
npm run test:watch  # Watch mode
npm run seed        # Seed database with sample data
```

## 📂 Quick File Locations

| Need | Location |
|------|----------|
| Add new route | `src/routes/` |
| Business logic | `src/services/` |
| Database model | `src/models/` |
| Middleware | `src/middleware/` |
| Config | `src/config/` or `.env` |
| Tests | `tests/` |

## 🔍 Key Implementation Files

**Haversine Logic**: `src/utils/haversine.js`
```javascript
isWithinDeliveryRadius(userLocation, libraryLocation, 8)
```

**Issue Book (with distance check)**: `src/services/circulationService.js`
```javascript
exports.issueBook = async (issueData) => {
  // 1. Validate user
  // 2. Check Haversine distance <= 8km
  // 3. Find available copy
  // 4. Atomic transaction
}
```

**Penalty Cron**: `src/utils/cronJobs.js`
```javascript
cron.schedule('0 2 * * *', processOverduePenalties)
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Test specific file
npm test haversine

# Watch mode
npm run test:watch
```

## 🔐 Authentication Headers

```bash
# All protected routes need:
Authorization: Bearer <JWT_TOKEN>

# Get token from login/register response
```

## 📊 Module Checklist

- ✅ Auth Module (JWT + bcrypt)
- ✅ User Module (profiles, delivery address)
- ✅ Book Module (catalog, search, availability)
- ✅ Inventory Module (stock management)
- ✅ Circulation Module (issue/return with Haversine)
- ✅ Library Module (branches, nearby search)
- ✅ Payment Module (MySQL transactions)
- ✅ Penalty Module (automated fines)

## 🌍 Environment Variables (.env)

```env
# Essential Variables
PORT=5000
MONGODB_URI=mongodb://localhost:27017/hyper-local-library
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
JWT_SECRET=your_secret_key

# Business Rules
DELIVERY_RADIUS_KM=8        # Haversine check radius
LATE_FEE_PER_DAY=10
GRACE_PERIOD_DAYS=2
DEFAULT_BORROW_PERIOD_DAYS=14
```

## 💡 Common Tasks

### Add a New Book (Librarian)
```bash
curl -X POST http://localhost:5000/api/v1/books \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"New Book","author":"Author","ageRating":"6-8"}'
```

### Check Distance Eligibility
```bash
curl -X GET "http://localhost:5000/api/v1/books/<BOOK_ID>/availability?lat=28.6139&lng=77.2090" \
  -H "Authorization: Bearer <TOKEN>"
```

### Issue a Book (Auto Distance Check)
```bash
curl -X POST http://localhost:5000/api/v1/issues \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "profileId":"<PROFILE_ID>",
    "bookId":"<BOOK_ID>",
    "branchId":"<BRANCH_ID>",
    "type":"PHYSICAL"
  }'
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't connect to MongoDB | Check MONGODB_URI in .env |
| MySQL connection error | Verify credentials in .env, check if MySQL running |
| JWT token invalid | Re-login to get fresh token |
| Distance check fails | Verify user has delivery address set |
| No books available | Run `npm run seed` to add sample data |

## 📖 Documentation Files

- `README.md` - Complete documentation
- `API_EXAMPLES.md` - Detailed API examples with curl
- `IMPLEMENTATION_SUMMARY.md` - Technical overview
- `.env.example` - Environment template

## 🎯 Testing Haversine Logic

**Sample Locations:**
- Central Library: `[77.2090, 28.6139]` (Delhi)
- Test User (within range): `[77.2100, 28.6200]` (~1km away)
- Test User (out of range): `[77.1025, 28.7041]` (~15km away)

**Expected Results:**
- Within 8km → ✅ Book issue succeeds
- Beyond 8km → ❌ "Delivery not available. Library is beyond 8km radius"

## 📈 Database Schema Quick View

**MongoDB Collections:**
- organizations
- libraryBranches (with GeoJSON location)
- books
- bookCopies
- users (with embedded profiles)
- auths
- issues
- deliveries

**MySQL Tables:**
- payments
- penalties
- transaction_logs

## 🔄 Typical Workflow

1. User registers → JWT token
2. User sets delivery address (with coordinates)
3. User browses books
4. User checks availability (distance calculated)
5. User issues book → Haversine check → Success
6. Book delivered → User enjoys reading
7. User returns book
8. If late → Penalty calculated (cron job)
9. User pays fine → Done!

## ⚡ Performance Tips

- Use indexes on frequently queried fields
- Connection pooling for MySQL
- Cache popular books (future: Redis)
- Optimize geospatial queries with proper indexes

## 🚨 Important Notes

1. **Haversine check happens in `circulationService.issueBook()`**
2. **User must have delivery address set before issuing physical books**
3. **Penalties auto-calculated daily at 2 AM**
4. **All payments stored in MySQL for immutability**
5. **Book metadata in MongoDB for flexibility**

---

**Need Help?** Check `README.md` or `API_EXAMPLES.md`

**Ready to Deploy?** All configuration in `.env`

**Built by:** Guntesh | **Course:** DASS | **Date:** Feb 2026
