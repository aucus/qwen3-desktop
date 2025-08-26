import asyncio
import json
import aiohttp
from typing import Dict, Any, List, Optional
from datetime import datetime
import urllib.parse
from bs4 import BeautifulSoup
import re

from ...utils.logger import mcp_logger

class WebSearchMCPServer:
    """웹 검색 MCP 서버"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key
        self.search_engines = {
            'google': self._search_google,
            'bing': self._search_bing,
            'duckduckgo': self._search_duckduckgo,
            'custom': self._search_custom
        }
        self.session = None
        self.max_results = 10
        self.timeout = 30
        
    async def initialize(self):
        """서버를 초기화합니다."""
        try:
            mcp_logger.info("Initializing web search MCP server")
            
            # HTTP 세션 생성
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=self.timeout),
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            )
            
            # 기본 메서드 등록
            self.methods = {
                'web/search': self.search,
                'web/browse': self.browse_url,
                'web/extract': self.extract_content,
                'web/summarize': self.summarize_content,
            }
            
            mcp_logger.info("Web search MCP server initialized successfully")
            
        except Exception as e:
            mcp_logger.error(f"Failed to initialize web search MCP server: {e}")
            raise
    
    async def cleanup(self):
        """서버 리소스를 정리합니다."""
        if self.session:
            await self.session.close()
    
    async def handle_request(self, method: str, params: Dict[str, Any]) -> Any:
        """요청을 처리합니다."""
        try:
            if method not in self.methods:
                raise ValueError(f"Unknown method: {method}")
            
            handler = self.methods[method]
            return await handler(params)
            
        except Exception as e:
            mcp_logger.error(f"Error handling web search request {method}: {e}")
            raise
    
    async def search(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """웹 검색을 수행합니다."""
        try:
            query = params.get('query')
            engine = params.get('engine', 'google')
            max_results = params.get('max_results', self.max_results)
            
            if not query:
                raise ValueError("Query parameter is required")
            
            if engine not in self.search_engines:
                raise ValueError(f"Unsupported search engine: {engine}")
            
            mcp_logger.info(f"Performing web search: {query} using {engine}")
            
            # 검색 수행
            search_handler = self.search_engines[engine]
            results = await search_handler(query, max_results)
            
            return {
                'query': query,
                'engine': engine,
                'results': results,
                'total': len(results),
                'searched_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error performing web search: {e}")
            raise
    
    async def browse_url(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """URL을 탐색합니다."""
        try:
            url = params.get('url')
            if not url:
                raise ValueError("URL parameter is required")
            
            # URL 유효성 검증
            if not url.startswith(('http://', 'https://')):
                url = 'https://' + url
            
            mcp_logger.info(f"Browsing URL: {url}")
            
            # 페이지 가져오기
            async with self.session.get(url) as response:
                if response.status != 200:
                    raise ValueError(f"Failed to fetch URL: HTTP {response.status}")
                
                content = await response.text()
                content_type = response.headers.get('content-type', '')
                
                # HTML 파싱
                soup = BeautifulSoup(content, 'html.parser')
                
                # 메타데이터 추출
                title = soup.find('title')
                title_text = title.get_text() if title else ''
                
                meta_description = soup.find('meta', attrs={'name': 'description'})
                description = meta_description.get('content', '') if meta_description else ''
                
                # 텍스트 추출
                text_content = soup.get_text()
                text_content = re.sub(r'\s+', ' ', text_content).strip()
                
                return {
                    'url': url,
                    'title': title_text,
                    'description': description,
                    'content': text_content[:5000],  # 첫 5000자만
                    'content_type': content_type,
                    'content_length': len(content),
                    'browsed_at': datetime.now().isoformat()
                }
                
        except Exception as e:
            mcp_logger.error(f"Error browsing URL {params.get('url')}: {e}")
            raise
    
    async def extract_content(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """웹 페이지에서 특정 내용을 추출합니다."""
        try:
            url = params.get('url')
            selector = params.get('selector')  # CSS 선택자
            extract_type = params.get('type', 'text')  # 'text', 'links', 'images'
            
            if not url:
                raise ValueError("URL parameter is required")
            
            if not url.startswith(('http://', 'https://')):
                url = 'https://' + url
            
            mcp_logger.info(f"Extracting content from: {url}")
            
            # 페이지 가져오기
            async with self.session.get(url) as response:
                if response.status != 200:
                    raise ValueError(f"Failed to fetch URL: HTTP {response.status}")
                
                content = await response.text()
                soup = BeautifulSoup(content, 'html.parser')
                
                extracted_data = []
                
                if extract_type == 'text':
                    if selector:
                        elements = soup.select(selector)
                        for element in elements:
                            extracted_data.append({
                                'text': element.get_text().strip(),
                                'tag': element.name,
                                'classes': element.get('class', [])
                            })
                    else:
                        # 모든 텍스트 추출
                        text_content = soup.get_text()
                        text_content = re.sub(r'\s+', ' ', text_content).strip()
                        extracted_data.append({
                            'text': text_content,
                            'tag': 'body',
                            'classes': []
                        })
                
                elif extract_type == 'links':
                    links = soup.find_all('a', href=True)
                    for link in links:
                        href = link.get('href')
                        text = link.get_text().strip()
                        if href and text:
                            extracted_data.append({
                                'url': href,
                                'text': text,
                                'title': link.get('title', '')
                            })
                
                elif extract_type == 'images':
                    images = soup.find_all('img')
                    for img in images:
                        src = img.get('src')
                        alt = img.get('alt', '')
                        if src:
                            extracted_data.append({
                                'src': src,
                                'alt': alt,
                                'title': img.get('title', '')
                            })
                
                return {
                    'url': url,
                    'type': extract_type,
                    'selector': selector,
                    'extracted': extracted_data,
                    'count': len(extracted_data),
                    'extracted_at': datetime.now().isoformat()
                }
                
        except Exception as e:
            mcp_logger.error(f"Error extracting content from {params.get('url')}: {e}")
            raise
    
    async def summarize_content(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """웹 페이지 내용을 요약합니다."""
        try:
            url = params.get('url')
            max_length = params.get('max_length', 500)
            
            if not url:
                raise ValueError("URL parameter is required")
            
            # 페이지 내용 가져오기
            browse_result = await self.browse_url({'url': url})
            content = browse_result['content']
            
            # 간단한 요약 (첫 번째 문단들)
            paragraphs = content.split('\n\n')
            summary = '\n\n'.join(paragraphs[:3])  # 첫 3개 문단
            
            if len(summary) > max_length:
                summary = summary[:max_length] + '...'
            
            return {
                'url': url,
                'title': browse_result['title'],
                'summary': summary,
                'original_length': len(content),
                'summary_length': len(summary),
                'summarized_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            mcp_logger.error(f"Error summarizing content from {params.get('url')}: {e}")
            raise
    
    # 검색 엔진별 구현
    async def _search_google(self, query: str, max_results: int) -> List[Dict[str, Any]]:
        """Google 검색 (간단한 구현)"""
        try:
            # Google 검색 URL
            search_url = f"https://www.google.com/search?q={urllib.parse.quote(query)}"
            
            async with self.session.get(search_url) as response:
                if response.status != 200:
                    raise ValueError(f"Google search failed: HTTP {response.status}")
                
                content = await response.text()
                soup = BeautifulSoup(content, 'html.parser')
                
                results = []
                search_results = soup.find_all('div', class_='g')
                
                for result in search_results[:max_results]:
                    title_elem = result.find('h3')
                    link_elem = result.find('a')
                    snippet_elem = result.find('div', class_='VwiC3b')
                    
                    if title_elem and link_elem:
                        title = title_elem.get_text()
                        url = link_elem.get('href', '')
                        snippet = snippet_elem.get_text() if snippet_elem else ''
                        
                        results.append({
                            'title': title,
                            'url': url,
                            'snippet': snippet,
                            'engine': 'google'
                        })
                
                return results
                
        except Exception as e:
            mcp_logger.error(f"Google search error: {e}")
            return []
    
    async def _search_bing(self, query: str, max_results: int) -> List[Dict[str, Any]]:
        """Bing 검색 (간단한 구현)"""
        try:
            search_url = f"https://www.bing.com/search?q={urllib.parse.quote(query)}"
            
            async with self.session.get(search_url) as response:
                if response.status != 200:
                    raise ValueError(f"Bing search failed: HTTP {response.status}")
                
                content = await response.text()
                soup = BeautifulSoup(content, 'html.parser')
                
                results = []
                search_results = soup.find_all('li', class_='b_algo')
                
                for result in search_results[:max_results]:
                    title_elem = result.find('h2')
                    link_elem = result.find('a')
                    snippet_elem = result.find('p')
                    
                    if title_elem and link_elem:
                        title = title_elem.get_text()
                        url = link_elem.get('href', '')
                        snippet = snippet_elem.get_text() if snippet_elem else ''
                        
                        results.append({
                            'title': title,
                            'url': url,
                            'snippet': snippet,
                            'engine': 'bing'
                        })
                
                return results
                
        except Exception as e:
            mcp_logger.error(f"Bing search error: {e}")
            return []
    
    async def _search_duckduckgo(self, query: str, max_results: int) -> List[Dict[str, Any]]:
        """DuckDuckGo 검색 (간단한 구현)"""
        try:
            search_url = f"https://duckduckgo.com/html/?q={urllib.parse.quote(query)}"
            
            async with self.session.get(search_url) as response:
                if response.status != 200:
                    raise ValueError(f"DuckDuckGo search failed: HTTP {response.status}")
                
                content = await response.text()
                soup = BeautifulSoup(content, 'html.parser')
                
                results = []
                search_results = soup.find_all('div', class_='result')
                
                for result in search_results[:max_results]:
                    title_elem = result.find('a', class_='result__a')
                    snippet_elem = result.find('a', class_='result__snippet')
                    
                    if title_elem:
                        title = title_elem.get_text()
                        url = title_elem.get('href', '')
                        snippet = snippet_elem.get_text() if snippet_elem else ''
                        
                        results.append({
                            'title': title,
                            'url': url,
                            'snippet': snippet,
                            'engine': 'duckduckgo'
                        })
                
                return results
                
        except Exception as e:
            mcp_logger.error(f"DuckDuckGo search error: {e}")
            return []
    
    async def _search_custom(self, query: str, max_results: int) -> List[Dict[str, Any]]:
        """커스텀 검색 (API 키 사용)"""
        try:
            if not self.api_key:
                raise ValueError("API key required for custom search")
            
            # 여기에 실제 검색 API 구현
            # 예: Google Custom Search API, Bing Search API 등
            
            return []
            
        except Exception as e:
            mcp_logger.error(f"Custom search error: {e}")
            return []
