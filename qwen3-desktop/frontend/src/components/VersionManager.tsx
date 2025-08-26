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
  Plus, 
  GitBranch, 
  GitCommit, 
  GitMerge, 
  GitCompare,
  RotateCcw,
  Tag,
  Download,
  Upload,
  Trash2,
  Eye,
  History,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  FileText
} from 'lucide-react';
import { apiService } from '../services/apiService';
import './VersionManager.css';

interface VersionMetadata {
  version: string;
  version_type: string;
  description: string;
  author: string;
  created_at: string;
  changes: Array<{
    type: string;
    field?: string;
    description: string;
  }>;
  tags: string[];
  is_stable: boolean;
  parent_version?: string;
  merge_source?: string;
}

interface VersionDiff {
  version_from: string;
  version_to: string;
  changes: Array<{
    type: string;
    field: string;
    added_lines: number;
    removed_lines: number;
    description: string;
  }>;
  added_lines: number;
  removed_lines: number;
  modified_files: string[];
  diff_summary: string;
}

interface VersionType {
  value: string;
  name: string;
  description: string;
}

interface ConflictStrategy {
  value: string;
  name: string;
  description: string;
}

export const VersionManager: React.FC = () => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [versionHistory, setVersionHistory] = useState<VersionMetadata[]>([]);
  const [versionTypes, setVersionTypes] = useState<VersionType[]>([]);
  const [conflictStrategies, setConflictStrategies] = useState<ConflictStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateVersion, setShowCreateVersion] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [showTag, setShowTag] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<VersionMetadata | null>(null);
  const [compareResult, setCompareResult] = useState<VersionDiff | null>(null);

  // 새 버전 폼
  const [newVersion, setNewVersion] = useState({
    template_id: '',
    version_type: 'patch',
    description: '',
    author: '',
    content: {},
    tags: [] as string[],
    parent_version: ''
  });

  // 병합 폼
  const [mergeForm, setMergeForm] = useState({
    source_version: '',
    target_version: '',
    author: '',
    description: '',
    conflict_strategy: 'manual'
  });

  // 태그 폼
  const [tagForm, setTagForm] = useState({
    tags: [] as string[],
    is_stable: false
  });

  useEffect(() => {
    loadVersionTypes();
    loadConflictStrategies();
  }, []);

  useEffect(() => {
    if (selectedTemplateId) {
      loadVersionHistory(selectedTemplateId);
    }
  }, [selectedTemplateId]);

  const loadVersionTypes = async () => {
    try {
      const response = await apiService.get('/api/versions/types');
      if (response.success) {
        setVersionTypes(response.types);
      }
    } catch (error) {
      console.error('버전 타입 로드 실패:', error);
    }
  };

  const loadConflictStrategies = async () => {
    try {
      const response = await apiService.get('/api/versions/conflict-strategies');
      if (response.success) {
        setConflictStrategies(response.strategies);
      }
    } catch (error) {
      console.error('충돌 해결 전략 로드 실패:', error);
    }
  };

  const loadVersionHistory = async (templateId: string) => {
    try {
      setLoading(true);
      const response = await apiService.get(`/api/versions/${templateId}/history`);
      if (response.success) {
        setVersionHistory(response.history);
      }
    } catch (error) {
      console.error('버전 히스토리 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const createVersion = async () => {
    try {
      const response = await apiService.post('/api/versions/create', newVersion);
      if (response.success) {
        await loadVersionHistory(selectedTemplateId);
        setShowCreateVersion(false);
        setNewVersion({
          template_id: '',
          version_type: 'patch',
          description: '',
          author: '',
          content: {},
          tags: [],
          parent_version: ''
        });
      }
    } catch (error) {
      console.error('버전 생성 실패:', error);
    }
  };

  const compareVersions = async () => {
    if (!selectedTemplateId || !mergeForm.source_version || !mergeForm.target_version) return;

    try {
      const response = await apiService.post(`/api/versions/${selectedTemplateId}/compare`, {
        version_from: mergeForm.source_version,
        version_to: mergeForm.target_version
      });
      if (response.success) {
        setCompareResult(response.diff);
        setShowCompare(true);
      }
    } catch (error) {
      console.error('버전 비교 실패:', error);
    }
  };

  const mergeVersions = async () => {
    if (!selectedTemplateId) return;

    try {
      const response = await apiService.post(`/api/versions/${selectedTemplateId}/merge`, mergeForm);
      if (response.success) {
        await loadVersionHistory(selectedTemplateId);
        setShowMerge(false);
        setMergeForm({
          source_version: '',
          target_version: '',
          author: '',
          description: '',
          conflict_strategy: 'manual'
        });
      }
    } catch (error) {
      console.error('버전 병합 실패:', error);
    }
  };

  const rollbackToVersion = async (version: string) => {
    if (!selectedTemplateId || !confirm(`정말로 버전 ${version}로 롤백하시겠습니까?`)) return;

    try {
      const response = await apiService.post(`/api/versions/${selectedTemplateId}/rollback`, null, {
        params: { target_version: version }
      });
      if (response.success) {
        await loadVersionHistory(selectedTemplateId);
      }
    } catch (error) {
      console.error('버전 롤백 실패:', error);
    }
  };

  const tagVersion = async () => {
    if (!selectedTemplateId || !selectedVersion) return;

    try {
      const response = await apiService.post(`/api/versions/${selectedTemplateId}/${selectedVersion.version}/tag`, tagForm);
      if (response.success) {
        await loadVersionHistory(selectedTemplateId);
        setShowTag(false);
        setTagForm({ tags: [], is_stable: false });
      }
    } catch (error) {
      console.error('버전 태그 설정 실패:', error);
    }
  };

  const deleteVersion = async (version: string) => {
    if (!selectedTemplateId || !confirm(`정말로 버전 ${version}를 삭제하시겠습니까?`)) return;

    try {
      const response = await apiService.delete(`/api/versions/${selectedTemplateId}/${version}`);
      if (response.success) {
        await loadVersionHistory(selectedTemplateId);
      }
    } catch (error) {
      console.error('버전 삭제 실패:', error);
    }
  };

  const exportVersion = async (version: string) => {
    if (!selectedTemplateId) return;

    try {
      const response = await apiService.post(`/api/versions/${selectedTemplateId}/${version}/export`, { format: 'json' });
      if (response.success) {
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `version_export_${selectedTemplateId}_${version}_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('버전 내보내기 실패:', error);
    }
  };

  const getVersionTypeInfo = (type: string) => {
    return versionTypes.find(t => t.value === type) || { name: type, description: '알 수 없는 타입' };
  };

  const getVersionIcon = (type: string) => {
    switch (type) {
      case 'major': return <TrendingUp className="w-4 h-4" />;
      case 'minor': return <GitBranch className="w-4 h-4" />;
      case 'patch': return <GitCommit className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getVersionColor = (type: string) => {
    switch (type) {
      case 'major': return 'bg-red-100 text-red-800';
      case 'minor': return 'bg-blue-100 text-blue-800';
      case 'patch': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="version-manager">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              버전 관리
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMerge(true)}
                disabled={!selectedTemplateId}
              >
                <GitMerge className="w-4 h-4 mr-1" />
                병합
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCompare(true)}
                disabled={!selectedTemplateId}
              >
                <GitCompare className="w-4 h-4 mr-1" />
                비교
              </Button>
              <Button onClick={() => setShowCreateVersion(true)}>
                <Plus className="w-4 h-4 mr-1" />
                새 버전
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 템플릿 선택 */}
          <div className="mb-6">
            <Label>템플릿 선택</Label>
            <Input
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              placeholder="템플릿 ID를 입력하세요"
              className="mt-1"
            />
          </div>

          {selectedTemplateId ? (
            <div>
              {/* 버전 히스토리 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">버전 히스토리</h3>
                  <div className="text-sm text-gray-500">
                    총 {versionHistory.length}개 버전
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                    <div className="mt-2 text-gray-500">버전 히스토리 로딩 중...</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {versionHistory.map((version, index) => {
                      const typeInfo = getVersionTypeInfo(version.version_type);
                      return (
                        <div key={version.version} className="version-item">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="flex items-center gap-1">
                                  {getVersionIcon(version.version_type)}
                                  <span className="font-mono text-sm font-medium">
                                    v{version.version}
                                  </span>
                                </div>
                                <Badge className={getVersionColor(version.version_type)}>
                                  {typeInfo.name}
                                </Badge>
                                {version.is_stable && (
                                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    안정
                                  </Badge>
                                )}
                                {version.tags.map(tag => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                              
                              <div className="text-sm font-medium mb-1">
                                {version.description}
                              </div>
                              
                              <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {version.author}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(version.created_at).toLocaleDateString()}
                                </span>
                                {version.parent_version && (
                                  <span className="flex items-center gap-1">
                                    <GitBranch className="w-3 h-3" />
                                    부모: v{version.parent_version}
                                  </span>
                                )}
                              </div>

                              {/* 변경사항 */}
                              {version.changes.length > 0 && (
                                <div className="text-xs text-gray-600">
                                  <div className="font-medium mb-1">변경사항:</div>
                                  <ul className="list-disc list-inside space-y-1">
                                    {version.changes.map((change, idx) => (
                                      <li key={idx}>
                                        {change.description}
                                        {change.field && ` (${change.field})`}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedVersion(version);
                                  setShowTag(true);
                                }}
                              >
                                <Tag className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => exportVersion(version.version)}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => rollbackToVersion(version.version)}
                                disabled={index === versionHistory.length - 1}
                              >
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteVersion(version.version)}
                                disabled={index === versionHistory.length - 1}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!loading && versionHistory.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <GitBranch className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <div>버전 히스토리가 없습니다</div>
                    <div className="text-sm">새로운 버전을 생성해보세요</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <GitBranch className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <div className="text-lg mb-2">템플릿을 선택하세요</div>
              <div className="text-sm">템플릿 ID를 입력하여 버전을 관리하세요</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 새 버전 모달 */}
      {showCreateVersion && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>새 버전 생성</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCreateVersion(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="space-y-4">
                <div>
                  <Label>템플릿 ID</Label>
                  <Input
                    value={newVersion.template_id}
                    onChange={(e) => setNewVersion(prev => ({ ...prev, template_id: e.target.value }))}
                    placeholder="템플릿 ID"
                  />
                </div>
                <div>
                  <Label>버전 타입</Label>
                  <Select value={newVersion.version_type} onValueChange={(value) => setNewVersion(prev => ({ ...prev, version_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {versionTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>설명</Label>
                  <Textarea
                    value={newVersion.description}
                    onChange={(e) => setNewVersion(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="버전 설명"
                    rows={3}
                  />
                </div>
                <div>
                  <Label>작성자</Label>
                  <Input
                    value={newVersion.author}
                    onChange={(e) => setNewVersion(prev => ({ ...prev, author: e.target.value }))}
                    placeholder="작성자"
                  />
                </div>
                <div>
                  <Label>부모 버전 (선택사항)</Label>
                  <Input
                    value={newVersion.parent_version}
                    onChange={(e) => setNewVersion(prev => ({ ...prev, parent_version: e.target.value }))}
                    placeholder="부모 버전 (예: 1.0.0)"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowCreateVersion(false)}>
                취소
              </Button>
              <Button onClick={createVersion}>
                생성
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 버전 비교 모달 */}
      {showCompare && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>버전 비교</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCompare(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>소스 버전</Label>
                    <Input
                      value={mergeForm.source_version}
                      onChange={(e) => setMergeForm(prev => ({ ...prev, source_version: e.target.value }))}
                      placeholder="예: 1.0.0"
                    />
                  </div>
                  <div>
                    <Label>타겟 버전</Label>
                    <Input
                      value={mergeForm.target_version}
                      onChange={(e) => setMergeForm(prev => ({ ...prev, target_version: e.target.value }))}
                      placeholder="예: 1.1.0"
                    />
                  </div>
                </div>
                <Button onClick={compareVersions} className="w-full">
                  <GitCompare className="w-4 h-4 mr-1" />
                  비교
                </Button>

                {compareResult && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-2">비교 결과</h4>
                    <div className="text-sm space-y-2">
                      <div>소스: v{compareResult.version_from}</div>
                      <div>타겟: v{compareResult.version_to}</div>
                      <div>추가된 라인: {compareResult.added_lines}</div>
                      <div>삭제된 라인: {compareResult.removed_lines}</div>
                      <div>수정된 파일: {compareResult.modified_files.join(', ')}</div>
                      <div className="text-gray-600">{compareResult.diff_summary}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowCompare(false)}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 버전 병합 모달 */}
      {showMerge && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>버전 병합</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowMerge(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>소스 버전</Label>
                    <Input
                      value={mergeForm.source_version}
                      onChange={(e) => setMergeForm(prev => ({ ...prev, source_version: e.target.value }))}
                      placeholder="예: 1.0.0"
                    />
                  </div>
                  <div>
                    <Label>타겟 버전</Label>
                    <Input
                      value={mergeForm.target_version}
                      onChange={(e) => setMergeForm(prev => ({ ...prev, target_version: e.target.value }))}
                      placeholder="예: 1.1.0"
                    />
                  </div>
                </div>
                <div>
                  <Label>작성자</Label>
                  <Input
                    value={mergeForm.author}
                    onChange={(e) => setMergeForm(prev => ({ ...prev, author: e.target.value }))}
                    placeholder="작성자"
                  />
                </div>
                <div>
                  <Label>설명</Label>
                  <Textarea
                    value={mergeForm.description}
                    onChange={(e) => setMergeForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="병합 설명"
                    rows={3}
                  />
                </div>
                <div>
                  <Label>충돌 해결 전략</Label>
                  <Select value={mergeForm.conflict_strategy} onValueChange={(value) => setMergeForm(prev => ({ ...prev, conflict_strategy: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {conflictStrategies.map(strategy => (
                        <SelectItem key={strategy.value} value={strategy.value}>
                          {strategy.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowMerge(false)}>
                취소
              </Button>
              <Button onClick={mergeVersions}>
                <GitMerge className="w-4 h-4 mr-1" />
                병합
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 버전 태그 모달 */}
      {showTag && selectedVersion && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>버전 태그 설정</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowTag(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="space-y-4">
                <div>
                  <Label>태그 (쉼표로 구분)</Label>
                  <Input
                    value={tagForm.tags.join(', ')}
                    onChange={(e) => setTagForm(prev => ({ 
                      ...prev, 
                      tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                    }))}
                    placeholder="예: stable, production, v1.0"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_stable"
                    checked={tagForm.is_stable}
                    onChange={(e) => setTagForm(prev => ({ ...prev, is_stable: e.target.checked }))}
                  />
                  <Label htmlFor="is_stable">안정 버전으로 표시</Label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowTag(false)}>
                취소
              </Button>
              <Button onClick={tagVersion}>
                <Tag className="w-4 h-4 mr-1" />
                태그 설정
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
