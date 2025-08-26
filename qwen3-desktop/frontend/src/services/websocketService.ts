import { io, Socket } from 'socket.io-client';

export interface WebSocketMessage {
  type: 'chat' | 'mcp' | 'system' | 'error';
  data: any;
  timestamp: number;
  id?: string;
}

export interface ChatMessage {
  message: string;
  conversation_id?: string;
  max_length?: number;
  temperature?: number;
  top_p?: number;
}

export interface MCPMessage {
  method: string;
  params?: any;
  server?: string;
}

export interface SystemMessage {
  action: 'ping' | 'pong' | 'status' | 'reconnect';
  data?: any;
}

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  private messageQueue: WebSocketMessage[] = [];
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_WS_BASE_URL || 'http://localhost:8000';
  }

  // 연결 관리
  async connect(clientId?: string): Promise<void> {
    if (this.socket && this.isConnected) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      const url = clientId ? `${this.baseURL}/ws/${clientId}` : `${this.baseURL}/ws`;
      
      this.socket = io(url, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: this.maxReconnectAttempts,
      });

      this.setupEventHandlers();
      
      return new Promise((resolve, reject) => {
        if (!this.socket) {
          reject(new Error('Socket initialization failed'));
          return;
        }

        this.socket.on('connect', () => {
          console.log('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.flushMessageQueue();
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          this.isConnected = false;
          reject(error);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('WebSocket disconnected:', reason);
          this.isConnected = false;
          
          if (reason === 'io server disconnect') {
            // 서버에서 연결을 끊은 경우
            this.socket?.connect();
          }
        });
      });
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log('WebSocket disconnected');
    }
  }

  // 이벤트 핸들러 설정
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('message', (data: WebSocketMessage) => {
      console.log('Received WebSocket message:', data);
      this.handleMessage(data);
    });

    this.socket.on('chat_response', (data: any) => {
      this.emit('chat_response', {
        type: 'chat',
        data,
        timestamp: Date.now(),
      });
    });

    this.socket.on('mcp_response', (data: any) => {
      this.emit('mcp_response', {
        type: 'mcp',
        data,
        timestamp: Date.now(),
      });
    });

    this.socket.on('system_message', (data: any) => {
      this.emit('system_message', {
        type: 'system',
        data,
        timestamp: Date.now(),
      });
    });

    this.socket.on('error', (error: any) => {
      console.error('WebSocket error:', error);
      this.emit('error', {
        type: 'error',
        data: error,
        timestamp: Date.now(),
      });
    });
  }

  // 메시지 전송
  sendMessage(message: WebSocketMessage): void {
    if (!this.isConnected || !this.socket) {
      console.log('WebSocket not connected, queuing message');
      this.messageQueue.push(message);
      return;
    }

    try {
      this.socket.emit('message', message);
      console.log('Sent WebSocket message:', message);
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
      this.messageQueue.push(message);
    }
  }

  // 채팅 메시지 전송
  sendChatMessage(chatMessage: ChatMessage): void {
    const message: WebSocketMessage = {
      type: 'chat',
      data: chatMessage,
      timestamp: Date.now(),
      id: `chat_${Date.now()}_${Math.random()}`,
    };
    this.sendMessage(message);
  }

  // MCP 메시지 전송
  sendMCPMessage(mcpMessage: MCPMessage): void {
    const message: WebSocketMessage = {
      type: 'mcp',
      data: mcpMessage,
      timestamp: Date.now(),
      id: `mcp_${Date.now()}_${Math.random()}`,
    };
    this.sendMessage(message);
  }

  // 시스템 메시지 전송
  sendSystemMessage(systemMessage: SystemMessage): void {
    const message: WebSocketMessage = {
      type: 'system',
      data: systemMessage,
      timestamp: Date.now(),
      id: `system_${Date.now()}_${Math.random()}`,
    };
    this.sendMessage(message);
  }

  // 이벤트 리스너 관리
  on(event: string, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, message: WebSocketMessage): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    this.emit(message.type, message);
  }

  // 메시지 큐 처리
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  // 상태 확인
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  getConnectionState(): string {
    if (!this.socket) return 'disconnected';
    return this.socket.connected ? 'connected' : 'connecting';
  }

  // 핑/퐁
  ping(): void {
    this.sendSystemMessage({
      action: 'ping',
      data: { timestamp: Date.now() },
    });
  }

  // 상태 요청
  requestStatus(): void {
    this.sendSystemMessage({
      action: 'status',
    });
  }

  // 재연결 요청
  requestReconnect(): void {
    this.sendSystemMessage({
      action: 'reconnect',
    });
  }

  // 설정 업데이트
  updateBaseURL(url: string): void {
    this.baseURL = url;
  }

  // 연결 통계
  getStats(): {
    isConnected: boolean;
    reconnectAttempts: number;
    messageQueueLength: number;
    eventHandlerCount: number;
  } {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      messageQueueLength: this.messageQueue.length,
      eventHandlerCount: Array.from(this.eventHandlers.values()).reduce(
        (total, handlers) => total + handlers.length,
        0
      ),
    };
  }
}

// 싱글톤 인스턴스 생성
export const websocketService = new WebSocketService();
export default websocketService;
