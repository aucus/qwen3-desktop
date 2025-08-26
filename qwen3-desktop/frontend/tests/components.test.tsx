import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// 컴포넌트들 import
import { ChatInterface } from '../src/components/ChatInterface';
import { FileSystemTool } from '../src/components/FileSystemTool';
import { WebSearchTool } from '../src/components/WebSearchTool';
import { TerminalTool } from '../src/components/TerminalTool';
import { DatabaseTool } from '../src/components/DatabaseTool';
import { McpToolsPanel } from '../src/components/McpToolsPanel';
import { FileUpload } from '../src/components/FileUpload';
import { InputArea } from '../src/components/InputArea';
import { MessageBubble } from '../src/components/MessageBubble';

// Mock 서비스들
vi.mock('../src/services/apiService', () => ({
  default: {
    sendMessage: vi.fn(),
    uploadFile: vi.fn(),
    executeMcpMethod: vi.fn(),
  }
}));

vi.mock('../src/services/websocketService', () => ({
  default: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
  }
}));

// Mock context
const mockThemeContext = {
  theme: 'dark',
  toggleTheme: vi.fn(),
};

const mockAppStore = {
  conversations: [],
  currentConversation: null,
  addMessage: vi.fn(),
  createConversation: vi.fn(),
  setCurrentConversation: vi.fn(),
};

describe('ChatInterface Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders chat interface correctly', () => {
    render(<ChatInterface />);
    
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('sends message when form is submitted', async () => {
    const mockSendMessage = vi.fn();
    vi.mocked(require('../src/services/apiService').default.sendMessage).mockResolvedValue({
      success: true,
      response: 'Test response'
    });

    render(<ChatInterface />);
    
    const input = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'Hello, World!' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('Hello, World!');
    });
  });

  it('displays loading state while sending message', async () => {
    vi.mocked(require('../src/services/apiService').default.sendMessage).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    render(<ChatInterface />);
    
    const input = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'Hello, World!' } });
    fireEvent.click(sendButton);
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});

describe('FileSystemTool Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders file system tool correctly', () => {
    render(<FileSystemTool />);
    
    expect(screen.getByText(/file system/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse/i })).toBeInTheDocument();
  });

  it('lists files when directory is selected', async () => {
    const mockExecuteMethod = vi.fn();
    vi.mocked(require('../src/services/apiService').default.executeMcpMethod).mockResolvedValue({
      success: true,
      result: {
        files: [
          { name: 'test.txt', type: 'file', size: 100 },
          { name: 'folder', type: 'directory' }
        ]
      }
    });

    render(<FileSystemTool />);
    
    const browseButton = screen.getByRole('button', { name: /browse/i });
    fireEvent.click(browseButton);
    
    await waitFor(() => {
      expect(screen.getByText('test.txt')).toBeInTheDocument();
      expect(screen.getByText('folder')).toBeInTheDocument();
    });
  });

  it('reads file content when file is clicked', async () => {
    const mockExecuteMethod = vi.fn();
    vi.mocked(require('../src/services/apiService').default.executeMcpMethod)
      .mockResolvedValueOnce({
        success: true,
        result: { files: [{ name: 'test.txt', type: 'file' }] }
      })
      .mockResolvedValueOnce({
        success: true,
        result: { content: 'File content' }
      });

    render(<FileSystemTool />);
    
    // 파일 목록 로드
    const browseButton = screen.getByRole('button', { name: /browse/i });
    fireEvent.click(browseButton);
    
    await waitFor(() => {
      const fileItem = screen.getByText('test.txt');
      fireEvent.click(fileItem);
    });
    
    await waitFor(() => {
      expect(screen.getByText('File content')).toBeInTheDocument();
    });
  });
});

