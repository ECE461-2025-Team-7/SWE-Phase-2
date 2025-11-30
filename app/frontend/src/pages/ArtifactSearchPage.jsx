// ArtifactSearchPage.jsx - List/search artifacts by queries
import { useState } from 'react';
import { listArtifacts } from '../apiClient';

const typeOptions = ['model', 'dataset', 'code'];

function QueryRow({ index, query, onChange, onRemove, disableRemove }) {
  const updateField = (field, value) => {
    onChange(index, { ...query, [field]: value });
  };

  const toggleType = (type) => {
    const current = new Set(query.types || []);
    if (current.has(type)) current.delete(type); else current.add(type);
    updateField('types', Array.from(current));
  };

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 6, padding: '0.75rem', marginBottom: '0.75rem', background: '#fff' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', marginBottom: 4, color: '#555' }}>Name</label>
          <input
            type="text"
            value={query.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="artifact name or *"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </div>
        <div style={{ flex: '1 1 240px' }}>
          <label style={{ display: 'block', marginBottom: 4, color: '#555' }}>Types (optional)</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {typeOptions.map((t) => (
              <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={(query.types || []).includes(t)}
                  onChange={() => toggleType(t)}
                />
                {t}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => updateField('name', '*')}
            style={{ padding: '0.4rem 0.75rem', border: '1px solid #999', background: '#f1f1f1', borderRadius: 4, cursor: 'pointer' }}
          >
            Wildcard
          </button>
          <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={disableRemove}
            style={{ padding: '0.4rem 0.75rem', border: '1px solid #c33', background: disableRemove ? '#eee' : '#fee', color: '#900', borderRadius: 4, cursor: disableRemove ? 'not-allowed' : 'pointer' }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function ArtifactSearchPage() {
  const [queries, setQueries] = useState([{ name: '' }]);
  const [results, setResults] = useState([]);
  const [nextOffset, setNextOffset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateQuery = (idx, updated) => {
    setQueries((prev) => prev.map((q, i) => (i === idx ? updated : q)));
  };

  const addQuery = () => setQueries((prev) => [...prev, { name: '' }]);
  const removeQuery = (idx) => setQueries((prev) => prev.filter((_, i) => i !== idx));

  const executeSearch = async (offset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const cleaned = queries.map((q) => ({
        name: q.name?.trim() || '',
        ...(q.types && q.types.length ? { types: q.types } : {}),
      })).filter((q) => q.name.length > 0);
      if (cleaned.length === 0) {
        setError('Please provide at least one query name.');
        setLoading(false);
        return;
      }
      const { data, nextOffset: headerOffset } = await listArtifacts(cleaned, offset);
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
      <h2 style={{ marginBottom: '1rem', color: '#333' }}>Search Artifacts</h2>
      <p style={{ marginTop: 0, color: '#666' }}>Use exact names or "*" wildcard; optionally filter by type.</p>

      <div style={{ marginBottom: '1rem' }}>
        {queries.map((q, idx) => (
          <QueryRow
            key={idx}
            index={idx}
            query={q}
            onChange={updateQuery}
            onRemove={removeQuery}
            disableRemove={queries.length === 1}
          />
        ))}
        <button
          type="button"
          onClick={addQuery}
          style={{ padding: '0.5rem 1rem', border: '1px dashed #777', background: '#fafafa', borderRadius: 4, cursor: 'pointer' }}
        >
          + Add Query
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
        <button
          onClick={() => executeSearch(0)}
          disabled={loading}
          style={{ padding: '0.75rem 1.5rem', background: loading ? '#ccc' : '#0066cc', color: '#fff', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
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

export default ArtifactSearchPage;
 