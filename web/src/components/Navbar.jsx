import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const onSearch = (e) => {
    e.preventDefault();
    const kw = q.trim();
    if (!kw) return;
    navigate(`/search?q=${encodeURIComponent(kw)}`);
    setQ('');
  };

  const onLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">社区</Link>
        <nav className="nav-links">
          <NavLink to="/" end>首页</NavLink>
          <NavLink to="/tags">标签</NavLink>
          <a href="/new"
            onClick={(e) => {
              e.preventDefault();
              navigate(user ? '/new' : '/login');
            }}
          >
            发帖
          </a>
        </nav>
        <form onSubmit={onSearch} style={{ display: 'flex', gap: 6 }}>
          <input className="input" style={{ width: 160 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索…" />
          <button className="btn btn-sm" type="submit">搜索</button>
        </form>
        <div className="nav-right">
          {user ? (
            <>
              <NavLink to="/me" className="btn btn-sm">我的</NavLink>
              <button className="btn btn-sm" onClick={onLogout}>退出</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="btn btn-sm">登录</NavLink>
              <NavLink to="/register" className="btn btn-sm btn-primary">注册</NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