describe('WebSearchTool Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders web search tool correctly', () => {
    render(<WebSearchTool />);
    
    expect(screen.getByText(/web search/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('performs web search when form is submitted', async () => {
    const mockExecuteMethod = vi.fn();
    vi.mocked(require('../src/services/apiService').default.executeMcpMethod).mockResolvedValue({
      success: true,
      result: {
        results: [
          { title: 'Test Result', url: 'https://example.com', snippet: 'Test snippet' }
        ]
      }
    });

    render(<WebSearchTool />);
    
    const input = screen.getByRole('textbox');
    const searchButton = screen.getByRole('button', { name: /search/i });
    
    fireEvent.change(input, { target: { value: 'test query' } });
    fireEvent.click(searchButton);
    
    await waitFor(() => {
      expect(screen.getByText('Test Result')).toBeInTheDocument();
      expect(screen.getByText('Test snippet')).toBeInTheDocument();
    });
  });

  it('displays error when search fails', async () => {
    vi.mocked(require('../src/services/apiService').default.executeMcpMethod).mockResolvedValue({
      success: false,
      error: 'Search failed'
    });

    render(<WebSearchTool />);
    
    const input = screen.getByRole('textbox');
    const searchButton = screen.getByRole('button', { name: /search/i });
    
    fireEvent.change(input, { target: { value: 'test query' } });
    fireEvent.click(searchButton);
    
    await waitFor(() => {
      expect(screen.getByText(/search failed/i)).toBeInTheDocument();
    });
  });
});

describe('TerminalTool Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders terminal tool correctly', () => {
    render(<TerminalTool />);
    
    expect(screen.getByText(/terminal/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /execute/i })).toBeInTheDocument();
  });

  it('executes command when form is submitted', async () => {
    const mockExecuteMethod = vi.fn();
    vi.mocked(require('../src/services/apiService').default.executeMcpMethod).mockResolvedValue({
      success: true,
      result: { output: 'Command output', exit_code: 0 }
    });

    render(<TerminalTool />);
    
    const input = screen.getByRole('textbox');
    const executeButton = screen.getByRole('button', { name: /execute/i });
    
    fireEvent.change(input, { target: { value: 'ls -la' } });
    fireEvent.click(executeButton);
    
    await waitFor(() => {
      expect(screen.getByText('Command output')).toBeInTheDocument();
    });
  });

  it('displays command history', async () => {
    const mockExecuteMethod = vi.fn();
    vi.mocked(require('../src/services/apiService').default.executeMcpMethod)
      .mockResolvedValueOnce({
        success: true,
        result: { output: 'First command', exit_code: 0 }
      })
      .mockResolvedValueOnce({
        success: true,
        result: { output: 'Second command', exit_code: 0 }
      });

    render(<TerminalTool />);
    
    const input = screen.getByRole('textbox');
    const executeButton = screen.getByRole('button', { name: /execute/i });
    
    // 첫 번째 명령어 실행
    fireEvent.change(input, { target: { value: 'echo "first"' } });
    fireEvent.click(executeButton);
    
    // 두 번째 명령어 실행
    await waitFor(() => {
      fireEvent.change(input, { target: { value: 'echo "second"' } });
      fireEvent.click(executeButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText('echo "first"')).toBeInTheDocument();
      expect(screen.getByText('echo "second"')).toBeInTheDocument();
    });
  });
});

describe('DatabaseTool Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders database tool correctly', () => {
    render(<DatabaseTool />);
    
    expect(screen.getByText(/database/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /execute/i })).toBeInTheDocument();
  });

  it('connects to database', async () => {
    const mockExecuteMethod = vi.fn();
    vi.mocked(require('../src/services/apiService').default.executeMcpMethod).mockResolvedValue({
      success: true,
      result: { message: 'Connected successfully' }
    });

    render(<DatabaseTool />);
    
    const connectButton = screen.getByRole('button', { name: /connect/i });
    fireEvent.click(connectButton);
    
    await waitFor(() => {
      expect(screen.getByText(/connected successfully/i)).toBeInTheDocument();
    });
  });

  it('executes SQL query', async () => {
    const mockExecuteMethod = vi.fn();
    vi.mocked(require('../src/services/apiService').default.executeMcpMethod)
      .mockResolvedValueOnce({
        success: true,
        result: { message: 'Connected successfully' }
      })
      .mockResolvedValueOnce({
        success: true,
        result: {
          results: [
            { id: 1, name: 'Test', value: 100 },
            { id: 2, name: 'Test2', value: 200 }
          ]
        }
      });

    render(<DatabaseTool />);
    
    // 데이터베이스 연결
    const connectButton = screen.getByRole('button', { name: /connect/i });
    fireEvent.click(connectButton);
    
    await waitFor(() => {
      const input = screen.getByRole('textbox');
      const executeButton = screen.getByRole('button', { name: /execute/i });
      
      fireEvent.change(input, { target: { value: 'SELECT * FROM test_table' } });
      fireEvent.click(executeButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
      expect(screen.getByText('Test2')).toBeInTheDocument();
    });
  });
});

