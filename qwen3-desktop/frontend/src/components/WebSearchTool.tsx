import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { SearchInterface } from './SearchInterface';
import { SearchResults } from './SearchResults';
import { SearchHistory } from './SearchHistory';
import { WebBrowser } from './WebBrowser';
import './WebSearchTool.css';

interface WebSearchToolProps {
  className?: string;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  timestamp: string;
}

interface SearchHistoryItem {
  id: string;
  query: string;
  engine: string;
  timestamp: string;
  resultCount: number;
}

interface WebPage {
  url: string;
  title: string;
  content: string;
  html: string;
  metadata: {
    description?: string;
    keywords?: string;
    author?: string;
    published?: string;
  };
}

export const WebSearchTool: React.FC<WebSearchToolProps> = ({ className = '' }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchEngine, setSearchEngine] = useState<string>('google');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentPage, setCurrentPage] = useState<WebPage | null>(null);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'results' | 'browser' | 'history'>('search');
  const [maxResults, setMaxResults] = useState<number>(10);
  const [searchFilters, setSearchFilters] = useState<{
    timeRange: string;
    region: string;
    language: string;
    safeSearch: boolean;
  }>({
    timeRange: 'any',
    region: 'global',
    language: 'ko',
    safeSearch: true
  });

  // 검색 실행
  const performSearch = async (query: string, engine: string = searchEngine) => {
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.callMCPMethod('web/search', {
        query: query,
        engine: engine,
        max_results: maxResults,
        time_range: searchFilters.timeRange,
        region: searchFilters.region,
        language: searchFilters.language,
        safe_search: searchFilters.safeSearch
      });
      
      if (response.results) {
        const results: SearchResult[] = response.results.map((result: any) => ({
          title: result.title || '',
          url: result.url || '',
          snippet: result.snippet || '',
          source: result.source || engine,
          timestamp: new Date().toISOString()
        }));
        
        setSearchResults(results);
        
        // 검색 히스토리에 추가
        const historyItem: SearchHistoryItem = {
          id: Date.now().toString(),
          query: query,
          engine: engine,
          timestamp: new Date().toISOString(),
          resultCount: results.length
        };
        
        setSearchHistory(prev => [historyItem, ...prev.slice(0, 49)]); // 최대 50개 유지
        
        setActiveTab('results');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '검색에 실패했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 웹페이지 로드
  const loadWebPage = async (url: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.callMCPMethod('web/browse', {
        url: url,
        timeout: 30,
        user_agent: 'Mozilla/5.0 (compatible; Qwen3Desktop/1.0)'
      });
      
      if (response.content) {
        const webPage: WebPage = {
          url: url,
          title: response.title || url,
          content: response.content || '',
          html: response.html || '',
          metadata: {
            description: response.metadata?.description,
            keywords: response.metadata?.keywords,
            author: response.metadata?.author,
            published: response.metadata?.published
          }
        };
        
        setCurrentPage(webPage);
        setActiveTab('browser');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '웹페이지를 불러오는데 실패했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 검색 히스토리에서 검색 재실행
  const repeatSearch = (historyItem: SearchHistoryItem) => {
    setSearchQuery(historyItem.query);
    setSearchEngine(historyItem.engine);
    performSearch(historyItem.query, historyItem.engine);
  };

  // 검색 히스토리 삭제
  const deleteSearchHistory = (id: string) => {
    setSearchHistory(prev => prev.filter(item => item.id !== id));
  };

  // 검색 히스토리 전체 삭제
  const clearSearchHistory = () => {
    setSearchHistory([]);
  };

  // 검색 필터 변경
  const updateSearchFilters = (filters: Partial<typeof searchFilters>) => {
    setSearchFilters(prev => ({ ...prev, ...filters }));
  };

  // 검색 엔진 변경
  const handleSearchEngineChange = (engine: string) => {
    setSearchEngine(engine);
    if (searchQuery.trim()) {
      performSearch(searchQuery, engine);
    }
  };

  // 검색 결과 필터링
  const filterResults = (filterType: 'all' | 'recent' | 'reliable') => {
    // 검색 결과 필터링 로직 (추후 구현)
    console.log('Filtering results by:', filterType);
  };

  // 검색 결과 정렬
  const sortResults = (sortBy: 'relevance' | 'date' | 'title') => {
    const sortedResults = [...searchResults];
    
    switch (sortBy) {
      case 'date':
        sortedResults.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        break;
      case 'title':
        sortedResults.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'relevance':
      default:
        // 기본 순서 유지 (검색 엔진 순서)
        break;
    }
    
    setSearchResults(sortedResults);
  };

  // 초기 로드 시 검색 히스토리 복원 (로컬 스토리지에서)
  useEffect(() => {
    const savedHistory = localStorage.getItem('webSearchHistory');
    if (savedHistory) {
      try {
        const history = JSON.parse(savedHistory);
        setSearchHistory(history);
      } catch (err) {
        console.warn('Failed to load search history:', err);
      }
    }
  }, []);

  // 검색 히스토리 저장
  useEffect(() => {
    localStorage.setItem('webSearchHistory', JSON.stringify(searchHistory));
  }, [searchHistory]);

  return (
    <div className={`web-search-tool ${className}`}>
      <div className="tool-header">
        <h3>웹 검색 도구</h3>
        <div className="header-actions">
          <button
            type="button"
            className="refresh-btn"
            onClick={() => window.location.reload()}
            title="새로고침"
          >
            🔄
          </button>
        </div>
      </div>

      <div className="tool-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          🔍 검색
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
          disabled={searchResults.length === 0}
        >
          📋 결과 ({searchResults.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'browser' ? 'active' : ''}`}
          onClick={() => setActiveTab('browser')}
          disabled={!currentPage}
        >
          🌐 브라우저
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📚 히스토리 ({searchHistory.length})
        </button>
      </div>

      {error && (
        <div className="tool-error">
          <p>{error}</p>
          <button type="button" className="clear-btn" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      <div className="tool-content">
        {activeTab === 'search' && (
          <SearchInterface
            searchQuery={searchQuery}
            searchEngine={searchEngine}
            searchFilters={searchFilters}
            maxResults={maxResults}
            loading={loading}
            onSearchQueryChange={setSearchQuery}
            onSearchEngineChange={handleSearchEngineChange}
            onSearchFiltersChange={updateSearchFilters}
            onMaxResultsChange={setMaxResults}
            onSearch={performSearch}
          />
        )}

        {activeTab === 'results' && (
          <SearchResults
            results={searchResults}
            loading={loading}
            onResultClick={loadWebPage}
            onFilter={filterResults}
            onSort={sortResults}
          />
        )}

        {activeTab === 'browser' && currentPage && (
          <WebBrowser
            page={currentPage}
            loading={loading}
            onNavigate={loadWebPage}
          />
        )}

        {activeTab === 'history' && (
          <SearchHistory
            history={searchHistory}
            onRepeatSearch={repeatSearch}
            onDeleteHistory={deleteSearchHistory}
            onClearHistory={clearSearchHistory}
          />
        )}
      </div>

      {loading && (
        <div className="tool-loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
    </div>
  );
};
