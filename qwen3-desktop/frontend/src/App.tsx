import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import McpToolsPage from './pages/McpToolsPage';
import './styles/App.css';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <Router>
        <div className="app">
          <Layout>
            <Routes>
              <Route path="/" element={<ChatPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/mcp-tools" element={<McpToolsPage />} />
            </Routes>
          </Layout>
        </div>
      </Router>
    </ThemeProvider>
  );
};

export default App;
