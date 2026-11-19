import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformRepository } from '../../data';
import { formatKm, relativeTime } from '../../lib/format';
import { Button, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import type { PlatformClub, PlatformClubStatus } from '../../types/models';
import { ClubStatusBadge, RiskBadge } from './platformUi';
import { PlatformPager, usePagedRows } from './paging';

type ClubFilter = 'all' | PlatformClubStatus;

export function PlatformClubsPage() {
  const [clubs, setClubs] = useState<PlatformClub[]>([]);
  const [filter, setFilter] = useState<ClubFilter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    platformRepository.listClubs().then((items) => {
      if (alive) setClubs(items);
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => ({
    all: clubs.length,
    active: clubs.filter((club) => club.status === 'active').length,
    pending: clubs.filter((club) => club.status === 'pending').length,
    paused: clubs.filter((club) => club.status === 'paused').length,
    rejected: clubs.filter((club) => club.status === 'rejected').length,
  }), [clubs]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return clubs.filter((club) => {
      if (filter !== 'all' && club.status !== filter) return false;
      if (!needle) return true;
      return [club.name, club.school, club.city, club.ownerName].join(' ').toLowerCase().includes(needle);
    });
  }, [clubs, filter, query]);
  const paged = usePagedRows(rows, filter + '|' + query);

  if (loading) return <Spinner label="正在读取社团名册" />;

  const filters: { key: ClubFilter; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: counts.all },
    { key: 'active', label: '运行中', count: counts.active },
    { key: 'pending', label: '待审核', count: counts.pending },
    { key: 'paused', label: '已暂停', count: counts.paused },
    { key: 'rejected', label: '未通过', count: counts.rejected },
  ];

  return (
    <>
      <PageHeader
        title="学校与社团"
        description="平台掌握全部社团的入驻状态、负责人、规模和安全风险。进入详情后才能改动数据。"
        actions={<span className="soft-chip"><Icon name="shield" size={14} /> {counts.active} 个运行中 · {counts.pending} 个待审核</span>}
      />

      <Card className="table-card">
        <div className="table-toolbar">
          <div className="filter-tabs">
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                className={'filter-tab' + (filter === item.key ? ' filter-tab-active' : '')}
                onClick={() => setFilter(item.key)}
              >
                {item.label}<span>{item.count}</span>
              </button>
            ))}
          </div>
          <div className="search-box">
            <Icon name="search" size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索社团、学校、城市或负责人" />
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon="search" title="没有匹配的社团" description="换个筛选条件或关键词再试。" />
        ) : (
          <div className="table-wrap">
            <table className="data-table platform-table">
              <thead>
                <tr>
                  <th>社团</th>
                  <th>地区 / 类型</th>
                  <th>负责人</th>
                  <th>规模</th>
                  <th>本周里程</th>
                  <th>风险</th>
                  <th>状态</th>
                  <th className="align-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {paged.pageRows.map((club) => (
                  <tr key={club.id}>
                    <td>
                      <div className="person-cell club-cell">
                        <span className="club-mark">{club.name.slice(0, 1)}</span>
                        <div>
                          <div className="person-name">{club.name}{club.verified ? <span className="verified-mark"><Icon name="check" size={11} /></span> : null}</div>
                          <span>{club.school}</span>
                        </div>
                      </div>
                    </td>
                    <td><div className="stacked-cell"><strong>{club.province} · {club.city}</strong><span>{club.kind === 'school' ? '学校社团' : '社区跑团'}</span></div></td>
                    <td><div className="stacked-cell"><strong>{club.ownerName}</strong><span>{club.ownerTitle} · {club.ownerPhone}</span></div></td>
                    <td><div className="stacked-cell"><strong>{club.memberCount} 人</strong><span>累计 {formatKm(club.totalKm)}</span></div></td>
                    <td className="nowrap"><strong>{formatKm(club.weeklyKm)}</strong></td>
                    <td><RiskBadge level={club.riskLevel} /></td>
                    <td><ClubStatusBadge status={club.status} /></td>
                    <td className="align-right">
                      <Link to={'/platform/clubs/' + club.id}><Button size="sm" variant="secondary" icon="eye">详情</Button></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PlatformPager page={paged.page} pageCount={paged.pageCount} total={rows.length} pageSize={paged.pageSize} onChange={paged.setPage} />
        <div className="table-footnote">共 {rows.length} 个社团 · 列表按入驻时间倒序 · 最近更新 {clubs[0] ? relativeTime(clubs[0].createdAt) : '—'}</div>
      </Card>
    </>
  );
}
