import React, { useState, useEffect } from 'react';
import './History.css';

export default function History() {
  const [historyData, setHistoryData] = useState({ items: [], total: 0, page: 1, limit: 10 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Filter and pagination states
  const [toolType, setToolType] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Fetch history from backend whenever page or toolType filter changes
  useEffect(() => {
    fetchHistory();
  }, [page, toolType]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      let url = `http://localhost:4001/api/history?page=${page}&limit=${limit}`;
      if (toolType) {
        url += `&toolType=${toolType}`;
      }

      const res = await fetch(url,{
        credentials: 'include'
      });
      const data = await res.json();

      if (data.success) {
        setHistoryData(data.data);
      } else {
        setError(data.error?.message || 'Failed to load history.');
      }
    } catch (err) {
      setError('Network error or server is down.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate total pages for pagination
  const totalPages = Math.ceil(historyData.total / limit) || 1;

  return (
    <div className="history-container">
      <h2>Scan Audit History</h2>
      <p className="description">
        Review all past security checks, file integrity hashes, and tool executions linked to your account.
      </p>

      {/* Filter Controls */}
      <div className="controls-bar">
        <label htmlFor="tool-filter">Filter by Tool:</label>
        <select 
          id="tool-filter"
          value={toolType} 
          onChange={(e) => { setToolType(e.target.value); setPage(1); }}
          className="filter-select"
        >
          <option value="">All Tools</option>
          <option value="fileintegrity">File Integrity</option>
          <option value="headershield">Header Shield</option>
          <option value="phishcheck">Phish Check</option>
        </select>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {/* History Table */}
      {loading ? (
        <div className="loading-text">Loading audit logs...</div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="history-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tool Type</th>
                  <th>Summary</th>
                  <th>Status</th>
                  <th>Risk Level</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {historyData.items.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="no-data">No history records found.</td>
                  </tr>
                ) : (
                  historyData.items.map((item) => (
                    <tr key={item.id}>
                      <td>#{item.id}</td>
                      <td>
                        <span className={`badge-tool tool-${item.tool_type}`}>
                          {item.tool_type}
                        </span>
                      </td>
                      <td>{item.input_summary}</td>
                      <td>
                        <span className={`status-badge status-${item.status}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <span className={`risk-badge risk-${item.risk_level || 'low'}`}>
                          {item.risk_level || 'low'}
                        </span>
                      </td>
                      <td className="timestamp-cell">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="pagination-bar">
            <button 
              disabled={page <= 1} 
              onClick={() => setPage(p => p - 1)}
              className="btn-page"
            >
              Previous
            </button>
            <span>Page {page} of {totalPages || 1} (Total: {historyData.total} records)</span>
            <button 
              disabled={page >= totalPages} 
              onClick={() => setPage(p => p + 1)}
              className="btn-page"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}