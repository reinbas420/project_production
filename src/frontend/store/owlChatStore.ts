import AsyncStorage from "@react-native-async-storage/async-storage";

export type OwlMessage = { id: string; role: "model" | "user"; text: string };

interface OwlConversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: OwlMessage[];
}

type OwlConversationMap = Record<string, OwlConversation[]>;

const OWL_CHAT_STORAGE_KEY = "@owl_chat_history_v1";
const MAX_CONVERSATIONS = 2;

function buildScopeKey(role: "user" | "child", userId?: string | null, profileId?: string | null) {
  return `${role}:${userId || "anon"}:${profileId || "none"}`;
}

async function readStore(): Promise<OwlConversationMap> {
  try {
    const raw = await AsyncStorage.getItem(OWL_CHAT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeStore(data: OwlConversationMap) {
  await AsyncStorage.setItem(OWL_CHAT_STORAGE_KEY, JSON.stringify(data));
}

export async function getLatestOwlConversation(
  role: "user" | "child",
  userId?: string | null,
  profileId?: string | null,
) {
  const key = buildScopeKey(role, userId, profileId);
  const store = await readStore();
  const conversations = store[key] || [];
  return conversations[0] || null;
}

export async function saveOwlConversation(
  role: "user" | "child",
  userId: string | null | undefined,
  profileId: string | null | undefined,
  conversation: OwlConversation,
) {
  const key = buildScopeKey(role, userId, profileId);
  const store = await readStore();
  const existing = store[key] || [];

  const now = new Date().toISOString();
  const normalized: OwlConversation = {
    ...conversation,
    updatedAt: now,
    createdAt: conversation.createdAt || now,
  };

  const others = existing.filter((item) => item.id !== normalized.id);
  store[key] = [normalized, ...others].slice(0, MAX_CONVERSATIONS);
  await writeStore(store);
}

export function createInitialOwlConversation(initialMessage: OwlMessage): OwlConversation {
  const now = new Date().toISOString();
  return {
    id: `conv_${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    messages: [initialMessage],
  };
}
