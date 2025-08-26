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
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Copy, 
  Download,
  Upload,
  Eye,
  Settings,
  Merge,
  Zap,
  Brain,
  Clock,
  HardDrive
} from 'lucide-react';
import { apiService } from '../services/apiService';
import './ContextManager.css';

interface ContextItem {
  id: string;
  type: string;
  content: string;
  metadata: { [key: string]: any };
  created_at: string;
  accessed_at: string;
  priority: number;
  size: number;
  compressed: boolean;
}

interface ContextSession {
  session_id: string;
  user_id: string;
  items: ContextItem[];
  max_size: number;
  max_items: number;
  created_at: string;
  updated_at: string;
}

interface ContextType {
  value: string;
  name: string;
  description: string;
}

export const ContextManager: React.FC = () => {
  const [sessions, setSessions] = useState<ContextSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ContextSession | null>(null);
  const [contextTypes, setContextTypes] = useState<ContextType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showOptimize, setShowOptimize] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  // 새 세션 폼
  const [newSession, setNewSession] = useState({
    user_id: '',
    max_size: 10000,
    max_items: 100
  });

  // 새 아이템 폼
  const [newItem, setNewItem] = useState({
    context_type: 'chat',
    content: '',
    metadata: {},
    priority: 0
  });

  // 최적화 설정
  const [optimizeSettings, setOptimizeSettings] = useState({
    target_size: 8000
  });

  useEffect(() => {
    loadContextTypes();
    loadSessions();
  }, []);

  const loadContextTypes = async () => {
    try {
      const response = await apiService.get('/api/context/types');
      if (response.success) {
        setContextTypes(response.types);
      }
    } catch (error) {
      console.error('컨텍스트 타입 로드 실패:', error);
    }
  };

  const loadSessions = async () => {
    try {
      setLoading(true);
      // 실제로는 세션 목록을 가져오는 API가 필요합니다
      // 현재는 더미 데이터 사용
      const dummySessions: ContextSession[] = [
        {
          session_id: 'session-1',
          user_id: 'user-1',
          items: [],
          max_size: 10000,
          max_items: 100,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      setSessions(dummySessions);
    } catch (error) {
      console.error('세션 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    try {
      const response = await apiService.post('/api/context/sessions', newSession);
      if (response.success) {
        await loadSessions();
        setShowCreateSession(false);
        setNewSession({ user_id: '', max_size: 10000, max_items: 100 });
      }
    } catch (error) {
      console.error('세션 생성 실패:', error);
    }
  };

  const addContextItem = async () => {
    if (!selectedSession) return;

    try {
      const response = await apiService.post(`/api/context/sessions/${selectedSession.session_id}/items`, newItem);
      if (response.success) {
        await loadSessions();
        setShowAddItem(false);
        setNewItem({ context_type: 'chat', content: '', metadata: {}, priority: 0 });
      }
    } catch (error) {
      console.error('컨텍스트 아이템 추가 실패:', error);
    }
  };

  const optimizeContext = async () => {
    if (!selectedSession) return;

    try {
      const response = await apiService.post(`/api/context/sessions/${selectedSession.session_id}/optimize`, optimizeSettings);
      if (response.success) {
        await loadSessions();
        setShowOptimize(false);
      }
    } catch (error) {
      console.error('컨텍스트 최적화 실패:', error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('정말로 이 세션을 삭제하시겠습니까?')) return;

    try {
      const response = await apiService.delete(`/api/context/sessions/${sessionId}`);
      if (response.success) {
        await loadSessions();
        if (selectedSession?.session_id === sessionId) {
          setSelectedSession(null);
        }
      }
    } catch (error) {
      console.error('세션 삭제 실패:', error);
    }
  };

  const exportContext = async (sessionId: string) => {
    try {
      const response = await apiService.post(`/api/context/sessions/${sessionId}/export`, { format: 'json' });
      if (response.success) {
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `context_export_${sessionId}_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('컨텍스트 내보내기 실패:', error);
    }
  };

  const getContextTypeInfo = (type: string) => {
    return contextTypes.find(t => t.value === type) || { name: type, description: '알 수 없는 타입' };
  };

  const getSessionStats = (session: ContextSession) => {
    const totalSize = session.items.reduce((sum, item) => sum + item.size, 0);
    const typeCounts: { [key: string]: number } = {};
    
    session.items.forEach(item => {
      typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
    });

    return {
      totalSize,
      typeCounts,
      compressedCount: session.items.filter(item => item.compressed).length
    };
  };

  const filteredItems = selectedSession?.items.filter(item => {
    const matchesSearch = searchQuery === '' || 
      item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.type.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = selectedType === 'all' || item.type === selectedType;
    
    return matchesSearch && matchesType;
  }) || [];

  return (
    <div className="context-manager">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              컨텍스트 관리
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOptimize(true)}
                disabled={!selectedSession}
              >
                <Zap className="w-4 h-4 mr-1" />
                최적화
              </Button>
              <Button onClick={() => setShowCreateSession(true)}>
                <Plus className="w-4 h-4 mr-1" />
                새 세션
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 세션 목록 */}
            <div className="lg:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">세션 목록</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreateSession(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                {sessions.map(session => {
                  const stats = getSessionStats(session);
                  return (
                    <div
                      key={session.session_id}
                      className={`session-item ${selectedSession?.session_id === session.session_id ? 'selected' : ''}`}
                      onClick={() => setSelectedSession(session)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-sm truncate">
                            {session.session_id}
                          </div>
                          <div className="text-xs text-gray-500">
                            {session.items.length}개 아이템 • {stats.totalSize} 바이트
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              exportContext(session.session_id);
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSession(session.session_id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 컨텍스트 아이템 목록 */}
            <div className="lg:col-span-2">
              {selectedSession ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium">컨텍스트 아이템</h3>
                      <p className="text-sm text-gray-500">
                        세션: {selectedSession.session_id}
                      </p>
                    </div>
                    <Button onClick={() => setShowAddItem(true)}>
                      <Plus className="w-4 h-4 mr-1" />
                      아이템 추가
                    </Button>
                  </div>

                  {/* 필터 및 검색 */}
                  <div className="flex gap-4 mb-4">
                    <div className="flex-1">
                      <Input
                        placeholder="컨텍스트 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Select value={selectedType} onValueChange={setSelectedType}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">모든 타입</SelectItem>
                        {contextTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 통계 정보 */}
                  {(() => {
                    const stats = getSessionStats(selectedSession);
                    return (
                      <div className="grid grid-cols-4 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="text-center">
                          <div className="text-lg font-semibold">{selectedSession.items.length}</div>
                          <div className="text-xs text-gray-500">총 아이템</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold">{stats.totalSize}</div>
                          <div className="text-xs text-gray-500">총 크기</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold">{stats.compressedCount}</div>
                          <div className="text-xs text-gray-500">압축됨</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold">
                            {Math.round((stats.totalSize / selectedSession.max_size) * 100)}%
                          </div>
                          <div className="text-xs text-gray-500">사용률</div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 아이템 목록 */}
                  <div className="space-y-2">
                    {filteredItems.map(item => {
                      const typeInfo = getContextTypeInfo(item.type);
                      return (
                        <div key={item.id} className="context-item">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline">{typeInfo.name}</Badge>
                                {item.compressed && <Badge variant="secondary">압축됨</Badge>}
                                <Badge variant="outline">우선순위 {item.priority}</Badge>
                              </div>
                              <div className="text-sm text-gray-600 mb-2 line-clamp-2">
                                {item.content}
                              </div>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span>크기: {item.size} 바이트</span>
                                <span>생성: {new Date(item.created_at).toLocaleDateString()}</span>
                                <span>접근: {new Date(item.accessed_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {filteredItems.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Brain className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <div>컨텍스트 아이템이 없습니다</div>
                      <div className="text-sm">새로운 아이템을 추가해보세요</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Brain className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <div className="text-lg mb-2">세션을 선택하세요</div>
                  <div className="text-sm">왼쪽에서 세션을 선택하여 컨텍스트를 관리하세요</div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 새 세션 모달 */}
      {showCreateSession && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>새 세션 생성</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCreateSession(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="space-y-4">
                <div>
                  <Label>사용자 ID</Label>
                  <Input
                    value={newSession.user_id}
                    onChange={(e) => setNewSession(prev => ({ ...prev, user_id: e.target.value }))}
                    placeholder="사용자 ID"
                  />
                </div>
                <div>
                  <Label>최대 크기 (바이트)</Label>
                  <Input
                    type="number"
                    value={newSession.max_size}
                    onChange={(e) => setNewSession(prev => ({ ...prev, max_size: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label>최대 아이템 수</Label>
                  <Input
                    type="number"
                    value={newSession.max_items}
                    onChange={(e) => setNewSession(prev => ({ ...prev, max_items: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowCreateSession(false)}>
                취소
              </Button>
              <Button onClick={createSession}>
                생성
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 새 아이템 모달 */}
      {showAddItem && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>컨텍스트 아이템 추가</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAddItem(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="space-y-4">
                <div>
                  <Label>타입</Label>
                  <Select value={newItem.context_type} onValueChange={(value) => setNewItem(prev => ({ ...prev, context_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {contextTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>내용</Label>
                  <Textarea
                    value={newItem.content}
                    onChange={(e) => setNewItem(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="컨텍스트 내용"
                    rows={4}
                  />
                </div>
                <div>
                  <Label>우선순위</Label>
                  <Input
                    type="number"
                    value={newItem.priority}
                    onChange={(e) => setNewItem(prev => ({ ...prev, priority: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowAddItem(false)}>
                취소
              </Button>
              <Button onClick={addContextItem}>
                추가
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 최적화 모달 */}
      {showOptimize && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>컨텍스트 최적화</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowOptimize(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="space-y-4">
                <div>
                  <Label>목표 크기 (바이트)</Label>
                  <Input
                    type="number"
                    value={optimizeSettings.target_size}
                    onChange={(e) => setOptimizeSettings(prev => ({ ...prev, target_size: Number(e.target.value) }))}
                  />
                </div>
                <div className="text-sm text-gray-600">
                  <p>• 우선순위가 낮은 아이템부터 제거됩니다</p>
                  <p>• 큰 아이템은 자동으로 압축됩니다</p>
                  <p>• 현재 크기: {selectedSession ? getSessionStats(selectedSession).totalSize : 0} 바이트</p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowOptimize(false)}>
                취소
              </Button>
              <Button onClick={optimizeContext}>
                최적화
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
