import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { postsApi, commentsApi, likesApi } from '../api/endpoints.js';
import CommentList from '../components/CommentList.jsx';
import Pagination from '../components/Pagination.jsx';
import StateView from '../components/StateView.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate } from '../utils/format.js';

const PAGE_SIZE = 10;

export default function PostDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [comments, setComments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadPost = useCallback(() => {
    setLoading(true);
    setError(null);
    postsApi
      .get(id)
      .then((data) => setPost(data.post))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  const loadComments = useCallback(() => {
    setCommentsLoading(true);
    commentsApi
      .list(id, { page, pageSize: PAGE_SIZE })
      .then((data) => {
        setComments(data.list || []);
        setPagination(data.pagination || null);
      })
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }, [id, page]);

  useEffect(() => { loadPost(); }, [loadPost]);
  useEffect(() => { loadComments(); }, [loadComments]);

  const requireLogin = () => {
    navigate('/login', { state: { from: `/posts/${id}` } });
  };

  const onToggleLike = async () => {
    if (!user) return requireLogin();
    try {
      const data = post.liked ? await likesApi.unlike(post.id) : await likesApi.like(post.id);
      setPost((p) => ({ ...p, liked: data.liked, likeCount: data.likeCount }));
    } catch (err) {
      alert(err.message);
    }
  };

  const onSubmitComment = async (e) => {
    e.preventDefault();
    if (!user) return requireLogin();
    const content = commentText.trim();
    if (!content) return;
    setSubmitting(true);
    try {
      await commentsApi.create(post.id, { content });
      setCommentText('');
      setPage(1);
      loadComments();
      setPost((p) => ({ ...p, commentCount: (p.commentCount || 0) + 1 }));
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onDeleteComment = async (comment) => {
    if (!window.confirm('确定删除这条评论？')) return;
    try {
      await commentsApi.remove(comment.id);
      setPost((p) => ({ ...p, commentCount: Math.max(0, (p.commentCount || 0) - 1) }));
      loadComments();
    } catch (err) {
      alert(err.message);
    }
  };

  const onDeletePost = async () => {
    if (!window.confirm('确定删除这篇帖子？相关评论也会被删除。')) return;
    try {
      await postsApi.remove(post.id);
      navigate('/');
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <StateView loading>加载帖子中…</StateView>;
  if (error) return <StateView error={error} onRetry={loadPost} />;
  if (!post) return <StateView empty emptyText="帖子不存在" />;

  const isAuthor = user && user.id === post.author?.id;

  return (
    <div>
      <article className="card">
        <h1 className="post-title" style={{ fontSize: 22 }}>{post.title}</h1>
        <div className="post-meta">
          <Link to={`/users/${post.author?.id}`}>{post.author?.nickname || post.author?.username}</Link>
          <span>{formatDate(post.createdAt)}</span>
          {post.updatedAt && post.updatedAt !== post.createdAt && <span>编辑于 {formatDate(post.updatedAt)}</span>}
        </div>
        {post.tags?.length > 0 && (
          <div style={{ margin: '10px 0' }}>
            {post.tags.map((t) => (
              <Link key={t} className="tag" to={`/tags/${encodeURIComponent(t)}`}>#{t}</Link>
            ))}
          </div>
        )}
        <div className="post-detail-content">{post.content}</div>
        <div className="post-actions">
          <button type="button" className={`like-btn${post.liked ? ' liked' : ''}`} onClick={onToggleLike}>
            ♥ {post.likeCount ?? 0} 赞
          </button>
          <span className="muted">{post.commentCount ?? 0} 评论</span>
          {isAuthor && (
            <>
              <Link className="btn btn-sm" to={`/posts/${post.id}/edit`}>编辑</Link>
              <button className="btn btn-sm btn-danger" onClick={onDeletePost}>删除</button>
            </>
          )}
        </div>
      </article>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>评论</h3>
        <StateView loading={commentsLoading} error={null} empty={false}>
          <CommentList
            comments={comments}
            currentUser={user}
            postAuthorId={post.author?.id}
            onDelete={onDeleteComment}
          />
        </StateView>
        <Pagination pagination={pagination} onChange={setPage} />

        {user ? (
          <form onSubmit={onSubmitComment} style={{ marginTop: 10 }}>
            <textarea
              className="textarea"
              style={{ minHeight: 80 }}
              value={commentText}
              maxLength={500}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="写下你的评论（最多 500 字）"
            />
            <div className="form-actions" style={{ marginTop: 8 }}>
              <button className="btn btn-primary" type="submit" disabled={submitting || !commentText.trim()}>
                {submitting ? '提交中…' : '发表评论'}
              </button>
            </div>
          </form>
        ) : (
          <div className="muted" style={{ marginTop: 10 }}>
            <Link to="/login" state={{ from: `/posts/${id}` }}>登录</Link> 后即可评论
          </div>
        )}
      </section>
    </div>
  );
}
