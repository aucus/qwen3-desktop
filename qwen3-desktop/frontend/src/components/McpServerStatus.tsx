import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { McpMethodExecutor } from './McpMethodExecutor';
import './McpServerStatus.css';

interface McpServerStatusProps {
  serverName: string;
  onClose: () => void;
}

interface ServerInfo {
  name: string;
  enabled: boolean;
  running: boolean;
  status: string;
  config: any;
  available_methods: string[];
}

interface MethodInfo {
  name: string;
  description?: string;
  parameters?: any[];
  examples?: string[];
}

export const McpServerStatus: React.FC<McpServerStatusProps> = ({
  serverName,
  onClose
}) => {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'status' | 'methods' | 'config'>('status');

  // 서버 정보 로드
  const loadServerInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.callMCPMethod('mcp/get_server_info', { server_name: serverName });
      setServerInfo(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '서버 정보를 불러오는데 실패했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 초기 로드
  useEffect(() => {
    loadServerInfo();
  }, [serverName]);

  // 메서드 정보 가져오기
  const getMethodInfo = (methodName: string): MethodInfo => {
    const methodInfo: { [key: string]: MethodInfo } = {
      // 파일시스템 메서드들
      'filesystem/read': {
        name: '파일 읽기',
        description: '지정된 경로의 파일을 읽습니다.',
        parameters: [
          { name: 'path', type: 'string', required: true, description: '파일 경로' }
        ],
        examples: [
          'filesystem/read?path=/home/user/document.txt'
        ]
      },
      'filesystem/write': {
        name: '파일 쓰기',
        description: '지정된 경로에 파일을 씁니다.',
        parameters: [
          { name: 'path', type: 'string', required: true, description: '파일 경로' },
          { name: 'content', type: 'string', required: true, description: '파일 내용' },
          { name: 'overwrite', type: 'boolean', required: false, description: '덮어쓰기 여부' }
        ],
        examples: [
          'filesystem/write?path=/home/user/newfile.txt&content=Hello World'
        ]
      },
      'filesystem/list': {
        name: '디렉토리 나열',
        description: '지정된 디렉토리의 내용을 나열합니다.',
        parameters: [
          { name: 'path', type: 'string', required: false, description: '디렉토리 경로' },
          { name: 'include_hidden', type: 'boolean', required: false, description: '숨김 파일 포함' },
          { name: 'recursive', type: 'boolean', required: false, description: '재귀적 나열' }
        ],
        examples: [
          'filesystem/list?path=/home/user&include_hidden=true'
        ]
      },
      
      // 웹 검색 메서드들
      'web/search': {
        name: '웹 검색',
        description: '웹에서 정보를 검색합니다.',
        parameters: [
          { name: 'query', type: 'string', required: true, description: '검색 쿼리' },
          { name: 'engine', type: 'string', required: false, description: '검색 엔진' },
          { name: 'max_results', type: 'number', required: false, description: '최대 결과 수' }
        ],
        examples: [
          'web/search?query=Python programming&engine=google&max_results=5'
        ]
      },
      'web/browse': {
        name: 'URL 탐색',
        description: '지정된 URL의 내용을 가져옵니다.',
        parameters: [
          { name: 'url', type: 'string', required: true, description: '탐색할 URL' }
        ],
        examples: [
          'web/browse?url=https://example.com'
        ]
      },
      
      // 터미널 메서드들
      'terminal/execute': {
        name: '명령어 실행',
        description: '터미널 명령어를 실행합니다.',
        parameters: [
          { name: 'command', type: 'string', required: true, description: '실행할 명령어' },
          { name: 'timeout', type: 'number', required: false, description: '타임아웃 (초)' },
          { name: 'working_directory', type: 'string', required: false, description: '작업 디렉토리' }
        ],
        examples: [
          'terminal/execute?command=ls -la&timeout=30'
        ]
      },
      'terminal/list': {
        name: '명령어 목록',
        description: '사용 가능한 명령어 목록을 반환합니다.',
        parameters: [
          { name: 'type', type: 'string', required: false, description: '명령어 타입' }
        ],
        examples: [
          'terminal/list?type=basic'
        ]
      },
      
      // 데이터베이스 메서드들
      'database/query': {
        name: 'SQL 쿼리',
        description: 'SQL 쿼리를 실행합니다.',
        parameters: [
          { name: 'query', type: 'string', required: true, description: 'SQL 쿼리' },
          { name: 'database', type: 'string', required: false, description: '데이터베이스 이름' },
          { name: 'fetch_type', type: 'string', required: false, description: '결과 타입' }
        ],
        examples: [
          'database/query?query=SELECT * FROM users LIMIT 10'
        ]
      },
      'database/list': {
        name: '테이블 목록',
        description: '데이터베이스의 테이블 목록을 반환합니다.',
        parameters: [
          { name: 'database', type: 'string', required: false, description: '데이터베이스 이름' }
        ],
        examples: [
          'database/list?database=default'
        ]
      }
    };

    return methodInfo[methodName] || {
      name: methodName.split('/')[1] || methodName,
      description: 'MCP 메서드'
    };
  };

  // 새로고침
  const handleRefresh = () => {
    loadServerInfo();
  };

  // 메서드 선택
  const handleMethodSelect = (methodName: string) => {
    setSelectedMethod(methodName);
  };

  if (loading && !serverInfo) {
    return (
      <div className="mcp-server-status">
        <div className="status-header">
          <h3>{serverName} 서버</h3>
          <button type="button" className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="status-loading">
          <div className="loading-spinner"></div>
          <p>서버 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mcp-server-status">
        <div className="status-header">
          <h3>{serverName} 서버</h3>
          <button type="button" className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="status-error">
          <p>{error}</p>
          <button type="button" className="retry-btn" onClick={handleRefresh}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!serverInfo) {
    return null;
  }

  return (
    <div className="mcp-server-status">
      <div className="status-header">
        <h3>{serverName} 서버</h3>
        <div className="header-actions">
          <button 
            type="button" 
            className="refresh-btn"
            onClick={handleRefresh}
            title="새로고침"
          >
            🔄
          </button>
          <button type="button" className="close-btn" onClick={onClose}>✕</button>
        </div>
      </div>

      <div className="status-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => setActiveTab('status')}
        >
          상태
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'methods' ? 'active' : ''}`}
          onClick={() => setActiveTab('methods')}
        >
          메서드 ({serverInfo.available_methods?.length || 0})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          설정
        </button>
      </div>

      <div className="status-content">
        {activeTab === 'status' && (
          <div className="status-info">
            <div className="info-item">
              <label>상태:</label>
              <span className={`status-badge ${serverInfo.status}`}>
                {serverInfo.status === 'running' ? '실행 중' :
                 serverInfo.status === 'error' ? '오류' :
                 serverInfo.status === 'stopped' ? '중지됨' : '알 수 없음'}
              </span>
            </div>
            <div className="info-item">
              <label>활성화:</label>
              <span className={`enabled-badge ${serverInfo.enabled ? 'enabled' : 'disabled'}`}>
                {serverInfo.enabled ? '활성화됨' : '비활성화됨'}
              </span>
            </div>
            <div className="info-item">
              <label>메서드 수:</label>
              <span>{serverInfo.available_methods?.length || 0}개</span>
            </div>
            {serverInfo.config && (
              <div className="info-item">
                <label>설정:</label>
                <pre className="config-preview">
                  {JSON.stringify(serverInfo.config, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {activeTab === 'methods' && (
          <div className="methods-list">
            {serverInfo.available_methods?.map((method) => {
              const methodInfo = getMethodInfo(method);
              return (
                <div
                  key={method}
                  className={`method-item ${selectedMethod === method ? 'selected' : ''}`}
                  onClick={() => handleMethodSelect(method)}
                >
                  <div className="method-header">
                    <h4>{methodInfo.name}</h4>
                    <span className="method-name">{method}</span>
                  </div>
                  {methodInfo.description && (
                    <p className="method-description">{methodInfo.description}</p>
                  )}
                  {methodInfo.parameters && methodInfo.parameters.length > 0 && (
                    <div className="method-parameters">
                      <strong>매개변수:</strong>
                      <ul>
                        {methodInfo.parameters.map((param, index) => (
                          <li key={index}>
                            <code>{param.name}</code> ({param.type})
                            {param.required && <span className="required">*</span>}
                            {param.description && <span> - {param.description}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'config' && (
          <div className="config-details">
            <h4>서버 설정</h4>
            <pre className="config-json">
              {JSON.stringify(serverInfo.config, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {selectedMethod && (
        <div className="method-executor">
          <McpMethodExecutor
            methodName={selectedMethod}
            serverName={serverName}
            onClose={() => setSelectedMethod(null)}
          />
        </div>
      )}
    </div>
  );
};
