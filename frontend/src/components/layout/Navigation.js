import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Upload as UploadIcon, BarChart3 } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import './Navigation.css';

const Navigation = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Photos', icon: Home },
    { path: '/collections', label: 'Collections', icon: Users },
    { path: '/upload', label: 'Upload', icon: UploadIcon },
    { path: '/stats', label: 'Stats', icon: BarChart3 },
  ];

  return (
    <nav className="main-nav">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          <h2>Orchids Gallery</h2>
        </Link>

        <div className="nav-links">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} className="nav-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
