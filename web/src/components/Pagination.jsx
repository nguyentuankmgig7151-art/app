// 分页器：依据 §5.4 pagination { page, pageSize, total, totalPages }
export default function Pagination({ pagination, onChange }) {
  if (!pagination) return null;
  const { page, totalPages } = pagination;
  if (!totalPages || totalPages <= 1) {
    return totalPages === 1 ? <div className="pager"><span className="pager-info">共 {pagination.total} 条</span></div> : null;
  }
  return (
    <div className="pager">
      <button className="btn btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        上一页
      </button>
      <span className="pager-info">
        第 {page} / {totalPages} 页 · 共 {pagination.total} 条
      </span>
      <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        下一页
      </button>
    </div>
  );
}
