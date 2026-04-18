import bookService from '@/api/services/bookService';
import { NavBar } from '@/components/NavBar';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

// ─── Per-book reading content based on genre ─────────────────────────────────
function getPages(book: any): string[] {
  const title = book?.title || 'this story';
  const author = book?.author || 'the author';
  const genres: string[] = (book?.genre || book?.genres || []).map((g: string) => g.toLowerCase());

  const hasGenre = (...gs: string[]) => gs.some(g => genres.some(bg => bg.includes(g)));

  // ── Frog and Toad Are Friends (Arnold Lobel) ──────────────────────────────
  if (title.toLowerCase().includes('frog and toad')) {
    return [
      `"${title}" by ${author} is made up of five short stories, all about the wonderful friendship between Frog and Toad — two very different characters who care for each other deeply.`,
      `In the first story, "Spring", Frog visits Toad, who is fast asleep in bed and wants to stay there until May. Frog cleverly tears the pages off Toad's calendar, skipping ahead to May so Toad will get up. Toad grumbles — but gets up anyway!`,
      `In "The Story", Frog is sick in bed and asks Toad to tell him a story. Toad tries everything — walking on his head, pouring water on himself, banging his head against the wall — to think of one. Just as he finally has an idea, Frog falls asleep. Toad smiles and tucks him in.`,
      `"A Lost Button" has Toad losing a big white button on their walk. Frog helps search, and animals keep finding wrong buttons — too small, wrong colour, four holes instead of two! When Toad angrily arrives home, he finds the button on the floor. He sews ALL the found buttons onto his jacket and gives it to Frog as a gift.`,
      `In "The Letter", Toad is sad because he never gets any mail. Frog writes him a letter saying what a good friend Toad is. He gives it to a snail to deliver — but the snail is very, very slow. Frog can't keep the secret, so he tells Toad what the letter says. Four days later, when the snail finally arrives, they sit happily on the porch and wait for it together. The End. 🐸`,
    ];
  }

  if (hasGenre('picture book', 'bedtime')) {
    return [
      `In "${title}" by ${author}, we begin in a cosy little room where everything is getting ready for bed.`,
      `The moon peeked through the curtains and smiled softly. "Time to sleep," it whispered to the toys, the lamp, and the small bowl of porridge.`,
      `One by one, each object in the room said goodnight — the red balloon, the great green room, the stars outside the window.`,
      `The little child in the story pulled the blanket up to their chin and let out a big, sleepy yawn.`,
      `And as the last page turns, you too might feel your eyes grow heavy... because the best stories always end with peaceful dreams. Goodnight!`,
    ];
  }

  if (hasGenre('fantasy', 'magic')) {
    return [
      `"${title}" by ${author} begins on an ordinary morning that is about to become extraordinarily magical.`,
      `The hero of our story had no idea that today was the day a mysterious letter would arrive — sealed with wax and addressed in shimmering silver ink.`,
      `"You have been chosen," the letter read. "The world beyond the old oak tree awaits your courage." Our hero's heart leapt with excitement and a little bit of fear.`,
      `Armed with only a cloak, a curious mind, and a small glowing stone found in the garden, the journey into the enchanted realm began.`,
      `By the end of the day, three riddles had been solved, a grumpy dragon had been befriended, and our hero discovered the most important magic of all: believing in yourself.`,
    ];
  }

  if (hasGenre('adventure', 'action')) {
    return [
      `"${title}" by ${author} throws us straight into a thrilling chase through narrow cobblestone streets as the sun sets over the harbour.`,
      `Our brave hero had discovered a crumpled map tucked inside an old library book. X marked a spot deep in the jungle — three days' journey away.`,
      `Day one: crossing the rope bridge over the roaring river. Day two: outsmarting the clever thieves who wanted the map. Day three: finding the entrance hidden behind a waterfall.`,
      `Inside the cave glittered something unexpected — not gold, not jewels, but an entire library of stories no one had ever told before.`,
      `"The greatest adventure," our hero read on the very last page of the very last book, "is always the one you haven't started yet."`,
    ];
  }

  if (hasGenre('science', 'educational', 'non-fiction')) {
    return [
      `"${title}" by ${author} is packed with fascinating facts that will make you see the world in a completely new way!`,
      `Did you know that trees talk to each other through underground networks of roots and fungi? Scientists call it the "Wood Wide Web."`,
      `Bees can recognise human faces, octopuses have three hearts, and a group of flamingos is called a flamboyance. Animals are truly amazing!`,
      `Space is so big that if you drove a car at 100 km/h towards the nearest star, Proxima Centauri, it would take over 45 million years to arrive.`,
      `Learning is like building a tower — every new fact is another brick. Keep reading, keep asking questions, and your tower of knowledge will touch the clouds!`,
    ];
  }

  if (hasGenre('fiction', "children's novel", 'classic')) {
    return [
      `"${title}" by ${author} introduces us to a character unlike anyone we have ever met — someone who sees the world a little differently than the rest.`,
      `At school, nobody seemed to understand our hero. But alone, with a stack of library books and an overactive imagination, anything was possible.`,
      `The day everything changed began with a dare — a dare to stand up, speak out, and tell the truth loudly, even if your voice shook.`,
      `From that day forward, friendships formed in unexpected places, and the quietest person in the room turned out to have the loudest heart.`,
      `By the final chapter, our hero had learned that being different is not a weakness — it is the thing that makes you unforgettable. And so can you be.`,
    ];
  }

  // Default fallback
  return [
    `"${title}" by ${author} opens in a world brimming with possibility, where every turn of the page reveals something new and wonderful.`,
    `Our story begins with a question — the kind of question that keeps you awake at night and pulls you out of bed in the morning to find the answer.`,
    `Along the way, our hero meets companions both expected and surprising: an old keeper of secrets, a mischievous little creature, and a puzzle no one has solved in a hundred years.`,
    `With each challenge faced, our hero grows a little braver, a little kinder, and a little wiser — discovering that the best adventures change you from the inside.`,
    `As the last words are read and the cover gently closes, a smile spreads across your face. Because this story, like all great stories, will stay with you forever.`,
  ];
}

