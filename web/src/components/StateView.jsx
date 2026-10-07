// 加载中 / 空数据 / 错误 三态统一展示
export default function StateView({ loading = false, error = null, empty = false, emptyText = '暂无数据', children, onRetry }) {
  if (loading) return <div className="state">加载中…</div>;
  if (error) {
    return (
      <div className="state error">
        <div>{typeof error === 'string' ? error : error.message || '出错了'}</div>
        {onRetry && (
          <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={onRetry}>
            重试
          </button>
        )}
      </div>
    );
  }
  if (empty) return <div className="state">{emptyText}</div>;
  return children;
}
