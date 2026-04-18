import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors, Spacing, Typography, Radius } from '@/constants/theme';
import {
  getQuestionnaire,
  mapQuestionnaireResponsesToProfile,
  QuestionnaireQuestion,
} from '../constants/questionnaires';

interface QuestionnaireProps {
  onComplete: (responses: Record<string, any>, profileData: any) => Promise<void>;
  onCancel: () => void;
  forcedAccountType?: 'CHILD' | 'PARENT';
  initialResponses?: Record<string, any>;
}

interface QuestionResponse {
  [questionId: string]: string | string[];
}

/**
 * Auto-detect account type from age entered in first step
 */
const getAccountTypeFromAge = (age: string | undefined): 'CHILD' | 'PARENT' => {
  if (!age) return 'CHILD'; // default
  const ageNum = parseInt(age, 10);
  return ageNum >= 15 ? 'PARENT' : 'CHILD';
};

export default function PersonalizedQuestionnaire({
  onComplete,
  onCancel,
  forcedAccountType,
  initialResponses,
}: QuestionnaireProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<QuestionResponse>(initialResponses || {});
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Auto-determine accountType based on age from step 1
  const determinedAccountType = forcedAccountType || getAccountTypeFromAge(responses.age as string);
  const questionnaire = getQuestionnaire(determinedAccountType);

  const currentQuestions = questionnaire.steps[currentStep];
  const isLastStep = currentStep === questionnaire.steps.length - 1;
  const totalSteps = questionnaire.steps.length;
  const progressPercent = ((currentStep + 1) / totalSteps) * 100;

  const handleQuestionResponse = (questionId: string, value: string | string[]) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));
    setError('');
  };

  const handleNextStep = () => {
    // Validate required fields
    const unanswered = currentQuestions.filter(
      (q) => q.required && !responses[q.id]
    );

    if (unanswered.length > 0) {
      setError(`Please answer: ${unanswered.map((q) => q.question).join(', ')}`);
      return;
    }

    if (isLastStep) {
      handleSubmit();
    } else {
      setCurrentStep((prev) => prev + 1);
      setError('');
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const profileData = mapQuestionnaireResponsesToProfile(responses, determinedAccountType);
      await onComplete(responses, profileData);
    } catch (err) {
      setError('Failed to save profile. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      setError('');
    } else {
      onCancel();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={s.container}
    >
      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>{questionnaire.titles[currentStep]}</Text>
          <Text style={s.headerDescription}>
            {questionnaire.descriptions[currentStep]}
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={s.progressContainer}>
          <View
            style={[
              s.progressBar,
              {
                width: `${progressPercent}%`,
                backgroundColor: determinedAccountType === 'CHILD' ? Colors.accentPeriwinkle : Colors.accentSage,
              },
            ]}
          />
        </View>
        <Text style={s.progressText}>
          Step {currentStep + 1} of {totalSteps}
        </Text>

        {/* Questions */}
        <View style={s.questionsContainer}>
          {currentQuestions.map((question) => (
            <QuestionComponent
              key={question.id}
              question={question}
              value={responses[question.id]}
              onChange={(value) => handleQuestionResponse(question.id, value)}
              accountType={determinedAccountType}
            />
          ))}
        </View>

        {/* Error Message */}
        {error ? <Text style={s.errorText}>⚠️ {error}</Text> : null}

        {/* Navigation Buttons */}
        <View style={s.buttonContainer}>
          <TouchableOpacity
            style={[s.button, s.buttonSecondary]}
            onPress={handleBack}
            disabled={isLoading}
          >
            <Text style={s.buttonTextSecondary}>
              {currentStep === 0 ? '✕ Cancel' : '← Back'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.button, s.buttonPrimary]}
            onPress={handleNextStep}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.buttonPrimaryText} size="small" />
            ) : (
              <Text style={s.buttonTextPrimary}>
                {isLastStep ? '🎉 Get Started!' : 'Next →'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Individual question renderer
 */
function QuestionComponent({
  question,
  value,
  onChange,
  accountType,
}: {
  question: QuestionnaireQuestion;
  value?: any;
  onChange: (value: any) => void;
  accountType: 'CHILD' | 'PARENT';
}) {
  const accentColor =
    accountType === 'CHILD' ? Colors.accentPeriwinkle : Colors.accentSage;

  switch (question.type) {
    case 'text':
      return (
        <View style={s.questionWrapper}>
          <Text style={s.questionText}>
            {question.icon} {question.question}
          </Text>
          {question.helpText && (
            <Text style={s.helpText}>{question.helpText}</Text>
          )}
          <TextInput
            style={[s.textInput, { borderColor: accentColor }]}
            placeholder="Type your answer..."
            placeholderTextColor={Colors.textSecondary}
            value={value || ''}
            onChangeText={onChange}
            keyboardType={question.id === 'age' ? 'number-pad' : 'default'}
          />
        </View>
      );

    case 'multiple-choice':
      return (
        <View style={s.questionWrapper}>
          <Text style={s.questionText}>{question.question}</Text>
          {question.helpText && (
            <Text style={s.helpText}>{question.helpText}</Text>
          )}
          <View style={s.optionsContainer}>
            {question.options?.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  s.optionButton,
                  value === option && [s.optionButtonSelected, { backgroundColor: accentColor }],
                ]}
                onPress={() => onChange(option)}
              >
                <Text
                  style={[
                    s.optionText,
                    value === option && s.optionTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );

    case 'tags':
      return (
        <View style={s.questionWrapper}>
          <Text style={s.questionText}>{question.question}</Text>
          {question.helpText && (
            <Text style={s.helpText}>{question.helpText}</Text>
          )}
          <View style={s.tagsContainer}>
            {question.options?.map((tag) => {
              const isSelected = Array.isArray(value) && value.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[
                    s.tag,
                    isSelected && [s.tagSelected, { backgroundColor: accentColor }],
                  ]}
                  onPress={() => {
                    const current = Array.isArray(value) ? value : [];
                    if (isSelected) {
                      onChange(current.filter((t) => t !== tag));
                    } else {
                      onChange([...current, tag]);
                    }
                  }}
                >
                  <Text
                    style={[
                      s.tagText,
                      isSelected && s.tagTextSelected,
                    ]}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );

    default:
      return null;
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  headerTitle: {
    fontSize: Typography.title,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  headerDescription: {
    fontSize: Typography.body,
    color: Colors.textSecondary,
  },
  progressContainer: {
    height: 6,
    backgroundColor: Colors.card,
    borderRadius: Radius.full,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: Radius.full,
  },
  progressText: {
    fontSize: Typography.label,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  questionsContainer: {
    marginBottom: Spacing.xl,
  },
  questionWrapper: {
    marginBottom: Spacing.lg,
  },
  questionText: {
    fontSize: Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  helpText: {
    fontSize: Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
  },
  textInput: {
    borderWidth: 2,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: Colors.card,
  },
  optionsContainer: {
    gap: Spacing.sm,
  },
  optionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
  },
  optionButtonSelected: {
    borderColor: Colors.accentPeriwinkle,
  },
  optionText: {
    fontSize: Typography.label,
    color: Colors.textPrimary,
  },
  optionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.cardBorder,
  },
  tagSelected: {
    borderColor: Colors.accentPeriwinkle,
  },
  tagText: {
    fontSize: Typography.label,
    color: Colors.textPrimary,
  },
  tagTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: Colors.accentPeriwinkle,
  },
  buttonSecondary: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  buttonTextPrimary: {
    fontSize: Typography.label,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonTextSecondary: {
    fontSize: Typography.label,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  errorText: {
    fontSize: Typography.label,
    color: Colors.error,
    backgroundColor: `${Colors.error}15`,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    marginBottom: Spacing.md,
  },
});
