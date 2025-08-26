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
import { Switch } from './ui/switch';
import { 
  Settings, 
  Search, 
  Save,
  RotateCcw,
  Download,
  Upload,
  History,
  Shield,
  Database,
  Monitor,
  Palette,
  Zap,
  Key,
  Backup,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
  FileText,
  Trash2,
  Plus,
  Eye,
  EyeOff
} from 'lucide-react';
import { apiService } from '../services/apiService';
import './SettingsManager.css';

interface SettingDefinition {
  key: string;
  name: string;
  description: string;
  category: string;
  type: string;
  default_value: any;
  validation_rules: Record<string, any>;
  options: any[];
  required: boolean;
  sensitive: boolean;
}

interface SettingData {
  definition: SettingDefinition;
  value: any;
}

interface Category {
  value: string;
  name: string;
  description: string;
}

interface SettingHistory {
  old_value: any;
  new_value: any;
  changed_at: string;
  changed_by: string;
}

interface BackupFile {
  filename: string;
  path: string;
  size: number;
  created_at: string;
  modified_at: string;
}

export const SettingsManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState<Record<string, SettingData>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState<string>('');
  const [settingHistory, setSettingHistory] = useState<SettingHistory[]>([]);
  const [backupFiles, setBackupFiles] = useState<BackupFile[]>([]);
  const [showSensitiveValues, setShowSensitiveValues] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadSettings();
    loadCategories();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/api/settings');
      if (response.success) {
        setSettings(response.settings);
      }
    } catch (error) {
      console.error('설정 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await apiService.get('/api/settings/categories');
      if (response.success) {
        setCategories(response.categories);
      }
    } catch (error) {
      console.error('카테고리 로드 실패:', error);
    }
  };

  const handleSettingChange = async (key: string, value: any) => {
    try {
      const response = await apiService.put(`/api/settings/${key}`, { value });
      if (response.success) {
        // 설정 업데이트
        setSettings(prev => ({
          ...prev,
          [key]: {
            ...prev[key],
            value: value
          }
        }));
      }
    } catch (error) {
      console.error('설정 업데이트 실패:', error);
    }
  };

  const handleResetSetting = async (key: string) => {
    if (!confirm('이 설정을 기본값으로 초기화하시겠습니까?')) return;

    try {
      const response = await apiService.post(`/api/settings/${key}/reset`);
      if (response.success) {
        await loadSettings();
      }
    } catch (error) {
      console.error('설정 초기화 실패:', error);
    }
  };

  const handleResetCategory = async (category: string) => {
    if (!confirm(`정말로 ${category} 카테고리의 모든 설정을 초기화하시겠습니까?`)) return;

    try {
      const response = await apiService.post(`/api/settings/category/${category}/reset`);
      if (response.success) {
        await loadSettings();
      }
    } catch (error) {
      console.error('카테고리 초기화 실패:', error);
    }
  };

  const handleViewHistory = async (key: string) => {
    try {
      const response = await apiService.get(`/api/settings/${key}/history`);
      if (response.success) {
        setSettingHistory(response.history);
        setSelectedSetting(key);
        setShowHistoryModal(true);
      }
    } catch (error) {
      console.error('설정 이력 로드 실패:', error);
    }
  };

  const handleCreateBackup = async () => {
    try {
      const response = await apiService.post('/api/settings/backup');
      if (response.success) {
        await loadBackupFiles();
        setShowBackupModal(true);
      }
    } catch (error) {
      console.error('백업 생성 실패:', error);
    }
  };

  const loadBackupFiles = async () => {
    try {
      const response = await apiService.get('/api/settings/backup');
      if (response.success) {
        setBackupFiles(response.backups);
      }
    } catch (error) {
      console.error('백업 파일 로드 실패:', error);
    }
  };

  const handleRestoreBackup = async (backupPath: string) => {
    if (!confirm('정말로 이 백업을 복원하시겠습니까? 현재 설정이 덮어써집니다.')) return;

    try {
      const response = await apiService.post('/api/settings/backup/restore', { backup_file: backupPath });
      if (response.success) {
        await loadSettings();
        setShowBackupModal(false);
      }
    } catch (error) {
      console.error('백업 복원 실패:', error);
    }
  };

  const handleExportSettings = async () => {
    try {
      const response = await apiService.get('/api/settings/export');
      if (response.success) {
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `settings_export_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('설정 내보내기 실패:', error);
    }
  };

  const handleImportSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('정말로 이 설정 파일을 가져오시겠습니까? 일부 설정이 덮어써질 수 있습니다.')) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        const importData = JSON.parse(content);
        
        const response = await apiService.post('/api/settings/import', importData);
        if (response.success) {
          await loadSettings();
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('설정 가져오기 실패:', error);
    }
  };

  const toggleSensitiveValue = (key: string) => {
    setShowSensitiveValues(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'general':
        return <Settings className="w-4 h-4" />;
      case 'model':
        return <Database className="w-4 h-4" />;
      case 'performance':
        return <Zap className="w-4 h-4" />;
      case 'security':
        return <Shield className="w-4 h-4" />;
      case 'ui':
        return <Palette className="w-4 h-4" />;
      case 'plugins':
        return <Plus className="w-4 h-4" />;
      case 'backup':
        return <Backup className="w-4 h-4" />;
      default:
        return <Settings className="w-4 h-4" />;
    }
  };

  const renderSettingInput = (key: string, setting: SettingData) => {
    const { definition, value } = setting;
    const { type, options, validation_rules } = definition;

    switch (type) {
      case 'string':
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleSettingChange(key, e.target.value)}
            placeholder={definition.description}
            maxLength={validation_rules.max_length}
            minLength={validation_rules.min_length}
          />
        );
      
      case 'integer':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleSettingChange(key, parseInt(e.target.value) || 0)}
            min={validation_rules.min}
            max={validation_rules.max}
          />
        );
      
      case 'float':
        return (
          <Input
            type="number"
            step="0.1"
            value={value || ''}
            onChange={(e) => handleSettingChange(key, parseFloat(e.target.value) || 0)}
            min={validation_rules.min}
            max={validation_rules.max}
          />
        );
      
      case 'boolean':
        return (
          <Switch
            checked={value || false}
            onCheckedChange={(checked) => handleSettingChange(key, checked)}
          />
        );
      
      case 'enum':
        return (
          <Select value={value || ''} onValueChange={(val) => handleSettingChange(key, val)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      default:
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleSettingChange(key, e.target.value)}
            placeholder={definition.description}
          />
        );
    }
  };

  const filteredSettings = Object.entries(settings).filter(([key, setting]) => {
    const matchesSearch = searchQuery === '' || 
      setting.definition.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      setting.definition.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || setting.definition.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const categoryTabs = categories.map(category => ({
    value: category.value,
    label: category.name,
    icon: getCategoryIcon(category.value)
  }));

  return (
    <div className="settings-manager">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              고급 설정
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleCreateBackup} variant="outline">
                <Backup className="w-4 h-4 mr-2" />
                백업
              </Button>
              <Button onClick={handleExportSettings} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                내보내기
              </Button>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportSettings}
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="settings-tabs">
            <TabsList className="tabs-list">
              {categoryTabs.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value} className="tab-trigger">
                  {tab.icon}
                  <span className="ml-2">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={activeTab} className="tab-content">
              <div className="settings-section">
                {/* 검색 및 필터 */}
                <div className="search-filters">
                  <div className="search-box">
                    <Search className="w-4 h-4" />
                    <Input
                      placeholder="설정 검색..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">모든 카테고리</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 설정 목록 */}
                <div className="settings-container">
                  {loading ? (
                    <div className="loading-state">
                      <div className="loading-spinner"></div>
                      <div>설정 로딩 중...</div>
                    </div>
                  ) : (
                    <div className="settings-list">
                      {filteredSettings.map(([key, setting]) => (
                        <Card key={key} className="setting-card">
                          <CardHeader className="card-header">
                            <div className="setting-title">
                              <div className="title-content">
                                <h3>{setting.definition.name}</h3>
                                <p className="description">{setting.definition.description}</p>
                                <div className="setting-badges">
                                  <Badge variant="outline" className="text-xs">
                                    {setting.definition.category}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {setting.definition.type}
                                  </Badge>
                                  {setting.definition.required && (
                                    <Badge variant="secondary" className="text-xs">
                                      필수
                                    </Badge>
                                  )}
                                  {setting.definition.sensitive && (
                                    <Badge variant="destructive" className="text-xs">
                                      민감
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="setting-actions">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleViewHistory(key)}
                                >
                                  <History className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleResetSetting(key)}
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          
                          <CardContent className="card-content">
                            <div className="setting-input-group">
                              <Label htmlFor={key}>{setting.definition.name}</Label>
                              <div className="input-container">
                                {renderSettingInput(key, setting)}
                                {setting.definition.sensitive && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => toggleSensitiveValue(key)}
                                  >
                                    {showSensitiveValues[key] ? (
                                      <EyeOff className="w-4 h-4" />
                                    ) : (
                                      <Eye className="w-4 h-4" />
                                    )}
                                  </Button>
                                )}
                              </div>
                              {setting.definition.validation_rules && Object.keys(setting.definition.validation_rules).length > 0 && (
                                <div className="validation-info">
                                  <Info className="w-3 h-3" />
                                  <span className="text-xs text-gray-500">
                                    {Object.entries(setting.definition.validation_rules)
                                      .map(([rule, value]) => `${rule}: ${value}`)
                                      .join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {!loading && filteredSettings.length === 0 && (
                    <div className="empty-state">
                      <Settings className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <div className="text-lg mb-2">설정이 없습니다</div>
                      <div className="text-sm text-gray-500">
                        검색 조건을 변경해보세요
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 설정 이력 모달 */}
      {showHistoryModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>설정 변경 이력</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowHistoryModal(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="history-list">
                {settingHistory.map((history, index) => (
                  <div key={index} className="history-item">
                    <div className="history-header">
                      <span className="history-time">
                        {new Date(history.changed_at).toLocaleString()}
                      </span>
                      <span className="history-user">{history.changed_by}</span>
                    </div>
                    <div className="history-values">
                      <div className="old-value">
                        <span className="label">이전 값:</span>
                        <span className="value">{JSON.stringify(history.old_value)}</span>
                      </div>
                      <div className="new-value">
                        <span className="label">새 값:</span>
                        <span className="value">{JSON.stringify(history.new_value)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowHistoryModal(false)}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 백업 관리 모달 */}
      {showBackupModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>백업 관리</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowBackupModal(false)}
              >
                ×
              </Button>
            </div>
            <div className="modal-content">
              <div className="backup-list">
                {backupFiles.map((backup, index) => (
                  <div key={index} className="backup-item">
                    <div className="backup-info">
                      <div className="backup-name">{backup.filename}</div>
                      <div className="backup-details">
                        <span>크기: {(backup.size / 1024).toFixed(1)} KB</span>
                        <span>생성: {new Date(backup.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="backup-actions">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestoreBackup(backup.path)}
                      >
                        복원
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="outline" onClick={() => setShowBackupModal(false)}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
