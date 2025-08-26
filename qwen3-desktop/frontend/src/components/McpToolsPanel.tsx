import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { apiService } from '../services/apiService';
import { McpToolCard } from './McpToolCard';
import { McpServerStatus } from './McpServerStatus';
import './McpToolsPanel.css';

interface McpServer {
  name: string;
  enabled: boolean;
  running: boolean;
  status: string;
  config: any;
  available_methods: string[];
}

interface McpToolsPanelProps {
  className?: string;
}

export const McpToolsPanel: React.FC<McpToolsPanelProps> = ({ className = '' }) => {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // 서버 목록 로드
  const loadServers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.callMCPMethod('mcp/list_servers');
      setServers(response.servers || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '서버 목록을 불러오는데 실패했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 서버 상태 업데이트
  const updateServerStatus = async () => {
    try {
      const response = await apiService.callMCPMethod('mcp/get_server_status');
      if (response.servers) {
        setServers(prev => 
          prev.map(server => ({
            ...server,
            status: response.servers[server.name]?.status || 'unknown',
            running: response.servers[server.name]?.enabled || false
          }))
        );
      }
    } catch (err) {
      console.warn('Failed to update server status:', err);
    }
  };

  // 서버 활성화/비활성화
  const toggleServer = async (serverName: string, enabled: boolean) => {
    try {
      const method = enabled ? 'mcp/enable_server' : 'mcp/disable_server';
      await apiService.callMCPMethod(method, { server_name: serverName });
      
      // 서버 목록 새로고침
      await loadServers();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '서버 상태 변경에 실패했습니다.';
      setError(errorMessage);
    }
  };

  // 서버 재로드
  const reloadServer = async (serverName: string) => {
    try {
      await apiService.callMCPMethod('mcp/reload_server', { server_name: serverName });
      
      // 서버 목록 새로고침
      await loadServers();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '서버 재로드에 실패했습니다.';
      setError(errorMessage);
    }
  };

  // 초기 로드
  useEffect(() => {
    loadServers();
  }, []);

  // 주기적 상태 업데이트 (30초마다)
  useEffect(() => {
    const interval = setInterval(updateServerStatus, 30000);
    setRefreshInterval(interval);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  // 수동 새로고침
  const handleRefresh = () => {
    loadServers();
  };

  // 서버 선택
  const handleServerSelect = (serverName: string) => {
    setSelectedServer(serverName);
  };

  // 에러 해제
  const clearError = () => {
    setError(null);
  };

  if (loading && servers.length === 0) {
    return (
      <div className={`mcp-tools-panel ${className}`}>
        <div className="mcp-tools-header">
          <h3>MCP 도구</h3>
          <button 
            type="button" 
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={loading}
          >
            🔄
          </button>
        </div>
        <div className="mcp-tools-loading">
          <div className="loading-spinner"></div>
          <p>MCP 서버 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`mcp-tools-panel ${className}`}>
      <div className="mcp-tools-header">
        <h3>MCP 도구 ({servers.length})</h3>
        <button 
          type="button" 
          className="refresh-btn"
          onClick={handleRefresh}
          disabled={loading}
          title="새로고침"
        >
          🔄
        </button>
      </div>

      {error && (
        <div className="mcp-tools-error">
          <p>{error}</p>
          <button 
            type="button" 
            className="retry-btn"
            onClick={handleRefresh}
          >
            다시 시도
          </button>
          <button 
            type="button" 
            className="clear-btn"
            onClick={clearError}
          >
            ✕
          </button>
        </div>
      )}

      <div className="mcp-tools-content">
        {servers.length === 0 ? (
          <div className="mcp-tools-empty">
            <p>사용 가능한 MCP 서버가 없습니다.</p>
            <button 
              type="button" 
              className="retry-btn"
              onClick={handleRefresh}
            >
              새로고침
            </button>
          </div>
        ) : (
          <div className="mcp-servers-grid">
            {servers.map((server) => (
              <McpToolCard
                key={server.name}
                server={server}
                isSelected={selectedServer === server.name}
                onSelect={() => handleServerSelect(server.name)}
                onToggle={(enabled) => toggleServer(server.name, enabled)}
                onReload={() => reloadServer(server.name)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedServer && (
        <div className="mcp-server-details">
          <McpServerStatus 
            serverName={selectedServer}
            onClose={() => setSelectedServer(null)}
          />
        </div>
      )}

      {loading && servers.length > 0 && (
        <div className="mcp-tools-loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
    </div>
  );
};