describe('McpToolsPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders MCP tools panel correctly', () => {
    render(<McpToolsPanel />);
    
    expect(screen.getByText(/mcp tools/i)).toBeInTheDocument();
    expect(screen.getByText(/file system/i)).toBeInTheDocument();
    expect(screen.getByText(/web search/i)).toBeInTheDocument();
    expect(screen.getByText(/terminal/i)).toBeInTheDocument();
    expect(screen.getByText(/database/i)).toBeInTheDocument();
  });

  it('toggles tool visibility when tool is clicked', () => {
    render(<McpToolsPanel />);
    
    const fileSystemTool = screen.getByText(/file system/i);
    fireEvent.click(fileSystemTool);
    
    expect(screen.getByTestId('filesystem-tool')).toBeVisible();
    
    fireEvent.click(fileSystemTool);
    
    expect(screen.queryByTestId('filesystem-tool')).not.toBeVisible();
  });

  it('displays tool status correctly', () => {
    render(<McpToolsPanel />);
    
    const statusIndicators = screen.getAllByTestId('tool-status');
    statusIndicators.forEach(indicator => {
      expect(indicator).toHaveClass('status-active');
    });
  });
});

describe('FileUpload Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders file upload component correctly', () => {
    render(<FileUpload />);
    
    expect(screen.getByText(/upload file/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose file/i })).toBeInTheDocument();
  });

  it('handles file selection', () => {
    const mockOnFileSelect = vi.fn();
    render(<FileUpload onFileSelect={mockOnFileSelect} />);
    
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByTestId('file-input');
    
    fireEvent.change(input, { target: { files: [file] } });
    
    expect(mockOnFileSelect).toHaveBeenCalledWith(file);
  });

  it('displays drag and drop area', () => {
    render(<FileUpload />);
    
    const dropArea = screen.getByTestId('drop-area');
    expect(dropArea).toBeInTheDocument();
    expect(dropArea).toHaveTextContent(/drag and drop files here/i);
  });

  it('handles drag and drop events', () => {
    const mockOnFileSelect = vi.fn();
    render(<FileUpload onFileSelect={mockOnFileSelect} />);
    
    const dropArea = screen.getByTestId('drop-area');
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    fireEvent.dragEnter(dropArea);
    fireEvent.drop(dropArea, { dataTransfer: { files: [file] } });
    
    expect(mockOnFileSelect).toHaveBeenCalledWith(file);
  });
});

describe('InputArea Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders input area correctly', () => {
    render(<InputArea onSend={vi.fn()} />);
    
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('sends message when send button is clicked', () => {
    const mockOnSend = vi.fn();
    render(<InputArea onSend={mockOnSend} />);
    
    const input = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'Hello, World!' } });
    fireEvent.click(sendButton);
    
    expect(mockOnSend).toHaveBeenCalledWith('Hello, World!');
  });

  it('sends message when Enter key is pressed', () => {
    const mockOnSend = vi.fn();
    render(<InputArea onSend={mockOnSend} />);
    
    const input = screen.getByRole('textbox');
    
    fireEvent.change(input, { target: { value: 'Hello, World!' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(mockOnSend).toHaveBeenCalledWith('Hello, World!');
  });

  it('does not send empty message', () => {
    const mockOnSend = vi.fn();
    render(<InputArea onSend={mockOnSend} />);
    
    const input = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(sendButton);
    
    expect(mockOnSend).not.toHaveBeenCalled();
  });
});

describe('MessageBubble Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders user message correctly', () => {
    const message = {
      id: '1',
      content: 'Hello, World!',
      role: 'user',
      timestamp: new Date().toISOString()
    };
    
    render(<MessageBubble message={message} />);
    
    expect(screen.getByText('Hello, World!')).toBeInTheDocument();
    expect(screen.getByTestId('message-bubble')).toHaveClass('user-message');
  });

  it('renders assistant message correctly', () => {
    const message = {
      id: '2',
      content: 'Hi there!',
      role: 'assistant',
      timestamp: new Date().toISOString()
    };
    
    render(<MessageBubble message={message} />);
    
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
    expect(screen.getByTestId('message-bubble')).toHaveClass('assistant-message');
  });

  it('displays timestamp correctly', () => {
    const timestamp = new Date('2023-01-01T12:00:00Z');
    const message = {
      id: '1',
      content: 'Hello, World!',
      role: 'user',
      timestamp: timestamp.toISOString()
    };
    
    render(<MessageBubble message={message} />);
    
    expect(screen.getByText(/12:00/i)).toBeInTheDocument();
  });

  it('handles markdown content', () => {
    const message = {
      id: '1',
      content: '**Bold text** and *italic text*',
      role: 'assistant',
      timestamp: new Date().toISOString()
    };
    
    render(<MessageBubble message={message} />);
    
    expect(screen.getByText('Bold text')).toBeInTheDocument();
    expect(screen.getByText('italic text')).toBeInTheDocument();
  });
});
