import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usersApi, postsApi, likesApi } from '../api/endpoints.js';
import PostCard from '../components/PostCard.jsx';
import Pagination from '../components/Pagination.jsx';
import StateView from '../components/StateView.jsx';
import UserList from '../components/UserList.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const PAGE_SIZE = 10;
const TABS = [
  { key: 'posts', label: '我的帖子' },
  { key: 'following', label: '关注' },
  { key: 'followers', label: '粉丝' },
];

export default function UserProfilePage() {
  const { id } = useParams();
  const { user: me, updateUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('posts');

  // 列表数据
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const [page, setPage] = useState(1);

  // 资料编辑
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ nickname: '', avatar: '', bio: '' });
  const [saving, setSaving] = useState(false);

  const isSelf = me && String(me.id) === String(id);

  const loadProfile = useCallback(() => {
    setLoading(true);
    setError(null);
    usersApi
      .get(id)
      .then((data) => {
        setProfile(data);
        setForm({
          nickname: data.user?.nickname || '',
          avatar: data.user?.avatar || '',
          bio: data.user?.bio || '',
        });
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const loadList = useCallback(() => {
    setListLoading(true);
    const fetcher =
      tab === 'posts'
        ? usersApi.posts(id, { page, pageSize: PAGE_SIZE })
        : tab === 'following'
          ? usersApi.following(id, { page, pageSize: PAGE_SIZE })
          : usersApi.followers(id, { page, pageSize: PAGE_SIZE });
    fetcher
      .then((data) => {
        setList(data.list || []);
        setPagination(data.pagination || null);
      })
      .catch(() => { setList([]); setPagination(null); })
      .finally(() => setListLoading(false));
  }, [id, tab, page]);

  useEffect(() => { setPage(1); }, [tab]);
  useEffect(() => { loadList(); }, [loadList]);

  const onToggleFollow = async () => {
    if (!me) return;
    try {
      const data = profile.followed ? await usersApi.unfollow(id) : await usersApi.follow(id);
      setProfile((p) => ({
        ...p,
        followed: data.followed,
        stats: { ...p.stats, followerCount: data.followerCount },
      }));
    } catch (err) {
      alert(err.message);
    }
  };

  const onToggleLike = async (post) => {
    if (!me) return;
    try {
      const data = post.liked ? await likesApi.unlike(post.id) : await likesApi.like(post.id);
      setList((arr) => arr.map((p) => (p.id === post.id ? { ...p, liked: data.liked, likeCount: data.likeCount } : p)));
    } catch (err) {
      alert(err.message);
    }
  };

  const onSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await usersApi.updateMe({
        nickname: form.nickname.trim(),
        avatar: form.avatar.trim(),
        bio: form.bio.trim(),
      });
      setProfile((p) => ({ ...p, user: data.user }));
      updateUser(data.user);
      setEditing(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <StateView loading>加载用户信息中…</StateView>;
  if (error) return <StateView error={error} onRetry={loadProfile} />;
  if (!profile) return <StateView empty emptyText="用户不存在" />;

  const { user, stats } = profile;

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <h2 style={{ margin: '0 0 4px' }}>{user.nickname || user.username}</h2>
            <div className="muted">@{user.username}</div>
            {user.bio && <p style={{ margin: '8px 0' }}>{user.bio}</p>}
            <div className="stats">
              <span>帖子 <b>{stats?.postCount ?? 0}</b></span>
              <span>关注 <b>{stats?.followingCount ?? 0}</b></span>
              <span>粉丝 <b>{stats?.followerCount ?? 0}</b></span>
            </div>
          </div>
          <div className="form-actions">
            {isSelf ? (
              <button className="btn btn-sm" onClick={() => setEditing((v) => !v)}>
                {editing ? '取消编辑' : '编辑资料'}
              </button>
            ) : (
              me && (
                <button className={`btn btn-sm${profile.followed ? '' : ' btn-primary'}`} onClick={onToggleFollow}>
                  {profile.followed ? '已关注' : '关注'}
                </button>
              )
            )}
          </div>
        </div>

        {editing && (
          <form onSubmit={onSaveProfile} style={{ marginTop: 14, borderTop: '1px solid var(--c-border)', paddingTop: 14 }}>
            <div className="form-row">
              <label>昵称</label>
              <input className="input" value={form.nickname} maxLength={20} onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
            </div>
            <div className="form-row">
              <label>头像 URL</label>
              <input className="input" value={form.avatar} onChange={(e) => setForm({ ...form, avatar: e.target.value })} placeholder="https://…" />
            </div>
            <div className="form-row">
              <label>个人简介</label>
              <textarea className="textarea" style={{ minHeight: 70 }} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </button>
          </form>
        )}
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <StateView loading={listLoading} error={null} empty={list.length === 0} emptyText="暂无数据">
        {tab === 'posts' ? (
          list.map((post) => <PostCard key={post.id} post={post} onToggleLike={onToggleLike} />)
        ) : (
          <div className="card"><UserList users={list} /></div>
        )}
      </StateView>

      <Pagination pagination={pagination} onChange={setPage} />
    </div>
  );
}
