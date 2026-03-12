import { useState, useRef, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ask } from '@tauri-apps/plugin-dialog';
import { save } from '@tauri-apps/plugin-dialog';
import { Editor, EditorHandle } from './components/Editor';
import { Sidebar } from './components/Sidebar';
import { exportToDocx, exportToOfficialDocx } from './utils/exportDocx';
import { markdownToHtml } from './utils/markdown';
import { htmlToMarkdown } from './utils/htmlToMarkdown';
import './App.css';

type Theme = 'light' | 'dark' | 'system';

function App() {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [theme, setTheme] = useState<Theme>('dark');
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const autoSaveRef = useRef(autoSaveEnabled);
  const hasChangesRef = useRef(hasChanges);
  const currentFileRef = useRef(currentFile);
  const markdownContentRef = useRef(markdownContent);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorHandle>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isDarkMode = theme === 'dark';

  // Update refs when state changes
  useEffect(() => { autoSaveRef.current = autoSaveEnabled; }, [autoSaveEnabled]);
  useEffect(() => { hasChangesRef.current = hasChanges; }, [hasChanges]);
  useEffect(() => { currentFileRef.current = currentFile; }, [currentFile]);
  useEffect(() => { markdownContentRef.current = markdownContent; }, [markdownContent]);



  // Save function


  const handleSave = useCallback(async () => {
    const file = currentFileRef.current;
    const content = markdownContentRef.current;
    if (file && content !== undefined) {
      try {
        await invoke('write_file', { path: file, content });
        setHasChanges(false);
        console.log('File saved:', file);
      } catch (error) {
        console.error('Failed to save file:', error);
      }
    } else {
      console.error('Cannot save: file or content is undefined');
    }
  }, []);

  // Handle window close with save prompt
  useEffect(() => {
    let isClosing = false;
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      unlisten = await listen('close-requested', async () => {
        console.log('Close requested, isClosing:', isClosing);
        if (isClosing) return;
        isClosing = true;

        try {
          if (!autoSaveRef.current && hasChangesRef.current && currentFileRef.current) {
            console.log('Showing ask dialog');
            const shouldSave = await ask(
              'Save changes before closing?',
              { title: 'Close File', kind: 'warning', okLabel: 'Save', cancelLabel: 'Discard' }
            );
            console.log('User choice:', shouldSave);
            if (shouldSave) {
              await handleSave();
            }
          }
          // 调用 Rust 命令，强制销毁窗口
          console.log('Calling close_app');
          await invoke('close_app');
        } catch (error) {
          console.error("Error during close:", error);
          isClosing = false;
        }
      });
    };

    setup();
    return () => { if (unlisten) unlisten(); };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowThemeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus on input when editing name
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Debounced auto-save function
  const debouncedSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    if (autoSaveEnabled && currentFile) {
      autoSaveTimerRef.current = setTimeout(async () => {
        if (currentFile && markdownContent) {
          try {
            await invoke('write_file', { path: currentFile, content: markdownContent });
            setHasChanges(false);
          } catch (error) {
            console.error('Auto-save failed:', error);
          }
        }
      }, 1000);
    }
  }, [autoSaveEnabled, currentFile, markdownContent]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        if (['1', '2', '3', '4', '5', '6'].includes(e.key)) {
          e.preventDefault();
          const level = parseInt(e.key) as 1 | 2 | 3 | 4 | 5 | 6;
          editorRef.current?.setHeading(level);
        }
        if (e.key === '0') {
          e.preventDefault();
          editorRef.current?.setParagraph();
        }
        if (e.key === 'b') {
          e.preventDefault();
          editorRef.current?.toggleBold();
        }
        if (e.key === 'i') {
          e.preventDefault();
          editorRef.current?.toggleItalic();
        }
        if (e.key === 's') {
          e.preventDefault();
          handleSave();
        }
        if (e.key === 'n') {
          e.preventDefault();
          handleNewFile();
        }
      }
      if (e.key === '\\' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSidebarCollapsed(!sidebarCollapsed);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, sidebarCollapsed]);

  const handleFileSelect = (path: string, fileMarkdownContent: string) => {
    setCurrentFile(path);
    setCurrentFileName(path.split('/').pop() || 'Untitled');
    setMarkdownContent(fileMarkdownContent);
    const htmlContent = markdownToHtml(fileMarkdownContent);
    setHtmlContent(htmlContent);
    setHasChanges(false);
  };

  const handleContentChange = (newHtmlContent: string) => {
    setHtmlContent(newHtmlContent);
    const md = htmlToMarkdown(newHtmlContent);
    setMarkdownContent(md);
    setHasChanges(true);
    debouncedSave();
  };

  





