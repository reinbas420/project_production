/**
 * Async error handler wrapper
 * Catches errors in async route handlers and passes to error middleware
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = catchAsync;
