import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { 
  Plus, 
  Search, 
  Filter, 
  Star, 
  Edit, 
  Trash2, 
  Copy, 
  Download,
  Upload,
  Eye,
  MoreVertical
} from 'lucide-react';
import { PromptEditor } from './PromptEditor';
import { apiService } from '../services/apiService';
import './PromptManager.css';

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
    required: boolean;
  }>;
  tags: string[];
  is_favorite: boolean;
  is_system_prompt: boolean;
  created_at: string;
  updated_at: string;
  version: string;
  author: string;
}

interface PromptCategory {
  name: string;
  description: string;
  icon: string;
  color: string;
  template_count: number;
}

export const PromptManager: React.FC = () => {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [categories, setCategories] = useState<PromptCategory[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<PromptTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);
  const [showSystemPrompts, setShowSystemPrompts] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    loadTemplates();
    loadCategories();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [templates, selectedCategory, searchQuery, showFavorites, showSystemPrompts]);

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

  const filterTemplates = () => {
    let filtered = [...templates];

    // 카테고리 필터
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(template => template.category === selectedCategory);
    }

    // 즐겨찾기 필터
    if (showFavorites) {
      filtered = filtered.filter(template => template.is_favorite);
    }

    // 시스템 프롬프트 필터
    if (showSystemPrompts) {
      filtered = filtered.filter(template => template.is_system_prompt);
    }

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(template => 
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.content.toLowerCase().includes(query) ||
        template.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    setFilteredTemplates(filtered);
  };

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setShowEditor(true);
  };

  const handleEditTemplate = (template: PromptTemplate) => {
    setEditingTemplate(template);
    setShowEditor(true);
  };

  const handleDeleteTemplate = async (templateId: string) => {
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

  const handleToggleFavorite = async (template: PromptTemplate) => {
    try {
      const response = await apiService.put(`/api/prompts/templates/${template.id}`, {
        is_favorite: !template.is_favorite
      });
      if (response.success) {
        await loadTemplates();
      }
    } catch (error) {
      console.error('즐겨찾기 토글 실패:', error);
    }
  };

  const handleCopyTemplate = async (template: PromptTemplate) => {
    try {
      const response = await apiService.post(`/api/prompts/templates/${template.id}/duplicate`);
      if (response.success) {
        await loadTemplates();
      }
    } catch (error) {
      console.error('템플릿 복제 실패:', error);
    }
  };

  const handleSaveTemplate = async (template: PromptTemplate) => {
    await loadTemplates();
    setShowEditor(false);
    setEditingTemplate(null);
  };

  const handleExportTemplates = async () => {
    try {
      const response = await apiService.post('/api/prompts/export');
      if (response.success) {
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `prompts_export_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('템플릿 내보내기 실패:', error);
    }
  };

  const handleImportTemplates = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await apiService.post('/api/prompts/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.success) {
        await loadTemplates();
        alert(`${response.imported_count}개의 템플릿이 가져와졌습니다.`);
      }
    } catch (error) {
      console.error('템플릿 가져오기 실패:', error);
    }
  };

  const renderTemplateCard = (template: PromptTemplate) => (
    <Card key={template.id} className="template-card">
      <CardHeader className="template-card-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">{template.name}</span>
            {template.is_favorite && <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />}
            {template.is_system_prompt && <Badge variant="secondary">시스템</Badge>}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleToggleFavorite(template)}
            >
              <Star className={`w-4 h-4 ${template.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleEditTemplate(template)}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleCopyTemplate(template)}
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDeleteTemplate(template.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{template.category}</span>
          <span>•</span>
          <span>{new Date(template.updated_at).toLocaleDateString()}</span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {template.description || '설명이 없습니다.'}
        </p>
        
        <div className="flex flex-wrap gap-1 mb-3">
          {template.tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {template.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{template.tags.length - 3}
            </Badge>
          )}
        </div>

        {template.variables.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
            <span>변수: {template.variables.length}개</span>
          </div>
        )}

        <div className="text-xs text-gray-400">
          버전 {template.version} • {template.author}
        </div>
      </CardContent>
    </Card>
  );

  const renderTemplateList = (template: PromptTemplate) => (
    <div key={template.id} className="template-list-item">
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium">{template.name}</h3>
            {template.is_favorite && <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />}
            {template.is_system_prompt && <Badge variant="secondary">시스템</Badge>}
            <Badge variant="outline">{template.category}</Badge>
          </div>
          <p className="text-sm text-gray-600 mb-2">
            {template.description || '설명이 없습니다.'}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>변수: {template.variables.length}개</span>
            <span>•</span>
            <span>태그: {template.tags.length}개</span>
            <span>•</span>
            <span>수정: {new Date(template.updated_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleToggleFavorite(template)}
          >
            <Star className={`w-4 h-4 ${template.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleEditTemplate(template)}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleCopyTemplate(template)}
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteTemplate(template.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  if (showEditor) {
    return (
      <PromptEditor
        template={editingTemplate || undefined}
        onSave={handleSaveTemplate}
        onCancel={() => {
          setShowEditor(false);
          setEditingTemplate(null);
        }}
        categories={categories}
      />
    );
  }

  return (
    <div className="prompt-manager">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>프롬프트 관리</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              >
                {viewMode === 'grid' ? '목록 보기' : '그리드 보기'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportTemplates}
              >
                <Download className="w-4 h-4 mr-1" />
                내보내기
              </Button>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportTemplates}
                  className="hidden"
                />
                <Button variant="outline" size="sm">
                  <Upload className="w-4 h-4 mr-1" />
                  가져오기
                </Button>
              </label>
              <Button onClick={handleCreateTemplate}>
                <Plus className="w-4 h-4 mr-1" />
                새 프롬프트
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 필터 및 검색 */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="프롬프트 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="카테고리" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 카테고리</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category.name} value={category.name}>
                      {category.icon} {category.name}
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
                variant={showSystemPrompts ? "default" : "outline"}
                size="sm"
                onClick={() => setShowSystemPrompts(!showSystemPrompts)}
              >
                시스템
              </Button>
            </div>
          </div>

          {/* 통계 정보 */}
          <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
            <span>총 {filteredTemplates.length}개의 프롬프트</span>
            <span>•</span>
            <span>즐겨찾기 {templates.filter(t => t.is_favorite).length}개</span>
            <span>•</span>
            <span>시스템 프롬프트 {templates.filter(t => t.is_system_prompt).length}개</span>
          </div>

          {/* 템플릿 목록 */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">로딩 중...</div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <div className="text-lg mb-2">프롬프트가 없습니다</div>
              <div className="text-sm mb-4">새로운 프롬프트를 생성해보세요</div>
              <Button onClick={handleCreateTemplate}>
                <Plus className="w-4 h-4 mr-1" />
                첫 번째 프롬프트 만들기
              </Button>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'template-grid' : 'template-list'}>
              {filteredTemplates.map(template => 
                viewMode === 'grid' ? renderTemplateCard(template) : renderTemplateList(template)
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
