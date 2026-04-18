export interface QuestionnaireQuestion {
  id: string;
  question: string;
  type: "multiple-choice" | "tags" | "text";
  options?: string[];
  icon?: string;
  helpText?: string;
  required?: boolean;
}

export interface Questionnaire {
  accountType: "CHILD" | "PARENT";
  steps: QuestionnaireQuestion[][];
  titles: string[];
  descriptions: string[];
}

export interface ProfilePreferenceItem {
  questionId: string;
  question: string;
  answer: string | string[];
}

export const CHILD_QUESTIONNAIRE: Questionnaire = {
  accountType: "CHILD",
  steps: [
    [
      {
        id: "name",
        question: "What is your name?",
        type: "text",
        icon: "👤",
        required: true,
      },
      {
        id: "age",
        question: "How old are you?",
        type: "text",
        icon: "🎂",
        required: true,
      },
    ],
    [
      {
        id: "favoriteActivity",
        question: "🎮 What do you love doing most?",
        type: "multiple-choice",
        options: [
          "📚 Reading stories",
          "🎨 Drawing & creating art",
          "🏃 Playing sports & games",
          "🎵 Singing & dancing",
          "🧩 Solving puzzles",
          "🌳 Exploring nature",
        ],
        required: true,
      },
      {
        id: "favoriteCharacter",
        question: "⭐ Who is your favorite character?",
        type: "text",
        helpText: "From a book, movie, or show",
      },
      {
        id: "favoriteAnimal",
        question: "🐾 What is your favorite animal?",
        type: "multiple-choice",
        options: ["🐶 Dog", "🐱 Cat", "🦁 Lion", "🐘 Elephant", "🦉 Owl", "Other"],
      },
    ],
    [
      {
        id: "preferredLanguages",
        question: "🌍 Which languages do you understand?",
        type: "tags",
        options: [
          "English",
          "Hindi",
          "Telugu",
          "Tamil",
          "Kannada",
          "Malayalam",
          "Marathi",
          "Gujarati",
          "Bengali",
          "Punjabi",
          "Urdu",
          "Other",
        ],
        required: true,
      },
    ],
    [
      {
        id: "preferredGenres",
        question: "📚 What kind of stories do you like?",
        type: "tags",
        options: [
          "Fairy Tales & Magic",
          "Adventure",
          "Mystery",
          "Fantasy",
          "Friendship",
          "Science",
          "Funny Stories",
          "Animals",
        ],
        required: true,
      },
    ],
  ],
  titles: ["👋 Let's Get Started!", "✨ Tell Us About You", "🌍 Languages", "📚 Favorite Stories"],
  descriptions: [
    "Help us know you better!",
    "Your personality helps us find perfect books for you!",
    "We have stories in many languages",
    "So we can suggest stories you'll love!",
  ],
};

export const PARENT_QUESTIONNAIRE: Questionnaire = {
  accountType: "PARENT",
  steps: [
    [
      {
        id: "name",
        question: "What is your name?",
        type: "text",
        icon: "👤",
        required: true,
      },
      {
        id: "age",
        question: "Age",
        type: "text",
        icon: "🎂",
        required: true,
      },
    ],
    [
      {
        id: "readingFrequency",
        question: "How often do you read?",
        type: "multiple-choice",
        options: [
          "Every day",
          "Several times a week",
          "Once a week",
          "A few times a month",
          "Rarely",
        ],
        required: true,
      },
      {
        id: "primaryReadingGoal",
        question: "What is your main reading goal?",
        type: "multiple-choice",
        options: [
          "Entertainment",
          "Learning",
          "Personal growth",
          "Professional development",
          "For children/family",
        ],
        required: true,
      },
    ],
    [
      {
        id: "preferredLanguages",
        question: "🌍 Which languages do you prefer to read?",
        type: "tags",
        options: [
          "English",
          "Hindi",
          "Telugu",
          "Tamil",
          "Kannada",
          "Malayalam",
          "Marathi",
          "Gujarati",
          "Bengali",
          "Punjabi",
          "Urdu",
          "Other",
        ],
        required: true,
      },
    ],
    [
      {
        id: "preferredGenres",
        question: "📚 Which genres interest you most?",
        type: "tags",
        options: [
          "Literary Fiction",
          "Mystery & Thriller",
          "Science Fiction",
          "Fantasy",
          "Biography",
          "Self-Help",
          "Business",
          "Children's Books",
        ],
        required: true,
      },
    ],
  ],
  titles: ["👋 Welcome!", "📖 Reading Habits", "🌍 Language Preferences", "📚 Genre Preferences"],
  descriptions: [
    "Let us know who you are",
    "Help us understand your reading style",
    "Personalize your library experience",
    "Find books you'll love",
  ],
};

export function getQuestionnaire(accountType: "CHILD" | "PARENT"): Questionnaire {
  return accountType === "CHILD" ? CHILD_QUESTIONNAIRE : PARENT_QUESTIONNAIRE;
}

export function getQuestionnaireQuestionMeta(accountType: "CHILD" | "PARENT") {
  const questionnaire = getQuestionnaire(accountType);
  const meta: Record<string, { question: string; type: QuestionnaireQuestion["type"] }> = {};

  for (const step of questionnaire.steps) {
    for (const question of step) {
      meta[question.id] = { question: question.question, type: question.type };
    }
  }

  return meta;
}

export function buildProfilePreferencesFromResponses(
  responses: Record<string, any>,
  accountType: "CHILD" | "PARENT",
): ProfilePreferenceItem[] {
  const meta = getQuestionnaireQuestionMeta(accountType);

  return Object.entries(meta).map(([questionId, info]) => {
    const rawAnswer = responses?.[questionId];
    const answer = Array.isArray(rawAnswer)
      ? rawAnswer
      : rawAnswer == null
        ? ""
        : String(rawAnswer);

    return {
      questionId,
      question: info.question,
      answer,
    };
  });
}

export function mapQuestionnaireResponsesToProfile(
  responses: Record<string, any>,
  accountType: "CHILD" | "PARENT",
) {
  return {
    name: responses.name?.trim() || "",
    preferredGenres: responses.preferredGenres || [],
    preferredLanguages: responses.preferredLanguages || [],
    metadata: {
      accountType,
      favoriteActivity: responses.favoriteActivity,
      favoriteCharacter: responses.favoriteCharacter,
      favoriteAnimal: responses.favoriteAnimal,
      readingFrequency: responses.readingFrequency,
      primaryReadingGoal: responses.primaryReadingGoal,
    },
    profilePreferences: buildProfilePreferencesFromResponses(responses, accountType),
  };
}
