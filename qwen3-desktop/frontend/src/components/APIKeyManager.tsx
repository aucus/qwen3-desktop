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
  Plus, 
  Search, 
  Settings, 
  Copy,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  Key,
  Shield,
  Clock,
  User,
  Activity,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pause,
  Calendar,
  BarChart3,
  History,
  Tag,
  Edit,
  Save,
  X
} from 'lucide-react';
import { apiService } from '../services/apiService';
import './APIKeyManager.css';

interface APIKey {
  id: string;
  name: string;
  permissions: string[];
  created_at: string;
  expires_at?: string;
  last_used?: string;
  usage_count: number;
  status: string;
  description?: string;
  tags: string[];
}

interface KeyUsage {
  key_id: string;
  timestamp: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_time: number;
  ip_address: string;
  user_agent: string;
}

interface Permission {
  value: string;
  name: string;
  description: string;
}

export const APIKeyManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('keys');
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedKey, setSelectedKey] = useState<APIKey | null>(null);
  const [keyUsage, setKeyUsage] = useState<KeyUsage[]>([]);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);

  // 새 키 생성 폼 상태
  const [newKeyForm, setNewKeyForm] = useState({
    name: '',
    permissions: [] as string[],
    expires_at: '',
    description: '',
    tags: [] as string[]
  });

  // 편집 폼 상태
  const [editForm, setEditForm] = useState({
    name: '',
    permissions: [] as string[],
    expires_at: '',
    description: '',
    tags: [] as string[]
  });

  useEffect(() => {
    loadAPIKeys();
    loadPermissions();
  }, []);

  const loadAPIKeys = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/api/keys');
      if (response.success) {
        setApiKeys(response.keys);
      }
    } catch (error) {
      console.error('API 키 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async () => {
    try {
      const response = await apiService.get('/api/keys/permissions');
      if (response.success) {
        setPermissions(response.permissions);
      }
    } catch (error) {
      console.error('권한 로드 실패:', error);
    }
  };

  const handleCreateAPIKey = async () => {
    try {
      const response = await apiService.post('/api/keys', {
        name: newKeyForm.name,
        permissions: newKeyForm.permissions,
        expires_at: newKeyForm.expires_at || null,
        description: newKeyForm.description,
        tags: newKeyForm.tags
      });

      if (response.success) {
        await loadAPIKeys();
        setShowCreateModal(false);
        setNewKeyForm({
          name: '',
          permissions: [],
          expires_at: '',
          description: '',
          tags: []
        });
        
        // 새로 생성된 API 키 표시
        setShowApiKey(response.api_key);
      }
    } catch (error) {
      console.error('API 키 생성 실패:', error);
    }
  };

  const handleUpdateAPIKey = async () => {
    if (!selectedKey) return;

    try {
      const response = await apiService.put(`/api/keys/${selectedKey.id}`, {
        name: editForm.name,
        permissions: editForm.permissions,
        expires_at: editForm.expires_at || null,
        description: editForm.description,
        tags: editForm.tags
      });

      if (response.success) {
        await loadAPIKeys();
        setShowEditModal(false);
        setSelectedKey(null);
      }
    } catch (error) {
      console.error('API 키 업데이트 실패:', error);
    }
  };

  const handleRevokeAPIKey = async (keyId: string) => {
    if (!confirm('정말로 이 API 키를 폐기하시겠습니까?')) return;

    try {
      const response = await apiService.post(`/api/keys/${keyId}/revoke`);
      if (response.success) {
        await loadAPIKeys();
      }
    } catch (error) {
      console.error('API 키 폐기 실패:', error);
    }
  };

  const handleDeleteAPIKey = async (keyId: string) => {
    if (!confirm('정말로 이 API 키를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

    try {
      const response = await apiService.delete(`/api/keys/${keyId}`);
      if (response.success) {
        await loadAPIKeys();
      }
    } catch (error) {
      console.error('API 키 삭제 실패:', error);
    }
  };

  const handleViewUsage = async (keyId: string) => {
    try {
      const response = await apiService.get(`/api/keys/${keyId}/usage`);
      if (response.success) {
        setKeyUsage(response.usage);
        setShowUsageModal(true);
      }
    } catch (error) {
      console.error('사용 기록 로드 실패:', error);
    }
  };

  const handleEditKey = (key: APIKey) => {
    setSelectedKey(key);
    setEditForm({
      name: key.name,
      permissions: key.permissions,
      expires_at: key.expires_at || '',
      description: key.description || '',
      tags: key.tags
    });
    setShowEditModal(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'inactive':
        return <Pause className="w-4 h-4 text-gray-500" />;
      case 'expired':
        return <Clock className="w-4 h-4 text-orange-500" />;
      case 'revoked':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'expired':
        return 'bg-orange-100 text-orange-800';
      case 'revoked':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const filteredKeys = apiKeys.filter(key => {
    const matchesSearch = searchQuery === '' || 
      key.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (key.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = selectedStatus === 'all' || key.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="api-key-manager">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              API 키 관리
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                새 API 키
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="api-key-tabs">
            <TabsList className="tabs-list">
              <TabsTrigger value="keys" className="tab-trigger">
                <Key className="w-4 h-4 mr-2" />
                API 키
              </TabsTrigger>
              <TabsTrigger value="usage" className="tab-trigger">
                <Activity className="w-4 h-4 mr-2" />
                사용량
              </TabsTrigger>
            </TabsList>

            <TabsContent value="keys" className="tab-content">
              <div className="keys-section">
                {/* 검색 및 필터 */}
                <div className="search-filters">
                  <div className="search-box">
                    <Search className="w-4 h-4" />
                    <Input
                      placeholder="API 키 검색..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">모든 상태</SelectItem>
                      <SelectItem value="active">활성</SelectItem>
                      <SelectItem value="inactive">비활성</SelectItem>
                      <SelectItem value="expired">만료</SelectItem>
                      <SelectItem value="revoked">폐기</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* API 키 목록 */}
                <div className="keys-container">
                  {loading ? (
                    <div className="loading-state">
                      <div className="loading-spinner"></div>
                      <div>API 키 로딩 중...</div>
                    </div>
                  ) : (
                    <div className="keys-grid">
                      {filteredKeys.map(key => (
                        <Card key={key.id} className="key-card">
                          <CardHeader className="card-header">
                            <div className="card-title">
                              <div className="title-content">
                                <h3>{key.name}</h3>
                                <div className="card-badges">
                                  {getStatusIcon(key.status)}
                                  <Badge className={getStatusColor(key.status)}>
                                    {key.status}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {key.permissions.length} 권한
                                  </Badge>
                                </div>
                              </div>
                              <div className="card-actions">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleViewUsage(key.id)}
                                >
                                  <Activity className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditKey(key)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRevokeAPIKey(key.id)}
                                  disabled={key.status === 'revoked'}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteAPIKey(key.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          
                          <CardContent className="card-content">
                            {key.description && (
                              <p className="description">{key.description}</p>
                            )}
                            
                            <div className="key-meta">
                              <div className="meta-item">
                                <User className="w-3 h-3" />
                                <span>사용 횟수: {key.usage_count}</span>
                              </div>
                              <div className="meta-item">
                                <Calendar className="w-3 h-3" />
                                <span>생성: {new Date(key.created_at).toLocaleDateString()}</span>
                              </div>
                              {key.last_used && (
                                <div className="meta-item">
                                  <Clock className="w-3 h-3" />
                                  <span>마지막 사용: {new Date(key.last_used).toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>

                            <div className="key-permissions">
                              {key.permissions.map(permission => (
                                <Badge key={permission} variant="outline" className="text-xs">
                                  {permission}
                                </Badge>
                              ))}
                            </div>

                            {key.tags.length > 0 && (
                              <div className="key-tags">
                                {key.tags.map(tag => (
                                  <Badge key={tag} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {key.expires_at && (
                              <div className="expiry-info">
                                <Clock className="w-3 h-3" />
                                <span>만료: {new Date(key.expires_at).toLocaleDateString()}</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {!loading && filteredKeys.length === 0 && (
                    <div className="empty-state">
                      <Key className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <div className="text-lg mb-2">API 키가 없습니다</div>
                      <div className="text-sm text-gray-500 mb-4">
                        새로운 API 키를 생성해보세요
                      </div>
                      <Button onClick={() => setShowCreateModal(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        첫 번째 API 키 만들기
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="usage" className="tab-content">
              <div className="usage-section">
                <div className="usage-stats">
                  <Card>
                    <CardHeader>
                      <CardTitle>사용량 통계</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="stats-grid">
                        <div className="stat-item">
                          <div className="stat-number">{apiKeys.length}</div>
                          <div className="stat-label">총 API 키</div>
                        </div>
                        <div className="stat-item">
                          <div className="stat-number">
                            {apiKeys.filter(k => k.status === 'active').length}
                          </div>
                          <div className="stat-label">활성 키</div>
                        </div>
                        <div className="stat-item">
                          <div className="stat-number">
                            {apiKeys.reduce((sum, key) => sum + key.usage_count, 0)}
                          </div>
                          <div className="stat-label">총 사용 횟수</div>
                        </div>
                        <div className="stat-item">
                          <div className="stat-number">
                            {apiKeys.filter(k => k.expires_at && new Date(k.expires_at) < new Date()).length}
                          </div>
                          <div className="stat-label">만료된 키</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* API 키 생성 모달 */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>새 API 키 생성</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="space-y-4">
                <div>
                  <Label>이름</Label>
                  <Input
                    value={newKeyForm.name}
                    onChange={(e) => setNewKeyForm({...newKeyForm, name: e.target.value})}
                    placeholder="API 키 이름"
                  />
                </div>
                
                <div>
                  <Label>설명</Label>
                  <Input
                    value={newKeyForm.description}
                    onChange={(e) => setNewKeyForm({...newKeyForm, description: e.target.value})}
                    placeholder="API 키 설명"
                  />
                </div>
                
                <div>
                  <Label>권한</Label>
                  <div className="permissions-grid">
                    {permissions.map(permission => (
                      <label key={permission.value} className="permission-item">
                        <input
                          type="checkbox"
                          checked={newKeyForm.permissions.includes(permission.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewKeyForm({
                                ...newKeyForm,
                                permissions: [...newKeyForm.permissions, permission.value]
                              });
                            } else {
                              setNewKeyForm({
                                ...newKeyForm,
                                permissions: newKeyForm.permissions.filter(p => p !== permission.value)
                              });
                            }
                          }}
                        />
                        <span>{permission.name}</span>
                        <span className="text-xs text-gray-500">{permission.description}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <Label>만료일</Label>
                  <Input
                    type="datetime-local"
                    value={newKeyForm.expires_at}
                    onChange={(e) => setNewKeyForm({...newKeyForm, expires_at: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label>태그</Label>
                  <Input
                    value={newKeyForm.tags.join(', ')}
                    onChange={(e) => setNewKeyForm({
                      ...newKeyForm,
                      tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                    })}
                    placeholder="태그1, 태그2, 태그3"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                취소
              </Button>
              <Button onClick={handleCreateAPIKey} disabled={!newKeyForm.name}>
                <Key className="w-4 h-4 mr-1" />
                생성
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* API 키 편집 모달 */}
      {showEditModal && selectedKey && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>API 키 편집</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowEditModal(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="space-y-4">
                <div>
                  <Label>이름</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    placeholder="API 키 이름"
                  />
                </div>
                
                <div>
                  <Label>설명</Label>
                  <Input
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    placeholder="API 키 설명"
                  />
                </div>
                
                <div>
                  <Label>권한</Label>
                  <div className="permissions-grid">
                    {permissions.map(permission => (
                      <label key={permission.value} className="permission-item">
                        <input
                          type="checkbox"
                          checked={editForm.permissions.includes(permission.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditForm({
                                ...editForm,
                                permissions: [...editForm.permissions, permission.value]
                              });
                            } else {
                              setEditForm({
                                ...editForm,
                                permissions: editForm.permissions.filter(p => p !== permission.value)
                              });
                            }
                          }}
                        />
                        <span>{permission.name}</span>
                        <span className="text-xs text-gray-500">{permission.description}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <Label>만료일</Label>
                  <Input
                    type="datetime-local"
                    value={editForm.expires_at}
                    onChange={(e) => setEditForm({...editForm, expires_at: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label>태그</Label>
                  <Input
                    value={editForm.tags.join(', ')}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                    })}
                    placeholder="태그1, 태그2, 태그3"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                취소
              </Button>
              <Button onClick={handleUpdateAPIKey}>
                <Save className="w-4 h-4 mr-1" />
                저장
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 사용 기록 모달 */}
      {showUsageModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>사용 기록</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowUsageModal(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="usage-list">
                {keyUsage.map((usage, index) => (
                  <div key={index} className="usage-item">
                    <div className="usage-header">
                      <span className="usage-method">{usage.method}</span>
                      <span className="usage-endpoint">{usage.endpoint}</span>
                      <span className={`usage-status ${usage.status_code < 400 ? 'success' : 'error'}`}>
                        {usage.status_code}
                      </span>
                    </div>
                    <div className="usage-details">
                      <span>{new Date(usage.timestamp).toLocaleString()}</span>
                      <span>{usage.response_time.toFixed(2)}ms</span>
                      <span>{usage.ip_address}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowUsageModal(false)}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 새로 생성된 API 키 표시 모달 */}
      {showApiKey && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>API 키 생성 완료</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowApiKey(null)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="space-y-4">
                <div className="alert alert-warning">
                  <AlertTriangle className="w-4 h-4" />
                  <span>이 API 키는 한 번만 표시됩니다. 안전한 곳에 저장하세요.</span>
                </div>
                
                <div>
                  <Label>API 키</Label>
                  <div className="api-key-display">
                    <Input
                      value={showApiKey}
                      readOnly
                      className="font-mono"
                    />
                    <Button
                      size="sm"
                      onClick={() => copyToClipboard(showApiKey)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button onClick={() => setShowApiKey(null)}>
                확인
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
