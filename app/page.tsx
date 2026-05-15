'use client';

import { useState, useRef, useEffect } from 'react';
import { Message } from '@/types';
import { Plus, Moon, Sun } from 'lucide-react';

export default function CockpitChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [jd, setJd] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/parse-pdf', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) throw new Error('Failed to parse PDF');
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        setInput((prev) => prev + (prev ? '\n\n' : '') + `[File: ${file.name}]\n${data.text}`);
      } else if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          setInput((prev) => prev + (prev ? '\n\n' : '') + `[File: ${file.name}]\n${text}`);
        };
        reader.readAsText(file);
      } else {
        alert('Currently only text files and PDFs are supported.');
      }
    } catch (err) {
      alert('Error uploading file: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('theme-dark');
    } else {
      document.documentElement.classList.remove('theme-dark');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages([...messages, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jd: jd || input,
          history: messages,
          question: input,
        }),
      });

      if (!response.ok) {
        let errorMsg = 'Failed to get response';
        try {
          const errorData = await response.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch (e) {
          // ignore parse error
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.text || (typeof data.content === 'string' ? data.content : 'No response generated'),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      // Store job descriptions for analysis
      if (input.toLowerCase().includes('analyze') && input.length > 50) {
        setJd(input);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'An error occurred'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="cockpit-chat">
      {/* Header */}
      <header className="chat-header">
        <div className="chat-branding">
          <h1>JobOps AI</h1>
          <p>Agentic intelligence for career navigation and analysis</p>
        </div>
        <button onClick={toggleTheme} className="theme-toggle" title="Toggle Theme">
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </header>

      {/* Chat Container */}
      <div className="chat-container">
        {/* Welcome State */}
        {messages.length === 0 ? (
          <div className="welcome-state">
            <h2>What can I help you with?</h2>
            <p>Tell me about a job you want to analyze, search for roles, or track your applications.</p>
            <div className="example-prompts">
              <button
                onClick={() => setInput('Analyze this job description: [paste job description]')}
                className="example-prompt"
              >
                📋 Analyze a job description
              </button>
              <button
                onClick={() => setInput('Search for AI engineer roles in SF')}
                className="example-prompt"
              >
                🔍 Search for jobs
              </button>
              <button
                onClick={() => setInput('Show me my tracked jobs')}
                className="example-prompt"
              >
                💾 View saved jobs
              </button>
              <button
                onClick={() => setInput('What skills should I focus on for ML engineering?')}
                className="example-prompt"
              >
                🎯 Career advice
              </button>
            </div>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                <div className="message-content">{msg.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className="message assistant">
                <div className="message-content">
                  <span className="typing-indicator">
                    <span></span><span></span><span></span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        <div className="input-wrapper">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
            accept=".txt,.md,.json,.csv,.pdf"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="attach-button"
            title="Attach a text file"
            disabled={isLoading}
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Tell me what you want to analyze, search, or track..."
            className="chat-input"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            className="send-button"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
        <p className="input-hint">Paste job descriptions, ask about roles, or discuss your career path</p>
      </div>
    </div>
  );
}
