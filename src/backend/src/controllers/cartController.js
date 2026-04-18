const cartService = require('../services/cartService');
const catchAsync = require('../utils/catchAsync');

exports.addToCart = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { book_id, library_id, force_replace } = req.body;

  const result = await cartService.addToCart(userId, book_id, library_id, {
    forceReplace: force_replace,
  });

  if (result.requires_confirmation) {
    return res.status(409).json({
      status: 'fail',
      code: 'LIBRARY_CONFLICT',
      message: result.message,
      requires_confirmation: true,
      data: { cart: result.cart },
    });
  }

  return res.status(200).json({
    status: 'success',
    message: result.message,
    requires_confirmation: false,
    data: { cart: result.cart },
  });
});

exports.clearCart = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const result = await cartService.clearCart(userId);

  return res.status(200).json({
    status: 'success',
    message: result.message,
    data: { cart: result.cart },
  });
});

exports.getCart = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const result = await cartService.getCart(userId);

  return res.status(200).json({
    status: 'success',
    message: result.message,
    data: { cart: result.cart },
  });
});

exports.updateCartItemQuantity = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { book_id, operation } = req.body;
  const result = await cartService.updateCartItemQuantity(userId, book_id, operation);

  return res.status(200).json({
    status: 'success',
    message: result.message,
    data: { cart: result.cart },
  });
});
