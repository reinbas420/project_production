# Hyper Local Cloud Library - Backend API

The Node.js and Express backend empowering the Hyper Local Cloud Library ecosystem.

This robust REST API securely manages dynamic Library inventories, transactional Circulation ledgers, role-based profiles (parent/child/librarian/admin), and calculates geographic Delivery availability.

## 🛠️ Tech Stack
- **Runtime:** Node.js (v16+)
- **Framework:** Express.js
- **Database:** MongoDB
- **ORM:** Mongoose
- **Validation:** Joi validation schemas
- **Authentication:** JWT (JSON Web Tokens) with `crypto`-hashed passwords structure.
- **Geospatial Maths:** Custom Haversine module checking delivery radii.

---

## 🚀 Quick Setup

1. **Install Modules:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   You must set up an `.env` file at `backend/.env`.
   ```env
   NODE_ENV=development
   PORT=5000
   
   # Database Configuration
   MONGODB_URI=mongodb+srv://<auth string>
   MONGO_DB_NAME=library_db
   
   # JWT Configuration
   JWT_SECRET=YOUR_SECRET_KEY
   JWT_EXPIRES_IN=90d
   ```

3. **Start the Development Server:**
   ```bash
   npm start
   # Server natively listens on http://localhost:5000
   ```

---

## 🏛️ Business Logic & Operations

### Delivery Boundaries (Haversine Formula)
The `IssueBook` controller inside `src/services/circulationService.js` natively calculates straight-line distances off your authenticated user's coordinates directly against the targeted Library Branch's raw location via the MongoDB schema. If the difference eclipses the branch's valid physical radius constraint, an API block throws.

### Transaction Sequences (Atomic Processing)
In `.issueBook(...)` processes, when a physical copy is pulled off the digital shelf, a `mongoose.startSession()` triggers to ensure database transactional integrity. Because 3 documents are pushed (an `Issue`, an `inventoryService` status update `BookCopy`, and an instantiated `Delivery` trace object), MongoDB transactions ensure that ALL updates write flawlessly, or none write at all.

### Dynamic Inventory Analytics 
When the API retrieves `getAllBooks` or `getBookById` (powered by `bookService.js`), a dedicated live database aggregator pipelines how many active `AVAILABLE` copies currently sit in the system directly pulling arrays off `BookCopy` instead of relying on cached unverified strings!

---

## 🌐 Endpoints

- **`GET /api/v1/auth/me`** - Parse Authentication / active session token.
- **`POST /api/v1/auth/login`** - Authenticate Email/JWT.
- **`GET /api/v1/books`** - Discover top items / new arrivals (Dynamic copies count linked).
- **`GET /api/v1/libraries`** - Discover configured Library Branches.
- **`POST /api/v1/issues`** - Push a circulation trigger transaction out mapping a copy to an instantiated Profile.
- **`GET /api/v1/users/:parentId/children`** - Authenticated lookup tracking unique nested profiles bound.
