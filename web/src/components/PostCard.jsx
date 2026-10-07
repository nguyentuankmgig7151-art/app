import { Link } from 'react-router-dom';
import { excerpt, formatDate } from '../utils/format.js';

// 帖子卡片：字段对齐 §6 帖子对象视图
export default function PostCard({ post, onToggleLike }) {
  return (
    <article className="card">
      <h3 className="post-title">
        <Link to={`/posts/${post.id}`}>{post.title}</Link>
      </h3>
      <div className="post-meta">
        <Link to={`/users/${post.author?.id}`}>{post.author?.nickname || post.author?.username}</Link>
        <span>{formatDate(post.createdAt)}</span>
        {post.commentCount > 0 && <span>{post.commentCount} 评论</span>}
      </div>
      <p className="post-excerpt">{excerpt(post.content)}</p>
      {post.tags?.length > 0 && (
        <div style={{ margin: '8px 0' }}>
          {post.tags.map((t) => (
            <Link key={t} className="tag" to={`/tags/${encodeURIComponent(t)}`}>
              #{t}
            </Link>
          ))}
        </div>
      )}
      <div className="post-actions">
        <button
          type="button"
          className={`like-btn${post.liked ? ' liked' : ''}`}
          onClick={() => onToggleLike && onToggleLike(post)}
        >
          ♥ {post.likeCount ?? 0}
        </button>
        <Link to={`/posts/${post.id}`} className="muted">查看详情</Link>
      </div>
    </article>
  );
}
