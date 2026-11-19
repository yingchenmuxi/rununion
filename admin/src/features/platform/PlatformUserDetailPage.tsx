import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { platformRepository } from '../../data';
import { formatDate, formatKm, relativeTime } from '../../lib/format';
import { useToast } from '../../components/ui/Toast';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Avatar, Button, Card, EmptyState, Spinner } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import type { PlatformClub, PlatformReport, PlatformUser, RunRecord } from '../../types/models';
import { DetailHeader, DetailTabs, ReportStatusBadge, RiskBadge, SourceBadge, UserStatusBadge, VisibilityBadge } from './platformUi';
import { RecordEditModal } from './RecordEditModal';

type TabKey = 'profile' | 'records' | 'reports';

export function PlatformUserDetailPage() {
  const { userId = '' } = useParams();
  const toast = useToast();
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [club, setClub] = useState<PlatformClub | null>(null);
  const [records, setRecords] = useState<RunRecord[]>([]);
  const [reports, setReports] = useState<PlatformReport[]>([]);
  const [tab, setTab] = useState<TabKey>('profile');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recordEdit, setRecordEdit] = useState<RunRecord | null>(null);

  const load = async () => {
    const [nextUser, allRecords, allReports] = await Promise.all([
      platformRepository.getUser(userId),
      platformRepository.listRecords(),
      platformRepository.listReports(),
    ]);
    setUser(nextUser);
    if (nextUser) {
      setClub(await platformRepository.getClub(nextUser.clubId));
      setRecords(allRecords.filter((record) => record.memberId === nextUser.id));
      setReports(allReports.filter((report) => report.targetId === nextUser.id || report.targetName === nextUser.name));
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    load().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const totals = useMemo(() => ({
    clubKm: records.filter((record) => record.visibility !== 'private').reduce((sum, record) => sum + record.distanceKm, 0),
    privateCount: records.filter((record) => record.visibility === 'private').length,
  }), [records]);

  const toggleStatus = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const next = user.status === 'suspended' ? 'active' : 'suspended';
      await platformRepository.updateUserStatus(user.id, next);
      toast(next === 'suspended' ? '用户已暂停，操作已写入日志。' : '用户已恢复在团状态。');
      setConfirmOpen(false);
      await load();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : '操作失败，请稍后重试。', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="正在读取用户资料" />;
  if (!user) return <EmptyState icon="alert" title="找不到这个用户" description="用户可能已经离团或被移除。" />;

  const tabs = [
    { key: 'profile', label: '资料' },
    { key: 'records', label: '跑步记录', count: records.length },
    { key: 'reports', label: '相关举报', count: reports.length },
  ];

  return (
    <>
      <DetailHeader
        backTo="/platform/users"
        backLabel="返回全部用户"
        title={user.name}
        subtitle={'@' + user.username + ' · ' + user.clubName + ' · ' + user.grade + ' · ' + user.ageGroup}
        badges={<><UserStatusBadge status={user.status} />{user.riskFlags.length > 0 ? <RiskBadge level="high" /> : null}{user.role === 'owner' ? <span className="soft-chip">社团负责人</span> : null}</>}
        actions={user.status === 'left' ? undefined : (
          <Button
            variant={user.status === 'suspended' ? 'primary' : 'dangerGhost'}
            icon={user.status === 'suspended' ? 'refresh' : 'lock'}
            onClick={() => setConfirmOpen(true)}
          >
            {user.status === 'suspended' ? '恢复在团' : '暂停用户'}
          </Button>
        )}
      />

      <div className="detail-summary">
        <div><span>本周里程</span><strong>{formatKm(user.weeklyKm)}</strong><small>来自社团可见记录</small></div>
        <div><span>累计里程</span><strong>{formatKm(user.totalKm)}</strong><small>{records.length} 条平台记录</small></div>
        <div><span>社团内角色</span><strong>{user.role === 'owner' ? '负责人' : '成员'}</strong><small>{club?.name ?? user.clubName}</small></div>
        <div><span>监护人同意</span><strong>{user.guardianConsent ? '已收' : '待补'}</strong><small>{user.guardianConsent ? '入团时确认' : '高风险动作前必须补齐'}</small></div>
        <div><span>私密记录</span><strong>{totals.privateCount}</strong><small>仅本人可见，平台可审计</small></div>
      </div>

      <DetailTabs tabs={tabs} active={tab} onChange={(key) => setTab(key as TabKey)} />

      {tab === 'profile' ? (
        <div className="split-grid">
          <Card className="panel">
            <div className="panel-head"><div><h2>基本资料</h2><p>平台全量可见，社团内只显示必要字段。</p></div><Avatar name={user.name} size="lg" tone="green" /></div>
            <div className="info-grid">
              <div className="info-item"><span>姓名</span><strong>{user.name}</strong></div>
              <div className="info-item"><span>用户名</span><strong>@{user.username}</strong></div>
              <div className="info-item"><span>性别</span><strong>{user.gender}</strong></div>
              <div className="info-item"><span>年级</span><strong>{user.grade}</strong></div>
              <div className="info-item"><span>年龄层（自述）</span><strong>{user.ageGroup}</strong></div>
              <div className="info-item"><span>所属社团</span><strong>{user.clubName}</strong></div>
              <div className="info-item"><span>入团时间</span><strong>{formatDate(user.joinedAt)}</strong></div>
              <div className="info-item"><span>最近活跃</span><strong>{relativeTime(user.lastActiveAt)}</strong></div>
            </div>
            <div className="detail-block">
              <h3>平台备注</h3>
              <p>{user.riskFlags.length > 0 ? user.riskFlags.join('；') : '暂无风险标记。'}</p>
            </div>
          </Card>

          <div className="stacked-panels">
            <Card className="panel">
              <div className="panel-head"><div><h2>安全状态</h2><p>平台处理高风险动作时优先核对。</p></div></div>
              <div className="checklist">
                <div className={user.guardianConsent ? 'check-ok' : 'check-warn'}><Icon name={user.guardianConsent ? 'check' : 'alert'} size={15} /><span>监护人同意</span><strong>{user.guardianConsent ? '已收' : '待补'}</strong></div>
                <div className={user.riskFlags.length > 0 ? 'check-warn' : 'check-ok'}><Icon name={user.riskFlags.length > 0 ? 'alert' : 'check'} size={15} /><span>风险标记</span><strong>{user.riskFlags.length > 0 ? user.riskFlags.length + ' 条' : '无'}</strong></div>
                <div className="check-ok"><Icon name="check" size={15} /><span>所属社团</span><strong>{club?.verified ? '已认证' : '待认证'}</strong></div>
              </div>
            </Card>
            <Card className="panel">
              <div className="panel-head"><div><h2>记录概览</h2><p>平台可见全部记录，包括私密记录。</p></div><button type="button" className="text-link" onClick={() => setTab('records')}>查看 <Icon name="chevronRight" size={13} /></button></div>
              <div className="mini-record-list">
                {records.slice(0, 4).map((record) => (
                  <div className="mini-record" key={record.id}>
                    <span className="mini-record-icon"><Icon name="activity" size={14} /></span>
                    <div><strong>{formatKm(record.distanceKm)} · {record.pace} /km</strong><small>{record.date} · {record.visibility === 'private' ? '私密记录' : '社团可见'}</small></div>
                  </div>
                ))}
                {records.length === 0 ? <p className="muted-cell">暂无记录。</p> : null}
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'records' ? (
        <Card className="table-card">
          <div className="table-toolbar"><div><h2 className="section-title">跑步记录</h2><p className="section-desc">平台可更正异常数据。更正会同时影响成员端统计，并写入审计日志。</p></div><span className="soft-chip">社团可见 {formatKm(totals.clubKm)}</span></div>
          {records.length === 0 ? <EmptyState icon="activity" title="还没有记录" description="成员手动记录或导入文件后会出现在这里。" /> : (
            <div className="table-wrap">
              <table className="data-table platform-table records-table">
                <thead><tr><th>日期</th><th>距离</th><th>时长</th><th>配速</th><th>来源</th><th>可见性</th><th>备注</th><th className="align-right">操作</th></tr></thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td className="nowrap">{record.date}</td>
                      <td className="nowrap"><strong>{formatKm(record.distanceKm)}</strong></td>
                      <td className="nowrap">{record.durationMin} 分钟</td>
                      <td className="nowrap">{record.pace} /km</td>
                      <td>{record.source ? <SourceBadge source={record.source} /> : <span className="muted-cell">手动</span>}</td>
                      <td><VisibilityBadge visibility={record.visibility} /></td>
                      <td className="note-cell">{record.note || '—'}</td>
                      <td className="align-right"><Button size="sm" variant="ghost" icon="edit" onClick={() => setRecordEdit(record)}>更正</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'reports' ? (
        <Card className="panel">
          <div className="panel-head"><div><h2>与该用户相关的举报</h2><p>包含用户本人被举报，以及用户作为举报人提交的记录。</p></div></div>
          {reports.length === 0 ? <EmptyState icon="flag" title="没有相关举报" /> : (
            <div className="report-list">
              {reports.map((report) => (
                <div className="report-card" key={report.id}>
                  <div className="report-head"><div><strong>{report.reason}</strong><span>{report.clubName} · {relativeTime(report.createdAt)}</span></div><div className="report-badges"><ReportStatusBadge status={report.status} />{report.priority === 'high' ? <span className="badge badge-coral">高风险</span> : null}</div></div>
                  <p>{report.detail}</p>
                  {report.resolution ? <div className="report-resolution"><Icon name="check" size={13} /><span>{report.resolution}</span></div> : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title={user.status === 'suspended' ? '恢复这个用户？' : '暂停这个用户？'}
        description={user.status === 'suspended' ? '恢复后用户可以继续记录、报名活动和查看社团内容。' : '暂停后用户不能新增记录或报名活动，历史记录保留。该操作会写入审计日志。'}
        tone={user.status === 'suspended' ? 'primary' : 'danger'}
        confirmText={user.status === 'suspended' ? '确认恢复' : '确认暂停'}
        loading={busy}
        onConfirm={toggleStatus}
        onClose={() => setConfirmOpen(false)}
      />
      <RecordEditModal record={recordEdit} open={recordEdit !== null} onClose={() => setRecordEdit(null)} onSaved={load} />
    </>
  );
}
