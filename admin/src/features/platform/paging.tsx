import { useEffect, useMemo, useState } from 'react';

export const PLATFORM_PAGE_SIZE = 10;

export function usePagedRows<T>(rows: T[], resetKey: string, pageSize = PLATFORM_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pageRows = useMemo(() => {
    const start = (Math.min(page, pageCount) - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageCount, pageSize]);

  return { page, setPage, pageCount, pageRows, pageSize };
}

export function PlatformPager({
  page,
  pageCount,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  if (total <= pageSize) return null;
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const end = Math.min(pageCount, start + 4);
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index);

  return (
    <div className="table-pager">
      <span>共 {total} 条 · 每页 {pageSize} 条</span>
      <div className="table-pager-buttons">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>上一页</button>
        {pages.map((item) => (
          <button
            key={item}
            type="button"
            className={item === page ? 'is-active' : undefined}
            aria-current={item === page ? 'page' : undefined}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ))}
        <button type="button" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>下一页</button>
      </div>
    </div>
  );
}
