import React, { useState } from 'react';
import './McpToolCard.css';

interface McpServer {
  name: string;
  enabled: boolean;
  running: boolean;
  status: string;
  config: any;
  available_methods: string[];
}

interface McpToolCardProps {
  server: McpServer;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: (enabled: boolean) => void;
  onReload: () => void;
}

export const McpToolCard: React.FC<McpToolCardProps> = ({
  server,
  isSelected,
  onSelect,
  onToggle,
  onReload
}) => {
  const [showActions, setShowActions] = useState(false);

  // 서버 타입별 아이콘과 색상
  const getServerInfo = (serverName: string) => {
    const serverInfo = {
      filesystem: {
        icon: '📁',
        color: '#4CAF50',
        title: '파일시스템',
        description: '파일 및 디렉토리 관리'
      },
      web_search: {
        icon: '🌐',
        color: '#2196F3',
        title: '웹 검색',
        description: '웹 검색 및 URL 탐색'
      },
      terminal: {
        icon: '💻',
        color: '#FF9800',
        title: '터미널',
        description: '명령어 실행 및 시스템 관리'
      },
      database: {
        icon: '🗄️',
        color: '#9C27B0',
        title: '데이터베이스',
        description: 'SQL 쿼리 및 데이터 관리'
      }
    };

    return serverInfo[serverName as keyof typeof serverInfo] || {
      icon: '⚙️',
      color: '#607D8B',
      title: serverName,
      description: 'MCP 서버'
    };
  };

  const serverInfo = getServerInfo(server.name);

  // 상태별 스타일
  const getStatusStyle = () => {
    if (!server.enabled) {
      return { color: '#9E9E9E', backgroundColor: '#F5F5F5' };
    }
    
    switch (server.status) {
      case 'running':
        return { color: '#4CAF50', backgroundColor: '#E8F5E8' };
      case 'error':
        return { color: '#F44336', backgroundColor: '#FFEBEE' };
      case 'stopped':
        return { color: '#FF9800', backgroundColor: '#FFF3E0' };
      default:
        return { color: '#607D8B', backgroundColor: '#ECEFF1' };
    }
  };

  // 메서드 수 표시
  const methodCount = server.available_methods?.length || 0;

  // 토글 핸들러
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(!server.enabled);
  };

  // 재로드 핸들러
  const handleReload = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReload();
  };

  // 액션 토글 핸들러
  const handleActionToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowActions(!showActions);
  };

  return (
    <div 
      className={`mcp-tool-card ${isSelected ? 'selected' : ''} ${!server.enabled ? 'disabled' : ''}`}
      onClick={onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="card-header">
        <div className="server-icon" style={{ color: serverInfo.color }}>
          {serverInfo.icon}
        </div>
        <div className="server-info">
          <h4 className="server-title">{serverInfo.title}</h4>
          <p className="server-description">{serverInfo.description}</p>
        </div>
        <div className="card-actions">
          <button
            type="button"
            className={`toggle-btn ${server.enabled ? 'enabled' : 'disabled'}`}
            onClick={handleToggle}
            title={server.enabled ? '비활성화' : '활성화'}
          >
            {server.enabled ? '●' : '○'}
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={handleActionToggle}
            title="액션"
          >
            ⋯
          </button>
        </div>
      </div>

      <div className="card-content">
        <div className="server-status" style={getStatusStyle()}>
          <span className="status-indicator"></span>
          <span className="status-text">
            {!server.enabled ? '비활성화' : 
             server.status === 'running' ? '실행 중' :
             server.status === 'error' ? '오류' :
             server.status === 'stopped' ? '중지됨' : '알 수 없음'}
          </span>
        </div>

        <div className="server-methods">
          <span className="method-count">{methodCount}개 메서드</span>
          {methodCount > 0 && (
            <div className="method-preview">
              {server.available_methods?.slice(0, 3).map((method, index) => (
                <span key={index} className="method-tag">
                  {method.split('/')[1]}
                </span>
              ))}
              {methodCount > 3 && (
                <span className="method-more">+{methodCount - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {showActions && (
        <div className="card-actions-menu">
          <button
            type="button"
            className="action-menu-item"
            onClick={handleReload}
            title="서버 재로드"
          >
            🔄 재로드
          </button>
          <button
            type="button"
            className="action-menu-item"
            onClick={onSelect}
            title="상세 정보"
          >
            ℹ️ 상세 정보
          </button>
        </div>
      )}

      {isSelected && (
        <div className="card-selection-indicator">
          <div className="selection-arrow">▶</div>
        </div>
      )}
    </div>
  );
};