const MIN_SIZE = 16;
const MAX_SIZE = 40;
const DEFAULT_SIZE = 24;

export default function ReadingView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(0);
  const [fontSize, setFontSize] = useState(DEFAULT_SIZE);

  useEffect(() => {
    let active = true;
    const fetchBook = async () => {
      try {
        const response = await bookService.getBookById(id);
        if (active && response.data?.book) {
          setBook(response.data.book);
        }
      } catch (err) {
        console.warn('Failed to fetch book', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchBook();
    return () => { active = false; };
  }, [id]);

  if (loading || !book) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: Colors.textMuted }}>Loading story...</Text>
      </SafeAreaView>
    );
  }

  const pages = getPages(book);
  const progress = (page + 1) / pages.length;

  return (
    <SafeAreaView style={s.safe}>
      {Platform.OS === 'web' && <NavBar role="child" active="home" />}

      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>

        <View style={s.titleWrap}>
          <Text style={s.bookTitle} numberOfLines={1}>{book.title}</Text>
        </View>

        {/* Font size controls */}
        <View style={s.sizeControls}>
          <TouchableOpacity
            style={s.sizeBtn}
            onPress={() => setFontSize(f => Math.max(MIN_SIZE, f - 2))}
          >
            <Text style={s.sizeBtnText}>A−</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.sizeBtn}
            onPress={() => setFontSize(f => Math.min(MAX_SIZE, f + 2))}
          >
            <Text style={s.sizeBtnText}>A+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Progress bar ── */}
      <View style={s.progressBar}>
        <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={s.progressLabel}>{page + 1} / {pages.length} pages</Text>

      {/* ── Page content — warm cream reading surface ── */}
      <View style={s.pageCard}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.pageContent}
        >
          <Text style={[s.pageText, { fontSize }]}>
            {pages[page]}
          </Text>
        </ScrollView>
      </View>

      {/* ── Navigation ── */}
      <View style={s.navRow}>
        <TouchableOpacity
          style={[s.navBtn, page === 0 && s.navBtnDisabled]}
          onPress={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
        >
          <Text style={s.navBtnText}>← Prev</Text>
        </TouchableOpacity>

        {/* Page dots */}
        <View style={s.dots}>
          {pages.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => setPage(i)}>
              <View
                style={[
                  s.dot,
                  i === page ? s.dotActive : i < page ? s.dotRead : s.dotUnread,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {page < pages.length - 1 ? (
          <TouchableOpacity style={s.navBtn} onPress={() => setPage(p => p + 1)}>
            <Text style={s.navBtnText}>Next →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.navBtn, { backgroundColor: Colors.accentSage }]}
            onPress={() => router.push(`/(child)/quiz/${book.id}`)}
          >
            <Text style={[s.navBtnText, { color: Colors.textOnDark }]}>Quiz! 🧠</Text>
          </TouchableOpacity>
        )}
      </View>

      {Platform.OS !== 'web' && <NavBar role="child" active="home" />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.readSurface },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center',
  },
  backText: { fontSize: 18, color: Colors.accentSage, fontWeight: '800' },
  titleWrap: { flex: 1 },
  bookTitle: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  sizeControls: { flexDirection: 'row', gap: 6 },
  sizeBtn: {
    backgroundColor: Colors.buttonPrimary, borderRadius: Radius.md,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  sizeBtnText: { fontSize: 13, fontWeight: '800', color: Colors.buttonPrimaryText },

  progressBar: {
    height: 6, backgroundColor: Colors.cardBorder,
    marginHorizontal: Spacing.md, borderRadius: Radius.full, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: Colors.accentSage, borderRadius: Radius.full,
  },
  progressLabel: {
    textAlign: 'center', fontSize: 12,
    color: Colors.textMuted, fontWeight: '600', marginVertical: 6,
  },

  pageCard: {
    flex: 1, marginHorizontal: Spacing.md, marginVertical: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.cardBorder,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.06)', elevation: 2,
  },
  pageContent: {
    padding: Spacing.xl, flexGrow: 1, justifyContent: 'center',
    minHeight: height * 0.48,
  },
  pageText: {
    color: Colors.textPrimary, lineHeight: 40, fontWeight: '500',
    textAlign: 'left', fontFamily: 'serif',
  },

  navRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.sm,
  },
  navBtn: {
    backgroundColor: Colors.buttonPrimary, borderRadius: Radius.full,
    paddingVertical: 12, paddingHorizontal: 20,
  },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontSize: 14, fontWeight: '800', color: Colors.buttonPrimaryText },
  dots: { flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  dotActive: { backgroundColor: Colors.accentSage, width: 20 },
  dotRead: { backgroundColor: Colors.accentSageLight },
  dotUnread: { backgroundColor: Colors.cardBorder },
});
