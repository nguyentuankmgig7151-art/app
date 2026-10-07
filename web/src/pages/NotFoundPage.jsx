import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="state">
      <h2>404</h2>
      <p>页面不存在</p>
      <Link className="btn" to="/">返回首页</Link>
    </div>
  );
}
