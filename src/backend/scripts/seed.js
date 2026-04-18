const mongoose = require('mongoose');
const config = require('../src/config');
const Organization = require('../src/models/Organization');
const LibraryBranch = require('../src/models/LibraryBranch');
const Book = require('../src/models/Book');
const BookCopy = require('../src/models/BookCopy');
const User = require('../src/models/User');
const Auth = require('../src/models/Auth');

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongodb.uri);
    console.log('✅ Connected to MongoDB');
    
    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await Organization.deleteMany({});
    await LibraryBranch.deleteMany({});
    await Book.deleteMany({});
    await BookCopy.deleteMany({});
    await User.deleteMany({});
    await Auth.deleteMany({});
    
    // Create Organization
    console.log('📝 Creating organization...');
    const org = await Organization.create({
      name: 'City Library Network',
      status: 'ACTIVE'
    });
    
    // Create Library Branches
    console.log('🏛️  Creating library branches...');
    const centralBranch = await LibraryBranch.create({
      organizationId: org._id,
      name: 'Central Library',
      address: '123 Main Street, Connaught Place, Delhi',
      location: {
        type: 'Point',
        coordinates: [77.2090, 28.6139] // [longitude, latitude]
      },
      librarian: 'Rajesh Kumar',
      serviceRadiusKm: 8
    });
    
    const northBranch = await LibraryBranch.create({
      organizationId: org._id,
      name: 'North Delhi Library',
      address: '456 Model Town, North Delhi',
      location: {
        type: 'Point',
        coordinates: [77.1910, 28.7041]
      },
      librarian: 'Priya Sharma',
      serviceRadiusKm: 8
    });
    
    // Create Books
    console.log('📚 Creating books...');
    const books = await Book.insertMany([
      {
        title: 'The Adventures of Tom Sawyer',
        author: 'Mark Twain',
        isbn: '978-0-14-062127-0',
        genre: ['Adventure', 'Classic'],
        language: 'English',
        ageRating: '8-10',
        summary: 'The classic tale of a mischievous boy growing up along the Mississippi River.'
      },
      {
        title: 'Harry Potter and the Philosopher\'s Stone',
        author: 'J.K. Rowling',
        isbn: '978-0-7475-3269-9',
        genre: ['Fantasy', 'Adventure'],
        language: 'English',
        ageRating: '8-10',
        summary: 'A young wizard discovers his magical heritage and begins his journey at Hogwarts.'
      },
      {
        title: 'Charlotte\'s Web',
        author: 'E.B. White',
        isbn: '978-0-06-440055-8',
        genre: ['Fiction', 'Animals'],
        language: 'English',
        ageRating: '6-8',
        summary: 'The story of a spider who saves her friend, a pig, from being slaughtered.'
      },
      {
        title: 'The Very Hungry Caterpillar',
        author: 'Eric Carle',
        isbn: '978-0-399-22690-5',
        genre: ['Picture Book', 'Educational'],
        language: 'English',
        ageRating: '0-3',
        summary: 'A caterpillar eats his way through various foods before becoming a butterfly.'
      },
      {
        title: 'Matilda',
        author: 'Roald Dahl',
        isbn: '978-0-14-130106-8',
        genre: ['Fiction', 'Fantasy'],
        language: 'English',
        ageRating: '8-10',
        summary: 'A brilliant girl with magical powers stands up against cruel adults.'
      }
    ]);
    
    // Create Book Copies
    console.log('📖 Creating book copies...');
    const copies = [];
    for (const book of books) {
      // Add 3 copies to Central Library
      for (let i = 0; i < 3; i++) {
        copies.push({
          bookId: book._id,
          branchId: centralBranch._id,
          barcode: `CENTRAL-${book._id}-${i}`,
          status: 'AVAILABLE',
          condition: 'GOOD'
        });
      }
      
      // Add 2 copies to North Library
      for (let i = 0; i < 2; i++) {
        copies.push({
          bookId: book._id,
          branchId: northBranch._id,
          barcode: `NORTH-${book._id}-${i}`,
          status: 'AVAILABLE',
          condition: 'GOOD'
        });
      }
    }
    await BookCopy.insertMany(copies);
    
    // Create Sample Users
    console.log('👥 Creating sample users...');
    
    // Create Admin User
    const adminUser = await User.create({
      email: 'admin@library.com',
      phone: '9999999999',
      status: 'ACTIVE',
      role: 'ADMIN',
      profiles: [{
        name: 'Admin User',
        accountType: 'PARENT'
      }],
      deliveryAddress: {
        street: '100 Admin Street',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
        location: {
          type: 'Point',
          coordinates: [77.2090, 28.6139]
        }
      }
    });
    
    await Auth.create({
      email: 'admin@library.com',
      password: 'admin123',
      userId: adminUser._id
    });
    
    // Create Librarian User
    const librarianUser = await User.create({
      email: 'librarian@library.com',
      phone: '9999999998',
      status: 'ACTIVE',
      role: 'LIBRARIAN',
      profiles: [{
        name: 'Rajesh Kumar',
        accountType: 'PARENT'
      }]
    });
    
    await Auth.create({
      email: 'librarian@library.com',
      password: 'librarian123',
      userId: librarianUser._id
    });
    
    // Create Regular User with Child
    const regularUser = await User.create({
      email: 'parent@example.com',
      phone: '9876543210',
      status: 'ACTIVE',
      role: 'USER',
      profiles: [
        {
          name: 'John Doe',
          accountType: 'PARENT',
          preferredGenres: ['Fiction', 'Mystery']
        },
        {
          name: 'Emma Doe',
          accountType: 'CHILD',
          ageGroup: '6-8',
          preferredGenres: ['Fantasy', 'Adventure']
        }
      ],
      deliveryAddress: {
        street: '123 Residential Area',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110002',
        location: {
          type: 'Point',
          coordinates: [77.2100, 28.6200] // About 1km from Central Library
        }
      }
    });
    
    await Auth.create({
      email: 'parent@example.com',
      password: 'password123',
      userId: regularUser._id
    });
    
    console.log('\n✅ Seed data created successfully!\n');
    console.log('📊 Summary:');
    console.log(`   - Organizations: 1`);
    console.log(`   - Library Branches: 2`);
    console.log(`   - Books: ${books.length}`);
    console.log(`   - Book Copies: ${copies.length}`);
    console.log(`   - Users: 3\n`);
    
    console.log('🔑 Test Credentials:');
    console.log('   Admin:');
    console.log('      Email: admin@library.com');
    console.log('      Password: admin123\n');
    console.log('   Librarian:');
    console.log('      Email: librarian@library.com');
    console.log('      Password: librarian123\n');
    console.log('   User:');
    console.log('      Email: parent@example.com');
    console.log('      Password: password123\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
