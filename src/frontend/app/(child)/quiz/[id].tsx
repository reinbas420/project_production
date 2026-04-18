import { API_BASE_URL } from '@/constants/config';
import bookService from '@/api/services/bookService';
import { NavBar, NAV_BOTTOM_PAD } from '@/components/NavBar';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import useAppStore from '@/store/useAppStore';
import useChildTrackingStore from '@/store/useChildTrackingStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Answer letter labels
const LETTERS = ['A', 'B', 'C', 'D'];

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { activeProfileId } = useAppStore();
  const { recordQuizResult } = useChildTrackingStore();

  const [bookTitle, setBookTitle] = useState('Loading book...');
  useEffect(() => {
    let active = true;
    bookService.getBookById(id as string)
      .then(r => { if (active && r.data?.book) setBookTitle(r.data.book.title); })
      .catch(() => { if (active) setBookTitle('Unknown Book'); });
    return () => { active = false; };
  }, [id]);

  const { token } = useAppStore();
  const [questions, setQuestions]         = useState<any[] | null>(null);
  const [loadingQuiz, setLoadingQuiz]     = useState(true);
  const [maxLimitReached, setMaxLimitReached] = useState(false);
  const [maxAnswered, setMaxAnswered]     = useState(0);

  useEffect(() => {
    let active = true;
    const fetchQuiz = async () => {
      try {
        const res  = await fetch(`${API_BASE_URL}/quizzes/generate/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        if (!active) return;

        if (json.data?.maxLimitReached) {
          setMaxLimitReached(true);
          setMaxAnswered(json.data.questionsAnswered ?? 60);
          return;
        }

        if (json.data?.quiz?.questions) {
          const adapted = json.data.quiz.questions.map((q: any) => ({
            _id:              q._id,
            q:                q.question,
            options:          q.options,
            answer:           q.options.indexOf(q.correctAnswer) !== -1
                                ? q.options.indexOf(q.correctAnswer)
                                : 0,
            correctAnswerString: q.correctAnswer,
          }));
          setQuestions(adapted);
        }
      } catch (err) {
        // Network error: nothing to fall back to — just leave loading=false so
        // the user sees an empty state rather than crashing.
        console.warn('[Quiz] Failed to fetch quiz:', err);
      } finally {
        if (active) setLoadingQuiz(false);
      }
    };
    fetchQuiz();
    return () => { active = false; };
  }, [id, token]);

  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [answersData, setAnswersData] = useState<any[]>([]);

  const handleSelect = (i: number) => {
    if (selected !== null || !questions) return;
    const q = questions[current];
    setSelected(i);
    const isCorrect = i === q.answer;
    if (isCorrect) setScore(s => s + 1);

    setAnswersData(prev => [...prev, {
      question: q.q,
      selectedAnswer: q.options[i],
      correctAnswer: q.correctAnswerString || q.options[q.answer],
      isCorrect,
    }]);
  };

  const handleNext = async () => {
    if (!questions) return;
    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
      setSelected(null);
    } else {
      const finalScore = score;
      const pct = Math.round((finalScore / questions.length) * 100);
      if (activeProfileId) {
        recordQuizResult(activeProfileId, {
          bookId: id as string,
          bookTitle,
          score: finalScore,
          total: questions.length,
          pct,
          date: new Date().toISOString(),
        });
      }

      try {
        const qIds = questions.map((q: any) => q._id).filter(Boolean);
        await fetch(`${API_BASE_URL}/quizzes/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ bookId: id, answers: answersData, questionIds: qIds }),
        });
      } catch (e) {
        console.warn('Failed to submit quiz to backend', e);
      }
      setDone(true);
    }
  };

  const handleReset = () => {
    setCurrent(0);
    setSelected(null);
    setScore(0);
    setAnswersData([]);
    setDone(false);
  };

  if (loadingQuiz) {
    return (
      <SafeAreaView style={[s.safe, {justifyContent: 'center', alignItems: 'center'}]}>
        <Text style={{fontSize: 48, marginBottom: 20}}>📚</Text>
        <Text style={{fontSize: Typography.body + 2, color: Colors.textSecondary, fontWeight: '700', textAlign: 'center', paddingHorizontal: 30, lineHeight: 26}}>
          Preparing your quiz{'\n'}This may take a moment the first time...
        </Text>
      </SafeAreaView>
    );
  }

  if (maxLimitReached) {
    return (
      <SafeAreaView style={[s.safe, {justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl}]}>
        {Platform.OS === 'web' && <NavBar role="child" active="home" />}
        <Text style={{fontSize: 52, marginBottom: 16}}>🏆</Text>
        <Text style={{fontSize: Typography.titleChild - 4, fontWeight: '900', color: Colors.accentSage, textAlign: 'center', marginBottom: 8}}>
          Quiz Master!
        </Text>
        <Text style={{fontSize: Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: 32}}>
          You've answered all {maxAnswered} questions available for this book.{`\n`}Come back after reading a new book!
        </Text>
        <TouchableOpacity style={s.btnPrimary} onPress={() => router.back()}>
          <Text style={s.btnPrimaryText}>Back to book</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!questions) {
    return (
      <SafeAreaView style={[s.safe, {justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl}]}>
        <Text style={{fontSize: 40, marginBottom: 12}}>😕</Text>
        <Text style={{fontSize: Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24}}>
          Couldn't load the quiz right now.{`\n`}Please try again later.
        </Text>
        <TouchableOpacity style={[s.btnPrimary, {marginTop: 24}]} onPress={() => router.back()}>
          <Text style={s.btnPrimaryText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const q = questions[current];

  // Results screen
  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    const emoji = pct === 100 ? '🏆' : pct >= 75 ? '🌟' : pct >= 50 ? '👍' : '📖';
    const msg = pct === 100 ? 'Perfect score! Amazing!'
      : pct >= 75 ? 'So close! Great job!'
        : pct >= 50 ? 'Good effort! Keep reading!'
          : 'Keep going — reading helps!';
    return (
      <SafeAreaView style={s.safe}>
        {Platform.OS === 'web' && <NavBar role="child" active="home" />}
        <ScrollView contentContainerStyle={s.resultScroll}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>

        {/* Results header */}
          <View style={s.resultHeader}>
            <Text style={s.resultScore}>{score} / {questions.length}</Text>
            <Text style={s.resultMsg}>{msg}</Text>
          </View>

          {/* Score bar */}
          <View style={s.scoreBar}>
            <View style={[s.scoreFill, { width: `${pct}%` }]} />
          </View>
          <Text style={s.pctLabel}>{pct}%</Text>

          <TouchableOpacity style={s.btnPrimary} onPress={handleReset} activeOpacity={0.82}>
            <Text style={s.btnPrimaryText}>Try again</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.btnSecondary} onPress={() => router.back()} activeOpacity={0.82}>
            <Text style={s.btnSecondaryText}>Back to book</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.btnGhost}
            onPress={() => router.replace('/(child)')}
            activeOpacity={0.82}
          >
            <Text style={s.btnGhostText}>Home</Text>
          </TouchableOpacity>
        </ScrollView>
        {Platform.OS !== 'web' && <NavBar role="child" active="home" />}
      </SafeAreaView>
    );
  }

  // ── Question screen ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      {Platform.OS === 'web' && <NavBar role="child" active="home" />}
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Back + progress */}
        <View style={s.topBar}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backText}>←</Text>
          </TouchableOpacity>
          <View style={s.progressWrap}>
            <View style={s.progressTrack}>
              <View
                style={[s.progressFill, {
                  width: `${((current) / questions.length) * 100}%`,
                }]}
              />
            </View>
            <Text style={s.progressLabel}>
              {current + 1} of {questions.length}
            </Text>
          </View>
        </View>

        {/* Book context */}
        <Text style={s.bookContext}>Quiz: {bookTitle}</Text>

        {/* Question */}
        <View style={s.questionBox}>
          <Text style={s.questionNum}>Question {current + 1}</Text>
          <Text style={s.questionText}>{q.q}</Text>
        </View>

        {/* Options */}
        <View style={s.optionsGrid}>
          {q.options.map((opt: string, i: number) => {
            const isSelected = selected === i;
            const isCorrect = selected !== null && i === q.answer;
            const isWrong = isSelected && i !== q.answer;

            return (
              <TouchableOpacity
                key={i}
                style={[
                  s.optionBtn,
                  isSelected && !isCorrect && !isWrong && s.optionSelected,
                  isCorrect && s.optionCorrect,
                  isWrong && s.optionWrong,
                ]}
                onPress={() => handleSelect(i)}
                activeOpacity={0.78}
                disabled={selected !== null}
              >
                <View style={[
                  s.letterBadge,
                  isCorrect && s.letterBadgeCorrect,
                  isWrong && s.letterBadgeWrong,
                ]}>
                  <Text style={s.letterText}>{LETTERS[i]}</Text>
                </View>
                <Text style={[
                  s.optionText,
                  isCorrect && { color: Colors.success },
                  isWrong && { color: Colors.error },
                ]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Feedback */}
        {selected !== null && (
          <View style={[
            s.feedbackBox,
            selected === q.answer ? s.feedbackCorrect : s.feedbackWrong,
          ]}>
            <Text style={s.feedbackText}>
              {selected === q.answer
                ? 'Correct! Well done!'
                : `Not quite — the answer was: "${q.options[q.answer]}"`}
            </Text>
          </View>
        )}

        {/* Next */}
        {selected !== null && (
          <TouchableOpacity style={s.btnPrimary} onPress={handleNext} activeOpacity={0.82}>
            <Text style={s.btnPrimaryText}>
              {current < questions.length - 1 ? 'Next question →' : 'See my results'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
      {Platform.OS !== 'web' && <NavBar role="child" active="home" />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.browseSurface },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: NAV_BOTTOM_PAD + Spacing.xl },
  resultScroll: {
    paddingHorizontal: Spacing.xl, paddingBottom: NAV_BOTTOM_PAD + Spacing.xxl,
    alignItems: 'center', gap: Spacing.md,
  },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.sm, marginTop: Spacing.md, marginBottom: Spacing.xl,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  backText: { fontSize: 18, fontWeight: '800', color: Colors.accentSage },

  progressWrap: { flex: 1, gap: 4 },
  progressTrack: {
    height: 8, backgroundColor: Colors.cardBorder,
    borderRadius: Radius.full, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.accentSage, borderRadius: Radius.full },
  progressLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },

  bookContext: { fontSize: Typography.label, color: Colors.textMuted, fontWeight: '600', marginBottom: Spacing.sm },

  questionBox: {
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    padding: Spacing.lg, marginBottom: Spacing.lg, gap: 8,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  questionNum: { fontSize: Typography.label, color: Colors.accentSage, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  questionText: { fontSize: Typography.titleChild - 4, fontWeight: '700', color: Colors.textPrimary, lineHeight: 30 },

  optionsGrid: { gap: Spacing.md, marginBottom: Spacing.lg },
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.card, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 2, borderColor: Colors.cardBorder,
  },
  optionSelected: { borderColor: Colors.accentSage, backgroundColor: Colors.accentSageLight },
  optionCorrect: { borderColor: Colors.success, backgroundColor: '#E8F5E9' },
  optionWrong: { borderColor: Colors.error, backgroundColor: '#FFEBEE' },
  letterBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.accentSage,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  letterBadgeCorrect: { backgroundColor: Colors.success },
  letterBadgeWrong: { backgroundColor: Colors.error },
  letterText: { fontSize: 14, fontWeight: '800', color: Colors.textOnDark },
  optionText: { fontSize: Typography.bodyChild - 2, fontWeight: '600', color: Colors.textPrimary, flex: 1 },

  feedbackBox: { borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  feedbackCorrect: { backgroundColor: '#E8F5E9' },
  feedbackWrong: { backgroundColor: '#FFEBEE' },
  feedbackText: { fontSize: Typography.body, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },

  btnPrimary: {
    backgroundColor: Colors.buttonPrimary, borderRadius: Radius.full,
    paddingVertical: 16, alignItems: 'center',
  },
  btnPrimaryText: { fontSize: Typography.body, fontWeight: '800', color: Colors.buttonPrimaryText },
  btnSecondary: {
    borderRadius: Radius.full, paddingVertical: 14, alignItems: 'center',
    borderWidth: 2, borderColor: Colors.accentSage,
  },
  btnSecondaryText: { fontSize: Typography.body, fontWeight: '700', color: Colors.accentSage },
  btnGhost: {
    borderRadius: Radius.full, paddingVertical: 12, alignItems: 'center',
  },
  btnGhostText: { fontSize: Typography.body, fontWeight: '600', color: Colors.textMuted },

  // Results
  resultHeader: { alignItems: 'center', gap: Spacing.xs, width: '100%', marginTop: Spacing.xl },
  resultScore: { fontSize: 52, fontWeight: '900', color: Colors.accentSage },
  resultMsg: { fontSize: Typography.body + 2, color: Colors.textSecondary, textAlign: 'center', lineHeight: 26 },
  scoreBar: {
    width: '100%', height: 16, backgroundColor: Colors.cardBorder,
    borderRadius: Radius.full, overflow: 'hidden',
  },
  scoreFill: { height: '100%', backgroundColor: Colors.accentSage, borderRadius: Radius.full },
  pctLabel: { fontSize: Typography.body, color: Colors.textSecondary, fontWeight: '700' },
});
