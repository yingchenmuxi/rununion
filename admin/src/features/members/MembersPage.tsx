import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { repository } from '../../data';
import { useAsync } from '../../lib/useAsync';
import { formatDate, relativeTime } from '../../lib/format';
import type { Member, MemberStatus } from '../../types/models';
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';

type Filter = 'all' | MemberStatus;

const statusLabel: Record<MemberStatus, string> = {
  pending: '待审批',
  active: '在团',
  rejected: '已拒绝',
  removed: '已移出',
};

const statusTone: Record<MemberStatus, 'coral' | 'green' | 'gray'> = {
  pending: 'coral',
  active: 'green',
  rejected: 'gray',
  removed: 'gray',
};

interface PendingAction {
  kind: 'reject' | 'remove';
  member: Member;
}

export function MembersPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => repository.listMembers(), []);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const counts = useMemo(() => {
    const members = data ?? [];
    return {
      all: members.length,
      pending: members.filter((member) => member.status === 'pending').length,
      active: members.filter((member) => member.status === 'active').length,
      rejected: members.filter((member) => member.status === 'rejected').length,
      removed: members.filter((member) => member.status === 'removed').length,
    };
  }, [data]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return (data ?? []).filter((member) => {
      const matchesFilter = filter === 'all' || member.status === filter;
      const matchesQuery = !keyword || [member.name, member.username, member.grade].some((value) => value.toLowerCase().includes(keyword));
      return matchesFilter && matchesQuery;
    });
  }, [data, filter, query]);

  const approve = async (member: Member) => {
    setBusyId(member.id);
    try {
      await repository.updateMemberStatus(member.id, 'active');
      toast(member.name + ' 已通过审批。');
      reload();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : '审批失败。', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (member: Member) => {
    setBusyId(member.id);
    try {
      const password = await repository.resetMemberPassword(member.id);
      toast(member.name + ' 的临时密码：' + password, 'info');
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : '重置失败。', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    setBusyId(pendingAction.member.id);
    try {
      await repository.updateMemberStatus(pendingAction.member.id, pendingAction.kind === 'reject' ? 'rejected' : 'removed');
      toast(pendingAction.kind === 'reject' ? '申请已拒绝。' : pendingAction.member.name + ' 已移出社团。', 'info');
      setPendingAction(null);
      reload();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : '操作失败。', 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !data) return <Spinner label="正在加载成员名册" />;
  if (error) {
    return (
      <Card className="error-card">
        <span className="error-icon"><Icon name="alert" size={22} /></span>
        <div><h3>成员加载失败</h3><p>{error}</p></div>
        <Button variant="secondary" onClick={reload}>重新加载</Button>
      </Card>
    );
  }

  const filters: Array<{ key: Filter; label: string; count: number }> = [
    { key: 'all', label: '全部', count: counts.all },
    { key: 'pending', label: '待审批', count: counts.pending },
    { key: 'active', label: '在团', count: counts.active },
    { key: 'rejected', label: '已拒绝', count: counts.rejected },
    { key: 'removed', label: '已移出', count: counts.removed },
  ];

  return (
    <div>
      <PageHeader
        title="成员"
        description="审批新成员、查看年级和活跃情况，必要时重置密码或移出社团。"
        actions={<Link to="/invites" className="btn btn-secondary btn-md"><Icon name="ticket" size={17} /><span>生成邀请码</span></Link>}
      />

      <Card className="table-card">
        <div className="table-toolbar">
          <div className="filter-tabs" role="tablist" aria-label="成员状态筛选">
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
              placeholder="搜索姓名、用户名或年级"
              aria-label="搜索成员"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon="users"
            title={query ? '没有匹配的成员' : '这个分组还没有成员'}
            description={query ? '换一个关键词试试。' : '成员通过邀请码加入后，会先出现在待审批里。'}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>成员</th>
                  <th>年级 / 性别</th>
                  <th>状态</th>
                  <th>本周</th>
                  <th>最近活跃</th>
                  <th className="align-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="person-cell">
                        <Avatar name={member.name} size="sm" tone={member.role === 'owner' ? 'coral' : 'green'} />
                        <div>
                          <div className="person-name">
                            {member.name}
                            {member.role === 'owner' ? <Badge tone="gold">社长</Badge> : null}
                          </div>
                          <span>@{member.username}</span>
                        </div>
                      </div>
                    </td>
                    <td>{member.grade} · {member.gender}</td>
                    <td><Badge tone={statusTone[member.status]}>{statusLabel[member.status]}</Badge></td>
                    <td>{member.weeklyKm.toFixed(1)} km</td>
                    <td className="muted-cell" title={formatDate(member.lastActiveAt)}>{relativeTime(member.lastActiveAt)}</td>
                    <td>
                      <div className="row-actions">
                        {member.status === 'pending' ? (
                          <>
                            <Button variant="primary" size="sm" loading={busyId === member.id} onClick={() => approve(member)}>通过</Button>
                            <Button variant="ghost" size="sm" onClick={() => setPendingAction({ kind: 'reject', member })}>拒绝</Button>
                          </>
                        ) : null}
                        {member.status === 'active' ? (
                          <Button variant="ghost" size="sm" icon="refresh" loading={busyId === member.id} onClick={() => resetPassword(member)}>重置</Button>
                        ) : null}
                        {member.status === 'active' && member.role !== 'owner' ? (
                          <Button variant="dangerGhost" size="sm" onClick={() => setPendingAction({ kind: 'remove', member })}>移出</Button>
                        ) : null}
                        {member.status === 'rejected' || member.status === 'removed' ? <span className="muted-cell">—</span> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.kind === 'reject' ? '拒绝这条申请？' : '移出 ' + (pendingAction?.member.name ?? '') + '？'}
        description={pendingAction?.kind === 'reject'
          ? '拒绝后，对方会进入已拒绝列表。需要重新生成邀请码才能再次申请。'
          : '移出后，该成员将无法继续查看社团内容；历史社团可见记录会转为私密。'}
        confirmText={pendingAction?.kind === 'reject' ? '拒绝申请' : '确认移出'}
        tone="danger"
        loading={busyId === pendingAction?.member.id}
        onConfirm={confirmAction}
        onClose={() => setPendingAction(null)}
      />
    </div>
  );
}
