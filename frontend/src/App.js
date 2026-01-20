import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Photos from './components/Photos';
import Collections from './components/Collections';
import PersonPhotos from './components/PersonPhotos';
import Upload from './components/Upload';
import './App.css';

function Navigation() {
  const location = useLocation();
  
  return (
    <nav className="main-nav">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          <h2>Gallery App</h2>
        </Link>
        <div className="nav-links">
          <Link 
            to="/" 
            className={location.pathname === '/' ? 'nav-link active' : 'nav-link'}
          >
            Photos
          </Link>
          <Link 
            to="/collections" 
            className={location.pathname === '/collections' ? 'nav-link active' : 'nav-link'}
          >
            Collections
          </Link>
          <Link 
            to="/upload" 
            className={location.pathname === '/upload' ? 'nav-link active' : 'nav-link'}
          >
            Upload
          </Link>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
    <div className="App">
        <Navigation />
        <Routes>
          <Route path="/" element={<Photos />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/persons/:personId/photos" element={<PersonPhotos />} />
        </Routes>
    </div>
    </Router>
  );
}

export default App;
