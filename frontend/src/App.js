import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/dashboard/Dashboard';
import CreateEvent from './components/events/CreateEvent';
import EventsList from './components/events/EventsList';
import EventGallery from './components/gallery/EventGallery';
import Photos from './components/gallery/Photos';
import Collections from './components/gallery/Collections';
import PersonPhotos from './components/gallery/PersonPhotos';
import Upload from './components/gallery/Upload';
import Stats from './components/gallery/Stats';
import YourCollection from './components/gallery/YourCollection';
import PlaceholderPage from './components/common/PlaceholderPage';
import Sidebar from './components/layout/Sidebar';
import { useTheme } from './hooks/useTheme';
import './App.css';

function App() {
  const { theme } = useTheme();

  return (
    <Router>
      <div className="App" data-theme={theme}>
        <Sidebar />
        <main className="main-content">
          <Routes>
            {/* Dashboard */}
            <Route path="/" element={<Dashboard />} />

            {/* Event Management */}
            <Route path="/create-event" element={<CreateEvent />} />
            <Route path="/events" element={<EventsList />} />

            {/* Event Gallery */}
            <Route path="/events/:eventId/gallery" element={<EventGallery />}>
              <Route index element={<Navigate to="upload" replace />} />
              <Route path="upload" element={<Upload />} />
              <Route path="photos" element={<Photos />} />
              <Route path="collections" element={<Collections />} />
              <Route path="stats" element={<Stats />} />
              <Route path="persons/:personId/photos" element={<PersonPhotos />} />
            </Route>

            {/* Your Collection */}
            <Route path="/your-collection" element={<YourCollection />} />

            {/* Placeholder Routes */}
            <Route
              path="/analytics"
              element={<PlaceholderPage title="Analytics" description="Advanced analytics and insights coming soon!" />}
            />
            <Route
              path="/settings"
              element={<PlaceholderPage title="Settings" description="Customize your experience in the settings panel (coming soon)." />}
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
