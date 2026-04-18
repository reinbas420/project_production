import bookService from '@/api/services/bookService';
import { NavBar, NAV_BOTTOM_PAD } from '@/components/NavBar';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height } = Dimensions.get('window');

// ─── Sample adult chapter content ─────────────────────────────────────────────
// In production, replace with book.content / fetched chapter text.
const SAMPLE_CHAPTERS = [
  {
    title: 'Chapter 1 — The Beginning',
    text: `The city never really slept. Even past midnight, the hum of distant traffic seeped through the walls of Marcus's apartment like a tide that refused to fully recede. He sat at his desk, the glow of a single lamp pooling over the open pages of a journal whose handwriting he was only just learning to decipher.

It had been three weeks since the envelope arrived — no return address, no postmark he could trace. Inside: three pages of densely handwritten notes and a brass key that fit no lock he had ever seen. His colleague Priya had suggested the university archives. His instinct said otherwise.

He poured another cup of coffee, the fourth of the evening, and turned to page two.

The handwriting was a man's — angular, with compressed ascenders and a habit of looping back on the letter g that suggested, to Marcus's unscientific eye, someone who had learned to write in the mid-twentieth century. The ink had faded to a warm brown, the colour of dried oak leaves.

He had spent the first week assuming the envelope was a prank. Some of his graduate students had a sense of humour that expressed itself in elaborate set-pieces, and a mysterious letter felt exactly like their register. He had even mentioned it, half-laughing, at the departmental drinks. No one had claimed credit. The silence that followed the mention was of a particular quality — not the silence of ignorance but the silence of people filing something away.

That had unsettled him more than the letter itself.

By the second week he had begun to take it seriously, photographing the pages and running the handwriting through two separate analysis tools, both of which agreed it was authentic, which is to say: not machine-produced, not recently aged, consistent across all three pages. The paper, when he had located a retired conservator willing to look at a digital scan, dated to somewhere between 1955 and 1975.

The third week he had done nothing. He had marked essays, attended two committee meetings, eaten lunch alone in his office three times in a row, and tried very hard to put the key out of his mind. The key, naturally, had refused to be put anywhere.

It was a small thing, perhaps four centimetres long, made of brass that had once been polished to brightness and was now matte with age. There was a number stamped into its bow — 114 — and beneath the number, in letters so small he needed a jeweller's loupe, a word he had only recently managed to read: *Whitmore.*

He knew the Whitmore. Everyone in the department knew the Whitmore.

He poured his coffee, turned to page two, and began, finally, to read with the full weight of his attention.`,
  },
  {
    title: 'Chapter 2 — The Archive',
    text: `The special collections room on the fourth floor of Whitmore Library smelled of cedar and old paper, a combination that Marcus had always found oddly reassuring. The archivist, a slight woman named Dr. Okonkwo, regarded him over half-moon spectacles as he slid the photocopied pages across the reading desk.

"Where did you get these?" she asked, her voice betraying nothing.

"A posthumous letter," Marcus said. It was close enough to the truth.

She studied the pages for a long time without speaking. Outside, rain had begun to fall against the tall windows, and the radiator ticked. When she finally looked up, her expression had shifted into something Marcus could not quite name — not alarm, but its quieter cousin.

"These reference a collection that was deaccessioned in 1987," she said carefully. "On paper, at least."

"On paper at least," Marcus repeated. He let the implication sit in the air between them.

Dr. Okonkwo set down the pages. She removed her spectacles and polished them with the hem of her cardigan, a gesture Marcus recognised as a thinking gesture, not a housekeeping one. He had students who did the same thing with their pens.

"Mr. Veltri," she said at last. "I have been in this building for twenty-six years. In that time I have seen two people come looking for what you appear to be looking for. The first one, I told to go away. The second one, I helped, and she published a monograph that caused a great deal of embarrassment to three living people and two institutions that are still operational." She paused. "I was quietly asked, after that, to exercise better judgement."

"And yet you're still talking to me."

"I am still talking to you," she agreed, "because the woman who wrote that monograph died last year, and because she left me a letter in which she described, among other things, sending a brass key to someone she had never met and explaining that if that person came to find me, I should help them."

Marcus felt the back of his neck go cold.

"You knew her."

"I knew her very well. We met here, over these same pages, nearly thirty years ago." Dr. Okonkwo stood. "Come with me. There are stairs that aren't on the building map."`,
  },
  {
    title: 'Chapter 3 — What the Key Opens',
    text: `Sub-basement storage was not on any map of the building that Marcus had ever seen. Dr. Okonkwo led him down two flights of stairs that grew progressively narrower, past pipes painted the dusty green of old institutions, to a door that looked as though it had not been opened in a generation.

The brass key turned.

Inside, a single overhead bulb came to life — someone, at some point, had wired a motion sensor. The room was perhaps four metres square, the walls lined floor to ceiling with archival boxes, each one labelled in the same handwriting he had spent three weeks puzzling over.

Marcus reached for the nearest box. His hands were not entirely steady.

The first document inside was a letter dated the fourteenth of November, 1962. It was addressed to the university's then-chancellor. Its opening line read: *The following must not be made public while any living person named herein still breathes.*

All of the people named, Marcus would later confirm, had been dead for at least twenty years.

He worked through the first three boxes with the systematic focus he usually reserved for translating particularly difficult passages — reading once for sense, once for structure, once for what was not said. Dr. Okonkwo did not read over his shoulder. She sat in the single chair beside the door, her hands folded in her lap, and watched the door.

The documents described, in the flat administrative language of mid-century academia, a series of decisions. Grant allocations redirected. Committee memberships rearranged. Recommendations quietly withdrawn. Individually, each decision might have been defensible. In aggregate, over a period of perhaps eleven years, they described something else entirely — a sustained and deliberate effort to keep certain people in certain places and prevent certain others from ever arriving.

"How many people knew about this room?" Marcus asked.

"Myself. The woman who sent you the key. And the man who built it." She paused. "And now you."

Marcus looked around at sixty years of sealed boxes in the quiet sub-basement and felt the specific weight of things that have been kept secret not through destruction but through patience — the arrogance of those who believe the past, given enough time, simply ceases to matter.

He photographed everything, working methodically, box by box. By the time they climbed back into the light it was nearly three in the afternoon and he had not eaten since breakfast. Neither of them mentioned it.`,
  },
  {
    title: 'Chapter 4 — The Names',
    text: `He worked through the night, photographing every page with his phone, careful not to disturb the order of the documents. Dr. Okonkwo brought tea at two in the morning without being asked, left it on the reading cart, and asked no questions that he was not prepared to answer.

By four a.m. a shape had emerged from the documents, the way a figure emerges from fog not all at once but in parts and pieces until one moment it is simply there, wholly present, impossible to un-see.

The shape was this: a decision made jointly by seven individuals across three institutions, a decision that had redirected significant public funds and, in doing so, had quietly unmade at least three other people's lives. Not dramatically. Not violently. In the slow, administrative way that leaves no fingerprints.

There were names — seven of them, repeated across the documents in different combinations like the cast of a play rehearsed across many years. Marcus recognised two of them immediately: a former university president who had a building named after him, and a government minister who had died in the late nineties to considerable public mourning. The others took until half past five and two additional cups of tea to track through the various indexes and cross-references.

All seven were dead. He wrote the last date of death in his notebook — 2019 — and underlined it three times.

"Is it better," he asked Dr. Okonkwo, who was on her fourth or fifth round of tea and showed no signs of fatigue, "that they're all gone?"

She considered the question with the seriousness it deserved. "It is better for you," she said. "It may be less good for the people who were affected. In my experience, justice and convenience rarely keep the same schedule."

Marcus looked at the brass key on the table beside his notes. There was, he now understood, a second lock somewhere. The woman who had sent the key had spent thirty years assembling this room. She had not done it so that it could stay assembled.

She had done it so that the right person would, at the right time, take it apart.

"There are names here I don't recognise," he said. "Institutional names. Committees that don't seem to exist anymore."

"They were renamed," Dr. Okonkwo said. "Twice. The second name is the one currently written on the door of a building on the north side of this campus." She let that land. "Some of the people downstream of this are not dead. Some of them are still, as the phrase goes, very much with us."

Marcus set down his pen. Outside, the first grey suggestion of dawn was beginning to appear in the high basement windows. Somewhere between the third and fourth cup of tea, the situation had changed from personally interesting to something considerably larger.`,
  },
  {
    title: 'Chapter 5 — An Unexpected Ally',
    text: `He found her number in the third box, tucked inside a letter that referenced her by her maiden name. Nadia Voss — now Nadia Reinholt — taught comparative literature at a college in Edinburgh. She answered on the second ring, despite the time difference, as though she had been expecting the call.

"I wondered when someone would turn up," she said. Her accent was careful and mid-Atlantic, the kind that forms in people who have lived in too many places to belong to any of them. "I thought it might take longer."

"You knew about the documents?"

"I knew about the key. My father sent it to you — or rather, to whoever came looking. He died last spring."

Marcus closed his eyes. *Posthumous letter.*

"Will you talk to me?"

A pause. The particular quality of silence on a long-distance call. Then: "Come to Edinburgh. Bring everything you've photographed. And Mr. Veltri — do not send copies to anyone. Not yet. Some of the people downstream of all this are still very much alive, and they are not the kind who accept inconvenience gracefully."

"How did you know my name?"

"My father's letter described the kind of person who would follow the trail. Careful. Academically trained. Probably not a journalist — too patient for that, too interested in structure. He left the key with a forwarding arrangement that would trace who requested the building records at Whitmore, which I am told you did, about two weeks ago."

Marcus thought about his visit to the records office, the routine request he had made almost without thinking, the clerk who had taken slightly longer than necessary to process it. He thought about all the things that had felt like privacy that had, in fact, been observation.

"He planned this very carefully," Marcus said.

"He planned this for thirty years," Nadia replied. There was something in her voice that was not quite grief and not quite pride but occupied the territory between them. "He spent the last decade of his life ensuring that when the time was right, the right doors would open for the right person. He was, in many ways, a very methodical man."

The line went quiet. Marcus sat in the sub-basement of Whitmore Library surrounded by sixty years of secrets, feeling the weight of being, apparently, the right person. Outside, the city was waking up — traffic thickening, the first sounds of the day filtering down through concrete and pipe.

"I'll come to Edinburgh," he said.

"Good." A pause. "One more thing. There is a seventh name on that list — the one you could not identify. The institution it refers to still exists. The name it operates under now is different, but Mr. Veltri, two of its current board members were directly appointed by the families of two people on that original list." Another pause. "I mention this only so that you understand we are not dealing with history. We are dealing with the present, which has taken a very long time to arrange itself into the shape it currently occupies."

The line went dead. Marcus sat for a long time without moving.

Then he opened his laptop and booked a flight to Edinburgh.`,
  },
];

