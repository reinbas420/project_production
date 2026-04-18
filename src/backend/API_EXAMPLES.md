# API Usage Examples

This guide demonstrates typical workflows for the Hyper Local Cloud Library API.

## Prerequisites

- Backend server running at `http://localhost:5000`
- MongoDB and MySQL databases configured
- Sample data loaded (at least one library and some books)

## Workflow 1: User Registration and Authentication

### Step 1: Register a New User
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "parent@example.com",
    "password": "securepass123",
    "phone": "9876543210",
    "name": "John Doe",
    "preferredGenres": ["Fiction", "Mystery"]
  }'
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "65f1234567890abcdef12345",
      "email": "parent@example.com",
      "phone": "9876543210",
      "profiles": [
        {
          "profileId": "65f1234567890abcdef12346",
          "name": "John Doe",
          "accountType": "PARENT"
        }
      ]
    }
  }
}
```

**Save the token for subsequent requests!**

### Step 2: Login (Returning User)
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "parent@example.com",
    "password": "securepass123"
  }'
```

## Workflow 2: Profile Management

### Step 3: Create Child Profile
```bash
curl -X POST http://localhost:5000/api/v1/users/65f1234567890abcdef12345/children \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Emma Doe",
    "ageGroup": "6-8",
    "preferredGenres": ["Fantasy", "Adventure"]
  }'
```

### Step 4: Update User Delivery Address
```bash
curl -X PUT http://localhost:5000/api/v1/users/65f1234567890abcdef12345 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryAddress": {
      "street": "123 Main Street",
      "city": "Delhi",
      "state": "Delhi",
      "pincode": "110001",
      "location": {
        "type": "Point",
        "coordinates": [77.2090, 28.6139]
      }
    }
  }'
```

## Workflow 3: Browse and Search Books

### Step 5: Browse Books by Age Group
```bash
curl -X GET "http://localhost:5000/api/v1/books?age=6-8&genre=Adventure&limit=10"
```

### Step 6: Search Books
```bash
curl -X GET "http://localhost:5000/api/v1/books?search=dinosaur"
```

### Step 7: Get Book Details
```bash
curl -X GET http://localhost:5000/api/v1/books/BOOK_ID_HERE
```

## Workflow 4: Check Availability and Issue Book

### Step 8: Check Book Availability Near User
```bash
curl -X GET "http://localhost:5000/api/v1/books/BOOK_ID_HERE/availability?lat=28.6139&lng=77.2090" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "bookId": "65f1234567890abcdef12347",
    "totalAvailable": 3,
    "branches": [
      {
        "branchId": "65f1234567890abcdef12348",
        "branchName": "Central Library",
        "address": "456 Library Road, Delhi",
        "distance": 2.5,
        "availableCopies": 2
      }
    ]
  }
}
```

### Step 9: Find Nearby Libraries
```bash
curl -X GET "http://localhost:5000/api/v1/libraries/nearby?lat=28.6139&lng=77.2090&maxDistance=8"
```

### Step 10: Issue a Book (The Core Feature!)
```bash
curl -X POST http://localhost:5000/api/v1/issues \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "profileId": "CHILD_PROFILE_ID",
    "bookId": "BOOK_ID",
    "branchId": "BRANCH_ID",
    "type": "PHYSICAL"
  }'
```

**What happens behind the scenes:**
1. ✅ Validates JWT token
2. ✅ Checks user and profile exist
3. ✅ Validates library branch is active
4. ✅ **Runs Haversine distance check** (user within 8km?)
5. ✅ Checks book copy availability
6. ✅ Marks copy as ISSUED (atomic transaction)
7. ✅ Creates issue record with due date
8. ✅ Schedules delivery

**Response:**
```json
{
  "status": "success",
  "data": {
    "issue": {
      "_id": "65f1234567890abcdef12349",
      "userId": "65f1234567890abcdef12345",
      "profileId": "65f1234567890abcdef12346",
      "copyId": "65f1234567890abcdef1234a",
      "issueDate": "2026-02-22T10:30:00.000Z",
      "dueDate": "2026-03-08T10:30:00.000Z",
      "status": "ISSUED",
      "type": "PHYSICAL"
    },
    "message": "Book issued successfully"
  }
}
```

