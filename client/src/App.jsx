import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import FileIntegrity from './pages/fileintegrity/FileIntegrity';
import History from './pages/history/History';
import './App.css';

export default function App() {
  return (
    <Router>
      <div className="app-shell">
        {/* Navigation Bar */}
        <nav className="navbar">
          <h1>AuthGuard X <span className="badge-person">Person 3 Modules</span></h1>
          <div className="nav-links">
            <Link to="/file-integrity" className="nav-link">File Integrity</Link>
            <Link to="/history" className="nav-link">Audit History</Link>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="main-content">
          <Routes>
            <Route path="/file-integrity" element={<FileIntegrity />} />
            <Route path="/history" element={<History />} />
            <Route path="/" element={
              <div className="home-welcome">
                <h2>Welcome, Person 3!</h2>
                <p>Select a module above to test your File Integrity uploader or view your scan audit logs.</p>
              </div>
            } />
          </Routes>
        </main>
      </div>
    </Router>
  );
}