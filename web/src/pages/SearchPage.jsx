import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchApi, likesApi } from '../api/endpoints.js';
import PostCard from '../components/PostCard.jsx';
import Pagination from '../components/Pagination.jsx';
import StateView from '../components/StateView.jsx';
import UserList from '../components/UserList.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const PAGE_SIZE = 10;

export default function SearchPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get('q') || '';
  const type = searchParams.get('type') === 'user' ? 'user' : 'post';
  const page = Number(searchParams.get('page') || 1);

  const [input, setInput] = useState(q);
  const [state, setState] = useState({ loading: false, error: null, list: [], pagination: null });

  useEffect(() => { setInput(q); }, [q]);

  const load = useCallback(() => {
    if (!q) {
      setState({ loading: false, error: null, list: [], pagination: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    searchApi
      .search({ q, type, page, pageSize: PAGE_SIZE })
      .then((data) => setState({ loading: false, error: null, list: data.list || [], pagination: data.pagination || null }))
      .catch((err) => setState({ loading: false, error: err, list: [], pagination: null }));
  }, [q, type, page]);

  useEffect(() => { load(); }, [load]);

  const patch = (next) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      Object.entries(next).forEach(([k, v]) => {
        if (v === undefined || v === '' || v === null) p.delete(k);
        else p.set(k, v);
      });
      if (!('page' in next)) p.delete('page');
      return p;
    });
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const kw = input.trim();
    patch({ q: kw });
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
      <form onSubmit={onSubmit} className="toolbar">
        <input className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="输入关键字搜索…" />
        <button className="btn btn-primary" type="submit">搜索</button>
      </form>

      <div className="tabs">
        <button className={type === 'post' ? 'active' : ''} onClick={() => patch({ type: 'post' })}>帖子</button>
        <button className={type === 'user' ? 'active' : ''} onClick={() => patch({ type: 'user' })}>用户</button>
      </div>

      {!q && <div className="state">请输入关键字进行搜索</div>}

      {q && (
        <>
          <div className="muted" style={{ marginBottom: 12 }}>“{q}” 的搜索结果</div>
          <StateView
            loading={state.loading}
            error={state.error}
            empty={state.list.length === 0}
            emptyText="没有找到相关内容"
            onRetry={load}
          >
            {type === 'post' ? (
              state.list.map((post) => <PostCard key={post.id} post={post} onToggleLike={onToggleLike} />)
            ) : (
              <div className="card"><UserList users={state.list} /></div>
            )}
          </StateView>
          <Pagination pagination={state.pagination} onChange={(p) => patch({ page: p })} />
        </>
      )}
    </div>
  );
}
