import React, { useState } from 'react';
import './SearchResults.css';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  timestamp: string;
}

interface SearchResultsProps {
  results: SearchResult[];
  loading: boolean;
  onResultClick: (url: string) => void;
  onFilter: (filterType: 'all' | 'recent' | 'reliable') => void;
  onSort: (sortBy: 'relevance' | 'date' | 'title') => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  loading,
  onResultClick,
  onFilter,
  onSort
}) => {
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // URL 도메인 추출
  const getDomain = (url: string): string => {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch {
      return url;
    }
  };

  // 상대 시간 포맷팅
  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

    if (diffInSeconds < 60) return '방금 전';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}일 전`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}개월 전`;
    return `${Math.floor(diffInSeconds / 31536000)}년 전`;
  };

  // 검색 결과 클릭 핸들러
  const handleResultClick = (result: SearchResult) => {
    setSelectedResult(result.url);
    onResultClick(result.url);
  };

  // 미리보기 토글
  const handlePreviewToggle = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewUrl === url) {
      setPreviewUrl(null);
      setShowPreview(false);
    } else {
      setPreviewUrl(url);
      setShowPreview(true);
    }
  };

  // 결과 복사
  const copyResult = (result: SearchResult, e: React.MouseEvent) => {
    e.stopPropagation();
    const resultText = `${result.title}\n${result.url}\n\n${result.snippet}`;
    navigator.clipboard.writeText(resultText);
  };

  // 결과 공유
  const shareResult = (result: SearchResult, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: result.title,
        url: result.url,
        text: result.snippet
      });
    } else {
      // 폴백: URL 복사
      navigator.clipboard.writeText(result.url);
    }
  };

  // 검색 결과 하이라이트
  const highlightText = (text: string, query?: string) => {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? <mark key={index}>{part}</mark> : part
    );
  };

  if (loading) {
    return (
      <div className="search-results">
        <div className="results-loading">
          <div className="loading-spinner"></div>
          <p>검색 결과를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="search-results">
        <div className="results-empty">
          <h4>검색 결과가 없습니다</h4>
          <p>다른 검색어를 시도해보세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="search-results">
      {/* 결과 헤더 */}
      <div className="results-header">
        <div className="results-info">
          <h4>검색 결과 ({results.length}개)</h4>
          <span className="results-source">검색 엔진: {results[0]?.source}</span>
        </div>
        
        <div className="results-controls">
          {/* 뷰 모드 토글 */}
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="목록 보기"
            >
              📋
            </button>
            <button
              type="button"
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="그리드 보기"
            >
              🔲
            </button>
          </div>

          {/* 필터 옵션 */}
          <div className="filter-options">
            <select
              onChange={(e) => onFilter(e.target.value as 'all' | 'recent' | 'reliable')}
              defaultValue="all"
            >
              <option value="all">모든 결과</option>
              <option value="recent">최신 결과</option>
              <option value="reliable">신뢰할 수 있는 결과</option>
            </select>
          </div>

          {/* 정렬 옵션 */}
          <div className="sort-options">
            <select
              onChange={(e) => onSort(e.target.value as 'relevance' | 'date' | 'title')}
              defaultValue="relevance"
            >
              <option value="relevance">관련성순</option>
              <option value="date">날짜순</option>
              <option value="title">제목순</option>
            </select>
          </div>
        </div>
      </div>

      {/* 결과 목록 */}
      <div className={`results-list ${viewMode}`}>
        {results.map((result, index) => (
          <div
            key={index}
            className={`result-item ${selectedResult === result.url ? 'selected' : ''}`}
            onClick={() => handleResultClick(result)}
          >
            <div className="result-header">
              <div className="result-title">
                <h3>{highlightText(result.title)}</h3>
                <span className="result-domain">{getDomain(result.url)}</span>
              </div>
              <div className="result-actions">
                <button
                  type="button"
                  className="action-btn preview-btn"
                  onClick={(e) => handlePreviewToggle(result.url, e)}
                  title="미리보기"
                >
                  👁️
                </button>
                <button
                  type="button"
                  className="action-btn copy-btn"
                  onClick={(e) => copyResult(result, e)}
                  title="복사"
                >
                  📋
                </button>
                <button
                  type="button"
                  className="action-btn share-btn"
                  onClick={(e) => shareResult(result, e)}
                  title="공유"
                >
                  📤
                </button>
              </div>
            </div>

            <div className="result-url">
              <a href={result.url} target="_blank" rel="noopener noreferrer">
                {result.url}
              </a>
            </div>

            <div className="result-snippet">
              {highlightText(result.snippet)}
            </div>

            <div className="result-meta">
              <span className="result-source">{result.source}</span>
              <span className="result-time">{formatRelativeTime(result.timestamp)}</span>
            </div>

            {/* 미리보기 */}
            {showPreview && previewUrl === result.url && (
              <div className="result-preview">
                <div className="preview-header">
                  <h5>미리보기</h5>
                  <button
                    type="button"
                    className="close-preview-btn"
                    onClick={(e) => handlePreviewToggle(result.url, e)}
                  >
                    ✕
                  </button>
                </div>
                <div className="preview-content">
                  <iframe
                    src={result.url}
                    title={result.title}
                    className="preview-iframe"
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 결과 요약 */}
      <div className="results-summary">
        <div className="summary-stats">
          <span>총 {results.length}개 결과</span>
          <span>검색 시간: {new Date().toLocaleTimeString()}</span>
        </div>
        
        <div className="summary-actions">
          <button
            type="button"
            className="export-btn"
            onClick={() => {
              const exportData = results.map(r => ({
                title: r.title,
                url: r.url,
                snippet: r.snippet,
                source: r.source,
                timestamp: r.timestamp
              }));
              const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'search_results.json';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
          >
            📥 결과 내보내기
          </button>
        </div>
      </div>
    </div>
  );
};
