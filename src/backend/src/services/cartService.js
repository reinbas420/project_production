const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const Cart = require('../models/Cart');
const Book = require('../models/Book');
const LibraryBranch = require('../models/LibraryBranch');
const BookCopy = require('../models/BookCopy');

const toObjectId = (id, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
  return new mongoose.Types.ObjectId(id);
};

const ensureBookAndLibrary = async (bookId, libraryId) => {
  const [bookExists, libraryExists] = await Promise.all([
    Book.exists({ _id: bookId }),
    LibraryBranch.exists({ _id: libraryId }),
  ]);

  if (!bookExists) {
    throw new AppError('Invalid book', 404);
  }

  if (!libraryExists) {
    throw new AppError('Invalid library', 404);
  }

  const copyExistsInLibrary = await BookCopy.exists({
    bookId,
    branchId: libraryId,
  });

  if (!copyExistsInLibrary) {
    throw new AppError('This book does not belong to the selected library', 400);
  }
};

const normalizeCartResponse = (cartDoc) => ({
  user_id: String(cartDoc.userId),
  library_id: cartDoc.libraryId ? String(cartDoc.libraryId) : null,
  items: (cartDoc.items || []).map((item) => ({
    book_id: String(item.bookId),
    quantity: item.quantity,
  })),
});

const getOrCreateCart = async (userId) => {
  // Keep one cart document per user for simpler reads/writes.
  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = await Cart.create({ userId, libraryId: null, items: [] });
  }
  return cart;
};

exports.addToCart = async (user_id, book_id, library_id, options = {}) => {
  const userId = toObjectId(user_id, 'user_id');
  const bookId = toObjectId(book_id, 'book_id');
  const libraryId = toObjectId(library_id, 'library_id');
  const forceReplace = Boolean(options.forceReplace);

  await ensureBookAndLibrary(bookId, libraryId);

  const cart = await getOrCreateCart(userId);

  // Empty cart: initialize its owning library.
  if (!cart.libraryId || cart.items.length === 0) {
    cart.libraryId = libraryId;
  }

  const isSameLibrary = cart.libraryId && String(cart.libraryId) === String(libraryId);

  if (!isSameLibrary) {
    // Different library: require explicit user confirmation before replacing.
    if (!forceReplace) {
      return {
        requires_confirmation: true,
        message: 'Your cart contains books from another library. Do you want to clear the cart and add this book?',
        cart: normalizeCartResponse(cart),
      };
    }

    // User confirmed replacement: clear old cart and switch library context.
    cart.libraryId = libraryId;
    cart.items = [];
  }

  // Same book added again => increase quantity.
  const existingItem = cart.items.find((item) => String(item.bookId) === String(bookId));

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.items.push({ bookId, quantity: 1 });
  }

  await cart.save();

  return {
    requires_confirmation: false,
    message: 'Book added to cart',
    cart: normalizeCartResponse(cart),
  };
};

exports.clearCart = async (user_id) => {
  const userId = toObjectId(user_id, 'user_id');
  const cart = await getOrCreateCart(userId);

  cart.libraryId = null;
  cart.items = [];
  await cart.save();

  return {
    message: 'Cart cleared successfully',
    cart: normalizeCartResponse(cart),
  };
};

exports.getCart = async (user_id) => {
  const userId = toObjectId(user_id, 'user_id');
  const cart = await getOrCreateCart(userId);

  return {
    message: cart.items.length ? 'Cart fetched successfully' : 'Cart is empty',
    cart: normalizeCartResponse(cart),
  };
};

exports.updateCartItemQuantity = async (user_id, book_id, operation) => {
  const userId = toObjectId(user_id, 'user_id');
  const bookId = toObjectId(book_id, 'book_id');

  if (!['increment', 'decrement'].includes(operation)) {
    throw new AppError('Invalid operation. Use increment or decrement', 400);
  }

  const cart = await getOrCreateCart(userId);

  const targetExists = cart.items.some((item) => String(item.bookId) === String(bookId));
  if (!targetExists) {
    throw new AppError('Book is not present in cart', 404);
  }

  const nextItems = cart.items
    .map((item) => {
      if (String(item.bookId) !== String(bookId)) {
        return {
          bookId: item.bookId,
          quantity: item.quantity,
        };
      }

      const nextQuantity = operation === 'increment'
        ? item.quantity + 1
        : item.quantity - 1;

      if (nextQuantity <= 0) {
        return null;
      }

      return {
        bookId: item.bookId,
        quantity: nextQuantity,
      };
    })
    .filter(Boolean);

  cart.items = nextItems;

  if (cart.items.length === 0) {
    cart.libraryId = null;
  }

  await cart.save();

  const refreshedCart = await Cart.findOne({ userId });

  return {
    message: operation === 'increment' ? 'Cart quantity increased' : 'Cart quantity updated',
    cart: normalizeCartResponse(refreshedCart || cart),
  };
};
