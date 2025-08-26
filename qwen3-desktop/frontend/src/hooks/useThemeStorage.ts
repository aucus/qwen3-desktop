import { useEffect, useState } from 'react';
import { Theme } from '../contexts/ThemeContext';

const THEME_STORAGE_KEY = 'qwen3-desktop-theme';

export const useThemeStorage = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    // 초기 로드 시 로컬 스토리지에서 테마 불러오기
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme;
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        return savedTheme;
      }
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error);
    }
    
    // 기본값은 시스템 테마
    return 'system';
  });

  // 테마 변경 시 로컬 스토리지에 저장
  const updateTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      setTheme(newTheme);
    } catch (error) {
      console.error('Failed to save theme to localStorage:', error);
      // 저장 실패해도 상태는 업데이트
      setTheme(newTheme);
    }
  };

  // 로컬 스토리지 변경 감지
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        const newTheme = e.newValue as Theme;
        if (['light', 'dark', 'system'].includes(newTheme)) {
          setTheme(newTheme);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 테마 설정 초기화
  const resetTheme = () => {
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
      setTheme('system');
    } catch (error) {
      console.error('Failed to reset theme:', error);
      setTheme('system');
    }
  };

  // 테마 설정 내보내기
  const exportThemeSettings = () => {
    try {
      const settings = {
        theme,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      };
      
      const blob = new Blob([JSON.stringify(settings, null, 2)], {
        type: 'application/json',
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qwen3-theme-settings.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Failed to export theme settings:', error);
      return false;
    }
  };

  // 테마 설정 가져오기
  const importThemeSettings = async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const settings = JSON.parse(text);
      
      if (settings.theme && ['light', 'dark', 'system'].includes(settings.theme)) {
        updateTheme(settings.theme);
        return true;
      } else {
        throw new Error('Invalid theme value in settings file');
      }
    } catch (error) {
      console.error('Failed to import theme settings:', error);
      return false;
    }
  };

  return {
    theme,
    updateTheme,
    resetTheme,
    exportThemeSettings,
    importThemeSettings,
  };
};
