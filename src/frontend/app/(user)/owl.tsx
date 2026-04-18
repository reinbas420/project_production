import { useState, useRef, useEffect } from 'react';
import { View, Text, Platform, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavBar, NAV_BOTTOM_PAD } from '@/components/NavBar';
import { ChatMessageText } from '@/components/ChatMessageText';
import { API_BASE_URL } from '@/constants/config';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import useAppStore from '@/store/useAppStore';
import {
  createInitialOwlConversation,
  getLatestOwlConversation,
  saveOwlConversation,
  OwlMessage,
} from '@/store/owlChatStore';
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

type Message = { id: string; role: 'model'|'user'; text: string };
const INITIAL_MESSAGE: Message = {
  id: '1',
  role: 'model',
  text: "Hoot! I'm Owl. How can I help you find your next great read today? 🦉",
};

function BouncingDots() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 350);
    return () => clearInterval(interval);
  }, []);
  return <Text style={{ fontSize: Typography.body, lineHeight: 22, color: Colors.accentSage, fontWeight: '800', letterSpacing: 2 }}>{dots || ' '}</Text>;
}

export default function OwlUserTab() {
  const { userId, activeProfileId, selectedBranchId, token } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [conversationId, setConversationId] = useState<string>(`conv_${Date.now()}`);
  const [conversationCreatedAt, setConversationCreatedAt] = useState<string>(new Date().toISOString());
  const [historyReady, setHistoryReady] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const bottomInset = Platform.OS === 'web' ? 0 : NAV_BOTTOM_PAD + 14;

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      const latest = await getLatestOwlConversation('user', userId, activeProfileId);
      if (cancelled) return;

      if (latest?.messages?.length) {
        setConversationId(latest.id);
        setConversationCreatedAt(latest.createdAt || new Date().toISOString());
        setMessages(latest.messages as Message[]);
      } else {
        const initialConversation = createInitialOwlConversation(INITIAL_MESSAGE as OwlMessage);
        setConversationId(initialConversation.id);
        setConversationCreatedAt(initialConversation.createdAt);
        setMessages(initialConversation.messages as Message[]);
      }

      setHistoryReady(true);
    };

    setHistoryReady(false);
    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [userId, activeProfileId]);

  useEffect(() => {
    if (!historyReady || !messages.length) return;
    saveOwlConversation('user', userId, activeProfileId, {
      id: conversationId,
      createdAt: conversationCreatedAt,
      updatedAt: new Date().toISOString(),
      messages: messages as OwlMessage[],
    });
  }, [messages, conversationId, conversationCreatedAt, historyReady, userId, activeProfileId]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    
    const newMessages: Message[] = [...messages, { id: Date.now().toString(), role: 'user', text: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    const messageId = Date.now().toString() + "_model";
    setMessages(prev => [...prev, { id: messageId, role: 'model', text: "" }]);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/books/chat/stream`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.onprogress = () => {
      const lines = xhr.responseText.split('\n');
      let currentParsedText = "";

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.substring(6).trim();
          if (dataStr === '[DONE]') break;
          if (!dataStr) continue;
          try {
            const parsed = JSON.parse(dataStr);
            currentParsedText += parsed.text;
          } catch (e) {
            // Incomplete JSON chunk, skip until next flush
          }
        }
      }

      if (currentParsedText) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, text: currentParsedText } : m));
      }
    };

    xhr.onload = () => {
      setLoading(false);
    };

    xhr.onerror = () => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, text: "Hoot! Something interrupted my flying. Can we try again? 🦉" } : m));
      setLoading(false);
    };

    xhr.send(JSON.stringify({ 
      messages: newMessages.map(m => ({ role: m.role, text: m.text })), 
      userId, 
      profileId: activeProfileId, 
      branchId: selectedBranchId 
    }));
  };

  return (
    <SafeAreaView style={s.safe}>
      {Platform.OS === 'web' && <NavBar role="user" active="owl" />}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, paddingBottom: bottomInset }}>
        
        <View style={s.header}>
          <Text style={s.headerTitle}>🦉 Chat with Owl</Text>
        </View>

        <ScrollView 
          ref={scrollRef}
          style={s.chatArea} 
          contentContainerStyle={{ padding: Spacing.xl, gap: Spacing.md }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m) => (
            <View key={m.id} style={[s.bubble, m.role === 'user' ? s.userBubble : s.modelBubble]}>
              {m.text === "" && m.role === 'model' ? (
                <BouncingDots />
              ) : m.role === 'model' ? (
                <ChatMessageText
                  text={m.text}
                  textStyle={s.msgText}
                  linkStyle={s.linkText}
                  boldStyle={s.boldText}
                  bookRouteBase="/(user)/book/"
                />
              ) : (
                <Text style={[s.msgText, m.role === 'user' ? s.userMsgText : undefined]}>{m.text}</Text>
              )}
            </View>
          ))}
        </ScrollView>

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="Ask Owl about books, your library, or reading..."
            placeholderTextColor={Colors.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity style={s.sendBtn} onPress={sendMessage} disabled={loading || !input.trim()}>
            <MaterialIcons name="send" size={20} color={Colors.textOnDark} />
          </TouchableOpacity>
        </View>
        
      </KeyboardAvoidingView>
      {Platform.OS !== 'web' && <NavBar role="user" active="owl" />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { 
    padding: Spacing.lg, 
    borderBottomWidth: 1, 
    borderBottomColor: Colors.cardBorder, 
    backgroundColor: Colors.card 
  },
  headerTitle: { fontSize: Typography.title, fontWeight: '800', color: Colors.accentSage },
  chatArea: { flex: 1 },
  bubble: { 
    maxWidth: '85%', 
    padding: Spacing.md, 
    borderRadius: Radius.lg 
  },
  modelBubble: { backgroundColor: Colors.card, alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.cardBorder },
  userBubble: { backgroundColor: Colors.accentSage, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  msgText: { fontSize: Typography.body, color: Colors.textPrimary, lineHeight: 22 },
  linkText: { color: Colors.accentSage, textDecorationLine: 'underline', fontWeight: '800' },
  boldText: { fontWeight: '800' },
  userMsgText: { color: Colors.textOnDark },
  inputRow: { 
    flexDirection: 'row', 
    padding: Spacing.md, 
    backgroundColor: Colors.card, 
    borderTopWidth: 1, 
    borderTopColor: Colors.cardBorder,
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    fontSize: Typography.body,
    color: Colors.textPrimary
  },
  sendBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accentSage,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
