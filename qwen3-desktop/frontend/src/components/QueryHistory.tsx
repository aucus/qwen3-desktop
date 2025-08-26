import React, { useState } from 'react';
import './QueryHistory.css';

interface QueryResult {
  id: string;
  query: string;
  result: any;
  error?: string;
  executionTime: number;
  timestamp: string;
  rowCount?: number;
  columns?: string[];
}

interface QueryHistoryProps {
  history: QueryResult[];
  onRepeatQuery: (query: string) => void;
  onDeleteHistory: (queryId: string) => void;
  onClearHistory: () => void;
}

export const QueryHistory: React.FC<QueryHistoryProps> = ({
  history,
  onRepeatQuery,
  onDeleteHistory,
  onClearHistory
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'success' | 'error'>('all');
  const [sortBy, setSortBy] = useState<'time' | 'duration' | 'rows'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<QueryResult | null>(null);

  // 검색 및 필터링
  const filteredHistory = history.filter(result => {
    const matchesSearch = result.query.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || 
      (filterType === 'success' && !result.error) ||
      (filterType === 'error' && result.error);
    
    return matchesSearch && matchesFilter;
  });

  // 정렬된 히스토리
  const sortedHistory = [...filteredHistory].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'time':
        comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        break;
      case 'duration':
        comparison = a.executionTime - b.executionTime;
        break;
      case 'rows':
        comparison = (a.rowCount || 0) - (b.rowCount || 0);
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // 쿼리 타입 분류
  const getQueryType = (query: string): string => {
    const trimmedQuery = query.trim().toLowerCase();
    if (trimmedQuery.startsWith('select')) return 'SELECT';
    if (trimmedQuery.startsWith('insert')) return 'INSERT';
    if (trimmedQuery.startsWith('update')) return 'UPDATE';
    if (trimmedQuery.startsWith('delete')) return 'DELETE';
    if (trimmedQuery.startsWith('create')) return 'CREATE';
    if (trimmedQuery.startsWith('drop')) return 'DROP';
    if (trimmedQuery.startsWith('alter')) return 'ALTER';
    return 'OTHER';
  };

  // 쿼리 타입별 아이콘
  const getQueryTypeIcon = (queryType: string): string => {
    const icons: { [key: string]: string } = {
      'SELECT': '🔍',
      'INSERT': '➕',
      'UPDATE': '✏️',
      'DELETE': '🗑️',
      'CREATE': '🏗️',
      'DROP': '💥',
      'ALTER': '🔧',
      'OTHER': '⚙️'
    };
    return icons[queryType] || '⚙️';
  };

  // 실행 시간 포맷팅
  const formatExecutionTime = (duration: number): string => {
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${(duration / 60000).toFixed(1)}m`;
  };

  // 결과 요약 생성
  const getResultSummary = (result: QueryResult): string => {
    if (result.error) {
      return `오류: ${result.error.substring(0, 50)}...`;
    }
    
    if (result.rowCount !== undefined) {
      return `${result.rowCount.toLocaleString()} 행 반환`;
    }
    
    if (result.result && Array.isArray(result.result)) {
      return `${result.result.length} 행 반환`;
    }
    
    return '쿼리 실행 완료';
  };

  // 쿼리 복사
  const copyQuery = (query: string) => {
    navigator.clipboard.writeText(query);
  };

  // 결과 복사
  const copyResult = (result: QueryResult) => {
    const resultText = JSON.stringify(result.result, null, 2);
    navigator.clipboard.writeText(resultText);
  };

  // 삭제 확인
  const handleDeleteConfirm = (queryId: string) => {
    if (showDeleteConfirm === queryId) {
      onDeleteHistory(queryId);
      setShowDeleteConfirm(null);
    } else {
      setShowDeleteConfirm(queryId);
    }
  };

  // 히스토리 통계 계산
  const getHistoryStats = () => {
    const totalQueries = history.length;
    const successfulQueries = history.filter(h => !h.error).length;
    const failedQueries = totalQueries - successfulQueries;
    const totalExecutionTime = history.reduce((sum, h) => sum + h.executionTime, 0);
    const avgExecutionTime = totalQueries > 0 ? totalExecutionTime / totalQueries : 0;
    
    return {
      total: totalQueries,
      successful: successfulQueries,
      failed: failedQueries,
      avgExecutionTime: formatExecutionTime(avgExecutionTime)
    };
  };

  const stats = getHistoryStats();

  return (
    <div className="query-history">
      {/* 히스토리 헤더 */}
      <div className="history-header">
        <h4>쿼리 히스토리 ({history.length}개)</h4>
        <div className="header-actions">
          <button
            type="button"
            className="clear-all-btn"
            onClick={onClearHistory}
            disabled={history.length === 0}
          >
            전체 삭제
          </button>
        </div>
      </div>

      {/* 히스토리 통계 */}
      <div className="history-stats">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">총 쿼리</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-value">{stats.successful}</div>
            <div className="stat-label">성공</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">❌</div>
          <div className="stat-content">
            <div className="stat-value">{stats.failed}</div>
            <div className="stat-label">실패</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏱️</div>
          <div className="stat-content">
            <div className="stat-value">{stats.avgExecutionTime}</div>
            <div className="stat-label">평균 실행시간</div>
          </div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="history-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="쿼리 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-controls">
          <div className="filter-type">
            <label>필터:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
            >
              <option value="all">모든 쿼리</option>
              <option value="success">성공한 쿼리</option>
              <option value="error">실패한 쿼리</option>
            </select>
          </div>
          
          <div className="sort-controls">
            <label>정렬:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="time">시간순</option>
              <option value="duration">실행시간순</option>
              <option value="rows">행 수순</option>
            </select>
            <button
              type="button"
              className="sort-order-btn"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              title={`${sortOrder === 'asc' ? '내림차순' : '오름차순'} 정렬`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* 히스토리 목록 */}
      <div className="history-list">
        {sortedHistory.length === 0 ? (
          <div className="empty-history">
            {searchQuery || filterType !== 'all' ? (
              <p>검색 결과가 없습니다.</p>
            ) : (
              <p>쿼리 히스토리가 없습니다.</p>
            )}
          </div>
        ) : (
          sortedHistory.map((result) => {
            const queryType = getQueryType(result.query);
            
            return (
              <div
                key={result.id}
                className={`history-item ${selectedResult?.id === result.id ? 'selected' : ''} ${result.error ? 'error' : 'success'}`}
                onClick={() => setSelectedResult(result)}
              >
                <div className="item-header">
                  <div className="item-info">
                    <span className="query-type-icon">{getQueryTypeIcon(queryType)}</span>
                    <span className="query-type">{queryType}</span>
                    <span className="execution-time">({formatExecutionTime(result.executionTime)})</span>
                    {result.error && <span className="error-indicator">❌</span>}
                  </div>
                  
                  <div className="item-actions">
                    <button
                      type="button"
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyQuery(result.query);
                      }}
                      title="쿼리 복사"
                    >
                      📋
                    </button>
                    <button
                      type="button"
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRepeatQuery(result.query);
                      }}
                      title="재실행"
                    >
                      🔄
                    </button>
                    <button
                      type="button"
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConfirm(result.id);
                      }}
                      title="삭제"
                    >
                      {showDeleteConfirm === result.id ? '✓' : '❌'}
                    </button>
                  </div>
                </div>

                <div className="query-display">
                  <code className="query-text">{result.query}</code>
                </div>

                <div className="result-summary">
                  {getResultSummary(result)}
                </div>

                <div className="item-meta">
                  <span className="timestamp">
                    {new Date(result.timestamp).toLocaleString()}
                  </span>
                  {result.rowCount !== undefined && (
                    <span className="row-count">{result.rowCount.toLocaleString()} 행</span>
                  )}
                  {result.columns && (
                    <span className="column-count">{result.columns.length} 컬럼</span>
                  )}
                </div>

                {/* 삭제 확인 메시지 */}
                {showDeleteConfirm === result.id && (
                  <div className="delete-confirmation">
                    <p>이 쿼리를 히스토리에서 삭제하시겠습니까?</p>
                    <div className="confirmation-actions">
                      <button
                        type="button"
                        className="confirm-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConfirm(result.id);
                        }}
                      >
                        삭제
                      </button>
                      <button
                        type="button"
                        className="cancel-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(null);
                        }}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 선택된 결과 상세 정보 */}
      {selectedResult && (
        <div className="result-details">
          <h5>쿼리 결과 상세</h5>
          <div className="details-grid">
            <div className="detail-item">
              <label>쿼리:</label>
              <code className="query-full">{selectedResult.query}</code>
            </div>
            <div className="detail-item">
              <label>실행 시간:</label>
              <span>{formatExecutionTime(selectedResult.executionTime)}</span>
            </div>
            <div className="detail-item">
              <label>실행 시간:</label>
              <span>{new Date(selectedResult.timestamp).toLocaleString()}</span>
            </div>
            {selectedResult.rowCount !== undefined && (
              <div className="detail-item">
                <label>반환된 행:</label>
                <span>{selectedResult.rowCount.toLocaleString()}</span>
              </div>
            )}
            {selectedResult.columns && (
              <div className="detail-item">
                <label>컬럼:</label>
                <span>{selectedResult.columns.join(', ')}</span>
              </div>
            )}
            {selectedResult.error && (
              <div className="detail-item error">
                <label>오류:</label>
                <span className="error-message">{selectedResult.error}</span>
              </div>
            )}
          </div>

          {!selectedResult.error && selectedResult.result && (
            <div className="result-preview">
              <h6>결과 미리보기</h6>
              <div className="preview-controls">
                <button
                  type="button"
                  className="copy-result-btn"
                  onClick={() => copyResult(selectedResult)}
                >
                  결과 복사
                </button>
              </div>
              <pre className="result-json">
                {JSON.stringify(selectedResult.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* 히스토리 내보내기 */}
      <div className="history-export">
        <button
          type="button"
          className="export-btn"
          onClick={() => {
            const exportData = {
              history: history,
              exportTime: new Date().toISOString(),
              stats: stats
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'query_history.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
          disabled={history.length === 0}
        >
          📥 히스토리 내보내기
        </button>
      </div>
    </div>
  );
};
