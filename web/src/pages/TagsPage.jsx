import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tagsApi } from '../api/endpoints.js';
import StateView from '../components/StateView.jsx';

export default function TagsPage() {
  const [state, setState] = useState({ loading: true, error: null, list: [] });

  const load = () => {
    setState({ loading: true, error: null, list: [] });
    tagsApi
      .list()
      .then((data) => setState({ loading: false, error: null, list: data.list || [] }))
      .catch((err) => setState({ loading: false, error: err, list: [] }));
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <h2>标签</h2>
      <StateView loading={state.loading} error={state.error} empty={state.list.length === 0} emptyText="暂无标签" onRetry={load}>
        <div className="card grid-tags">
          {state.list.map((t) => (
            <Link key={t.id} className="tag" to={`/tags/${encodeURIComponent(t.name)}`}>
              #{t.name} <span className="muted">({t.postCount})</span>
            </Link>
          ))}
        </div>
      </StateView>
    </div>
  );
}