const handleNewFile = async () => {
    if (hasChanges && !autoSaveEnabled) {
      const confirm = window.confirm('You have unsaved changes. Create new file anyway?');
      if (!confirm) return;
    }

    try {
      const filePath = await save({
        defaultPath: 'untitled.md',
        filters: [{
          name: 'Markdown',
          extensions: ['md', 'markdown']
        }]
      });

      if (filePath) {
        await invoke('write_file', { path: filePath, content: '' });
        setCurrentFile(filePath);
        setCurrentFileName(filePath.split('/').pop() || 'Untitled');
        setMarkdownContent('');
        setHtmlContent('<p></p>');
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Failed to create new file:', error);
    }
  };

  const handleRename = () => {
    setEditedName(currentFileName);
    setIsEditingName(true);
  };

  const handleRenameSubmit = async () => {
    if (!editedName.trim() || !currentFile) {
      setIsEditingName(false);
      return;
    }

    let newFileName = editedName.trim();
    if (!newFileName.endsWith('.md') && !newFileName.endsWith('.markdown')) {
      newFileName += '.md';
    }

    const oldPath = currentFile;
    const directory = oldPath.substring(0, oldPath.lastIndexOf('/') + 1);
    const newPath = `${directory}${newFileName}`;

    if (newPath === oldPath) {
      setIsEditingName(false);
      return;
    }

    try {
      await invoke('write_file', { path: newPath, content: markdownContent });
      await invoke('delete_file', { path: oldPath });
      setCurrentFile(newPath);
      setCurrentFileName(newFileName);
      setIsEditingName(false);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to rename file:', error);
      try {
        await invoke('rename_file', { oldPath, newPath });
        setCurrentFile(newPath);
        setCurrentFileName(newFileName);
        setIsEditingName(false);
      } catch (renameError) {
        console.error('Rename failed:', renameError);
      }
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
    }
  };

  const toggleAutoSave = async () => {
    // 如果是打开 AutoSave，并且有未保存的内容，立即保存一次
    if (!autoSaveEnabled && hasChanges && currentFile) {
      await handleSave();
    }
    setAutoSaveEnabled(!autoSaveEnabled);
  };

  const handleExport = async (type: 'normal' | 'official') => {
    if (!htmlContent) return;

    try {
      let baseName = currentFileName || 'document';
      if (baseName.endsWith('.md') || baseName.endsWith('.markdown')) {
        baseName = baseName.replace(/\.(md|markdown)$/, '');
      }

      if (type === 'official') {
        await exportToOfficialDocx(htmlContent, `${baseName}_公文.docx`);
      } else {
        await exportToDocx(htmlContent, `${baseName}.docx`);
      }
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light': return '☀️';
      case 'dark': return '🌙';
      case 'system': return '💻';
    }
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className={`app ${isDarkMode ? 'dark' : 'light'}`}>
      <header className="app-header">
        <div className="header-left">
          <button
            className={`sidebar-toggle-btn ${isDarkMode ? 'dark' : 'light'}`}
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Show Sidebar (⌘+\\)' : 'Hide Sidebar (⌘+\\)'}
          >
            ☰
          </button>
          <h1>Markdown Editor</h1>
          {currentFileName && (
            <div className="file-info">
              {isEditingName ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  className="filename-input"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={handleRenameKeyDown}
                />
              ) : (
                <span className="file-name" onClick={handleRename} title="Click to rename">
                  {currentFileName}
                  {hasChanges && !autoSaveEnabled && <span className="unsaved">*</span>}
                  {autoSaveEnabled && <span className="auto-saving">✓</span>}
                </span>
              )}
              <div className="auto-save-toggle" onClick={toggleAutoSave} title={autoSaveEnabled ? 'AutoSave ON' : 'AutoSave OFF'}>
                <span className="auto-save-label">AutoSave</span>
                <div className={`toggle-switch ${autoSaveEnabled ? 'on' : 'off'}`}>
                  <div className="toggle-knob" />
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="header-actions">
          <button onClick={handleNewFile} className="ios-btn">
            + New
          </button>

          <div className="theme-dropdown" ref={menuRef}>
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="ios-btn theme-btn"
            >
              {getThemeIcon()}
              <span className="theme-label">{theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'Auto'}</span>
              <svg className="dropdown-arrow" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              </svg>
            </button>
            {showThemeMenu && (
              <div className="theme-menu">
                <button
                  className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => { setTheme('light'); setShowThemeMenu(false); }}
                >
                  <span>☀️</span> Light
                </button>
                <button
                  className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => { setTheme('dark'); setShowThemeMenu(false); }}
                >
                  <span>🌙</span> Dark
                </button>
                <button
                  className={`theme-option ${theme === 'system' ? 'active' : ''}`}
                  onClick={() => { setTheme('system'); setShowThemeMenu(false); }}
                >
                  <span>💻</span> System
                </button>
              </div>
            )}
          </div>

          {currentFile && (
            <button onClick={handleSave} disabled={!hasChanges || autoSaveEnabled} className="ios-btn">
              Save
            </button>
          )}
          <button onClick={() => handleExport('normal')} className="ios-btn primary">
            Export DOCX
          </button>
          <button onClick={() => handleExport('official')} className="ios-btn accent">
            Export 公文
          </button>
        </div>
      </header>
      <div className="app-content">
        <Sidebar
          isDarkMode={isDarkMode}
          onFileSelect={handleFileSelect}
          currentFile={currentFile}
          isCollapsed={sidebarCollapsed}
        />
        <main className="editor-main">
          {currentFile ? (
            <Editor
              ref={editorRef}
              content={htmlContent}
              onChange={handleContentChange}
              isDarkMode={isDarkMode}
            />
          ) : (
            <div className="welcome">
              <h2>Welcome to Markdown Editor</h2>
              <p>Select a markdown file from the sidebar or click "+ New" to create a new file</p>
              <p className="shortcuts-hint">
                <span>⌘+1~6</span> Heading &nbsp;
                <span>⌘+B</span> Bold &nbsp;
                <span>⌘+I</span> Italic &nbsp;
                <span>⌘+S</span> Save &nbsp;
                <span>⌘+\</span> Toggle Sidebar
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
