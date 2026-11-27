import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformRepository } from '../../data';
import { formatKm, relativeTime } from '../../lib/format';
import { Button, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/primitives';
import { Icon, type IconName } from '../../components/ui/Icon';
import type { PlatformOverviewActivity, PlatformOverviewData } from '../../types/models';
import { ClubStatusBadge, ReportStatusBadge } from './platformUi';

const activityIcon: Record<PlatformOverviewActivity['type'], IconName> = {
  club: 'shield',
  user: 'users',
  content: 'megaphone',
  report: 'flag',
  system: 'lock',
};

const activityTone: Record<PlatformOverviewActivity['type'], string> = {
  club: 'platform-activity-club',
  user: 'platform-activity-user',
  content: 'platform-activity-content',
  report: 'platform-activity-report',
  system: 'platform-activity-system',
};

export function PlatformOverviewPage() {
  const [data, setData] = useState<PlatformOverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    platformRepository.getOverview().then((result) => {
      if (alive) setData(result);
    }).finally(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  if (loading) return <Spinner label="正在汇总全国社团数据" />;
  if (!data) return <EmptyState icon="alert" title="暂时读不到平台数据" description="请刷新页面再试一次。" />;

  const maxKm = Math.max(...data.weeklyTrend.map((point) => point.km), 1);
  const maxCityUsers = Math.max(...data.cities.map((city) => city.users), 1);

  return (
    <>
      <PageHeader
        title="全国社团，今天在发生什么？"
        description="先看需要平台介入的事，再看整体运行情况。当前为空状态，接入真实数据后会显示各社团汇总。"
        actions={<Link to="/platform/moderation"><Button variant="secondary" icon="flag">处理举报</Button></Link>}
      />

      <div className="stat-grid">
        <Card className="stat-card">
          <span className="stat-icon stat-icon-green"><Icon name="shield" size={19} /></span>
          <div className="stat-copy"><span>入驻社团</span><strong>{data.clubs}</strong><small>{data.activeClubs} 个正在运行</small></div>
        </Card>
        <Card className="stat-card">
          <span className="stat-icon stat-icon-blue"><Icon name="users" size={19} /></span>
          <div className="stat-copy"><span>覆盖用户</span><strong>{data.users}</strong><small>{data.pendingUsers} 人待社团审批</small></div>
        </Card>
        <Card className="stat-card">
          <span className="stat-icon stat-icon-gold"><Icon name="activity" size={19} /></span>
          <div className="stat-copy"><span>本周里程</span><strong>{formatKm(data.weeklyKm)}</strong><small>只统计社团可见记录</small></div>
        </Card>
        <Card className="stat-card">
          <span className="stat-icon stat-icon-coral"><Icon name="flag" size={19} /></span>
          <div className="stat-copy"><span>待处理举报</span><strong>{data.pendingReports}</strong><small>{data.highRiskReports} 条高风险</small></div>
        </Card>
      </div>

      <div className="overview-grid">
        <Card className="panel">
          <div className="panel-head">
            <div><h2>待审核社团</h2><p>通过后才会出现在成员端，并标记为已认证。</p></div>
            <span className="panel-head-icon"><Icon name="shield" size={19} /></span>
          </div>
          {data.pendingClubList.length === 0 ? (
            <EmptyState icon="check" title="暂时没有待审核社团" description="新的入驻申请会出现在这里。" />
          ) : (
            <div className="pending-list">
              {data.pendingClubList.map((club) => (
                <div className="pending-item" key={club.id}>
                  <span className="club-mini-mark">{club.name.slice(0, 1)}</span>
                  <div className="pending-copy">
                    <div className="pending-name"><strong>{club.name}</strong><span>{club.city} · {club.kind === 'school' ? '学校社团' : '社区跑团'}</span></div>
                    <p>{club.intro}</p>
                    <small>负责人 {club.ownerName} · {relativeTime(club.createdAt)}提交</small>
                  </div>
                  <div className="pending-actions">
                    <ClubStatusBadge status={club.status} />
                    <Link to={'/platform/clubs/' + club.id}><Button size="sm" variant="secondary">查看</Button></Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="panel">
          <div className="panel-head">
            <div><h2>待处理举报</h2><p>高风险举报排在最前面。</p></div>
            <Link to="/platform/moderation" className="text-link">全部举报 <Icon name="chevronRight" size={13} /></Link>
          </div>
          {data.pendingReportList.length === 0 ? (
            <EmptyState icon="check" title="举报都处理完了" />
          ) : (
            <div className="pending-list">
              {data.pendingReportList.slice(0, 3).map((report) => (
                <div className="pending-item" key={report.id}>
                  <span className={'report-dot ' + (report.priority === 'high' ? 'report-dot-high' : '')}><Icon name="flag" size={15} /></span>
                  <div className="pending-copy">
                    <div className="pending-name"><strong>{report.targetName}</strong><ReportStatusBadge status={report.status} /></div>
                    <p>{report.reason}</p>
                    <small>{report.clubName} · {relativeTime(report.createdAt)}</small>
                  </div>
                  <Link to="/platform/moderation"><Button size="sm" variant="secondary">处理</Button></Link>
                </div>
              ))}
            </div>
          )}
          <div className="panel-footnote"><Icon name="lock" size={13} /> 举报人和被举报人的资料只在平台后台可见。</div>
        </Card>
      </div>

      <div className="split-grid">
        <Card className="panel">
          <div className="panel-head">
            <div><h2>近 7 天平台里程</h2><p>各社团已同步记录的合计，不含私密记录。</p></div>
            <span className="trend-total">{formatKm(data.weeklyKm)}</span>
          </div>
          {data.weeklyTrend.length === 0 ? (
            <EmptyState icon="activity" title="还没有平台里程" description="各社团同步跑步记录后，这里会显示近 7 天趋势。" />
          ) : (
            <div className="trend-chart">
              {data.weeklyTrend.map((point) => (
                <div className="trend-column" key={point.label}>
                  <span className="trend-value">{Math.round(point.km)}</span>
                  <div className="trend-bar"><span style={{ height: Math.max(8, (point.km / maxKm) * 100) + '%' }} /></div>
                  <span className="trend-label">{point.label}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="panel">
          <div className="panel-head">
            <div><h2>城市覆盖</h2><p>按社团成员数排序，先做密度再扩城市。</p></div>
            <span className="panel-head-icon"><Icon name="users" size={19} /></span>
          </div>
          {data.cities.length === 0 ? (
            <EmptyState icon="users" title="还没有城市数据" description="社团入驻并添加成员后，这里会显示城市覆盖。" />
          ) : (
            <div className="city-list">
              {data.cities.slice(0, 6).map((city, index) => (
                <div className="city-row" key={city.city}>
                  <span className="city-rank">{String(index + 1).padStart(2, '0')}</span>
                  <div className="city-copy">
                    <div><strong>{city.city}</strong><span>{city.clubs} 个社团 · {city.users} 人</span></div>
                    <div className="city-track"><span style={{ width: (city.users / maxCityUsers) * 100 + '%' }} /></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="split-grid split-grid-wide">
        <Card className="panel">
          <div className="panel-head"><div><h2>平台动态</h2><p>入驻、内容、举报和系统操作的最近变化。</p></div></div>
          {data.activities.length === 0 ? (
            <EmptyState icon="activity" title="还没有平台动态" description="入驻、内容、举报和系统操作会出现在这里。" />
          ) : (
            <div className="activity-list">
              {data.activities.map((activity) => (
                <div className="activity-item platform-activity-item" key={activity.id}>
                  <span className={'activity-icon ' + activityTone[activity.type]}><Icon name={activityIcon[activity.type]} size={15} /></span>
                  <div><strong>{activity.title}</strong><p>{activity.detail}</p></div>
                  <small>{relativeTime(activity.time)}</small>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="quick-links quick-links-stack">
          <Link className="quick-link" to="/platform/clubs">
            <span className="quick-icon"><Icon name="shield" size={18} /></span>
            <span><strong>学校与社团</strong><small>审核入驻、暂停与恢复</small></span>
            <Icon name="chevronRight" size={16} />
          </Link>
          <Link className="quick-link" to="/platform/users">
            <span className="quick-icon"><Icon name="users" size={18} /></span>
            <span><strong>全部用户</strong><small>跨社团查询成员状态</small></span>
            <Icon name="chevronRight" size={16} />
          </Link>
          <Link className="quick-link" to="/platform/system">
            <span className="quick-icon"><Icon name="lock" size={18} /></span>
            <span><strong>系统与权限</strong><small>管理员账号与操作日志</small></span>
            <Icon name="chevronRight" size={16} />
          </Link>
        </div>
      </div>
    </>
  );
}
