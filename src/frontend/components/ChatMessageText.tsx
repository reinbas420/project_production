import { Linking, StyleProp, Text, TextStyle, View } from 'react-native';
import { useRouter } from 'expo-router';

const INLINE_PATTERN = /\[\[BOOK:([^|\]]+)\|([^\]]+)\]\]|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;

type ChatMessageTextProps = {
  text: string;
  textStyle?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
  boldStyle?: StyleProp<TextStyle>;
  bookRouteBase: string;
};

function parseInlineSegments(text: string) {
  const segments: Array<
    | { type: 'text'; text: string }
    | { type: 'bold'; text: string }
    | { type: 'book'; id: string; label: string }
    | { type: 'link'; href: string; label: string }
  > = [];

  INLINE_PATTERN.lastIndex = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }

    if (match[1] && match[2]) {
      segments.push({ type: 'book', id: match[1], label: match[2] });
    } else if (match[3] && match[4]) {
      segments.push({ type: 'link', href: match[4], label: match[3] });
    } else if (match[5]) {
      segments.push({ type: 'bold', text: match[5] });
    }

    lastIndex = INLINE_PATTERN.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return segments;
}

function renderInline(text: string, router: ReturnType<typeof useRouter>, bookRouteBase: string, linkStyle?: StyleProp<TextStyle>, boldStyle?: StyleProp<TextStyle>, prefix = 'seg') {
  const segments = parseInlineSegments(text);
  return segments.map((segment, index) => {
    const key = `${prefix}-${index}`;

    if (segment.type === 'bold') {
      return <Text key={key} style={boldStyle}>{segment.text}</Text>;
    }

    if (segment.type === 'book') {
      return (
        <Text
          key={key}
          style={linkStyle}
          onPress={() => router.push(`${bookRouteBase}${segment.id}` as never)}
        >
          {segment.label}
        </Text>
      );
    }

    if (segment.type === 'link') {
      const href = segment.href.trim();
      const openHref = async () => {
        if (/^BOOK:/i.test(href)) {
          const id = href.replace(/^BOOK:/i, '').trim();
          if (id) {
            router.push(`${bookRouteBase}${id}` as never);
          }
          return;
        }

        try {
          await Linking.openURL(href);
        } catch {
          // Ignore invalid URLs.
        }
      };

      return (
        <Text key={key} style={linkStyle} onPress={openHref}>
          {renderInline(segment.label, router, bookRouteBase, linkStyle, boldStyle, `${key}-inner`)}
        </Text>
      );
    }

    return <Text key={key}>{segment.text}</Text>;
  });
}

export function ChatMessageText({
  text,
  textStyle,
  linkStyle,
  boldStyle,
  bookRouteBase,
}: ChatMessageTextProps) {
  const router = useRouter();
  const lines = String(text || '').split(/\r?\n/);

  return (
    <View>
      {lines.map((line, index) => {
        if (!line.trim()) {
          return <View key={`gap-${index}`} style={{ height: 8 }} />;
        }

        return (
          <Text key={`line-${index}`} style={textStyle}>
            {renderInline(line, router, bookRouteBase, linkStyle, boldStyle, `line-${index}`)}
          </Text>
        );
      })}
    </View>
  );
}
