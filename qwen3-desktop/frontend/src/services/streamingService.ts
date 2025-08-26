import { useAppStore } from '../stores/useAppStore';
import { apiService, ChatStreamChunk } from './apiService';
import { websocketService, WebSocketMessage } from './websocketService';

export interface StreamingMessage {
  id: string;
  content: string;
  isComplete: boolean;
  error?: string;
}

export class StreamingService {
  private static instance: StreamingService;
  private abortController: AbortController | null = null;
  private useWebSocket: boolean = false;

  static getInstance(): StreamingService {
    if (!StreamingService.instance) {
      StreamingService.instance = new StreamingService();
    }
    return StreamingService.instance;
  }

  constructor() {
    // WebSocket 연결 상태에 따라 전송 방식 결정
    this.useWebSocket = websocketService.isSocketConnected();
  }

  async streamResponse(
    conversationId: string,
    message: string,
    onChunk: (chunk: string) => void,
    onComplete: (fullResponse: string) => void,
    onError: (error: string) => void
  ): Promise<void> {
    // 이전 요청이 있다면 취소
    if (this.abortController) {
      this.abortController.abort();
    }

    this.abortController = new AbortController();

    try {
      if (this.useWebSocket && websocketService.isSocketConnected()) {
        await this.streamViaWebSocket(conversationId, message, onChunk, onComplete, onError);
      } else {
        await this.streamViaHTTP(conversationId, message, onChunk, onComplete, onError);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }
      
      console.error('Streaming error:', error);
      onError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.abortController = null;
    }
  }

  private async streamViaHTTP(
    conversationId: string,
    message: string,
    onChunk: (chunk: string) => void,
    onComplete: (fullResponse: string) => void,
    onError: (error: string) => void
  ): Promise<void> {
    const stream = await apiService.generateStreamResponse({
      message,
      conversation_id: conversationId,
    });

    const reader = stream.getReader();
    let fullResponse = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk: ChatStreamChunk = value;
        
        if (chunk.type === 'chunk') {
          fullResponse += chunk.content;
          onChunk(chunk.content);
        } else if (chunk.type === 'complete') {
          onComplete(fullResponse);
          return;
        } else if (chunk.type === 'error') {
          onError(chunk.content);
          return;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async streamViaWebSocket(
    conversationId: string,
    message: string,
    onChunk: (chunk: string) => void,
    onComplete: (fullResponse: string) => void,
    onError: (error: string) => void
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let fullResponse = '';
      const messageId = `chat_${Date.now()}_${Math.random()}`;

      // 응답 핸들러 등록
      const handleResponse = (wsMessage: WebSocketMessage) => {
        if (wsMessage.id === messageId) {
          if (wsMessage.type === 'chat') {
            const data = wsMessage.data;
            if (data.type === 'chunk') {
              fullResponse += data.content;
              onChunk(data.content);
            } else if (data.type === 'complete') {
              onComplete(fullResponse);
              websocketService.off('chat_response', handleResponse);
              resolve();
            } else if (data.type === 'error') {
              onError(data.content);
              websocketService.off('chat_response', handleResponse);
              reject(new Error(data.content));
            }
          }
        }
      };

      websocketService.on('chat_response', handleResponse);

      // 채팅 메시지 전송
      websocketService.sendChatMessage({
        message,
        conversation_id: conversationId,
      });

      // 타임아웃 설정
      setTimeout(() => {
        websocketService.off('chat_response', handleResponse);
        reject(new Error('WebSocket response timeout'));
      }, 30000);
    });
  }

  // 스트리밍 중단
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // 스트리밍 중인지 확인
  isStreaming(): boolean {
    return this.abortController !== null;
  }

  // WebSocket 사용 여부 설정
  setUseWebSocket(use: boolean): void {
    this.useWebSocket = use;
  }
}

// React Hook으로 사용하기 위한 래퍼
export const useStreaming = () => {
  const { addMessage, updateMessage, setLoading, setError } = useAppStore();
  const streamingService = StreamingService.getInstance();

  const sendMessage = async (conversationId: string, content: string) => {
    setLoading(true);
    setError(null);

    // 사용자 메시지 추가
    const userMessageId = addMessage(conversationId, {
      role: 'user',
      content,
      timestamp: new Date(),
    });

    // AI 응답 메시지 생성 (스트리밍용)
    const assistantMessageId = addMessage(conversationId, {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    });

    let fullResponse = '';

    try {
      await streamingService.streamResponse(
        conversationId,
        content,
        (chunk) => {
          fullResponse += chunk;
          // 스트리밍 중인 메시지 업데이트
          updateMessage(conversationId, assistantMessageId, {
            content: fullResponse,
          });
        },
        (completeResponse) => {
          // 스트리밍 완료
          updateMessage(conversationId, assistantMessageId, {
            content: completeResponse,
          });
          setLoading(false);
        },
        (error) => {
          // 에러 발생
          setError(error);
          updateMessage(conversationId, assistantMessageId, {
            content: `오류가 발생했습니다: ${error}`,
          });
          setLoading(false);
        }
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      setError('메시지 전송에 실패했습니다.');
      updateMessage(conversationId, assistantMessageId, {
        content: '메시지 전송에 실패했습니다.',
      });
      setLoading(false);
    }
  };

  const stopStreaming = () => {
    streamingService.abort();
    setLoading(false);
  };

  const setUseWebSocket = (use: boolean) => {
    streamingService.setUseWebSocket(use);
  };

  return {
    sendMessage,
    stopStreaming,
    setUseWebSocket,
    isStreaming: streamingService.isStreaming(),
  };
};

