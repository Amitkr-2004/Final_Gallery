/**
 * Main Application Component
 * Simple image gallery with dashboard, upload, and gallery pages
 */

import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Gallery from './pages/Gallery';
import './styles/global.css';

function AppRoutes() {
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for navigation events from main process (tray menu)
    if (window.electronAPI && window.electronAPI.onNavigate) {
      window.electronAPI.onNavigate((route) => {
        navigate(route);
      });
    }
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/upload" element={<Upload />} />
      <Route path="/gallery" element={<Gallery />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <MainLayout>
        <AppRoutes />
      </MainLayout>
    </Router>
  );
}

// Render app
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
