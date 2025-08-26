import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { websocketService } from '../services/websocketService';

export interface ConnectionStatus {
  api: 'connected' | 'disconnected' | 'connecting' | 'error';
  websocket: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastCheck: Date | null;
  error: string | null;
}

export const useConnection = () => {
  const [status, setStatus] = useState<ConnectionStatus>({
    api: 'disconnected',
    websocket: 'disconnected',
    lastCheck: null,
    error: null,
  });

  const [isChecking, setIsChecking] = useState(false);

  // API 연결 상태 확인
  const checkApiConnection = useCallback(async () => {
    try {
      setStatus(prev => ({ ...prev, api: 'connecting' }));
      
      const health = await apiService.getHealth();
      
      if (health.status === 'healthy') {
        setStatus(prev => ({
          ...prev,
          api: 'connected',
          lastCheck: new Date(),
          error: null,
        }));
        return true;
      } else {
        throw new Error('API health check failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(prev => ({
        ...prev,
        api: 'error',
        lastCheck: new Date(),
        error: errorMessage,
      }));
      return false;
    }
  }, []);

  // WebSocket 연결 상태 확인
  const checkWebSocketConnection = useCallback(async () => {
    try {
      setStatus(prev => ({ ...prev, websocket: 'connecting' }));
      
      if (websocketService.isSocketConnected()) {
        setStatus(prev => ({
          ...prev,
          websocket: 'connected',
          lastCheck: new Date(),
          error: null,
        }));
        return true;
      } else {
        // WebSocket 연결 시도
        await websocketService.connect();
        
        if (websocketService.isSocketConnected()) {
          setStatus(prev => ({
            ...prev,
            websocket: 'connected',
            lastCheck: new Date(),
            error: null,
          }));
          return true;
        } else {
          throw new Error('WebSocket connection failed');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(prev => ({
        ...prev,
        websocket: 'error',
        lastCheck: new Date(),
        error: errorMessage,
      }));
      return false;
    }
  }, []);

  // 전체 연결 상태 확인
  const checkConnection = useCallback(async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    
    try {
      const [apiConnected, wsConnected] = await Promise.allSettled([
        checkApiConnection(),
        checkWebSocketConnection(),
      ]);

      const apiSuccess = apiConnected.status === 'fulfilled' && apiConnected.value;
      const wsSuccess = wsConnected.status === 'fulfilled' && wsConnected.value;

      if (!apiSuccess || !wsSuccess) {
        const errors = [];
        if (apiConnected.status === 'rejected') {
          errors.push(`API: ${apiConnected.reason}`);
        }
        if (wsConnected.status === 'rejected') {
          errors.push(`WebSocket: ${wsConnected.reason}`);
        }
        
        setStatus(prev => ({
          ...prev,
          error: errors.join(', '),
          lastCheck: new Date(),
        }));
      }
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, checkApiConnection, checkWebSocketConnection]);

  // WebSocket 연결
  const connectWebSocket = useCallback(async (clientId?: string) => {
    try {
      setStatus(prev => ({ ...prev, websocket: 'connecting' }));
      
      await websocketService.connect(clientId);
      
      if (websocketService.isSocketConnected()) {
        setStatus(prev => ({
          ...prev,
          websocket: 'connected',
          lastCheck: new Date(),
          error: null,
        }));
        return true;
      } else {
        throw new Error('WebSocket connection failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus(prev => ({
        ...prev,
        websocket: 'error',
        lastCheck: new Date(),
        error: errorMessage,
      }));
      return false;
    }
  }, []);

  // WebSocket 연결 해제
  const disconnectWebSocket = useCallback(() => {
    websocketService.disconnect();
    setStatus(prev => ({
      ...prev,
      websocket: 'disconnected',
      lastCheck: new Date(),
    }));
  }, []);

  // 연결 재시도
  const retryConnection = useCallback(async () => {
    setStatus(prev => ({
      ...prev,
      error: null,
    }));
    
    await checkConnection();
  }, [checkConnection]);

  // 초기 연결 확인
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // 주기적 연결 상태 확인 (30초마다)
  useEffect(() => {
    const interval = setInterval(() => {
      if (status.api === 'connected' && status.websocket === 'connected') {
        // 연결된 상태에서는 간단한 핑만
        websocketService.ping();
      } else {
        // 연결되지 않은 상태에서는 전체 확인
        checkConnection();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [status.api, status.websocket, checkConnection]);

  // WebSocket 이벤트 리스너
  useEffect(() => {
    const handleConnect = () => {
      setStatus(prev => ({
        ...prev,
        websocket: 'connected',
        lastCheck: new Date(),
        error: null,
      }));
    };

    const handleDisconnect = () => {
      setStatus(prev => ({
        ...prev,
        websocket: 'disconnected',
        lastCheck: new Date(),
      }));
    };

    const handleError = (error: any) => {
      setStatus(prev => ({
        ...prev,
        websocket: 'error',
        lastCheck: new Date(),
        error: error.message || 'WebSocket error',
      }));
    };

    websocketService.on('connect', handleConnect);
    websocketService.on('disconnect', handleDisconnect);
    websocketService.on('error', handleError);

    return () => {
      websocketService.off('connect', handleConnect);
      websocketService.off('disconnect', handleDisconnect);
      websocketService.off('error', handleError);
    };
  }, []);

  return {
    status,
    isChecking,
    checkConnection,
    connectWebSocket,
    disconnectWebSocket,
    retryConnection,
    isFullyConnected: status.api === 'connected' && status.websocket === 'connected',
  };
};
