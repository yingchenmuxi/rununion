import { useEffect, useMemo, useState } from 'react';
import { platformRepository } from '../../data';
import { formatDate, relativeTime } from '../../lib/format';
import { useToast } from '../../components/ui/Toast';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Button, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import type { PlatformContentItem, PlatformContentStatus, PlatformContentType } from '../../types/models';
import { ContentStatusBadge, contentTypeLabels } from './platformUi';
import { PlatformPager, usePagedRows } from './paging';

type StatusFilter = 'all' | PlatformContentStatus;

interface PendingAction {
  item: PlatformContentItem;
  status: PlatformContentStatus;
  title: string;
  description: string;
  tone: 'primary' | 'danger';
}

const actionLabel: Record<PlatformContentStatus, string> = {
  published: '上线',
  review: '通过',
  draft: '发布',
  offline: '下线',
};

export function PlatformContentPage() {
  const toast = useToast();
  const [items, setItems] = useState<PlatformContentItem[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | PlatformContentType>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setItems(await platformRepository.listContent());
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== 'all' && item.status !== filter) return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (!needle) return true;
      return [item.title, item.clubName, item.author].join(' ').toLowerCase().includes(needle);
    });
  }, [items, filter, typeFilter, query]);
  const paged = usePagedRows(rows, filter + '|' + typeFilter + '|' + query);

  const counts = useMemo(() => ({
    all: items.length,
    published: items.filter((item) => item.status === 'published').length,
    review: items.filter((item) => item.status === 'review').length,
    draft: items.filter((item) => item.status === 'draft').length,
    offline: items.filter((item) => item.status === 'offline').length,
  }), [items]);

  const runAction = async () => {
    if (!action) return;
    setBusy(true);
    try {
      await platformRepository.updateContentStatus(action.item.id, action.status);
      toast('内容状态已更新，成员端会同步变化。');
      setAction(null);
      await load();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : '操作失败，请稍后重试。', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="正在读取全平台内容" />;

  const statusFilters: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: counts.all },
    { key: 'review', label: '待审核', count: counts.review },
    { key: 'published', label: '已发布', count: counts.published },
    { key: 'offline', label: '已下线', count: counts.offline },
    { key: 'draft', label: '草稿', count: counts.draft },
  ];

  return (
    <>
      <PageHeader
        title="内容与活动"
        description="平台可查看所有社团的公告、文章、活动与挑战。日常发布由社团负责，平台只处理违规与高风险内容。"
        actions={<span className="soft-chip"><Icon name="eye" size={14} /> 全量可见 · {counts.review} 条待审核</span>}
      />

      <Card className="table-card">
        <div className="table-toolbar">
          <div className="filter-tabs">
            {statusFilters.map((item) => (
              <button key={item.key} type="button" className={'filter-tab' + (filter === item.key ? ' filter-tab-active' : '')} onClick={() => setFilter(item.key)}>
                {item.label}<span>{item.count}</span>
              </button>
            ))}
          </div>
          <div className="toolbar-right">
            <select className="input compact-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | PlatformContentType)}>
              <option value="all">全部类型</option>
              <option value="announcement">公告</option>
              <option value="article">文章</option>
              <option value="activity">活动</option>
              <option value="challenge">挑战</option>
            </select>
            <div className="search-box">
              <Icon name="search" size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、社团或作者" />
            </div>
          </div>
        </div>

        {rows.length === 0 ? <EmptyState icon="search" title="没有匹配的内容" description="换个类型、状态或关键词再试。" /> : (
          <div className="table-wrap">
            <table className="data-table platform-table content-table">
              <thead><tr><th>内容</th><th>类型</th><th>社团</th><th>作者</th><th>数据</th><th>创建时间</th><th>状态</th><th className="align-right">操作</th></tr></thead>
              <tbody>
                {paged.pageRows.map((item) => (
                  <tr key={item.id}>
                    <td><div className="stacked-cell"><strong>{item.title}</strong><span className="note-cell">{item.summary}</span></div></td>
                    <td><span className="type-tag">{contentTypeLabels[item.type]}</span></td>
                    <td>{item.clubName}</td>
                    <td>{item.author}</td>
                    <td className="muted-cell">{item.stats}</td>
                    <td className="nowrap"><div className="stacked-cell"><strong>{formatDate(item.createdAt)}</strong><span>{relativeTime(item.createdAt)}</span></div></td>
                    <td><ContentStatusBadge status={item.status} /></td>
                    <td className="align-right">
                      <div className="row-actions">
                        {item.status === 'review' ? (
                          <Button size="sm" variant="primary" onClick={() => setAction({ item, status: 'published', title: '通过这条内容？', description: '通过后内容会立即出现在对应社团的成员端。', tone: 'primary' })}>通过</Button>
                        ) : null}
                        {item.status === 'published' ? (
                          <Button size="sm" variant="dangerGhost" onClick={() => setAction({ item, status: 'offline', title: '下线这条内容？', description: '下线后成员端立即隐藏，但平台仍保留内容和操作记录。', tone: 'danger' })}>下线</Button>
                        ) : null}
                        {item.status === 'offline' || item.status === 'draft' ? (
                          <Button size="sm" variant="secondary" onClick={() => setAction({ item, status: 'published', title: '重新发布这条内容？', description: '发布后内容会出现在成员端，请确认已经完成审核。', tone: 'primary' })}>{actionLabel[item.status]}</Button>
                        ) : null}
                        <Button size="sm" variant="ghost" icon="eye" onClick={() => setAction({ item, status: item.status, title: item.title, description: item.summary + '\n\n' + item.clubName + ' · ' + item.author + ' · ' + item.stats, tone: 'primary' })}>查看</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PlatformPager page={paged.page} pageCount={paged.pageCount} total={rows.length} pageSize={paged.pageSize} onChange={paged.setPage} />
        <div className="table-footnote">共 {rows.length} 条 · 平台不会修改正文，只调整可见状态；需要删改时联系社团负责人。</div>
      </Card>

      <ConfirmDialog
        open={action !== null}
        title={action?.title ?? ''}
        description={action?.description ?? ''}
        tone={action?.tone}
        confirmText={action && action.status !== action.item.status ? '确认' + actionLabel[action.item.status] : '关闭'}
        loading={busy}
        onConfirm={() => {
          if (action && action.status === action.item.status) setAction(null);
          else runAction();
        }}
        onClose={() => setAction(null)}
      />
    </>
  );
}
