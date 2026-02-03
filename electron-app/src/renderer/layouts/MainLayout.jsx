/**
 * Main Layout Component
 * Sidebar navigation + content area
 * Orchids International School Branding
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Image,
  ChevronLeft,
  ChevronRight,
  GraduationCap
} from 'lucide-react';
import './MainLayout.css';

const navigation = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Gallery', path: '/gallery', icon: Image }
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
            {!collapsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <GraduationCap size={28} color="#DAA520" />
                <h2>Orchids Gallery</h2>
              </div>
            )}
            {collapsed && <GraduationCap size={28} color="#DAA520" />}
          </div>
          <button
            className="collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navigation.map((item) => {
            const IconComponent = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                title={collapsed ? item.name : ''}
              >
                <span className="nav-icon">
                  <IconComponent size={20} />
                </span>
                {!collapsed && <span className="nav-label">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="version">
            {!collapsed && <span>v1.1.0</span>}
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
