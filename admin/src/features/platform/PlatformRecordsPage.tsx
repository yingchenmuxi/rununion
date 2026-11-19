import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformRepository } from '../../data';
import { formatDate, formatKm } from '../../lib/format';
import { Button, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import type { RunRecord } from '../../types/models';
import { SourceBadge, VisibilityBadge } from './platformUi';
import { PlatformPager, usePagedRows } from './paging';
import { RecordEditModal } from './RecordEditModal';

type VisibilityFilter = 'all' | RunRecord['visibility'];

export function PlatformRecordsPage() {
  const [records, setRecords] = useState<RunRecord[]>([]);
  const [filter, setFilter] = useState<VisibilityFilter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RunRecord | null>(null);

  const load = async () => {
    setRecords(await platformRepository.listRecords());
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter((record) => {
      if (filter !== 'all' && record.visibility !== filter) return false;
      if (!needle) return true;
      return [record.memberName, record.clubName, record.note].join(' ').toLowerCase().includes(needle);
    });
  }, [records, filter, query]);
  const paged = usePagedRows(rows, filter + '|' + query);

  const stats = useMemo(() => ({
    total: records.length,
    km: records.reduce((sum, record) => sum + record.distanceKm, 0),
    privateCount: records.filter((record) => record.visibility === 'private').length,
    members: new Set(records.map((record) => record.memberId)).size,
    imports: records.filter((record) => record.source === 'import' || record.source === 'activity').length,
  }), [records]);

  if (loading) return <Spinner label="正在读取全平台记录" />;

  const filters: { key: VisibilityFilter; label: string; count: number }[] = [
    { key: 'all', label: '全部记录', count: records.length },
    { key: 'club', label: '社团可见', count: records.filter((record) => record.visibility === 'club').length },
    { key: 'public', label: '公开', count: records.filter((record) => record.visibility === 'public').length },
    { key: 'private', label: '私密', count: stats.privateCount },
  ];

  return (
    <>
      <PageHeader
        title="跑步记录"
        description="平台可以查看和更正全部记录，但这不是日常功能。更正会同步影响成员端统计，并写入审计日志。"
        actions={<Link to="/platform/system"><Button variant="secondary" icon="list">查看操作日志</Button></Link>}
      />

      <div className="info-banner">
        <span className="info-banner-icon"><Icon name="shield" size={17} /></span>
        <div><strong>数据边界</strong><p>私密记录只对成员本人可见，平台仅在有明确审计需要时查看；导出与更正都会留痕。V0.1 暂不提供批量导出全量记录。</p></div>
      </div>

      <div className="stat-grid">
        <Card className="stat-card"><span className="stat-icon stat-icon-green"><Icon name="activity" size={19} /></span><div className="stat-copy"><span>记录总数</span><strong>{stats.total}</strong><small>{stats.members} 位成员</small></div></Card>
        <Card className="stat-card"><span className="stat-icon stat-icon-gold"><Icon name="list" size={19} /></span><div className="stat-copy"><span>合计里程</span><strong>{formatKm(stats.km)}</strong><small>含私密与公开</small></div></Card>
        <Card className="stat-card"><span className="stat-icon stat-icon-blue"><Icon name="download" size={19} /></span><div className="stat-copy"><span>导入 / 计时</span><strong>{stats.imports}</strong><small>来自文件或活动</small></div></Card>
        <Card className="stat-card"><span className="stat-icon stat-icon-coral"><Icon name="lock" size={19} /></span><div className="stat-copy"><span>私密记录</span><strong>{stats.privateCount}</strong><small>仅本人可见</small></div></Card>
      </div>

      <Card className="table-card">
        <div className="table-toolbar">
          <div className="filter-tabs">
            {filters.map((item) => (
              <button key={item.key} type="button" className={'filter-tab' + (filter === item.key ? ' filter-tab-active' : '')} onClick={() => setFilter(item.key)}>
                {item.label}<span>{item.count}</span>
              </button>
            ))}
          </div>
          <div className="search-box">
            <Icon name="search" size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索成员、社团或备注" />
          </div>
        </div>

        {rows.length === 0 ? <EmptyState icon="search" title="没有匹配的记录" description="换个可见性或关键词再试。" /> : (
          <div className="table-wrap">
            <table className="data-table platform-table records-table">
              <thead><tr><th>日期</th><th>成员</th><th>社团</th><th>距离</th><th>时长</th><th>配速</th><th>来源</th><th>可见性</th><th>备注</th><th className="align-right">操作</th></tr></thead>
              <tbody>
                {paged.pageRows.map((record) => (
                  <tr key={record.id}>
                    <td className="nowrap">{formatDate(record.date)}</td>
                    <td><strong>{record.memberName}</strong></td>
                    <td>{record.clubName ?? '—'}</td>
                    <td className="nowrap"><strong>{formatKm(record.distanceKm)}</strong></td>
                    <td className="nowrap">{record.durationMin} 分钟</td>
                    <td className="nowrap">{record.pace} /km</td>
                    <td>{record.source ? <SourceBadge source={record.source} /> : <span className="muted-cell">手动</span>}</td>
                    <td><VisibilityBadge visibility={record.visibility} /></td>
                    <td className="note-cell">{record.note || '—'}</td>
                    <td className="align-right"><Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(record)}>更正</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PlatformPager page={paged.page} pageCount={paged.pageCount} total={rows.length} pageSize={paged.pageSize} onChange={paged.setPage} />
        <div className="table-footnote">共 {rows.length} 条记录 · 来源包括手动记录、导入文件和活动计时 · 更正不会删除原始审计信息</div>
      </Card>

      <RecordEditModal record={editing} open={editing !== null} onClose={() => setEditing(null)} onSaved={load} />
    </>
  );
}
