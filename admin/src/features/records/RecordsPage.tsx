import { useMemo, useState } from 'react';
import { repository } from '../../data';
import { useAsync } from '../../lib/useAsync';
import { downloadText, durationLabel, formatDate, toCsv } from '../../lib/format';
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { useToast } from '../../components/ui/Toast';

export function RecordsPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => repository.listRecords(), []);
  const [query, setQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return (data ?? []).filter((record) => {
      const matchesQuery = !keyword || record.memberName.toLowerCase().includes(keyword) || record.note.toLowerCase().includes(keyword);
      const matchesFrom = !fromDate || record.date >= fromDate;
      const matchesTo = !toDate || record.date <= toDate;
      return matchesQuery && matchesFrom && matchesTo;
    });
  }, [data, query, fromDate, toDate]);

  const summary = useMemo(() => {
    const totalKm = filtered.reduce((sum, record) => sum + record.distanceKm, 0);
    const members = new Set(filtered.map((record) => record.memberId)).size;
    return { totalKm, members, count: filtered.length };
  }, [filtered]);

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast('当前筛选条件下没有记录可导出。', 'info');
      return;
    }
    const csv = toCsv(
      ['日期', '成员', '距离(km)', '时长(分钟)', '配速', '备注', '可见性'],
      filtered.map((record) => [
        record.date,
        record.memberName,
        record.distanceKm.toFixed(1),
        record.durationMin,
        record.pace,
        record.note,
        '社团可见',
      ]),
    );
    downloadText('青跑团-社团记录-' + new Date().toISOString().slice(0, 10) + '.csv', csv, 'text/csv;charset=utf-8');
    toast('已导出 ' + filtered.length + ' 条社团可见记录。');
  };

  const clearFilters = () => {
    setQuery('');
    setFromDate('');
    setToDate('');
  };

  if (loading && !data) return <Spinner label="正在加载跑步记录" />;
  if (error) {
    return (
      <Card className="error-card">
        <span className="error-icon"><Icon name="alert" size={22} /></span>
        <div><h3>记录加载失败</h3><p>{error}</p></div>
        <Button variant="secondary" onClick={reload}>重新加载</Button>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="记录与导出"
        description="这里只显示社团可见的跑步记录。私密记录不会进入后台，也不会被导出。"
        actions={<Button variant="primary" icon="download" onClick={exportCsv} disabled={filtered.length === 0}>导出 CSV</Button>}
      />

      <div className="info-banner">
        <span className="info-banner-icon"><Icon name="shield" size={18} /></span>
        <div><strong>隐私优先</strong><p>导出文件只包含社团可见记录，不包含成员私密记录；V0.1 暂不记录导出审计日志，上线前会补上。</p></div>
      </div>

      <section className="stat-grid stat-grid-3">
        <Card className="stat-card"><div className="stat-icon stat-icon-green"><Icon name="activity" size={19} /></div><div className="stat-copy"><span>当前记录</span><strong>{summary.count}</strong><small>筛选后的条数</small></div></Card>
        <Card className="stat-card"><div className="stat-icon stat-icon-gold"><Icon name="flag" size={19} /></div><div className="stat-copy"><span>合计里程</span><strong>{summary.totalKm.toFixed(1)}</strong><small>公里 · 仅社团可见</small></div></Card>
        <Card className="stat-card"><div className="stat-icon stat-icon-blue"><Icon name="users" size={19} /></div><div className="stat-copy"><span>参与成员</span><strong>{summary.members}</strong><small>有记录的成员</small></div></Card>
      </section>

      <Card className="table-card">
        <div className="table-toolbar records-toolbar">
          <div className="search-box">
            <Icon name="search" size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索成员或备注" aria-label="搜索跑步记录" />
          </div>
          <div className="date-filters">
            <label><span>从</span><input className="input input-date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
            <label><span>到</span><input className="input input-date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
            {(query || fromDate || toDate) ? <Button variant="ghost" size="sm" onClick={clearFilters}>清除筛选</Button> : null}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon="activity" title={data && data.length > 0 ? '没有匹配的记录' : '还没有社团可见记录'} description={data && data.length > 0 ? '换一个成员名或日期范围试试。' : '成员保存为社团可见的跑步记录会出现在这里。'} />
        ) : (
          <div className="table-wrap">
            <table className="data-table records-table">
              <thead>
                <tr><th>日期</th><th>成员</th><th>距离</th><th>时长</th><th>配速</th><th>备注</th><th>可见性</th></tr>
              </thead>
              <tbody>
                {filtered.map((record) => (
                  <tr key={record.id}>
                    <td className="nowrap">{formatDate(record.date)}</td>
                    <td><strong>{record.memberName}</strong></td>
                    <td className="nowrap">{record.distanceKm.toFixed(1)} km</td>
                    <td className="muted-cell nowrap">{durationLabel(record.durationMin)}</td>
                    <td className="nowrap">{record.pace} /km</td>
                    <td className="note-cell">{record.note || '—'}</td>
                    <td><Badge tone="green">社团可见</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
