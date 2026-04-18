const aiService = require('../services/aiService');
const catchAsync = require('../utils/catchAsync');

/**
 * GET /quizzes/generate/:bookId
 * Serves 5 unseen questions from the pre-generated pool.
 * On first request, triggers synchronous Gemini generation (user sees loading screen).
 */
exports.generateQuiz = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const result = await aiService.generateQuiz(req.params.bookId, userId);

  if (result.maxLimitReached) {
    return res.status(200).json({
      status: 'success',
      data: { maxLimitReached: true, questionsAnswered: result.questionsAnswered },
    });
  }

  res.status(200).json({
    status: 'success',
    data: { quiz: { questions: result.questions } },
  });
});

/**
 * POST /quizzes/submit
 * Saves the attempt including which pool question IDs were answered.
 */
exports.submitQuiz = catchAsync(async (req, res) => {
  const { bookId, answers, questionIds = [] } = req.body;
  const userId = req.user._id;

  const attempt = await aiService.submitQuiz(userId, bookId, answers, questionIds);

  res.status(201).json({
    status: 'success',
    data: { attempt },
  });
});

/**
 * GET /quizzes/history/:userId
 */
exports.getQuizHistory = catchAsync(async (req, res) => {
  const userId = req.params.userId || req.user._id;
  const history = await aiService.getQuizHistory(userId);

  res.status(200).json({
    status: 'success',
    data: { history },
  });
});
