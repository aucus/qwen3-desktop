import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // 로컬 스토리지에서 테마 설정 불러오기
    const savedTheme = localStorage.getItem('theme') as Theme;
    return savedTheme || 'system';
  });

  const [isDark, setIsDark] = useState(false);

  // 시스템 테마 감지
  const getSystemTheme = (): boolean => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  // 실제 적용될 테마 계산
  const getEffectiveTheme = (): boolean => {
    if (theme === 'system') {
      return getSystemTheme();
    }
    return theme === 'dark';
  };

  // 테마 변경 함수
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // 테마 적용
  useEffect(() => {
    const effectiveTheme = getEffectiveTheme();
    setIsDark(effectiveTheme);

    // CSS 변수 설정
    const root = document.documentElement;
    const themeColors = effectiveTheme ? darkThemeColors : lightThemeColors;

    Object.entries(themeColors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // 메타 태그 업데이트
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', effectiveTheme ? '#1a1a1a' : '#ffffff');
    }
  }, [theme]);

  // 시스템 테마 변경 감지
  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleChange = () => {
        const effectiveTheme = getEffectiveTheme();
        setIsDark(effectiveTheme);
        
        const root = document.documentElement;
        const themeColors = effectiveTheme ? darkThemeColors : lightThemeColors;
        
        Object.entries(themeColors).forEach(([key, value]) => {
          root.style.setProperty(key, value);
        });
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  const value: ThemeContextType = {
    theme,
    setTheme,
    isDark,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// 테마 색상 정의
const lightThemeColors = {
  '--bg-primary': '#ffffff',
  '--bg-secondary': '#f8f9fa',
  '--bg-tertiary': '#f1f3f4',
  '--bg-hover': '#e8eaed',
  '--bg-disabled': '#f1f3f4',
  '--bg-code': '#f6f8fa',
  '--bg-danger': '#fef2f2',
  '--bg-success': '#f0fdf4',
  '--bg-warning': '#fffbeb',
  '--bg-info': '#eff6ff',
  
  '--text-primary': '#202124',
  '--text-secondary': '#5f6368',
  '--text-tertiary': '#9aa0a6',
  '--text-disabled': '#dadce0',
  '--text-danger': '#dc2626',
  '--text-success': '#16a34a',
  '--text-warning': '#d97706',
  '--text-info': '#2563eb',
  
  '--primary-color': '#1a73e8',
  '--primary-hover': '#1557b0',
  '--primary-color-alpha': 'rgba(26, 115, 232, 0.1)',
  
  '--border-color': '#dadce0',
  '--border-hover': '#bdc1c6',
  
  '--scrollbar-color': '#dadce0',
  '--scrollbar-hover': '#bdc1c6',
  
  '--shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
};

const darkThemeColors = {
  '--bg-primary': '#1a1a1a',
  '--bg-secondary': '#2d2d2d',
  '--bg-tertiary': '#3c3c3c',
  '--bg-hover': '#404040',
  '--bg-disabled': '#3c3c3c',
  '--bg-code': '#2d3748',
  '--bg-danger': '#3f1f1f',
  '--bg-success': '#1f3f1f',
  '--bg-warning': '#3f3f1f',
  '--bg-info': '#1f1f3f',
  
  '--text-primary': '#e8eaed',
  '--text-secondary': '#9aa0a6',
  '--text-tertiary': '#5f6368',
  '--text-disabled': '#3c4043',
  '--text-danger': '#f87171',
  '--text-success': '#4ade80',
  '--text-warning': '#fbbf24',
  '--text-info': '#60a5fa',
  
  '--primary-color': '#8ab4f8',
  '--primary-hover': '#aecbfa',
  '--primary-color-alpha': 'rgba(138, 180, 248, 0.1)',
  
  '--border-color': '#3c4043',
  '--border-hover': '#5f6368',
  
  '--scrollbar-color': '#3c4043',
  '--scrollbar-hover': '#5f6368',
  
  '--shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
  '--shadow-md': '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
  '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
};
