import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Plus, FolderOpen, BarChart3, Settings, Menu, X, Camera, UserCircle } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import './Sidebar.css';

const Sidebar = () => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/create-event', label: 'Create Event', icon: Plus },
    { path: '/events', label: 'My Events', icon: FolderOpen },
    { path: '/your-collection', label: 'Your Collection', icon: UserCircle },
    { path: '/analytics', label: 'Analytics', icon: BarChart3, isPlaceholder: true },
    { path: '/settings', label: 'Settings', icon: Settings, isPlaceholder: true },
  ];

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const closeMobileSidebar = () => {
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button className="mobile-menu-btn" onClick={toggleMobileSidebar}>
        <Menu size={24} />
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && <div className="sidebar-overlay" onClick={closeMobileSidebar} />}

      {/* Sidebar */}
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        {/* Logo Section */}
        <div className="sidebar-header">
          <Link to="/" className="sidebar-logo" onClick={closeMobileSidebar}>
            <Camera size={28} className="logo-icon" />
            {!isCollapsed && <span className="logo-text">Gallery App</span>}
          </Link>

          {/* Desktop Toggle Button */}
          <button className="sidebar-toggle desktop-only" onClick={toggleSidebar}>
            <Menu size={20} />
          </button>

          {/* Mobile Close Button */}
          <button className="sidebar-close mobile-only" onClick={closeMobileSidebar}>
            <X size={24} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                onClick={closeMobileSidebar}
                title={isCollapsed ? item.label : ''}
              >
                <Icon size={20} className="sidebar-icon" />
                {!isCollapsed && (
                  <span className="sidebar-label">
                    {item.label}
                    {item.isPlaceholder && <span className="badge-coming-soon">Soon</span>}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer with Theme Toggle */}
        <div className="sidebar-footer">
          <div className="sidebar-theme-toggle">
            <ThemeToggle collapsed={isCollapsed} />
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
