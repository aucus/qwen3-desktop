import axios, { AxiosInstance, AxiosResponse } from 'axios';

// API 응답 타입 정의
export interface ChatRequest {
  message: string;
  conversation_id?: string;
  max_length?: number;
  temperature?: number;
  top_p?: number;
  system_prompt?: string;
}

export interface ChatResponse {
  response: string;
  conversation_id: string;
  model_info: {
    model_name: string;
    device: string;
    is_initialized: boolean;
    max_length: number;
    temperature: number;
    top_p: number;
    repetition_penalty: number;
    conversation_count: number;
  };
}

export interface ChatStreamRequest {
  message: string;
  conversation_id?: string;
  max_length?: number;
  temperature?: number;
  top_p?: number;
}

export interface ChatStreamChunk {
  type: 'chunk' | 'complete' | 'error';
  content: string;
  conversation_id?: string;
}

export interface ConversationHistory {
  conversation_id: string;
  history: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  message_count: number;
}

export interface ModelInfo {
  model_name: string;
  device: string;
  is_initialized: boolean;
  max_length: number;
  temperature: number;
  top_p: number;
  repetition_penalty: number;
  conversation_count: number;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  model_initialized: boolean;
  device: string;
  conversation_count: number;
}

export interface FileInfo {
  filename: string;
  size: number;
  content_type: string;
  path: string;
  uploaded_at: string;
}

export interface FileAnalysis {
  filename: string;
  content_type: string;
  size: number;
  line_count?: number;
  word_count?: number;
  preview?: string;
  width?: number;
  height?: number;
  mode?: string;
  format?: string;
  message?: string;
}

