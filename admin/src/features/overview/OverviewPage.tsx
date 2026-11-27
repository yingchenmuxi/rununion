import { useState } from 'react';
import { Link } from 'react-router-dom';
import { repository } from '../../data';
import { memberApi } from '../../data/memberApi';
import { useAsync } from '../../lib/useAsync';
import { formatDate, relativeTime } from '../../lib/format';
import type { Member } from '../../types/models';
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/primitives';
import { Icon, type IconName } from '../../components/ui/Icon';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';

const statCards: Array<{ key: 'pendingMembers' | 'activeMembers' | 'weeklyActive' | 'weeklyKm'; label: string; hint: string; icon: IconName; tone: string }> = [
  { key: 'pendingMembers', label: '待审批', hint: '新成员申请', icon: 'users', tone: 'coral' },
  { key: 'activeMembers', label: '在团成员', hint: '已通过审批', icon: 'shield', tone: 'green' },
  { key: 'weeklyActive', label: '本周活跃', hint: '至少记录一次', icon: 'activity', tone: 'gold' },
  { key: 'weeklyKm', label: '本周总里程', hint: 'km · 仅社团可见记录', icon: 'flag', tone: 'blue' },
];

const activityIcon: Record<string, IconName> = {
  member: 'users',
  run: 'activity',
  challenge: 'flag',
  announcement: 'megaphone',
};

export function OverviewPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(async () => {
    const [overview, members] = await Promise.all([repository.getOverview(), memberApi.listMembers()]);
    const pending = members.filter((member) => member.status === 'pending');
    return {
      ...overview,
      pending,
      stats: {
        ...overview.stats,
        pendingMembers: pending.length,
        activeMembers: members.filter((member) => member.status === 'active').length,
      },
    };
  }, []);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Member | null>(null);

  const approve = async (member: Member) => {
    setProcessingId(member.id);
    try {
      await memberApi.updateMemberStatus(member.id, 'active', '已通过审批，欢迎加入跑团。');
      toast(member.name + ' 已通过审批，成员端会自动看到结果。');
      reload();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : '审批失败。', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const reject = async () => {
    if (!rejectTarget) return;
    setProcessingId(rejectTarget.id);
    try {
      await memberApi.updateMemberStatus(rejectTarget.id, 'rejected', '资料还不完整，请补充后重新申请。');
      toast(rejectTarget.name + ' 已拒绝，成员端会显示原因。', 'info');
      setRejectTarget(null);
      reload();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : '操作失败。', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading && !data) return <Spinner label="正在加载社团概览" />;

  if (error) {
    return (
      <Card className="error-card">
        <span className="error-icon"><Icon name="alert" size={22} /></span>
        <div>
          <h3>概览加载失败</h3>
          <p>{error}</p>
        </div>
        <Button variant="secondary" onClick={reload}>重新加载</Button>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div>
      <PageHeader
        title="今天，社团还好吗？"
        description="先处理最需要你的事情：待审批成员、本周记录和正在进行的挑战。"
        actions={<Link to="/members" className="btn btn-secondary btn-md"><Icon name="users" size={17} /><span>查看成员</span></Link>}
      />

      <section className="stat-grid">
        {statCards.map((card) => (
          <Card key={card.key} className="stat-card">
            <div className={'stat-icon stat-icon-' + card.tone}><Icon name={card.icon} size={19} /></div>
            <div className="stat-copy">
              <span>{card.label}</span>
              <strong>{card.key === 'weeklyKm' ? data.stats[card.key] : data.stats[card.key]}</strong>
              <small>{card.hint}</small>
            </div>
          </Card>
        ))}
      </section>

      <div className="overview-grid">
        <Card className="panel pending-panel">
          <div className="panel-head">
            <div>
              <h2>待审批成员</h2>
              <p>通过后，成员才能看到社团内的记录和挑战。</p>
            </div>
            <Badge tone="coral">{data.pending.length} 人</Badge>
          </div>

          {data.pending.length === 0 ? (
            <EmptyState icon="check" title="没有待审批的申请" description="新的邀请码申请会出现在这里。" />
          ) : (
            <div className="pending-list">
              {data.pending.map((member) => (
                <div className="pending-item" key={member.id}>
                  <Avatar name={member.name} size="md" />
                  <div className="pending-copy">
                    <div className="pending-name">
                      <strong>{member.name}</strong>
                      <span>{member.grade} · {member.gender}</span>
                    </div>
                    <p>{member.note || '没有填写申请说明。'}</p>
                    <small>申请于 {formatDate(member.joinedAt)} · {relativeTime(member.joinedAt)}</small>
                  </div>
                  <div className="pending-actions">
                    <Button variant="primary" size="sm" loading={processingId === member.id} onClick={() => approve(member)}>通过</Button>
                    <Button variant="ghost" size="sm" onClick={() => setRejectTarget(member)}>拒绝</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="panel activity-panel">
          <div className="panel-head">
            <div>
              <h2>最近动态</h2>
              <p>只汇总社团可见的内容。</p>
            </div>
            <Icon name="activity" size={19} className="panel-head-icon" />
          </div>

          {data.activities.length === 0 ? (
            <EmptyState icon="activity" title="还没有社团动态" description="成员加入、跑步记录、挑战和公告会出现在这里。" />
          ) : (
            <div className="activity-list">
              {data.activities.map((activity) => (
                <div className="activity-item" key={activity.id}>
                  <span className={'activity-icon activity-' + activity.type}><Icon name={activityIcon[activity.type]} size={16} /></span>
                  <div>
                    <strong>{activity.title}</strong>
                    <p>{activity.detail}</p>
                  </div>
                  <small>{activity.time}</small>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <section className="quick-links">
        <Link to="/invites" className="quick-link">
          <span className="quick-icon"><Icon name="ticket" size={20} /></span>
          <span><strong>生成邀请码</strong><small>把下一位同学带进社团</small></span>
          <Icon name="chevronRight" size={17} />
        </Link>
        <Link to="/announcements" className="quick-link">
          <span className="quick-icon"><Icon name="megaphone" size={20} /></span>
          <span><strong>发布公告</strong><small>让重要的事情被看见</small></span>
          <Icon name="chevronRight" size={17} />
        </Link>
        <Link to="/records" className="quick-link">
          <span className="quick-icon"><Icon name="download" size={20} /></span>
          <span><strong>导出记录</strong><small>CSV 不含私密记录</small></span>
          <Icon name="chevronRight" size={17} />
        </Link>
      </section>

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title={'拒绝 ' + (rejectTarget?.name ?? '') + ' 的申请？'}
        description="拒绝后，对方会在手机端看到原因，并可以补充资料后重新申请。"
        confirmText="拒绝申请"
        tone="danger"
        loading={processingId === rejectTarget?.id}
        onConfirm={reject}
        onClose={() => setRejectTarget(null)}
      />
    </div>
  );
}
