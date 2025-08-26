import React, { useState, useRef, useEffect } from 'react';
import './QueryExecutor.css';

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

interface QueryExecutorProps {
  connection: DatabaseConnection;
  onExecuteQuery: (query: string) => void;
  loading: boolean;
}

export const QueryExecutor: React.FC<QueryExecutorProps> = ({
  connection,
  onExecuteQuery,
  loading
}) => {
  const [query, setQuery] = useState<string>('');
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [showQueryTemplates, setShowQueryTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [autoComplete, setAutoComplete] = useState<string[]>([]);
  const [showAutoComplete, setShowAutoComplete] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<number>(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // SQL 키워드 자동완성
  const sqlKeywords = [
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER',
    'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'SCHEMA', 'JOIN', 'LEFT', 'RIGHT', 'INNER',
    'OUTER', 'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT',
    'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'AS', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN',
    'LIKE', 'IS NULL', 'IS NOT NULL', 'UNION', 'ALL', 'EXISTS', 'CASE', 'WHEN', 'THEN',
    'ELSE', 'END', 'IF', 'NULL', 'TRUE', 'FALSE', 'ASC', 'DESC'
  ];

  // 쿼리 템플릿
  const queryTemplates = {
    'SELECT 기본': 'SELECT * FROM table_name LIMIT 10;',
    'SELECT 조건': 'SELECT column1, column2 FROM table_name WHERE condition;',
    'INSERT': 'INSERT INTO table_name (column1, column2) VALUES (value1, value2);',
    'UPDATE': 'UPDATE table_name SET column1 = value1 WHERE condition;',
    'DELETE': 'DELETE FROM table_name WHERE condition;',
    'CREATE TABLE': 'CREATE TABLE table_name (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL,\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);',
    'JOIN': 'SELECT t1.column1, t2.column2\nFROM table1 t1\nJOIN table2 t2 ON t1.id = t2.id;',
    'GROUP BY': 'SELECT column1, COUNT(*) as count\nFROM table_name\nGROUP BY column1;',
    '서브쿼리': 'SELECT * FROM table1\nWHERE column1 IN (SELECT column1 FROM table2 WHERE condition);',
    'UNION': 'SELECT column1 FROM table1\nUNION\nSELECT column1 FROM table2;'
  };

  // 쿼리 실행
  const handleExecuteQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      // 쿼리 히스토리에 추가
      setQueryHistory(prev => {
        const newHistory = [query, ...prev.filter(q => q !== query)];
        return newHistory.slice(0, 50); // 최대 50개 유지
      });
      
      onExecuteQuery(query.trim());
      setQuery('');
      setHistoryIndex(-1);
    }
  };

  // 키보드 단축키 처리
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (historyIndex < queryHistory.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setQuery(queryHistory[newIndex]);
          }
        }
        break;
      case 'ArrowDown':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setQuery(queryHistory[newIndex]);
          } else if (historyIndex === 0) {
            setHistoryIndex(-1);
            setQuery('');
          }
        }
        break;
      case 'Tab':
        e.preventDefault();
        if (showAutoComplete && autoComplete.length > 0) {
          const selected = autoComplete[0];
          insertTextAtCursor(selected);
          setShowAutoComplete(false);
        } else {
          insertTextAtCursor('  '); // 2칸 들여쓰기
        }
        break;
      case 'Escape':
        setShowAutoComplete(false);
        setShowQueryTemplates(false);
        break;
    }
  };

  // 커서 위치에 텍스트 삽입
  const insertTextAtCursor = (text: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const newQuery = query.substring(0, start) + text + query.substring(end);
      setQuery(newQuery);
      
      // 커서 위치 업데이트
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + text.length;
          textareaRef.current.selectionEnd = start + text.length;
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  // 자동완성 제안 생성
  const generateAutoComplete = (input: string, position: number) => {
    const beforeCursor = input.substring(0, position);
    const words = beforeCursor.split(/\s+/);
    const currentWord = words[words.length - 1] || '';
    
    if (currentWord.length > 0) {
      const suggestions = sqlKeywords.filter(keyword =>
        keyword.toLowerCase().startsWith(currentWord.toLowerCase())
      );
      setAutoComplete(suggestions);
      setShowAutoComplete(suggestions.length > 0);
    } else {
      setShowAutoComplete(false);
    }
  };

  // 텍스트 변경 처리
  const handleQueryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setCursorPosition(e.target.selectionStart);
    generateAutoComplete(newQuery, e.target.selectionStart);
  };

  // 템플릿 선택
  const selectTemplate = (templateKey: string) => {
    const template = queryTemplates[templateKey as keyof typeof queryTemplates];
    setQuery(template);
    setSelectedTemplate(templateKey);
    setShowQueryTemplates(false);
  };

  // 쿼리 포맷팅
  const formatQuery = () => {
    // 간단한 SQL 포맷팅 (실제로는 더 정교한 포맷터 사용 권장)
    let formatted = query
      .replace(/\s+/g, ' ')
      .replace(/\s*([,()])\s*/g, '$1 ')
      .replace(/\s*([=<>!])\s*/g, ' $1 ')
      .replace(/\s*(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|JOIN|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|UNION|AND|OR|NOT|IN|BETWEEN|LIKE|IS NULL|IS NOT NULL|EXISTS|CASE|WHEN|THEN|ELSE|END|IF|ASC|DESC)\s+/gi, '\n$1 ')
      .trim();
    
    setQuery(formatted);
  };

  // 쿼리 지우기
  const clearQuery = () => {
    setQuery('');
    setHistoryIndex(-1);
  };

  // 쿼리 복사
  const copyQuery = () => {
    if (query.trim()) {
      navigator.clipboard.writeText(query);
    }
  };

  // 자동완성 항목 클릭
  const handleAutoCompleteClick = (suggestion: string) => {
    insertTextAtCursor(suggestion);
    setShowAutoComplete(false);
  };

  return (
    <div className="query-executor">
      {/* 쿼리 입력 영역 */}
      <div className="query-input-section">
        <div className="input-header">
          <h4>SQL 쿼리 실행</h4>
          <div className="input-controls">
            <button
              type="button"
              className="template-btn"
              onClick={() => setShowQueryTemplates(!showQueryTemplates)}
              title="쿼리 템플릿"
            >
              📋
            </button>
            <button
              type="button"
              className="format-btn"
              onClick={formatQuery}
              title="쿼리 포맷팅"
            >
              🔧
            </button>
            <button
              type="button"
              className="copy-btn"
              onClick={copyQuery}
              disabled={!query.trim()}
              title="쿼리 복사"
            >
              📋
            </button>
            <button
              type="button"
              className="clear-btn"
              onClick={clearQuery}
              disabled={!query.trim()}
              title="쿼리 지우기"
            >
              🗑️
            </button>
          </div>
        </div>

        <form onSubmit={handleExecuteQuery} className="query-form">
          <div className="query-input-container">
            <textarea
              ref={textareaRef}
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              placeholder="SQL 쿼리를 입력하세요..."
              className="query-textarea"
              disabled={loading}
              autoFocus
            />
            
            {/* 자동완성 드롭다운 */}
            {showAutoComplete && (
              <div className="autocomplete-dropdown">
                {autoComplete.map((suggestion, index) => (
                  <div
                    key={index}
                    className="autocomplete-item"
                    onClick={() => handleAutoCompleteClick(suggestion)}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="query-actions">
            <button
              type="submit"
              className="execute-btn"
              disabled={loading || !query.trim()}
            >
              {loading ? (
                <div className="loading-spinner"></div>
              ) : (
                '실행'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 쿼리 템플릿 */}
      {showQueryTemplates && (
        <div className="query-templates">
          <h5>쿼리 템플릿</h5>
          <div className="templates-grid">
            {Object.entries(queryTemplates).map(([key, template]) => (
              <div
                key={key}
                className={`template-item ${selectedTemplate === key ? 'selected' : ''}`}
                onClick={() => selectTemplate(key)}
              >
                <div className="template-name">{key}</div>
                <div className="template-preview">{template.split('\n')[0]}...</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 연결 정보 */}
      <div className="connection-info">
        <h5>연결 정보</h5>
        <div className="info-grid">
          <div className="info-item">
            <label>연결 이름:</label>
            <span>{connection.name}</span>
          </div>
          <div className="info-item">
            <label>데이터베이스 타입:</label>
            <span>{connection.type.toUpperCase()}</span>
          </div>
          <div className="info-item">
            <label>데이터베이스:</label>
            <span>{connection.database}</span>
          </div>
          {connection.host && (
            <div className="info-item">
              <label>호스트:</label>
              <span>{connection.host}:{connection.port}</span>
            </div>
          )}
          {connection.filePath && (
            <div className="info-item">
              <label>파일 경로:</label>
              <span>{connection.filePath}</span>
            </div>
          )}
        </div>
      </div>

      {/* 키보드 단축키 도움말 */}
      <div className="keyboard-shortcuts">
        <h5>단축키</h5>
        <div className="shortcuts-list">
          <span>Ctrl+↑/↓: 쿼리 히스토리 탐색</span>
          <span>Tab: 자동완성/들여쓰기</span>
          <span>Esc: 자동완성/템플릿 닫기</span>
          <span>Ctrl+Enter: 쿼리 실행</span>
        </div>
      </div>

      {/* 쿼리 히스토리 미리보기 */}
      {queryHistory.length > 0 && (
        <div className="query-history-preview">
          <h5>최근 쿼리</h5>
          <div className="history-list">
            {queryHistory.slice(0, 5).map((historyQuery, index) => (
              <div
                key={index}
                className="history-item"
                onClick={() => setQuery(historyQuery)}
              >
                <div className="history-preview">{historyQuery.substring(0, 50)}...</div>
                <button
                  type="button"
                  className="use-history-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuery(historyQuery);
                  }}
                >
                  사용
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
