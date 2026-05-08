'use client';

interface SidebarProps {
  activePanel: 'analyze' | 'search' | 'tracker';
  onPanelChange: (panel: 'analyze' | 'search' | 'tracker') => void;
}

export default function Sidebar({ activePanel, onPanelChange }: SidebarProps) {
  const panels = [
    { id: 'analyze', label: 'Analyze', icon: '📋' },
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'tracker', label: 'Tracker', icon: '💾' },
  ] as const;

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <h1>Career Cockpit</h1>
        <p>AI Operator</p>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {panels.map((panel) => (
          <button
            key={panel.id}
            onClick={() => onPanelChange(panel.id)}
            className={`sidebar-nav-button ${activePanel === panel.id ? 'active' : ''}`}
          >
            <span className="sidebar-nav-icon">{panel.icon}</span>
            <span>{panel.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <a
          href="https://github.com/ss889"
          target="_blank"
          rel="noopener noreferrer"
          className="sidebar-github-link"
          title="GitHub"
        >
          <span style={{ fontSize: '1.2rem' }}>🔗</span>
        </a>
      </div>
    </aside>
  );
}
