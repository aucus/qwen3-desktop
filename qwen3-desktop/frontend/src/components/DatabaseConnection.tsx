import React, { useState } from 'react';
import './DatabaseConnection.css';

interface DatabaseConnection {
  id: string;
  name: string;
  type: 'sqlite' | 'mysql' | 'postgresql';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  filePath?: string;
  isConnected: boolean;
  lastConnected?: string;
}

interface DatabaseConnectionProps {
  connections: DatabaseConnection[];
  activeConnection: DatabaseConnection | null;
  onConnect: (connection: Omit<DatabaseConnection, 'id' | 'isConnected' | 'lastConnected'>) => void;
  onDisconnect: (connectionId: string) => void;
  onSelectConnection: (connection: DatabaseConnection) => void;
}

export const DatabaseConnection: React.FC<DatabaseConnectionProps> = ({
  connections,
  activeConnection,
  onConnect,
  onDisconnect,
  onSelectConnection
}) => {
  const [showNewConnection, setShowNewConnection] = useState(false);
  const [connectionForm, setConnectionForm] = useState({
    name: '',
    type: 'sqlite' as const,
    host: '',
    port: 3306,
    database: '',
    username: '',
    password: '',
    filePath: ''
  });

  // 연결 폼 제출
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const connectionData = {
      name: connectionForm.name,
      type: connectionForm.type,
      host: connectionForm.host || undefined,
      port: connectionForm.port || undefined,
      database: connectionForm.database,
      username: connectionForm.username || undefined,
      password: connectionForm.password || undefined,
      filePath: connectionForm.filePath || undefined
    };

    onConnect(connectionData);
    setShowNewConnection(false);
    setConnectionForm({
      name: '',
      type: 'sqlite',
      host: '',
      port: 3306,
      database: '',
      username: '',
      password: '',
      filePath: ''
    });
  };

  // 폼 필드 변경
  const handleFormChange = (field: string, value: string | number) => {
    setConnectionForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 데이터베이스 타입별 기본 포트 설정
  const getDefaultPort = (type: string): number => {
    switch (type) {
      case 'mysql': return 3306;
      case 'postgresql': return 5432;
      default: return 3306;
    }
  };

  // 데이터베이스 타입별 아이콘
  const getDatabaseIcon = (type: string): string => {
    switch (type) {
      case 'sqlite': return '🗄️';
      case 'mysql': return '🐬';
      case 'postgresql': return '🐘';
      default: return '🗄️';
    }
  };

  // 연결 상태 아이콘
  const getConnectionStatusIcon = (isConnected: boolean): string => {
    return isConnected ? '🟢' : '🔴';
  };

  // 연결 시간 포맷팅
  const formatConnectionTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="database-connection">
      {/* 연결 목록 */}
      <div className="connection-list">
        <div className="list-header">
          <h4>데이터베이스 연결</h4>
          <button
            type="button"
            className="new-connection-btn"
            onClick={() => setShowNewConnection(true)}
          >
            ➕ 새 연결
          </button>
        </div>

        <div className="connections">
          {connections.length === 0 ? (
            <div className="empty-connections">
              <p>등록된 데이터베이스 연결이 없습니다.</p>
              <p>새 연결을 추가하여 시작하세요.</p>
            </div>
          ) : (
            connections.map((connection) => (
              <div
                key={connection.id}
                className={`connection-item ${activeConnection?.id === connection.id ? 'active' : ''} ${connection.isConnected ? 'connected' : 'disconnected'}`}
                onClick={() => onSelectConnection(connection)}
              >
                <div className="connection-info">
                  <div className="connection-header">
                    <span className="db-icon">{getDatabaseIcon(connection.type)}</span>
                    <span className="connection-name">{connection.name}</span>
                    <span className="status-icon">{getConnectionStatusIcon(connection.isConnected)}</span>
                  </div>
                  
                  <div className="connection-details">
                    <span className="db-type">{connection.type.toUpperCase()}</span>
                    <span className="db-name">{connection.database}</span>
                    {connection.host && (
                      <span className="db-host">{connection.host}:{connection.port}</span>
                    )}
                    {connection.filePath && (
                      <span className="db-file">{connection.filePath}</span>
                    )}
                  </div>

                  {connection.lastConnected && (
                    <div className="connection-time">
                      마지막 연결: {formatConnectionTime(connection.lastConnected)}
                    </div>
                  )}
                </div>

                <div className="connection-actions">
                  {connection.isConnected ? (
                    <button
                      type="button"
                      className="disconnect-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDisconnect(connection.id);
                      }}
                      title="연결 해제"
                    >
                      🔌
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="connect-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onConnect({
                          name: connection.name,
                          type: connection.type,
                          host: connection.host,
                          port: connection.port,
                          database: connection.database,
                          username: connection.username,
                          password: connection.password,
                          filePath: connection.filePath
                        });
                      }}
                      title="연결"
                    >
                      🔗
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 새 연결 폼 */}
      {showNewConnection && (
        <div className="new-connection-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h4>새 데이터베이스 연결</h4>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowNewConnection(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="connection-form">
              <div className="form-group">
                <label htmlFor="connection-name">연결 이름 *</label>
                <input
                  type="text"
                  id="connection-name"
                  value={connectionForm.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="예: 로컬 SQLite"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="connection-type">데이터베이스 타입 *</label>
                <select
                  id="connection-type"
                  value={connectionForm.type}
                  onChange={(e) => {
                    handleFormChange('type', e.target.value);
                    handleFormChange('port', getDefaultPort(e.target.value));
                  }}
                >
                  <option value="sqlite">SQLite</option>
                  <option value="mysql">MySQL</option>
                  <option value="postgresql">PostgreSQL</option>
                </select>
              </div>

              {connectionForm.type !== 'sqlite' && (
                <>
                  <div className="form-group">
                    <label htmlFor="connection-host">호스트</label>
                    <input
                      type="text"
                      id="connection-host"
                      value={connectionForm.host}
                      onChange={(e) => handleFormChange('host', e.target.value)}
                      placeholder="localhost"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="connection-port">포트</label>
                    <input
                      type="number"
                      id="connection-port"
                      value={connectionForm.port}
                      onChange={(e) => handleFormChange('port', parseInt(e.target.value))}
                      placeholder={getDefaultPort(connectionForm.type).toString()}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="connection-username">사용자명</label>
                    <input
                      type="text"
                      id="connection-username"
                      value={connectionForm.username}
                      onChange={(e) => handleFormChange('username', e.target.value)}
                      placeholder="root"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="connection-password">비밀번호</label>
                    <input
                      type="password"
                      id="connection-password"
                      value={connectionForm.password}
                      onChange={(e) => handleFormChange('password', e.target.value)}
                      placeholder="비밀번호"
                    />
                  </div>
                </>
              )}

              {connectionForm.type === 'sqlite' ? (
                <div className="form-group">
                  <label htmlFor="connection-file">데이터베이스 파일 경로</label>
                  <input
                    type="text"
                    id="connection-file"
                    value={connectionForm.filePath}
                    onChange={(e) => handleFormChange('filePath', e.target.value)}
                    placeholder="/path/to/database.db"
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="connection-database">데이터베이스 이름 *</label>
                  <input
                    type="text"
                    id="connection-database"
                    value={connectionForm.database}
                    onChange={(e) => handleFormChange('database', e.target.value)}
                    placeholder="mydatabase"
                    required
                  />
                </div>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowNewConnection(false)}
                >
                  취소
                </button>
                <button type="submit" className="connect-btn">
                  연결
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 연결 도움말 */}
      <div className="connection-help">
        <h5>연결 도움말</h5>
        <div className="help-content">
          <div className="help-item">
            <strong>SQLite:</strong> 파일 기반 데이터베이스로 별도의 서버 설정이 필요하지 않습니다.
          </div>
          <div className="help-item">
            <strong>MySQL:</strong> 기본 포트 3306, 사용자명과 비밀번호가 필요합니다.
          </div>
          <div className="help-item">
            <strong>PostgreSQL:</strong> 기본 포트 5432, 사용자명과 비밀번호가 필요합니다.
          </div>
        </div>
      </div>
    </div>
  );
};
