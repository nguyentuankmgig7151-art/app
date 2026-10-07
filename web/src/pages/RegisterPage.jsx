import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!USERNAME_RE.test(username.trim())) return setError('用户名需为 3–20 位字母、数字或下划线');
    if (password.length < 6 || password.length > 64) return setError('密码需为 6–64 个字符');
    if (nickname && (nickname.length < 1 || nickname.length > 20)) return setError('昵称需为 1–20 个字符');

    setSubmitting(true);
    try {
      const body = { username: username.trim(), password };
      if (nickname.trim()) body.nickname = nickname.trim();
      await register(body);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || '注册失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 420, margin: '40px auto' }}>
      <h2 style={{ marginTop: 0 }}>注册</h2>
      {error && <div className="alert">{error}</div>}
      <form onSubmit={onSubmit}>
        <div className="form-row">
          <label htmlFor="username">用户名 *</label>
          <input
            id="username"
            className="input"
            value={username}
            autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
            placeholder="3–20 位字母、数字或下划线"
          />
        </div>
        <div className="form-row">
          <label htmlFor="password">密码 *</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6–64 个字符"
          />
        </div>
        <div className="form-row">
          <label htmlFor="nickname">昵称（可选）</label>
          <input
            id="nickname"
            className="input"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="默认与用户名相同"
          />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? '注册中…' : '注册'}
          </button>
          <span className="muted">
            已有账号？<Link to="/login">去登录</Link>
          </span>
        </div>
      </form>
    </div>
  );
}
