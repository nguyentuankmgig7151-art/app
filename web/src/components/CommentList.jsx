import { Link } from 'react-router-dom';
import { formatDate } from '../utils/format.js';

// 评论列表：评论对象 { id, postId, content, createdAt, author }
// 删除权限：评论作者 或 帖子作者（§6.4）
export default function CommentList({ comments, currentUser, postAuthorId, onDelete }) {
  if (!comments || comments.length === 0) {
    return <div className="muted" style={{ padding: '10px 0' }}>还没有评论，来抢沙发吧～</div>;
  }
  return (
    <div>
      {comments.map((c) => {
        const canDelete =
          currentUser && (currentUser.id === c.author?.id || currentUser.id === postAuthorId);
        return (
          <div className="comment" key={c.id}>
            <div className="comment-head">
              <span>
                <Link to={`/users/${c.author?.id}`}>{c.author?.nickname || c.author?.username}</Link>
                <span className="muted" style={{ marginLeft: 8 }}>{formatDate(c.createdAt)}</span>
              </span>
              {canDelete && (
                <button className="btn btn-sm btn-danger" onClick={() => onDelete(c)}>
                  删除
                </button>
              )}
            </div>
            <div className="comment-body">{c.content}</div>
          </div>
        );
      })}
    </div>
  );
}
