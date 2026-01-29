/**
 * Main Layout Component
 * Sidebar navigation + content area
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './MainLayout.css';

// Icons (using Unicode symbols for now)
const icons = {
  dashboard: '📊',
  downloads: '⬇️',
  gallery: '🖼️',
  processing: '⚙️',
  people: '👥',
  storage: '💾',
  settings: '⚙️'
};

const navigation = [
  { name: 'Dashboard', path: '/dashboard', icon: icons.dashboard },
  { name: 'Downloads', path: '/downloads', icon: icons.downloads },
  { name: 'Gallery', path: '/gallery', icon: icons.gallery },
  { name: 'Processing', path: '/processing', icon: icons.processing },
  { name: 'Storage', path: '/storage', icon: icons.storage },
  { name: 'Settings', path: '/settings', icon: icons.settings }
];

function MainLayout({ children }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <div className="main-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            {!collapsed && <h2>Image Processor</h2>}
            {collapsed && <h2>IP</h2>}
          </div>
          <button
            className="collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navigation.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              title={collapsed ? item.name : ''}
            >
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span className="nav-label">{item.name}</span>}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="version">
            {!collapsed && <span>v1.0.0</span>}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default MainLayout;
