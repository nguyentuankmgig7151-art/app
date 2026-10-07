import { Link } from 'react-router-dom';

// 用户列表项：用户对象 { id, username, nickname, avatar, bio }
export default function UserList({ users }) {
  if (!users || users.length === 0) {
    return <div className="muted" style={{ padding: '10px 0' }}>暂无用户</div>;
  }
  return (
    <div>
      {users.map((u) => (
        <div className="user-item" key={u.id}>
          <div>
            <Link to={`/users/${u.id}`} style={{ fontWeight: 600 }}>
              {u.nickname || u.username}
            </Link>
            <span className="muted" style={{ marginLeft: 8 }}>@{u.username}</span>
            {u.bio && <div className="muted">{u.bio}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
