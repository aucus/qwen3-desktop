import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import './ThemeToggle.css';

const ThemeToggle: React.FC = () => {
  const { theme, setTheme, isDark } = useTheme();

  const handleThemeChange = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return '☀️';
      case 'dark':
        return '🌙';
      case 'system':
        return isDark ? '🌙' : '☀️';
      default:
        return '☀️';
    }
  };

  const getThemeLabel = () => {
    switch (theme) {
      case 'light':
        return '라이트 모드';
      case 'dark':
        return '다크 모드';
      case 'system':
        return `시스템 (${isDark ? '다크' : '라이트'})`;
      default:
        return '테마';
    }
  };

  return (
    <button
      className="theme-toggle"
      onClick={handleThemeChange}
      title={getThemeLabel()}
      aria-label={getThemeLabel()}
    >
      <span className="theme-icon">{getThemeIcon()}</span>
      <span className="theme-label">{getThemeLabel()}</span>
    </button>
  );
};

export default ThemeToggle;
