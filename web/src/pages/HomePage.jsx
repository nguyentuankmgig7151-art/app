import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { postsApi, likesApi } from '../api/endpoints.js';
import PostCard from '../components/PostCard.jsx';
import Pagination from '../components/Pagination.jsx';
import StateView from '../components/StateView.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const PAGE_SIZE = 10;

export default function HomePage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get('page') || 1);
  const tag = searchParams.get('tag') || '';
  const q = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'latest';

  const [keyword, setKeyword] = useState(q);
  const [state, setState] = useState({ loading: true, error: null, list: [], pagination: null });

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    postsApi
      .list({ page, pageSize: PAGE_SIZE, tag: tag || undefined, q: q || undefined, sort })
      .then((data) => setState({ loading: false, error: null, list: data.list || [], pagination: data.pagination || null }))
      .catch((err) => setState({ loading: false, error: err, list: [], pagination: null }));
  }, [page, tag, q, sort]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setKeyword(q); }, [q]);

  const patchParams = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') next.delete(k);
      else next.set(k, v);
    });
    if (!('page' in patch)) next.delete('page');
    setSearchParams(next);
  };

  const onSearch = (e) => {
    e.preventDefault();
    patchParams({ q: keyword.trim(), page: undefined });
  };

  const onToggleLike = async (post) => {
    if (!user) return;
    try {
      const data = post.liked ? await likesApi.unlike(post.id) : await likesApi.like(post.id);
      setState((s) => ({
        ...s,
        list: s.list.map((p) => (p.id === post.id ? { ...p, liked: data.liked, likeCount: data.likeCount } : p)),
      }));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="toolbar">
        <form onSubmit={onSearch} style={{ display: 'flex', gap: 8, flex: 1 }}>
          <input className="input" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索帖子标题或内容…" />
          <button className="btn" type="submit">搜索</button>
        </form>
        <button className={`btn btn-sm${sort === 'latest' ? ' btn-primary' : ''}`} onClick={() => patchParams({ sort: 'latest', page: undefined })}>最新</button>
        <button className={`btn btn-sm${sort === 'hot' ? ' btn-primary' : ''}`} onClick={() => patchParams({ sort: 'hot', page: undefined })}>最热</button>
        {user && <Link className="btn btn-sm btn-primary" to="/new">发帖</Link>}
      </div>

      {tag && (
        <div className="muted" style={{ marginBottom: 12 }}>
          标签筛选：<span className="tag">#{tag}</span>
          <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => patchParams({ tag: undefined, page: undefined })}>清除</button>
        </div>
      )}
      {q && <div className="muted" style={{ marginBottom: 12 }}>搜索“{q}”的结果</div>}

      <StateView
        loading={state.loading}
        error={state.error}
        empty={state.list.length === 0 && !state.error}
        emptyText="还没有帖子"
        onRetry={load}
      >
        {state.list.map((post) => (
          <PostCard key={post.id} post={post} onToggleLike={onToggleLike} />
        ))}
      </StateView>

      <Pagination pagination={state.pagination} onChange={(p) => patchParams({ page: p })} />
    </div>
  );
}
