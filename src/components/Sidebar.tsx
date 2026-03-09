import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './Sidebar.css';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

interface SidebarProps {
  isDarkMode: boolean;
  onFileSelect: (path: string, content: string) => void;
  currentFile: string | null;
  isCollapsed: boolean;
}

export function Sidebar({ isDarkMode, onFileSelect, currentFile, isCollapsed }: SidebarProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);

  const loadDirectory = async (path: string) => {
    try {
      const result = await invoke<FileEntry[]>('read_directory', { path });
      setEntries(result);
      setCurrentPath(path);
    } catch (error) {
      console.error('Failed to load directory:', error);
    }
  };

  const navigateTo = (path: string) => {
    setPathHistory([...pathHistory, currentPath]);
    loadDirectory(path);
  };

  const navigateBack = () => {
    if (pathHistory.length > 0) {
      const previousPath = pathHistory[pathHistory.length - 1];
      setPathHistory(pathHistory.slice(0, -1));
      loadDirectory(previousPath);
    }
  };

  const handleFileClick = async (entry: FileEntry) => {
    if (entry.is_dir) {
      navigateTo(entry.path);
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.markdown')) {
      try {
        const content = await invoke<string>('read_file', { path: entry.path });
        onFileSelect(entry.path, content);
      } catch (error) {
        console.error('Failed to read file:', error);
      }
    }
  };

  const goHome = () => {
    setPathHistory([]);
    loadDirectory('/Users/haodong');
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = e.clientX;
        setSidebarWidth(Math.max(180, Math.min(500, newWidth)));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    loadDirectory('/Users/haodong');
  }, []);

  return (
    <div
      className={`sidebar ${isDarkMode ? 'dark' : 'light'} ${isCollapsed ? 'collapsed' : ''}`}
      style={{ width: isCollapsed ? '0px' : `${sidebarWidth}px` }}
    >
      <div className="sidebar-header">
        <h3>Files</h3>
        <div className="sidebar-actions">
          <button onClick={navigateBack} disabled={pathHistory.length === 0} title="Back">
            ←
          </button>
          <button onClick={goHome} title="Home">
            ⌂
          </button>
        </div>
      </div>
      <div className="sidebar-path">
        {currentPath.split('/').filter(Boolean).join(' / ')}
      </div>
      <div className="sidebar-content">
        {entries.map((entry) => (
          <div
            key={entry.path}
            className={`file-item ${entry.is_dir ? 'folder' : 'file'} ${
              currentFile === entry.path ? 'active' : ''
            }`}
            onClick={() => handleFileClick(entry)}
          >
            <span className="file-icon">
              {entry.is_dir ? '📁' : '📄'}
            </span>
            <span className="file-name">{entry.name}</span>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="empty-message">No markdown files found</div>
        )}
      </div>
      {!isCollapsed && (
        <div
          className={`resize-handle ${isResizing ? 'active' : ''}`}
          onMouseDown={handleMouseDown}
        />
      )}
    </div>
  );
}
