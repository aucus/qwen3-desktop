import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
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
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Copy, 
  Download,
  Upload,
  Eye,
  Settings,
  Brain,
  Clock,
  User,
  FileText,
  Star,
  Tag,
  GitBranch,
  History,
  Zap,
  Layers,
  Palette,
  Code,
  BookOpen,
  Lightbulb,
  Sparkles
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { PromptManager } from './PromptManager';
import { PromptEditor } from './PromptEditor';
import { ContextManager } from './ContextManager';
import { VersionManager } from './VersionManager';
import './PromptUI.css';

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  variables: Array<{
    name: string;
    type: string;
    description: string;
    default_value: string;
    required: boolean;
    validation_rules: any;
  }>;
  tags: string[];
  is_favorite: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

interface PromptCategory {
  name: string;
  description: string;
  color: string;
  icon: string;
  template_count: number;
}

export const PromptUI: React.FC = () => {
  const [activeTab, setActiveTab] = useState('templates');
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFavorites, setShowFavorites] = useState(false);
  const [showSystem, setShowSystem] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);

  // 빠른 액션 상태
  const [quickAction, setQuickAction] = useState({
    type: '',
    template: null as PromptTemplate | null,
    variables: {} as Record<string, any>
  });

  useEffect(() => {
    loadTemplates();
    loadCategories();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/api/prompts/templates');
      if (response.success) {
        setTemplates(response.templates);
      }
    } catch (error) {
      console.error('템플릿 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await apiService.get('/api/prompts/categories');
      if (response.success) {
        setCategories(response.categories);
      }
    } catch (error) {
      console.error('카테고리 로드 실패:', error);
    }
  };

  const handleTemplateSelect = (template: PromptTemplate) => {
    setSelectedTemplate(template);
  };

  const handleTemplateCreate = () => {
    setShowCreateModal(true);
  };

  const handleTemplateEdit = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setActiveTab('editor');
  };

  const handleTemplateDelete = async (templateId: string) => {
    if (!confirm('정말로 이 템플릿을 삭제하시겠습니까?')) return;

    try {
      const response = await apiService.delete(`/api/prompts/templates/${templateId}`);
      if (response.success) {
        await loadTemplates();
      }
    } catch (error) {
      console.error('템플릿 삭제 실패:', error);
    }
  };

  const handleTemplateDuplicate = async (template: PromptTemplate) => {
    try {
      const response = await apiService.post(`/api/prompts/templates/${template.id}/duplicate`);
      if (response.success) {
        await loadTemplates();
      }
    } catch (error) {
      console.error('템플릿 복제 실패:', error);
    }
  };

  const handleTemplateFavorite = async (template: PromptTemplate) => {
    try {
      const response = await apiService.put(`/api/prompts/templates/${template.id}`, {
        ...template,
        is_favorite: !template.is_favorite
      });
      if (response.success) {
        await loadTemplates();
      }
    } catch (error) {
      console.error('즐겨찾기 설정 실패:', error);
    }
  };

  const handleQuickAction = (action: string, template: PromptTemplate) => {
    setQuickAction({
      type: action,
      template,
      variables: {}
    });
    setShowQuickActions(true);
  };

  const executeQuickAction = async () => {
    if (!quickAction.template) return;

    try {
      let result;
      switch (quickAction.type) {
        case 'copy':
          await navigator.clipboard.writeText(quickAction.template.content);
          break;
        case 'preview':
          // 미리보기 로직
          break;
        case 'use':
          // 사용 로직
          break;
        case 'export':
          const dataStr = JSON.stringify(quickAction.template, null, 2);
          const dataBlob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(dataBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${quickAction.template.name}_${new Date().toISOString().split('T')[0]}.json`;
          link.click();
          URL.revokeObjectURL(url);
          break;
      }
      setShowQuickActions(false);
    } catch (error) {
      console.error('빠른 액션 실행 실패:', error);
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = searchQuery === '' || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesFavorites = !showFavorites || template.is_favorite;
    const matchesSystem = !showSystem || template.is_system;
    
    return matchesSearch && matchesCategory && matchesFavorites && matchesSystem;
  });

  const getCategoryInfo = (categoryName: string) => {
    return categories.find(cat => cat.name === categoryName) || {
      name: categoryName,
      description: '카테고리',
      color: 'gray',
      icon: 'FileText'
    };
  };

  const getCategoryIcon = (iconName: string) => {
    const iconMap: { [key: string]: React.ReactNode } = {
      'Brain': <Brain className="w-4 h-4" />,
      'Code': <Code className="w-4 h-4" />,
      'BookOpen': <BookOpen className="w-4 h-4" />,
      'Lightbulb': <Lightbulb className="w-4 h-4" />,
      'Sparkles': <Sparkles className="w-4 h-4" />,
      'Palette': <Palette className="w-4 h-4" />,
      'Layers': <Layers className="w-4 h-4" />,
      'FileText': <FileText className="w-4 h-4" />
    };
    return iconMap[iconName] || <FileText className="w-4 h-4" />;
  };

  return (
    <div className="prompt-ui">
      <div className="prompt-header">
        <div className="header-content">
          <div className="header-title">
            <Brain className="w-6 h-6" />
            <h1>프롬프트 관리 시스템</h1>
          </div>
          <div className="header-actions">
            <Button onClick={handleTemplateCreate}>
              <Plus className="w-4 h-4 mr-2" />
              새 템플릿
            </Button>
          </div>
        </div>
      </div>

      <div className="prompt-main">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="prompt-tabs">
          <TabsList className="tabs-list">
            <TabsTrigger value="templates" className="tab-trigger">
              <FileText className="w-4 h-4 mr-2" />
              템플릿
            </TabsTrigger>
            <TabsTrigger value="editor" className="tab-trigger">
              <Edit className="w-4 h-4 mr-2" />
              편집기
            </TabsTrigger>
            <TabsTrigger value="context" className="tab-trigger">
              <Brain className="w-4 h-4 mr-2" />
              컨텍스트
            </TabsTrigger>
            <TabsTrigger value="versions" className="tab-trigger">
              <GitBranch className="w-4 h-4 mr-2" />
              버전
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="tab-content">
            <div className="templates-section">
              {/* 검색 및 필터 */}
              <div className="search-filters">
                <div className="search-box">
                  <Search className="w-4 h-4" />
                  <Input
                    placeholder="프롬프트 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div className="filters">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">모든 카테고리</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category.name} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant={showFavorites ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowFavorites(!showFavorites)}
                  >
                    <Star className="w-4 h-4 mr-1" />
                    즐겨찾기
                  </Button>

                  <Button
                    variant={showSystem ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowSystem(!showSystem)}
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    시스템
                  </Button>

                  <div className="view-toggle">
                    <Button
                      variant={viewMode === 'grid' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                    >
                      <Layers className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewMode('list')}
                    >
                      <FileText className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* 템플릿 목록 */}
              <div className="templates-container">
                {loading ? (
                  <div className="loading-state">
                    <div className="loading-spinner"></div>
                    <div>템플릿 로딩 중...</div>
                  </div>
                ) : (
                  <div className={`templates-grid ${viewMode}`}>
                    {filteredTemplates.map(template => {
                      const categoryInfo = getCategoryInfo(template.category);
                      return (
                        <Card key={template.id} className="template-card">
                          <CardHeader className="card-header">
                            <div className="card-title">
                              <div className="title-content">
                                <h3>{template.name}</h3>
                                <div className="card-badges">
                                  {template.is_favorite && (
                                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                  )}
                                  {template.is_system && (
                                    <Badge variant="secondary" className="text-xs">
                                      시스템
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    {categoryInfo.name}
                                  </Badge>
                                </div>
                              </div>
                              <div className="card-actions">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleQuickAction('copy', template)}
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleQuickAction('preview', template)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleQuickAction('export', template)}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          
                          <CardContent className="card-content">
                            <p className="description">{template.description}</p>
                            
                            <div className="template-meta">
                              <div className="meta-item">
                                <User className="w-3 h-3" />
                                <span>변수: {template.variables.length}개</span>
                              </div>
                              <div className="meta-item">
                                <Clock className="w-3 h-3" />
                                <span>{new Date(template.updated_at).toLocaleDateString()}</span>
                              </div>
                            </div>

                            <div className="template-tags">
                              {template.tags.map(tag => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>

                            <div className="template-actions">
                              <Button
                                size="sm"
                                onClick={() => handleTemplateEdit(template)}
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                편집
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTemplateDuplicate(template)}
                              >
                                <Copy className="w-4 h-4 mr-1" />
                                복제
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTemplateFavorite(template)}
                              >
                                <Star className={`w-4 h-4 mr-1 ${template.is_favorite ? 'fill-current' : ''}`} />
                                {template.is_favorite ? '해제' : '즐겨찾기'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTemplateDelete(template.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                삭제
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {!loading && filteredTemplates.length === 0 && (
                  <div className="empty-state">
                    <Brain className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <div className="text-lg mb-2">템플릿이 없습니다</div>
                    <div className="text-sm text-gray-500 mb-4">
                      새로운 프롬프트 템플릿을 생성해보세요
                    </div>
                    <Button onClick={handleTemplateCreate}>
                      <Plus className="w-4 h-4 mr-2" />
                      첫 번째 템플릿 만들기
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="editor" className="tab-content">
            <PromptEditor />
          </TabsContent>

          <TabsContent value="context" className="tab-content">
            <ContextManager />
          </TabsContent>

          <TabsContent value="versions" className="tab-content">
            <VersionManager />
          </TabsContent>
        </Tabs>
      </div>

      {/* 빠른 액션 모달 */}
      {showQuickActions && quickAction.template && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>빠른 액션</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowQuickActions(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="quick-action-content">
                <h4>{quickAction.template.name}</h4>
                <p>{quickAction.template.description}</p>
                
                {quickAction.type === 'preview' && (
                  <div className="preview-section">
                    <Label>미리보기</Label>
                    <div className="preview-content">
                      {quickAction.template.content}
                    </div>
                  </div>
                )}
                
                {quickAction.type === 'use' && (
                  <div className="variables-section">
                    <Label>변수 설정</Label>
                    {quickAction.template.variables.map(variable => (
                      <div key={variable.name} className="variable-input">
                        <Label>{variable.name}</Label>
                        <Input
                          value={quickAction.variables[variable.name] || variable.default_value}
                          onChange={(e) => setQuickAction(prev => ({
                            ...prev,
                            variables: {
                              ...prev.variables,
                              [variable.name]: e.target.value
                            }
                          }))}
                          placeholder={variable.description}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowQuickActions(false)}>
                취소
              </Button>
              <Button onClick={executeQuickAction}>
                실행
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
