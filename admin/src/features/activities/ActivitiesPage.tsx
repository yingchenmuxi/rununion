import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { activityApi } from '../../data/activityApi';
import { useAsync } from '../../lib/useAsync';
import type { ClubActivityStatus, ClubActivitySummary } from '../../types/models';
import { Button, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { ActivityStatusBadge, ActivityTagBadge, formatActivityDate } from './activityUi';
import { NewActivityModal } from './NewActivityModal';

type Filter = 'all' | 'pending' | ClubActivityStatus;

export function ActivitiesPage() {
  const { data, loading, error, reload } = useAsync(() => activityApi.listActivities(), []);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const counts = useMemo(() => {
    const list = data ?? [];
    return {
      all: list.length,
      published: list.filter((item) => item.status === 'published').length,
      draft: list.filter((item) => item.status === 'draft').length,
      ended: list.filter((item) => item.status === 'ended').length,
      pending: list.reduce((sum, item) => sum + item.pendingCount, 0),
      pendingActivities: list.filter((item) => item.pendingCount > 0).length,
      pendingCheckin: list.filter((item) => item.status === 'ended').reduce((sum, item) => sum + item.pendingCheckinCount, 0),
      signups: list.reduce((sum, item) => sum + item.signupCount, 0),
    };
  }, [data]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return (data ?? []).filter((item) => {
      const matchesFilter = filter === 'all'
        || (filter === 'pending' ? item.pendingCount > 0 : item.status === filter);
      const matchesQuery = !keyword || [item.title, item.coach, item.meetingArea, item.tag]
        .some((value) => value.toLowerCase().includes(keyword));
      return matchesFilter && matchesQuery;
    });
  }, [data, filter, query]);

  const signupHint = (activity: ClubActivitySummary) => {
    if (activity.pendingCount > 0) return activity.pendingCount + ' 条待确认';
    if (activity.status === 'ended' && activity.pendingCheckinCount > 0) return activity.pendingCheckinCount + ' 人待签到';
    if (activity.status === 'ended' && activity.absentCount > 0) return '出勤已核对 · ' + activity.absentCount + ' 人未到';
    if (activity.status === 'ended') return '出勤已核对';
    return '没有待确认报名';
  };

  if (loading && !data) return <Spinner label="正在加载活动" />;
  if (error) {
    return (
      <Card className="error-card">
        <span className="error-icon"><Icon name="alert" size={22} /></span>
        <div><h3>活动加载失败</h3><p>{error}</p></div>
        <Button variant="secondary" onClick={reload}>重新加载</Button>
      </Card>
    );
  }

  const filters: Array<{ key: Filter; label: string; count: number }> = [
    { key: 'all', label: '全部', count: counts.all },
    { key: 'pending', label: '待确认', count: counts.pendingActivities },
    { key: 'published', label: '报名中', count: counts.published },
    { key: 'draft', label: '草稿', count: counts.draft },
    { key: 'ended', label: '已结束', count: counts.ended },
  ];

  return (
    <div>
      <PageHeader
        title="活动"
        description="发布线下活动、审核报名、赛后核对签到。确认监护人知情后再放行集合点，活动只面向本社团成员。"
        actions={<Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>发布活动</Button>}
      />

      <section className="stat-grid">
        <Card className="stat-card">
          <div className="stat-icon stat-icon-green"><Icon name="calendar" size={19} /></div>
          <div className="stat-copy"><span>报名中</span><strong>{counts.published}</strong><small>场活动正在开放报名</small></div>
        </Card>
        <Card className="stat-card">
          <div className="stat-icon stat-icon-gold"><Icon name="clock" size={19} /></div>
          <div className="stat-copy"><span>待确认</span><strong>{counts.pending}</strong><small>条报名等团长处理</small></div>
        </Card>
        <Card className="stat-card">
          <div className="stat-icon stat-icon-coral"><Icon name="check" size={19} /></div>
          <div className="stat-copy"><span>待签到</span><strong>{counts.pendingCheckin}</strong><small>{counts.pendingCheckin > 0 ? '活动结束后核对出勤' : '出勤记录已核对'}</small></div>
        </Card>
        <Card className="stat-card">
          <div className="stat-icon stat-icon-blue"><Icon name="users" size={19} /></div>
          <div className="stat-copy"><span>累计报名</span><strong>{counts.signups}</strong><small>不含已取消的名额</small></div>
        </Card>
      </section>

      <Card className="table-card">
        <div className="table-toolbar">
          <div className="filter-tabs" role="tablist" aria-label="活动状态筛选">
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={filter === item.key}
                className={'filter-tab' + (filter === item.key ? ' filter-tab-active' : '')}
                onClick={() => setFilter(item.key)}
              >
                {item.label}<span>{item.count}</span>
              </button>
            ))}
          </div>
          <div className="search-box">
            <Icon name="search" size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索活动、教练或集合地点"
              aria-label="搜索活动"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon="calendar"
            title={query ? '没有匹配的活动' : '这个分组还没有活动'}
            description={query ? '换一个关键词试试。' : '发布一场活动，成员会在手机端看到报名入口。'}
            action={query ? undefined : <Button variant="primary" size="sm" icon="plus" onClick={() => setCreateOpen(true)}>发布活动</Button>}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table activity-table">
              <thead>
                <tr>
                  <th>活动</th>
                  <th>时间</th>
                  <th>报名</th>
                  <th>带跑</th>
                  <th>状态</th>
                  <th className="align-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((activity) => (
                  <tr key={activity.id}>
                    <td>
                      <div className="stacked-cell activity-name-cell">
                        <div className="activity-title-row">
                          <Link to={'/activities/' + activity.id} className="table-primary-link">{activity.title}</Link>
                          <ActivityTagBadge tag={activity.tag} />
                        </div>
                        <span>{activity.distanceKm} km · {activity.meetingArea}</span>
                      </div>
                    </td>
                    <td>
                      <div className="stacked-cell">
                        <strong>{formatActivityDate(activity.date)}</strong>
                        <span>{activity.startTime} 集合 · 约 {activity.durationMin} 分钟</span>
                      </div>
                    </td>
                    <td>
                      <div className="stacked-cell">
                        <strong>{activity.signupCount} / {activity.capacity} 人</strong>
                        <span>{signupHint(activity)}</span>
                      </div>
                    </td>
                    <td>{activity.coach}</td>
                    <td><ActivityStatusBadge status={activity.status} /></td>
                    <td>
                      <div className="row-actions">
                        <Link to={'/activities/' + activity.id} className="btn btn-ghost btn-sm">
                          <span>查看</span>
                          <Icon name="chevronRight" size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="table-footnote">
          共 {filtered.length} 场活动。报名确认前不显示具体集合点；活动结束后，未处理的报名会自动关闭，已确认成员进入签到。
        </p>
      </Card>

      <NewActivityModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={reload}
      />
    </div>
  );
}