class ApiService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 요청 인터셉터
    this.api.interceptors.request.use(
      (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // 응답 인터셉터
    this.api.interceptors.response.use(
      (response) => {
        console.log(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('API Response Error:', error);
        return Promise.reject(error);
      }
    );
  }

  // 채팅 관련 API
  async generateResponse(request: ChatRequest): Promise<ChatResponse> {
    const response: AxiosResponse<ChatResponse> = await this.api.post('/chat/generate', request);
    return response.data;
  }

  async generateStreamResponse(request: ChatStreamRequest): Promise<ReadableStream<ChatStreamChunk>> {
    const response = await fetch(`${this.baseURL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    return new ReadableStream({
      start(controller) {
        const decoder = new TextDecoder();
        let buffer = '';

        function pump(): Promise<void> {
          return reader.read().then(({ done, value }) => {
            if (done) {
              controller.close();
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  controller.enqueue(data);
                } catch (e) {
                  console.error('Error parsing SSE data:', e);
                }
              }
            }

            return pump();
          });
        }

        return pump();
      },
    });
  }

  async getConversationHistory(conversationId: string): Promise<ConversationHistory> {
    const response: AxiosResponse<ConversationHistory> = await this.api.get(
      `/chat/conversations/${conversationId}/history`
    );
    return response.data;
  }

  async clearConversation(conversationId: string): Promise<{ message: string; conversation_id: string }> {
    const response: AxiosResponse<{ message: string; conversation_id: string }> = await this.api.delete(
      `/chat/conversations/${conversationId}`
    );
    return response.data;
  }

  async getModelInfo(): Promise<ModelInfo> {
    const response: AxiosResponse<ModelInfo> = await this.api.get('/chat/model/info');
    return response.data;
  }

  async reloadModel(): Promise<{ message: string; status: string }> {
    const response: AxiosResponse<{ message: string; status: string }> = await this.api.post('/chat/model/reload');
    return response.data;
  }

  async getChatHealth(): Promise<HealthStatus> {
    const response: AxiosResponse<HealthStatus> = await this.api.get('/chat/health');
    return response.data;
  }

  // 파일 관련 API
  async uploadFile(file: File, conversationId?: string): Promise<{
    filename: string;
    size: number;
    content_type: string;
    path: string;
    conversation_id?: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    if (conversationId) {
      formData.append('conversation_id', conversationId);
    }

    const response = await this.api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async listFiles(conversationId?: string, limit: number = 100): Promise<FileInfo[]> {
    const params = new URLSearchParams();
    if (conversationId) {
      params.append('conversation_id', conversationId);
    }
    params.append('limit', limit.toString());

    const response: AxiosResponse<FileInfo[]> = await this.api.get(`/files/list?${params.toString()}`);
    return response.data;
  }

  async downloadFile(filename: string, conversationId?: string): Promise<Blob> {
    const params = new URLSearchParams();
    if (conversationId) {
      params.append('conversation_id', conversationId);
    }

    const response = await this.api.get(`/files/download/${filename}?${params.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async deleteFile(filename: string, conversationId?: string): Promise<{ message: string }> {
    const params = new URLSearchParams();
    if (conversationId) {
      params.append('conversation_id', conversationId);
    }

    const response: AxiosResponse<{ message: string }> = await this.api.delete(
      `/files/${filename}?${params.toString()}`
    );
    return response.data;
  }

  async getFileInfo(filename: string, conversationId?: string): Promise<FileInfo> {
    const params = new URLSearchParams();
    if (conversationId) {
      params.append('conversation_id', conversationId);
    }

    const response: AxiosResponse<FileInfo> = await this.api.get(
      `/files/info/${filename}?${params.toString()}`
    );
    return response.data;
  }

  async analyzeFile(filename: string, conversationId?: string): Promise<FileAnalysis> {
    const params = new URLSearchParams();
    if (conversationId) {
      params.append('conversation_id', conversationId);
    }

    const response: AxiosResponse<FileAnalysis> = await this.api.post(
      `/files/analyze?${params.toString()}`,
      { filename }
    );
    return response.data;
  }

  // 헬스 체크 API
  async getHealth(): Promise<{ status: string; timestamp: string; service: string }> {
    const response: AxiosResponse<{ status: string; timestamp: string; service: string }> = await this.api.get('/health');
    return response.data;
  }

  async getDetailedHealth(): Promise<any> {
    const response: AxiosResponse<any> = await this.api.get('/health/detailed');
    return response.data;
  }

  async getReadiness(): Promise<any> {
    const response: AxiosResponse<any> = await this.api.get('/health/ready');
    return response.data;
  }

  async getLiveness(): Promise<any> {
    const response: AxiosResponse<any> = await this.api.get('/health/live');
    return response.data;
  }

  // MCP 관련 API
  async callMCPMethod(method: string, params?: any, server?: string): Promise<any> {
    const response: AxiosResponse<any> = await this.api.post('/mcp/call', {
      method,
      params,
      server,
    });
    return response.data;
  }

  async listMCPServers(): Promise<any[]> {
    const response: AxiosResponse<any[]> = await this.api.get('/mcp/servers');
    return response.data;
  }

  async getMCPServerInfo(serverName: string): Promise<any> {
    const response: AxiosResponse<any> = await this.api.get(`/mcp/servers/${serverName}/info`);
    return response.data;
  }

  async connectMCPServer(serverName: string): Promise<{ message: string }> {
    const response: AxiosResponse<{ message: string }> = await this.api.post(`/mcp/servers/${serverName}/connect`);
    return response.data;
  }

  async disconnectMCPServer(serverName: string): Promise<{ message: string }> {
    const response: AxiosResponse<{ message: string }> = await this.api.post(`/mcp/servers/${serverName}/disconnect`);
    return response.data;
  }

  async getMCPStatus(): Promise<any> {
    const response: AxiosResponse<any> = await this.api.get('/mcp/status');
    return response.data;
  }

  async handleMCPMessage(message: any): Promise<any> {
    const response: AxiosResponse<any> = await this.api.post('/mcp/handle', message);
    return response.data;
  }

  // 유틸리티 메서드
  getBaseURL(): string {
    return this.baseURL;
  }

  setBaseURL(url: string): void {
    this.baseURL = url;
    this.api.defaults.baseURL = url;
  }
}

// 싱글톤 인스턴스 생성
export const apiService = new ApiService();
export default apiService;
