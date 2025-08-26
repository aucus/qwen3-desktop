import React, { useState } from 'react';
import './SearchInterface.css';

interface SearchFilters {
  timeRange: string;
  region: string;
  language: string;
  safeSearch: boolean;
}

interface SearchInterfaceProps {
  searchQuery: string;
  searchEngine: string;
  searchFilters: SearchFilters;
  maxResults: number;
  loading: boolean;
  onSearchQueryChange: (query: string) => void;
  onSearchEngineChange: (engine: string) => void;
  onSearchFiltersChange: (filters: Partial<SearchFilters>) => void;
  onMaxResultsChange: (max: number) => void;
  onSearch: (query: string, engine?: string) => void;
}

export const SearchInterface: React.FC<SearchInterfaceProps> = ({
  searchQuery,
  searchEngine,
  searchFilters,
  maxResults,
  loading,
  onSearchQueryChange,
  onSearchEngineChange,
  onSearchFiltersChange,
  onMaxResultsChange,
  onSearch
}) => {
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 검색 엔진 옵션
  const searchEngines = [
    { value: 'google', name: 'Google', icon: '🔍' },
    { value: 'bing', name: 'Bing', icon: '🔎' },
    { value: 'duckduckgo', name: 'DuckDuckGo', icon: '🦆' },
    { value: 'youtube', name: 'YouTube', icon: '📺' },
    { value: 'wikipedia', name: 'Wikipedia', icon: '📚' },
    { value: 'github', name: 'GitHub', icon: '💻' },
    { value: 'stackoverflow', name: 'Stack Overflow', icon: '💡' }
  ];

  // 시간 범위 옵션
  const timeRanges = [
    { value: 'any', label: '모든 시간' },
    { value: 'day', label: '지난 24시간' },
    { value: 'week', label: '지난 주' },
    { value: 'month', label: '지난 달' },
    { value: 'year', label: '지난 해' }
  ];

  // 지역 옵션
  const regions = [
    { value: 'global', label: '전 세계' },
    { value: 'kr', label: '한국' },
    { value: 'us', label: '미국' },
    { value: 'jp', label: '일본' },
    { value: 'cn', label: '중국' },
    { value: 'eu', label: '유럽' }
  ];

  // 언어 옵션
  const languages = [
    { value: 'ko', label: '한국어' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
    { value: 'zh', label: '中文' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' }
  ];

  // 검색 실행
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  };

  // 검색어 제안 (간단한 구현)
  const generateSuggestions = (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    // 실제로는 검색 API에서 제안을 가져와야 함
    const mockSuggestions = [
      `${query} 검색`,
      `${query} 최신`,
      `${query} 리뷰`,
      `${query} 가격`,
      `${query} 비교`
    ];
    setSuggestions(mockSuggestions);
    setShowSuggestions(true);
  };

  // 검색어 변경 핸들러
  const handleQueryChange = (query: string) => {
    onSearchQueryChange(query);
    generateSuggestions(query);
  };

  // 제안 선택
  const handleSuggestionClick = (suggestion: string) => {
    onSearchQueryChange(suggestion);
    setShowSuggestions(false);
    onSearch(suggestion);
  };

  // 키보드 단축키
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch(e);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // 빠른 검색 버튼들
  const quickSearches = [
    { label: '뉴스', query: '최신 뉴스' },
    { label: '날씨', query: '오늘 날씨' },
    { label: '지도', query: '지도' },
    { label: '번역', query: '번역기' },
    { label: '계산기', query: '계산기' }
  ];

  return (
    <div className="search-interface">
      {/* 메인 검색 영역 */}
      <div className="main-search-section">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-container">
            <div className="search-engine-selector">
              <select
                value={searchEngine}
                onChange={(e) => onSearchEngineChange(e.target.value)}
                className="engine-select"
              >
                {searchEngines.map(engine => (
                  <option key={engine.value} value={engine.value}>
                    {engine.icon} {engine.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="search-input-wrapper">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="검색어를 입력하세요..."
                className="search-input"
                autoFocus
              />
              
              {showSuggestions && suggestions.length > 0 && (
                <div className="search-suggestions">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="suggestion-item"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      <span className="suggestion-icon">🔍</span>
                      <span className="suggestion-text">{suggestion}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <button
              type="submit"
              className="search-button"
              disabled={loading || !searchQuery.trim()}
            >
              {loading ? (
                <div className="loading-spinner"></div>
              ) : (
                '검색'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 빠른 검색 버튼들 */}
      <div className="quick-search-section">
        <h4>빠른 검색</h4>
        <div className="quick-search-buttons">
          {quickSearches.map((quick, index) => (
            <button
              key={index}
              type="button"
              className="quick-search-btn"
              onClick={() => {
                onSearchQueryChange(quick.query);
                onSearch(quick.query);
              }}
            >
              {quick.label}
            </button>
          ))}
        </div>
      </div>

      {/* 고급 옵션 토글 */}
      <div className="advanced-options-toggle">
        <button
          type="button"
          className="toggle-btn"
          onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
        >
          {showAdvancedOptions ? '▼' : '▶'} 고급 검색 옵션
        </button>
      </div>

      {/* 고급 검색 옵션 */}
      {showAdvancedOptions && (
        <div className="advanced-options">
          <div className="options-grid">
            {/* 시간 범위 */}
            <div className="option-group">
              <label>시간 범위:</label>
              <select
                value={searchFilters.timeRange}
                onChange={(e) => onSearchFiltersChange({ timeRange: e.target.value })}
              >
                {timeRanges.map(range => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 지역 */}
            <div className="option-group">
              <label>지역:</label>
              <select
                value={searchFilters.region}
                onChange={(e) => onSearchFiltersChange({ region: e.target.value })}
              >
                {regions.map(region => (
                  <option key={region.value} value={region.value}>
                    {region.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 언어 */}
            <div className="option-group">
              <label>언어:</label>
              <select
                value={searchFilters.language}
                onChange={(e) => onSearchFiltersChange({ language: e.target.value })}
              >
                {languages.map(lang => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 최대 결과 수 */}
            <div className="option-group">
              <label>최대 결과 수:</label>
              <select
                value={maxResults}
                onChange={(e) => onMaxResultsChange(parseInt(e.target.value))}
              >
                <option value={5}>5개</option>
                <option value={10}>10개</option>
                <option value={20}>20개</option>
                <option value={50}>50개</option>
                <option value={100}>100개</option>
              </select>
            </div>

            {/* 안전 검색 */}
            <div className="option-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={searchFilters.safeSearch}
                  onChange={(e) => onSearchFiltersChange({ safeSearch: e.target.checked })}
                />
                안전 검색
              </label>
            </div>
          </div>

          {/* 검색 팁 */}
          <div className="search-tips">
            <h5>검색 팁</h5>
            <ul>
              <li><strong>정확한 구문:</strong> "따옴표"로 정확한 구문 검색</li>
              <li><strong>제외 검색:</strong> -단어로 특정 단어 제외</li>
              <li><strong>사이트 검색:</strong> site:example.com 검색어</li>
              <li><strong>파일 타입:</strong> filetype:pdf 검색어</li>
            </ul>
          </div>
        </div>
      )}

      {/* 검색 통계 */}
      <div className="search-stats">
        <div className="stat-item">
          <span className="stat-label">선택된 엔진:</span>
          <span className="stat-value">
            {searchEngines.find(e => e.value === searchEngine)?.name}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">언어:</span>
          <span className="stat-value">
            {languages.find(l => l.value === searchFilters.language)?.label}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">안전 검색:</span>
          <span className="stat-value">
            {searchFilters.safeSearch ? '활성화' : '비활성화'}
          </span>
        </div>
      </div>
    </div>
  );
};
