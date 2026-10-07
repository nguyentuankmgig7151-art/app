import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { postsApi } from '../api/endpoints.js';
import StateView from '../components/StateView.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function parseTags(input) {
  return Array.from(
    new Set(
      input
        .split(/[,，\n]/)
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean),
    ),
  ).slice(0, 5);
}

export default function PostEditorPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    postsApi
      .get(id)
      .then((data) => {
        const p = data.post;
        if (user && p.author?.id !== user.id) {
          setError(new Error('无权编辑他人的帖子'));
          return;
        }
        setTitle(p.title);
        setContent(p.content);
        setTagInput((p.tags || []).join(', '));
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id, isEdit, user]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const t = title.trim();
    const c = content.trim();
    if (!t || t.length > 100) return alert('标题需为 1–100 字符');
    if (!c || c.length > 10000) return alert('正文需为 1–10000 字符');
    const tags = parseTags(tagInput);
    if (tags.some((x) => x.length < 1 || x.length > 20)) return alert('每个标签需为 1–20 字符');

    setSubmitting(true);
    try {
      if (isEdit) {
        await postsApi.update(id, { title: t, content: c, tags });
        navigate(`/posts/${id}`);
      } else {
        const data = await postsApi.create({ title: t, content: c, tags });
        navigate(`/posts/${data.post.id}`);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <StateView loading>加载中…</StateView>;
  if (error) return <StateView error={error} />;

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{isEdit ? '编辑帖子' : '发表新帖'}</h2>
      <form onSubmit={onSubmit}>
        <div className="form-row">
          <label htmlFor="title">标题</label>
          <input
            id="title"
            className="input"
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="请输入标题（1–100 字符）"
          />
        </div>
        <div className="form-row">
          <label htmlFor="content">正文</label>
          <textarea
            id="content"
            className="textarea"
            value={content}
            maxLength={10000}
            onChange={(e) => setContent(e.target.value)}
            placeholder="请输入正文（1–10000 字符）"
          />
        </div>
        <div className="form-row">
          <label htmlFor="tags">标签</label>
          <input
            id="tags"
            className="input"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="用逗号分隔，最多 5 个，如：javascript, react"
          />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? '提交中…' : isEdit ? '保存修改' : '发布'}
          </button>
          <button type="button" className="btn" onClick={() => navigate(-1)}>取消</button>
        </div>
      </form>
    </div>
  );
}
