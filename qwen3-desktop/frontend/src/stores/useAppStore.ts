import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  systemPrompt?: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  modelSettings: {
    temperature: number;
    maxTokens: number;
    topP: number;
  };
  mcpSettings: {
    enabledServers: string[];
    autoConnect: boolean;
  };
}

interface AppState {
  // 대화 관리
  conversations: Conversation[];
  currentConversationId: string | null;
  
  // 앱 설정
  settings: AppSettings;
  
  // UI 상태
  isLoading: boolean;
  error: string | null;
  
  // 액션
  createConversation: (title?: string) => void;
  deleteConversation: (id: string) => void;
  setCurrentConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (conversationId: string, messageId: string, content: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 초기 상태
      conversations: [],
      currentConversationId: null,
      settings: {
        theme: 'system',
        language: 'ko',
        modelSettings: {
          temperature: 0.7,
          maxTokens: 2048,
          topP: 0.9,
        },
        mcpSettings: {
          enabledServers: [],
          autoConnect: true,
        },
      },
      isLoading: false,
      error: null,

      // 액션
      createConversation: (title = '새 대화') => {
        const newConversation: Conversation = {
          id: Date.now().toString(),
          title,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        set((state) => ({
          conversations: [newConversation, ...state.conversations],
          currentConversationId: newConversation.id,
        }));
      },

      deleteConversation: (id: string) => {
        set((state) => {
          const filteredConversations = state.conversations.filter(
            (conv) => conv.id !== id
          );
          const newCurrentId = state.currentConversationId === id 
            ? (filteredConversations[0]?.id || null)
            : state.currentConversationId;
          
          return {
            conversations: filteredConversations,
            currentConversationId: newCurrentId,
          };
        });
      },

      setCurrentConversation: (id: string) => {
        set({ currentConversationId: id });
      },

      addMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp'>) => {
        const newMessage: Message = {
          ...message,
          id: Date.now().toString(),
          timestamp: new Date(),
        };

        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, newMessage],
                  updatedAt: new Date(),
                }
              : conv
          ),
        }));
      },

      updateMessage: (conversationId: string, messageId: string, content: string) => {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages: conv.messages.map((msg) =>
                    msg.id === messageId ? { ...msg, content } : msg
                  ),
                  updatedAt: new Date(),
                }
              : conv
          ),
        }));
      },

      updateSettings: (newSettings: Partial<AppSettings>) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },
    }),
    {
      name: 'qwen3-desktop-storage',
      partialize: (state) => ({
        conversations: state.conversations,
        currentConversationId: state.currentConversationId,
        settings: state.settings,
      }),
    }
  )
);
