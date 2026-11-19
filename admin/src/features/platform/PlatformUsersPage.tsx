import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformRepository } from '../../data';
import { formatKm, relativeTime } from '../../lib/format';
import { Avatar, Button, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import type { PlatformUser, PlatformUserStatus } from '../../types/models';
import { UserStatusBadge } from './platformUi';
import { PlatformPager, usePagedRows } from './paging';

type UserFilter = 'all' | PlatformUserStatus;

export function PlatformUsersPage() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [filter, setFilter] = useState<UserFilter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    platformRepository.listUsers().then((items) => {
      if (alive) setUsers(items);
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => ({
    all: users.length,
    active: users.filter((user) => user.status === 'active').length,
    pending: users.filter((user) => user.status === 'pending').length,
    suspended: users.filter((user) => user.status === 'suspended').length,
    left: users.filter((user) => user.status === 'left').length,
  }), [users]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      if (filter !== 'all' && user.status !== filter) return false;
      if (!needle) return true;
      return [user.name, user.username, user.clubName, user.grade].join(' ').toLowerCase().includes(needle);
    });
  }, [users, filter, query]);
  const paged = usePagedRows(rows, filter + '|' + query);

  if (loading) return <Spinner label="正在读取全国用户" />;

  const filters: { key: UserFilter; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: counts.all },
    { key: 'active', label: '在团', count: counts.active },
    { key: 'pending', label: '待审批', count: counts.pending },
    { key: 'suspended', label: '已暂停', count: counts.suspended },
    { key: 'left', label: '已离团', count: counts.left },
  ];

  const noGuardian = users.filter((user) => !user.guardianConsent).length;
  const withFlags = users.filter((user) => user.riskFlags.length > 0).length;

  return (
    <>
      <PageHeader
        title="全部用户"
        description="跨社团查询成员状态。平台能看全量资料，但日常成员审批仍由各自社团负责人完成。"
        actions={<span className="soft-chip"><Icon name="shield" size={14} /> {withFlags} 个风险标记 · {noGuardian} 人监护人同意待补</span>}
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
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索姓名、用户名、社团或年级" />
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon="search" title="没有匹配的用户" description="换个筛选条件或关键词再试。" />
        ) : (
          <div className="table-wrap">
            <table className="data-table platform-table">
              <thead>
                <tr>
                  <th>用户</th>
                  <th>所属社团</th>
                  <th>年级 / 年龄层</th>
                  <th>本周 / 累计</th>
                  <th>监护人同意</th>
                  <th>风险标记</th>
                  <th>状态</th>
                  <th>最近活跃</th>
                  <th className="align-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {paged.pageRows.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="person-cell">
                        <Avatar name={user.name} size="sm" tone={user.role === 'owner' ? 'gold' : 'green'} />
                        <div>
                          <div className="person-name">{user.name}{user.role === 'owner' ? <span className="role-tag">负责人</span> : null}</div>
                          <span>@{user.username} · {user.gender}</span>
                        </div>
                      </div>
                    </td>
                    <td><div className="stacked-cell"><strong>{user.clubName}</strong><span>{user.ageGroup}</span></div></td>
                    <td>{user.grade}</td>
                    <td><div className="stacked-cell"><strong>{formatKm(user.weeklyKm)}</strong><span>累计 {formatKm(user.totalKm)}</span></div></td>
                    <td>{user.guardianConsent ? <span className="consent-yes"><Icon name="check" size={13} /> 已收</span> : <span className="consent-no">待补</span>}</td>
                    <td>{user.riskFlags.length > 0 ? <span className="risk-flag">{user.riskFlags[0]}</span> : <span className="muted-cell">无</span>}</td>
                    <td><UserStatusBadge status={user.status} /></td>
                    <td className="nowrap muted-cell">{relativeTime(user.lastActiveAt)}</td>
                    <td className="align-right"><Link to={'/platform/users/' + user.id}><Button size="sm" variant="secondary" icon="eye">详情</Button></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PlatformPager page={paged.page} pageCount={paged.pageCount} total={rows.length} pageSize={paged.pageSize} onChange={paged.setPage} />
        <div className="table-footnote">共 {rows.length} 位用户 · 年龄层来自用户自述，不作为平台排名依据 · 最近刷新 {relativeTime(new Date().toISOString())}</div>
      </Card>
    </>
  );
}
