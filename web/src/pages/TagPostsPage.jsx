import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { tagsApi, likesApi } from '../api/endpoints.js';
import PostCard from '../components/PostCard.jsx';
import Pagination from '../components/Pagination.jsx';
import StateView from '../components/StateView.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const PAGE_SIZE = 10;

export default function TagPostsPage() {
  const { name } = useParams();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') || 1);

  const [state, setState] = useState({ loading: true, error: null, list: [], pagination: null, tag: null });

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    tagsApi
      .posts(name, { page, pageSize: PAGE_SIZE })
      .then((data) => setState({
        loading: false,
        error: null,
        list: data.list || [],
        pagination: data.pagination || null,
        tag: data.tag || null,
      }))
      .catch((err) => setState({ loading: false, error: err, list: [], pagination: null, tag: null }));
  }, [name, page]);

  useEffect(() => { load(); }, [load]);

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
      <div className="muted" style={{ marginBottom: 14 }}>
        <Link to="/tags">标签</Link> / <span className="tag">#{name}</span>
      </div>
      <StateView
        loading={state.loading}
        error={state.error}
        empty={state.list.length === 0}
        emptyText="该标签下暂无帖子"
        onRetry={load}
      >
        {state.list.map((post) => (
          <PostCard key={post.id} post={post} onToggleLike={onToggleLike} />
        ))}
      </StateView>
      <Pagination
        pagination={state.pagination}
        onChange={(p) => setSearchParams(p > 1 ? { page: String(p) } : {})}
      />
    </div>
  );
}
