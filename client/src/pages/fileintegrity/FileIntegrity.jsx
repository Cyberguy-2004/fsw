import React, { useState, useEffect } from 'react';
import './FileIntegrity.css';

export default function FileIntegrity() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [referenceDigest, setReferenceDigest] = useState('');
  const [compareResult, setCompareResult] = useState(null);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Check login status on page load
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('http://localhost:4001/test-me', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.userId);
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      setCurrentUser(null);
    }
  };

  // Direct login action inside frontend
  const handleQuickLogin = async () => {
    try {
      const res = await fetch('http://localhost:4001/test-login/1', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(1);
        setError(null);
      }
    } catch (e) {
      setError('Failed to log in to test server.');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
      setCompareResult(null);
      setError(null);
    }
  };

  const handleHashSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file first.');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch('http://localhost:4001/api/fileintegrity/hash', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const data = await res.json();

      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error?.message || 'Failed to generate hash.');
      }
    } catch (err) {
      setError('Network error or server is down.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async (e) => {
    e.preventDefault();
    if (!result || !referenceDigest) return;

    try {
      const res = await fetch('http://localhost:4001/api/fileintegrity/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          computedDigest: result.sha256,
          referenceDigest: referenceDigest.trim()
        }),
        credentials: 'include'
      });

      const data = await res.json();
      if (data.success) {
        setCompareResult(data.data.match);
      } else {
        setError(data.error?.message || 'Comparison failed.');
      }
    } catch (err) {
      setError('Failed to reach comparison endpoint.');
    }
  };

  return (
    <div className="file-integrity-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2>File Integrity Verification (SHA-256)</h2>
        <div>
          {currentUser ? (
            <span style={{ background: '#d4edda', color: '#155724', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold' }}>
              ✓ Logged in as User #{currentUser}
            </span>
          ) : (
            <button onClick={handleQuickLogin} className="btn-secondary" style={{ background: '#e0a800' }}>
              🔑 Click to Simulate Login
            </button>
          )}
        </div>
      </div>

      <p className="description">
        Upload a file to calculate its cryptographic SHA-256 fingerprint and verify if its contents have changed.
      </p>

      {error && <div className="alert-error">{error}</div>}

      <form onSubmit={handleHashSubmit} className="upload-form">
        <div className="file-drop-zone">
          <input type="file" onChange={handleFileChange} />
        </div>

        {selectedFile && (
          <div className="file-meta">
            <p><strong>Selected File:</strong> {selectedFile.name}</p>
            <p><strong>Size:</strong> {(selectedFile.size / 1024).toFixed(2)} KB</p>
          </div>
        )}

        <button type="submit" disabled={!selectedFile || loading} className="btn-primary">
          {loading ? 'Calculating Hash...' : 'Calculate SHA-256 Hash'}
        </button>
      </form>

      {result && (
        <div className="result-card">
          <h3>Hash Result</h3>
          <p><strong>Algorithm:</strong> SHA-256</p>
          <p><strong>Computed Digest:</strong></p>
          <code className="digest-box">{result.sha256}</code>

          <div className="compare-section">
            <h4>Compare with Reference Digest</h4>
            <form onSubmit={handleCompare}>
              <input
                type="text"
                placeholder="Paste 64-character reference SHA-256 hex digest..."
                value={referenceDigest}
                onChange={(e) => setReferenceDigest(e.target.value)}
                maxLength={64}
              />
              <button type="submit" className="btn-secondary">Compare Digests</button>
            </form>

            {compareResult !== null && (
              <div className={`badge ${compareResult ? 'badge-match' : 'badge-mismatch'}`}>
                {compareResult ? '✓ MATCH: File contents are identical' : '✕ MISMATCH: File contents have changed!'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}