// ArtifactRegexSearchPage.jsx - Search artifacts by regex
import { useState } from 'react';
import { searchArtifactsByRegex } from '../apiClient';

function ArtifactRegexSearchPage() {
  const [regex, setRegex] = useState('');
  const [results, setResults] = useState([]);
  const [nextOffset, setNextOffset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const executeSearch = async (offset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const { data, nextOffset: headerOffset } = await searchArtifactsByRegex(regex, offset);
      setResults(data || []);
      setNextOffset(headerOffset);
    } catch (err) {
      setError(err.message || 'Search failed');
      setResults([]);
      setNextOffset(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '1rem', color: '#333' }}>Regex Search</h2>
      <p style={{ marginTop: 0, color: '#666' }}>Matches against artifact names. Use standard JavaScript regex syntax.</p>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
        <input
          type="text"
          value={regex}
          onChange={(e) => setRegex(e.target.value)}
          placeholder="e.g., .*whisper.*"
          style={{ flex: '1 1 auto', padding: '0.6rem', border: '1px solid #ccc', borderRadius: 4 }}
        />
        <button
          onClick={() => executeSearch(0)}
          disabled={loading || !regex}
          style={{ padding: '0.7rem 1.4rem', background: loading || !regex ? '#ccc' : '#0066cc', color: '#fff', border: 'none', borderRadius: 4, cursor: loading || !regex ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
        {nextOffset && (
          <button
            onClick={() => executeSearch(Number(nextOffset))}
            disabled={loading}
            style={{ padding: '0.6rem 1.2rem', background: '#eee', color: '#333', border: '1px solid #ccc', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            Next Page (offset {nextOffset})
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '0.75rem', background: '#fee', color: '#a00', borderRadius: 4, marginBottom: '1rem' }}>{error}</div>
      )}

      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #eee', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ marginTop: 0, color: '#444' }}>Results</h3>
        {loading && <p style={{ color: '#666' }}>Loading…</p>}
        {!loading && results.length === 0 && <p style={{ color: '#666' }}>No results yet.</p>}
        {!loading && results.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f7f7f7' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #eee' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #eee' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #eee' }}>ID</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={`${r.type}:${r.id}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '0.5rem' }}>{r.name}</td>
                  <td style={{ padding: '0.5rem' }}>{r.type}</td>
                  <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{r.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default ArtifactRegexSearchPage;
