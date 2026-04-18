// ─── Shared mock data ─────────────────────────────────────────────────────────
// Replace with real API calls from bookService once backend is connected.

export interface Book {
  id: string;
  title: string;
  author: string;
  pages: number | null;
  releaseYear: number;
  genres: string[];
  summary: string;
  rating: number;         // 0–5
  coverColor: string;     // placeholder until real cover images
  coverAccent: string;
  isDigital: boolean;
  isPhysical: boolean;
  availableCopies: number;
  nearestLibrary: string;
  ageMin: number;
  ageMax: number;
  keyWords: string[];
  coverImage?: string;
  isbn?: string;
  availableAtSelectedBranch?: boolean;
  otherBranchNames?: string[];
}

export const MOCK_BOOKS: Book[] = [
  {
    id: '1',
    title: 'The Velveteen Rabbit',
    author: 'Margery Williams',
    pages: 32,
    releaseYear: 1922,
    genres: ['Classic', 'Picture Book'],
    summary: 'A stuffed rabbit longs to become real through the love of a child, in this timeless tale about friendship and belonging.',
    rating: 4.8,
    coverColor: '#F4C2C2',
    coverAccent: '#E57373',
    isDigital: true,
    isPhysical: true,
    availableCopies: 3,
    nearestLibrary: 'Koramangala Branch',
    ageMin: 4,
    ageMax: 9,
    keyWords: ['rabbit', 'toys', 'love', 'real'],
  },
  {
    id: '2',
    title: 'Where the Wild Things Are',
    author: 'Maurice Sendak',
    pages: 48,
    releaseYear: 1963,
    genres: ['Picture Book', 'Fantasy'],
    summary: "Max is sent to bed without supper and imagines sailing to a land of wild creatures where he becomes king.",
    rating: 4.7,
    coverColor: '#C5D5EA',
    coverAccent: '#7986CB',
    isDigital: false,
    isPhysical: true,
    availableCopies: 1,
    nearestLibrary: 'Indiranagar Branch',
    ageMin: 3,
    ageMax: 8,
    keyWords: ['monsters', 'imagination', 'wild', 'adventure'],
  },
  {
    id: '3',
    title: 'Matilda',
    author: 'Roald Dahl',
    pages: 240,
    releaseYear: 1988,
    genres: ['Fiction', "Children's Novel"],
    summary: 'A brilliant young girl with telekinetic powers outwits her awful parents and a tyrannical headmistress.',
    rating: 4.9,
    coverColor: '#C5DDB8',
    coverAccent: '#4A7C59',
    isDigital: true,
    isPhysical: true,
    availableCopies: 5,
    nearestLibrary: 'Koramangala Branch',
    ageMin: 7,
    ageMax: 12,
    keyWords: ['magic', 'school', 'reading', 'clever'],
  },
  {
    id: '4',
    title: 'The Very Hungry Caterpillar',
    author: 'Eric Carle',
    pages: 26,
    releaseYear: 1969,
    genres: ['Picture Book', 'Educational'],
    summary: 'A caterpillar eats through a variety of foods before transforming into a beautiful butterfly.',
    rating: 4.6,
    coverColor: '#FFDAB9',
    coverAccent: '#FF8A65',
    isDigital: true,
    isPhysical: true,
    availableCopies: 4,
    nearestLibrary: 'HSR Branch',
    ageMin: 2,
    ageMax: 6,
    keyWords: ['caterpillar', 'butterfly', 'eating', 'counting'],
  },
  {
    id: '5',
    title: 'Charlotte\'s Web',
    author: 'E.B. White',
    pages: 192,
    releaseYear: 1952,
    genres: ['Fiction', 'Classic'],
    summary: 'A pig named Wilbur befriends a spider named Charlotte who works to save his life in this heartwarming classic.',
    rating: 4.8,
    coverColor: '#D4C5EA',
    coverAccent: '#7B68EE',
    isDigital: false,
    isPhysical: true,
    availableCopies: 2,
    nearestLibrary: 'Indiranagar Branch',
    ageMin: 7,
    ageMax: 11,
    keyWords: ['pig', 'spider', 'friendship', 'farm'],
  },
  {
    id: '6',
    title: 'Goodnight Moon',
    author: 'Margaret Wise Brown',
    pages: 32,
    releaseYear: 1947,
    genres: ['Picture Book', 'Bedtime'],
    summary: 'A bunny says goodnight to everything in the room in this soothing bedtime classic.',
    rating: 4.5,
    coverColor: '#B8D4C8',
    coverAccent: '#4CAF50',
    isDigital: true,
    isPhysical: true,
    availableCopies: 6,
    nearestLibrary: 'HSR Branch',
    ageMin: 2,
    ageMax: 5,
    keyWords: ['bedtime', 'bunny', 'goodnight', 'sleep'],
  },
  {
    id: '7',
    title: 'Harry Potter and the Philosopher\'s Stone',
    author: 'J.K. Rowling',
    pages: 332,
    releaseYear: 1997,
    genres: ['Fantasy', 'Adventure'],
    summary: 'An orphaned boy discovers he is a wizard and begins his education at Hogwarts School of Witchcraft and Wizardry.',
    rating: 4.9,
    coverColor: '#FFDAB9',
    coverAccent: '#8B4513',
    isDigital: true,
    isPhysical: true,
    availableCopies: 0,
    nearestLibrary: 'Koramangala Branch',
    ageMin: 9,
    ageMax: 14,
    keyWords: ['magic', 'hogwarts', 'wizards', 'adventure'],
  },
  {
    id: '8',
    title: 'The Lion, the Witch and the Wardrobe',
    author: 'C.S. Lewis',
    pages: 208,
    releaseYear: 1950,
    genres: ['Fantasy', 'Classic'],
    summary: 'Four siblings discover a magical land through a wardrobe and must help defeat an evil witch.',
    rating: 4.8,
    coverColor: '#E6E6FA',
    coverAccent: '#9370DB',
    isDigital: false,
    isPhysical: true,
    availableCopies: 2,
    nearestLibrary: 'HSR Branch',
    ageMin: 8,
    ageMax: 13,
    keyWords: ['narnia', 'magic', 'lion', 'witch'],
  },
];

export const GENRES = ['All', 'Fiction', 'Non Fiction', 'Self Help', 'Technology', 'Art', 'History', 'Humour', 'Fantasy', 'Adventure', 'Picture Book', 'Classic', 'Educational', 'Bedtime'];
