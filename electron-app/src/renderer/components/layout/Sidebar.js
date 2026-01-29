/**
 * Sidebar Component - Simplified
 * Simple navigation with Upload and Gallery
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

function Sidebar() {
  const navItems = [
    {
      path: '/dashboard',
      icon: '🏠',
      label: 'Dashboard',
      description: 'Home'
    },
    {
      path: '/upload',
      icon: '📤',
      label: 'Upload',
      description: 'Upload images'
    },
    {
      path: '/gallery',
      icon: '🖼️',
      label: 'Gallery',
      description: 'View images'
    }
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Image Gallery</h2>
        <p className="sidebar-subtitle">Simple Local Gallery</p>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            <div className="sidebar-nav-content">
              <div className="sidebar-nav-label">{item.label}</div>
              <div className="sidebar-nav-description">{item.description}</div>
            </div>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default Sidebar;
