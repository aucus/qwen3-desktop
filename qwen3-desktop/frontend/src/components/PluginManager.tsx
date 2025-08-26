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
  Download,
  Upload,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Package,
  Puzzle,
  Store,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  User,
  Star,
  Eye,
  Edit,
  Zap,
  Layers,
  Palette,
  Code,
  Globe
} from 'lucide-react';
import { apiService } from '../services/apiService';
import './PluginManager.css';

interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  plugin_type: string;
  dependencies: string[];
  permissions: string[];
  entry_point: string;
  config_schema: { [key: string]: any };
  icon?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  tags: string[];
}

interface PluginInfo {
  metadata: PluginMetadata;
  status: string;
  installed_at: string;
  enabled_at?: string;
  last_updated?: string;
  config: { [key: string]: any };
  error_message?: string;
}

interface PluginType {
  value: string;
  name: string;
  description: string;
}

export const PluginManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('installed');
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [marketplacePlugins, setMarketplacePlugins] = useState<any[]>([]);
  const [pluginTypes, setPluginTypes] = useState<PluginType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginInfo | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    loadPlugins();
    loadPluginTypes();
    loadMarketplacePlugins();
  }, []);

  const loadPlugins = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/api/plugins');
      if (response.success) {
        setPlugins(response.plugins);
      }
    } catch (error) {
      console.error('플러그인 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPluginTypes = async () => {
    try {
      const response = await apiService.get('/api/plugins/types');
      if (response.success) {
        setPluginTypes(response.types);
      }
    } catch (error) {
      console.error('플러그인 타입 로드 실패:', error);
    }
  };

  const loadMarketplacePlugins = async () => {
    try {
      const response = await apiService.get('/api/plugins/marketplace');
      if (response.success) {
        setMarketplacePlugins(response.plugins);
      }
    } catch (error) {
      console.error('마켓플레이스 로드 실패:', error);
    }
  };

  const handleInstallPlugin = async () => {
    if (!uploadFile) return;

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await apiService.post('/api/plugins/install', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.success) {
        await loadPlugins();
        setShowInstallModal(false);
        setUploadFile(null);
      }
    } catch (error) {
      console.error('플러그인 설치 실패:', error);
    }
  };

  const handleEnablePlugin = async (pluginName: string) => {
    try {
      const response = await apiService.post(`/api/plugins/${pluginName}/enable`);
      if (response.success) {
        await loadPlugins();
      }
    } catch (error) {
      console.error('플러그인 활성화 실패:', error);
    }
  };

  const handleDisablePlugin = async (pluginName: string) => {
    try {
      const response = await apiService.post(`/api/plugins/${pluginName}/disable`);
      if (response.success) {
        await loadPlugins();
      }
    } catch (error) {
      console.error('플러그인 비활성화 실패:', error);
    }
  };

  const handleUninstallPlugin = async (pluginName: string) => {
    if (!confirm(`정말로 플러그인 ${pluginName}을 제거하시겠습니까?`)) return;

    try {
      const response = await apiService.delete(`/api/plugins/${pluginName}`);
      if (response.success) {
        await loadPlugins();
      }
    } catch (error) {
      console.error('플러그인 제거 실패:', error);
    }
  };

  const handleUpdatePluginConfig = async (pluginName: string, config: { [key: string]: any }) => {
    try {
      const response = await apiService.put(`/api/plugins/${pluginName}/config`, { config });
      if (response.success) {
        await loadPlugins();
        setShowConfigModal(false);
      }
    } catch (error) {
      console.error('플러그인 설정 업데이트 실패:', error);
    }
  };

  const getPluginTypeIcon = (type: string) => {
    const iconMap: { [key: string]: React.ReactNode } = {
      'mcp_server': <Code className="w-4 h-4" />,
      'ui_component': <Layers className="w-4 h-4" />,
      'utility': <Zap className="w-4 h-4" />,
      'theme': <Palette className="w-4 h-4" />,
      'language': <Globe className="w-4 h-4" />
    };
    return iconMap[type] || <Package className="w-4 h-4" />;
  };

  const getPluginTypeColor = (type: string) => {
    const colorMap: { [key: string]: string } = {
      'mcp_server': 'bg-blue-100 text-blue-800',
      'ui_component': 'bg-green-100 text-green-800',
      'utility': 'bg-purple-100 text-purple-800',
      'theme': 'bg-pink-100 text-pink-800',
      'language': 'bg-orange-100 text-orange-800'
    };
    return colorMap[type] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'enabled':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'disabled':
        return <Pause className="w-4 h-4 text-gray-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'installing':
      case 'updating':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const filteredPlugins = plugins.filter(plugin => {
    const matchesSearch = searchQuery === '' || 
      plugin.metadata.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.metadata.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = selectedType === 'all' || plugin.metadata.plugin_type === selectedType;
    
    return matchesSearch && matchesType;
  });

  const filteredMarketplacePlugins = marketplacePlugins.filter(plugin => {
    const matchesSearch = searchQuery === '' || 
      plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = selectedType === 'all' || plugin.plugin_type === selectedType;
    
    return matchesSearch && matchesType;
  });

  return (
    <div className="plugin-manager">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Puzzle className="w-5 h-5" />
              플러그인 관리
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowInstallModal(true)}>
                <Upload className="w-4 h-4 mr-2" />
                플러그인 설치
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="plugin-tabs">
            <TabsList className="tabs-list">
              <TabsTrigger value="installed" className="tab-trigger">
                <Package className="w-4 h-4 mr-2" />
                설치됨
              </TabsTrigger>
              <TabsTrigger value="marketplace" className="tab-trigger">
                <Store className="w-4 h-4 mr-2" />
                마켓플레이스
              </TabsTrigger>
            </TabsList>

            <TabsContent value="installed" className="tab-content">
              <div className="plugins-section">
                {/* 검색 및 필터 */}
                <div className="search-filters">
                  <div className="search-box">
                    <Search className="w-4 h-4" />
                    <Input
                      placeholder="플러그인 검색..."
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
                      {pluginTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 플러그인 목록 */}
                <div className="plugins-container">
                  {loading ? (
                    <div className="loading-state">
                      <div className="loading-spinner"></div>
                      <div>플러그인 로딩 중...</div>
                    </div>
                  ) : (
                    <div className="plugins-grid">
                      {filteredPlugins.map(plugin => (
                        <Card key={plugin.metadata.name} className="plugin-card">
                          <CardHeader className="card-header">
                            <div className="card-title">
                              <div className="title-content">
                                <h3>{plugin.metadata.name}</h3>
                                <div className="card-badges">
                                  {getStatusIcon(plugin.status)}
                                  <Badge className={getPluginTypeColor(plugin.metadata.plugin_type)}>
                                    {getPluginTypeIcon(plugin.metadata.plugin_type)}
                                    {plugin.metadata.plugin_type}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    v{plugin.metadata.version}
                                  </Badge>
                                </div>
                              </div>
                              <div className="card-actions">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedPlugin(plugin);
                                    setShowConfigModal(true);
                                  }}
                                >
                                  <Settings className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUninstallPlugin(plugin.metadata.name)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          
                          <CardContent className="card-content">
                            <p className="description">{plugin.metadata.description}</p>
                            
                            <div className="plugin-meta">
                              <div className="meta-item">
                                <User className="w-3 h-3" />
                                <span>{plugin.metadata.author}</span>
                              </div>
                              <div className="meta-item">
                                <Clock className="w-3 h-3" />
                                <span>{new Date(plugin.installed_at).toLocaleDateString()}</span>
                              </div>
                            </div>

                            <div className="plugin-tags">
                              {plugin.metadata.tags.map(tag => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>

                            {plugin.error_message && (
                              <div className="error-message">
                                <AlertCircle className="w-4 h-4" />
                                <span>{plugin.error_message}</span>
                              </div>
                            )}

                            <div className="plugin-actions">
                              {plugin.status === 'enabled' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDisablePlugin(plugin.metadata.name)}
                                >
                                  <Pause className="w-4 h-4 mr-1" />
                                  비활성화
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleEnablePlugin(plugin.metadata.name)}
                                  disabled={plugin.status === 'error'}
                                >
                                  <Play className="w-4 h-4 mr-1" />
                                  활성화
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {!loading && filteredPlugins.length === 0 && (
                    <div className="empty-state">
                      <Puzzle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <div className="text-lg mb-2">설치된 플러그인이 없습니다</div>
                      <div className="text-sm text-gray-500 mb-4">
                        마켓플레이스에서 플러그인을 설치해보세요
                      </div>
                      <Button onClick={() => setActiveTab('marketplace')}>
                        <Store className="w-4 h-4 mr-2" />
                        마켓플레이스 보기
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="marketplace" className="tab-content">
              <div className="marketplace-section">
                {/* 검색 및 필터 */}
                <div className="search-filters">
                  <div className="search-box">
                    <Search className="w-4 h-4" />
                    <Input
                      placeholder="마켓플레이스 검색..."
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
                      {pluginTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 마켓플레이스 목록 */}
                <div className="marketplace-container">
                  <div className="marketplace-grid">
                    {filteredMarketplacePlugins.map(plugin => (
                      <Card key={plugin.name} className="marketplace-card">
                        <CardHeader className="card-header">
                          <div className="card-title">
                            <div className="title-content">
                              <h3>{plugin.name}</h3>
                              <div className="card-badges">
                                <Badge className={getPluginTypeColor(plugin.plugin_type)}>
                                  {getPluginTypeIcon(plugin.plugin_type)}
                                  {plugin.plugin_type}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  v{plugin.version}
                                </Badge>
                                {plugin.rating && (
                                  <div className="rating">
                                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                    <span>{plugin.rating}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="card-actions">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  // 플러그인 상세 정보 보기
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  // 플러그인 설치
                                }}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                설치
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="card-content">
                          <p className="description">{plugin.description}</p>
                          
                          <div className="plugin-meta">
                            <div className="meta-item">
                              <User className="w-3 h-3" />
                              <span>{plugin.author}</span>
                            </div>
                            <div className="meta-item">
                              <Download className="w-3 h-3" />
                              <span>{plugin.downloads || 0} 다운로드</span>
                            </div>
                          </div>

                          <div className="plugin-tags">
                            {plugin.tags?.map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {filteredMarketplacePlugins.length === 0 && (
                    <div className="empty-state">
                      <Store className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <div className="text-lg mb-2">플러그인을 찾을 수 없습니다</div>
                      <div className="text-sm text-gray-500">
                        다른 검색어를 시도해보세요
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 플러그인 설치 모달 */}
      {showInstallModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>플러그인 설치</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowInstallModal(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="space-y-4">
                <div>
                  <Label>플러그인 파일 (.zip)</Label>
                  <Input
                    type="file"
                    accept=".zip"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="text-sm text-gray-600">
                  <p>• 플러그인은 ZIP 파일 형태로 제공됩니다</p>
                  <p>• plugin.json 메타데이터 파일이 포함되어야 합니다</p>
                  <p>• 의존성은 자동으로 설치됩니다</p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowInstallModal(false)}>
                취소
              </Button>
              <Button onClick={handleInstallPlugin} disabled={!uploadFile}>
                <Upload className="w-4 h-4 mr-1" />
                설치
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 플러그인 설정 모달 */}
      {showConfigModal && selectedPlugin && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>플러그인 설정</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowConfigModal(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="space-y-4">
                <div>
                  <h4>{selectedPlugin.metadata.name}</h4>
                  <p className="text-sm text-gray-600">{selectedPlugin.metadata.description}</p>
                </div>
                
                <div className="config-section">
                  <Label>설정</Label>
                  <div className="config-fields">
                    {Object.entries(selectedPlugin.metadata.config_schema).map(([key, schema]) => (
                      <div key={key} className="config-field">
                        <Label>{key}</Label>
                        <Input
                          type={schema.type === 'boolean' ? 'checkbox' : 'text'}
                          value={selectedPlugin.config[key] || ''}
                          onChange={(e) => {
                            const newConfig = { ...selectedPlugin.config };
                            newConfig[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                            setSelectedPlugin({ ...selectedPlugin, config: newConfig });
                          }}
                        />
                        {schema.description && (
                          <p className="text-xs text-gray-500">{schema.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowConfigModal(false)}>
                취소
              </Button>
              <Button onClick={() => handleUpdatePluginConfig(selectedPlugin.metadata.name, selectedPlugin.config)}>
                <Settings className="w-4 h-4 mr-1" />
                설정 저장
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