const MIN_FONT = 14;
const MAX_FONT = 26;
const DEFAULT_FONT = 17;

export default function AdultReadingView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chapter, setChapter] = useState(0);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT);

  useEffect(() => {
    let active = true;
    bookService.getBookById(id).then((res) => {
      if (active && res?.data?.book) setBook(res.data.book);
    }).catch(err => {
      console.warn('Failed to fetch book for reading', err);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  const progress = (chapter + 1) / SAMPLE_CHAPTERS.length;
  const current = SAMPLE_CHAPTERS[chapter];

  if (loading || !book) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: Colors.textMuted }}>Loading…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {Platform.OS === 'web' && <NavBar role="user" active="home" />}

      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>

        <View style={s.titleWrap}>
          <Text style={s.bookTitle} numberOfLines={1}>{book.title}</Text>
        </View>

        <View style={s.sizeControls}>
          <TouchableOpacity
            style={s.sizeBtn}
            onPress={() => setFontSize(f => Math.max(MIN_FONT, f - 1))}
          >
            <Text style={s.sizeBtnText}>A−</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.sizeBtn}
            onPress={() => setFontSize(f => Math.min(MAX_FONT, f + 1))}
          >
            <Text style={s.sizeBtnText}>A+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Progress bar ── */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* ── Chapter label ── */}
      <Text style={s.chapterLabel}>{current.title}</Text>

      {/* ── Reading area ── */}
      <View style={s.readCard}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.readContent}
        >
          {current.text.split('\n\n').map((para, i) => (
            <Text
              key={i}
              style={[s.bodyText, { fontSize, lineHeight: fontSize * 1.75 }]}
            >
              {para.trim()}
            </Text>
          ))}
        </ScrollView>
      </View>

      {/* ── Chapter navigation ── */}
      <View style={s.navRow}>
        <TouchableOpacity
          style={[s.navBtn, chapter === 0 && s.navBtnDisabled]}
          onPress={() => setChapter(c => Math.max(0, c - 1))}
          disabled={chapter === 0}
        >
          <Text style={s.navBtnText}>← Prev</Text>
        </TouchableOpacity>

        <Text style={s.navProgress}>
          {chapter + 1} / {SAMPLE_CHAPTERS.length}
        </Text>

        {chapter < SAMPLE_CHAPTERS.length - 1 ? (
          <TouchableOpacity
            style={s.navBtn}
            onPress={() => setChapter(c => c + 1)}
          >
            <Text style={s.navBtnText}>Next →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.navBtn, { backgroundColor: Colors.accentSage }]}
            onPress={() => router.back()}
          >
            <Text style={[s.navBtnText, { color: Colors.textOnDark }]}>Finish ✓</Text>
          </TouchableOpacity>
        )}
      </View>
      {Platform.OS !== 'web' && <NavBar role="user" active="home" />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.readSurface },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: Radius.full,
    backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  backText: { fontSize: 18, color: Colors.accentSage, fontWeight: '700' },
  titleWrap: { flex: 1, paddingHorizontal: Spacing.sm },
  bookTitle: {
    fontSize: Typography.label + 1, fontWeight: '600',
    color: Colors.textSecondary, fontStyle: 'italic',
  },
  sizeControls: { flexDirection: 'row', gap: 4 },
  sizeBtn: {
    paddingHorizontal: 8, paddingVertical: 6,
    backgroundColor: Colors.card, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  sizeBtnText: { fontSize: 12, fontWeight: '700', color: Colors.accentSage },

  progressTrack: {
    height: 3, backgroundColor: Colors.cardBorder, marginHorizontal: Spacing.md,
    borderRadius: Radius.full, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: Colors.accentSage, borderRadius: Radius.full,
  },

  chapterLabel: {
    fontSize: Typography.label + 1, fontWeight: '700', color: Colors.accentSage,
    textAlign: 'center', paddingVertical: Spacing.sm,
    letterSpacing: 0.3,
  },

  readCard: {
    flex: 1, marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  readContent: {
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
    gap: Spacing.md,
    minHeight: height * 0.5,
  },
  bodyText: {
    color: Colors.textPrimary,
    fontFamily: 'serif',
    fontWeight: '400',
    textAlign: 'left',
  },

  navRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  navBtn: {
    backgroundColor: Colors.buttonPrimary, borderRadius: Radius.full,
    paddingVertical: 11, paddingHorizontal: Spacing.lg,
  },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontSize: Typography.label + 1, fontWeight: '800', color: Colors.buttonPrimaryText },
  navProgress: {
    fontSize: Typography.label, color: Colors.textMuted,
    fontWeight: '600', textAlign: 'center', flex: 1,
  },
});