### Step 11: Track Issue Status
```bash
curl -X GET http://localhost:5000/api/v1/issues/ISSUE_ID_HERE \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Workflow 5: Return Book and Handle Penalties

### Step 12: Return Book
```bash
curl -X PUT http://localhost:5000/api/v1/issues/ISSUE_ID/return \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Step 13: Check Pending Penalties
```bash
curl -X GET http://localhost:5000/api/v1/users/USER_ID/penalties?status=PENDING \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Step 14: Get Total Pending Fines
```bash
curl -X GET http://localhost:5000/api/v1/users/USER_ID/fines/total \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "totalPendingFines": 50.00
  }
}
```

### Step 15: Pay Penalty
```bash
curl -X PUT http://localhost:5000/api/v1/penalties/ISSUE_ID/pay \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Workflow 6: Payments

### Step 16: Create Payment
```bash
curl -X POST http://localhost:5000/api/v1/payments \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "issueId": "ISSUE_ID_HERE",
    "amount": 50.00
  }'
```

### Step 17: Get User Payment History
```bash
curl -X GET http://localhost:5000/api/v1/users/USER_ID/payments \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Workflow 7: Librarian Operations

### Step 18: Add Books to Catalog (Librarian/Admin)
```bash
curl -X POST http://localhost:5000/api/v1/books \
  -H "Authorization: Bearer LIBRARIAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "The Magic Adventure",
    "author": "Jane Smith",
    "isbn": "978-3-16-148410-0",
    "genre": ["Fantasy", "Adventure"],
    "language": "English",
    "ageRating": "6-8",
    "summary": "A magical journey through enchanted lands..."
  }'
```

### Step 19: Add Book Copies to Inventory
```bash
curl -X POST http://localhost:5000/api/v1/inventory \
  -H "Authorization: Bearer LIBRARIAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookId": "BOOK_ID",
    "branchId": "BRANCH_ID",
    "quantity": 5,
    "condition": "GOOD"
  }'
```

### Step 20: View Book Issue History
```bash
curl -X GET http://localhost:5000/api/v1/issues/books/BOOK_ID/history \
  -H "Authorization: Bearer LIBRARIAN_TOKEN"
```

### Step 21: Get Branch Inventory Stats
```bash
curl -X GET http://localhost:5000/api/v1/inventory/branch/BRANCH_ID/stats \
  -H "Authorization: Bearer LIBRARIAN_TOKEN"
```

## Workflow 8: Admin Operations

### Step 22: Create New Library Branch
```bash
curl -X POST http://localhost:5000/api/v1/libraries \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "ORG_ID",
    "name": "North Delhi Library",
    "address": "789 North Avenue, Delhi",
    "location": {
      "type": "Point",
      "coordinates": [77.2500, 28.7041]
    },
    "librarian": "Sarah Johnson",
    "serviceRadiusKm": 8
  }'
```

### Step 23: Process Overdue Penalties (Admin/Cron)
```bash
curl -X POST http://localhost:5000/api/v1/penalties/process-overdue \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

## Testing the Haversine Logic

### Example: User Far from Library (Should Fail)
```bash
# User in Mumbai trying to issue from Delhi library
curl -X POST http://localhost:5000/api/v1/issues \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "profileId": "PROFILE_ID",
    "bookId": "BOOK_ID",
    "branchId": "DELHI_BRANCH_ID",
    "type": "PHYSICAL"
  }'
```

**Expected Response:**
```json
{
  "status": "fail",
  "message": "Delivery not available. Library is beyond 8km radius"
}
```

### Example: User Within Range (Should Succeed)
```bash
# User coordinates: [77.2090, 28.6139] (Delhi)
# Library coordinates: [77.2100, 28.6200] (2-3 km away)
# Within 8km radius ✅
```

## Tips for Testing

1. **Get a Token First**: Always register/login and save the token
2. **Replace IDs**: Use actual MongoDB ObjectIds from your database
3. **Set Delivery Address**: Required before issuing physical books
4. **Check Availability**: Before issuing, verify book is available nearby
5. **Monitor Logs**: Server logs show Haversine calculations in real-time

## Postman Collection

You can import these as a Postman collection for easier testing:

1. Create environment variables:
   - `base_url`: http://localhost:5000/api/v1
   - `token`: (set after login)
   - `user_id`: (set after registration)

2. Use `{{base_url}}` and `{{token}}` in requests

## Common Error Responses

### 401 Unauthorized
```json
{
  "status": "fail",
  "message": "You are not logged in. Please log in to get access."
}
```

### 400 Bad Request - Outside Delivery Radius
```json
{
  "status": "fail",
  "message": "Delivery not available. Library is beyond 8km radius"
}
```

### 400 Bad Request - No Copies Available
```json
{
  "status": "fail",
  "message": "No copies available at this branch"
}
```

### 404 Not Found
```json
{
  "status": "fail",
  "message": "Book not found"
}
```

---

**Happy Testing! 🚀📚**
