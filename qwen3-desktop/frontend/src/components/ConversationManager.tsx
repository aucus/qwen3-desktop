import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from './ui/tabs';
import { 
  MessageSquare, 
  Search, 
  Plus,
  Download,
  Upload,
  GitBranch,
  GitMerge,
  Copy,
  Trash2,
  Archive,
  Tag,
  Calendar,
  Filter,
  MoreHorizontal,
  MessageCircle,
  User,
  Bot,
  Clock,
  FileText,
  Settings,
  RefreshCw,
  Eye,
  EyeOff,
  History,
  Star,
  StarOff,
  Share2,
  Edit3,
  Save,
  X,
  Check,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Grid,
  List
} from 'lucide-react';
import { apiService } from '../services/apiService';
import './ConversationManager.css';

interface Message {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  timestamp: string;
  metadata: Record<string, any>;
  parent_id?: string;
  branch_id?: string;
}

interface Conversation {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
  tags: string[];
  parent_conversation_id?: string;
  branch_id?: string;
}

interface ConversationStatistics {
  total_conversations: number;
  status_distribution: Record<string, number>;
  total_messages: number;
  role_distribution: Record<string, number>;
  total_branches: number;
  last_updated: string;
}

export const ConversationManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('conversations');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [statistics, setStatistics] = useState<ConversationStatistics | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'updated_at' | 'created_at' | 'title'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 모달 상태
  const [newConversationTitle, setNewConversationTitle] = useState('');
  const [newConversationTags, setNewConversationTags] = useState<string[]>([]);
  const [branchName, setBranchName] = useState('');
  const [branchDescription, setBranchDescription] = useState('');
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeStrategy, setMergeStrategy] = useState<'append' | 'interleave'>('append');

  useEffect(() => {
    loadConversations();
    loadStatistics();
    loadTags();
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/api/conversations');
      if (response.success) {
        setConversations(response.conversations);
      }
    } catch (error) {
      console.error('대화 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await apiService.get('/api/conversations/statistics');
      if (response.success) {
        setStatistics(response.statistics);
      }
    } catch (error) {
      console.error('통계 로드 실패:', error);
    }
  };

  const loadTags = async () => {
    try {
      const response = await apiService.get('/api/conversations/tags');
      if (response.success) {
        setAllTags(response.tags);
      }
    } catch (error) {
      console.error('태그 로드 실패:', error);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const response = await apiService.get(`/api/conversations/${conversationId}/messages`);
      if (response.success) {
        setMessages(response.messages);
      }
    } catch (error) {
      console.error('메시지 로드 실패:', error);
    }
  };

  const handleCreateConversation = async () => {
    try {
      const response = await apiService.post('/api/conversations', {
        title: newConversationTitle,
        tags: newConversationTags,
        metadata: {}
      });
      
      if (response.success) {
        await loadConversations();
        setShowCreateModal(false);
        setNewConversationTitle('');
        setNewConversationTags([]);
      }
    } catch (error) {
      console.error('대화 생성 실패:', error);
    }
  };

  const handleCreateBranch = async () => {
    if (!selectedConversation) return;

    try {
      const response = await apiService.post(`/api/conversations/${selectedConversation.id}/branches`, {
        branch_name: branchName,
        description: branchDescription,
        created_by: 'user'
      });
      
      if (response.success) {
        await loadConversations();
        setShowBranchModal(false);
        setBranchName('');
        setBranchDescription('');
      }
    } catch (error) {
      console.error('분기 생성 실패:', error);
    }
  };

  const handleMergeConversations = async () => {
    try {
      const response = await apiService.post('/api/conversations/merge', {
        source_conversation_id: mergeSourceId,
        target_conversation_id: mergeTargetId,
        merge_strategy: mergeStrategy
      });
      
      if (response.success) {
        await loadConversations();
        setShowMergeModal(false);
        setMergeSourceId('');
        setMergeTargetId('');
        setMergeStrategy('append');
      }
    } catch (error) {
      console.error('대화 병합 실패:', error);
    }
  };

  const handleExportConversation = async (conversationId: string, format: string) => {
    try {
      const response = await apiService.get(`/api/conversations/${conversationId}/export?format=${format}`);
      if (response.success) {
        const dataStr = format === 'json' 
          ? JSON.stringify(response.data, null, 2)
          : response.data;
        const dataBlob = new Blob([dataStr], { 
          type: format === 'json' ? 'application/json' : 'text/markdown' 
        });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `conversation_${conversationId}_${new Date().toISOString().split('T')[0]}.${format === 'json' ? 'json' : 'md'}`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('대화 내보내기 실패:', error);
    }
  };

  const handleImportConversation = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        let importData;
        let format = 'json';

        if (file.name.endsWith('.md')) {
          importData = { content };
          format = 'markdown';
        } else {
          importData = JSON.parse(content);
        }

        const response = await apiService.post('/api/conversations/import', importData, {
          params: { format }
        });
        
        if (response.success) {
          await loadConversations();
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('대화 가져오기 실패:', error);
    }
  };

  const handleDeleteConversation = async (conversationId: string, permanent: boolean = false) => {
    if (!confirm(`정말로 이 대화를 ${permanent ? '영구적으로 ' : ''}삭제하시겠습니까?`)) return;

    try {
      const response = await apiService.delete(`/api/conversations/${conversationId}?permanent=${permanent}`);
      if (response.success) {
        await loadConversations();
        if (selectedConversation?.id === conversationId) {
          setSelectedConversation(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('대화 삭제 실패:', error);
    }
  };

  const handleDuplicateConversation = async (conversationId: string) => {
    try {
      const response = await apiService.post(`/api/conversations/${conversationId}/duplicate`);
      if (response.success) {
        await loadConversations();
      }
    } catch (error) {
      console.error('대화 복제 실패:', error);
    }
  };

  const filteredConversations = conversations.filter(conversation => {
    const matchesSearch = searchQuery === '' || 
      conversation.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = selectedStatus === 'all' || conversation.status === selectedStatus;
    
    const matchesTags = selectedTags.length === 0 || 
      selectedTags.some(tag => conversation.tags.includes(tag));
    
    return matchesSearch && matchesStatus && matchesTags;
  });

  const sortedConversations = [...filteredConversations].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'updated_at':
        aValue = new Date(a.updated_at).getTime();
        bValue = new Date(b.updated_at).getTime();
        break;
      case 'created_at':
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      case 'title':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      default:
        return 0;
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <MessageCircle className="w-4 h-4 text-green-600" />;
      case 'archived':
        return <Archive className="w-4 h-4 text-gray-600" />;
      case 'deleted':
        return <Trash2 className="w-4 h-4 text-red-600" />;
      default:
        return <MessageCircle className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return '활성';
      case 'archived':
        return '보관';
      case 'deleted':
        return '삭제됨';
      default:
        return status;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'user':
        return <User className="w-4 h-4 text-blue-600" />;
      case 'assistant':
        return <Bot className="w-4 h-4 text-green-600" />;
      case 'system':
        return <Settings className="w-4 h-4 text-gray-600" />;
      default:
        return <MessageCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="conversation-manager">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              대화 관리
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowCreateModal(true)} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                새 대화
              </Button>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".json,.md"
                  onChange={handleImportConversation}
                  className="hidden"
                />
                <Button variant="outline" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    가져오기
                  </span>
                </Button>
              </label>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="conversation-tabs">
            <TabsList className="tabs-list">
              <TabsTrigger value="conversations" className="tab-trigger">
                <MessageSquare className="w-4 h-4 mr-2" />
                대화 목록
              </TabsTrigger>
              <TabsTrigger value="statistics" className="tab-trigger">
                <BarChart3 className="w-4 h-4 mr-2" />
                통계
              </TabsTrigger>
            </TabsList>

            <TabsContent value="conversations" className="tab-content">
              <div className="conversation-section">
                {/* 검색 및 필터 */}
                <div className="search-filters">
                  <div className="search-box">
                    <Search className="w-4 h-4" />
                    <Input
                      placeholder="대화 검색..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <div className="filter-controls">
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">모든 상태</SelectItem>
                        <SelectItem value="active">활성</SelectItem>
                        <SelectItem value="archived">보관</SelectItem>
                        <SelectItem value="deleted">삭제됨</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="updated_at">최근 수정</SelectItem>
                        <SelectItem value="created_at">생성일</SelectItem>
                        <SelectItem value="title">제목</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    >
                      {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                    >
                      {viewMode === 'list' ? <Grid className="w-4 h-4" /> : <List className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* 대화 목록 */}
                <div className="conversations-container">
                  {loading ? (
                    <div className="loading-state">
                      <div className="loading-spinner"></div>
                      <div>대화 로딩 중...</div>
                    </div>
                  ) : (
                    <div className={`conversations-list ${viewMode}`}>
                      {sortedConversations.map((conversation) => (
                        <Card 
                          key={conversation.id} 
                          className={`conversation-card ${selectedConversation?.id === conversation.id ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedConversation(conversation);
                            loadMessages(conversation.id);
                          }}
                        >
                          <CardHeader className="card-header">
                            <div className="conversation-title">
                              <div className="title-content">
                                <h3>{conversation.title}</h3>
                                <div className="conversation-meta">
                                  <span className="status">
                                    {getStatusIcon(conversation.status)}
                                    {getStatusLabel(conversation.status)}
                                  </span>
                                  <span className="date">
                                    <Clock className="w-3 h-3" />
                                    {new Date(conversation.updated_at).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="conversation-tags">
                                  {conversation.tags.map((tag) => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div className="conversation-actions">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicateConversation(conversation.id);
                                  }}
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowExportModal(true);
                                  }}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteConversation(conversation.id);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  )}

                  {!loading && sortedConversations.length === 0 && (
                    <div className="empty-state">
                      <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <div className="text-lg mb-2">대화가 없습니다</div>
                      <div className="text-sm text-gray-500">
                        새 대화를 생성하거나 검색 조건을 변경해보세요
                      </div>
                    </div>
                  )}
                </div>

                {/* 선택된 대화 상세 보기 */}
                {selectedConversation && (
                  <div className="conversation-detail">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            {selectedConversation.title}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowBranchModal(true)}
                            >
                              <GitBranch className="w-4 h-4 mr-2" />
                              분기
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowMergeModal(true)}
                            >
                              <GitMerge className="w-4 h-4 mr-2" />
                              병합
                            </Button>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="messages-container">
                          {messages.map((message) => (
                            <div key={message.id} className={`message ${message.role}`}>
                              <div className="message-header">
                                <div className="message-role">
                                  {getRoleIcon(message.role)}
                                  <span className="role-label">
                                    {message.role === 'user' ? '사용자' : 
                                     message.role === 'assistant' ? '어시스턴트' : '시스템'}
                                  </span>
                                </div>
                                <span className="message-time">
                                  {new Date(message.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <div className="message-content">
                                {message.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="statistics" className="tab-content">
              <div className="statistics-section">
                {statistics ? (
                  <div className="stats-grid">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">전체 통계</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="stat-item">
                          <span className="stat-label">총 대화 수</span>
                          <span className="stat-value">{statistics.total_conversations}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">총 메시지 수</span>
                          <span className="stat-value">{statistics.total_messages}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">총 분기 수</span>
                          <span className="stat-value">{statistics.total_branches}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">상태별 분포</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {Object.entries(statistics.status_distribution).map(([status, count]) => (
                          <div key={status} className="stat-item">
                            <span className="stat-label">{getStatusLabel(status)}</span>
                            <span className="stat-value">{count}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">역할별 분포</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {Object.entries(statistics.role_distribution).map(([role, count]) => (
                          <div key={role} className="stat-item">
                            <span className="stat-label">
                              {role === 'user' ? '사용자' : 
                               role === 'assistant' ? '어시스턴트' : '시스템'}
                            </span>
                            <span className="stat-value">{count}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <div>통계 로딩 중...</div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 새 대화 생성 모달 */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>새 대화 생성</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <Label htmlFor="title">제목</Label>
                <Input
                  id="title"
                  value={newConversationTitle}
                  onChange={(e) => setNewConversationTitle(e.target.value)}
                  placeholder="대화 제목을 입력하세요"
                />
              </div>
              <div className="form-group">
                <Label>태그</Label>
                <div className="tags-input">
                  {newConversationTags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="mr-2">
                      {tag}
                      <button
                        onClick={() => setNewConversationTags(tags => tags.filter((_, i) => i !== index))}
                        className="ml-1"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                  <Input
                    placeholder="태그 추가..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target as HTMLInputElement;
                        const tag = input.value.trim();
                        if (tag && !newConversationTags.includes(tag)) {
                          setNewConversationTags([...newConversationTags, tag]);
                          input.value = '';
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                취소
              </Button>
              <Button onClick={handleCreateConversation} disabled={!newConversationTitle.trim()}>
                생성
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 분기 생성 모달 */}
      {showBranchModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>대화 분기 생성</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowBranchModal(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <Label htmlFor="branch-name">분기 이름</Label>
                <Input
                  id="branch-name"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="분기 이름을 입력하세요"
                />
              </div>
              <div className="form-group">
                <Label htmlFor="branch-description">설명</Label>
                <Input
                  id="branch-description"
                  value={branchDescription}
                  onChange={(e) => setBranchDescription(e.target.value)}
                  placeholder="분기 설명을 입력하세요"
                />
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowBranchModal(false)}>
                취소
              </Button>
              <Button onClick={handleCreateBranch} disabled={!branchName.trim()}>
                분기 생성
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 병합 모달 */}
      {showMergeModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>대화 병합</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowMergeModal(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <Label>소스 대화</Label>
                <Select value={mergeSourceId} onValueChange={setMergeSourceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="소스 대화 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {conversations.map((conv) => (
                      <SelectItem key={conv.id} value={conv.id}>
                        {conv.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="form-group">
                <Label>대상 대화</Label>
                <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="대상 대화 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {conversations.map((conv) => (
                      <SelectItem key={conv.id} value={conv.id}>
                        {conv.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="form-group">
                <Label>병합 전략</Label>
                <Select value={mergeStrategy} onValueChange={(value: any) => setMergeStrategy(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="append">추가</SelectItem>
                    <SelectItem value="interleave">교차</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowMergeModal(false)}>
                취소
              </Button>
              <Button onClick={handleMergeConversations} disabled={!mergeSourceId || !mergeTargetId}>
                병합
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 내보내기 모달 */}
      {showExportModal && selectedConversation && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>대화 내보내기</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowExportModal(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="export-options">
                <Button
                  onClick={() => handleExportConversation(selectedConversation.id, 'json')}
                  className="w-full mb-2"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  JSON 형식으로 내보내기
                </Button>
                <Button
                  onClick={() => handleExportConversation(selectedConversation.id, 'markdown')}
                  className="w-full"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Markdown 형식으로 내보내기
                </Button>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowExportModal(false)}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
