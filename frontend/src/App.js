import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Photos from './components/Photos';
import Collections from './components/Collections';
import PersonPhotos from './components/PersonPhotos';
import Upload from './components/Upload';
import Stats from './components/Stats';
import Navigation from './components/layout/Navigation';
import { useTheme } from './hooks/useTheme';
import './App.css';

function App() {
  const { theme } = useTheme();

  return (
    <Router>
      <div className="App" data-theme={theme}>
        <Navigation />
        <Routes>
          <Route path="/" element={<Photos />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/persons/:personId/photos" element={<PersonPhotos />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
