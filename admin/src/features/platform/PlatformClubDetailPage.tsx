import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { platformRepository } from '../../data';
import { formatDate, formatDateTime, formatKm, relativeTime } from '../../lib/format';
import { useToast } from '../../components/ui/Toast';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Avatar, Button, Card, EmptyState, Field, Spinner } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import type { PlatformClub, PlatformClubStatus, PlatformContentItem, PlatformUser, RunRecord } from '../../types/models';
import { ClubStatusBadge, ContentStatusBadge, DetailHeader, DetailTabs, RiskBadge, SourceBadge, UserStatusBadge, VisibilityBadge } from './platformUi';
import { RecordEditModal } from './RecordEditModal';

type TabKey = 'overview' | 'members' | 'records' | 'content' | 'settings';

export function PlatformClubDetailPage() {
  const { clubId = '' } = useParams();
  const toast = useToast();
  const [club, setClub] = useState<PlatformClub | null>(null);
  const [members, setMembers] = useState<PlatformUser[]>([]);
  const [records, setRecords] = useState<RunRecord[]>([]);
  const [content, setContent] = useState<PlatformContentItem[]>([]);
  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [recordEdit, setRecordEdit] = useState<RunRecord | null>(null);
  const [confirm, setConfirm] = useState<{ status: PlatformClubStatus; title: string; description: string; tone: 'primary' | 'danger' } | null>(null);
  const [ownerTitle, setOwnerTitle] = useState('');
  const [gradeText, setGradeText] = useState('');
  const [guardian, setGuardian] = useState(false);

  const load = async () => {
    const [nextClub, allUsers, allRecords, allContent] = await Promise.all([
      platformRepository.getClub(clubId),
      platformRepository.listUsers(),
      platformRepository.listRecords(),
      platformRepository.listContent(),
    ]);
    setClub(nextClub);
    if (nextClub) {
      setMembers(allUsers.filter((user) => user.clubId === nextClub.id));
      setRecords(allRecords.filter((record) => record.clubId === nextClub.id));
      setContent(allContent.filter((item) => item.clubId === nextClub.id));
      setOwnerTitle(nextClub.ownerTitle);
      setGradeText(nextClub.gradeOptions.join('、'));
      setGuardian(nextClub.guardianConsent);
    }
    setLoading(false);
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load().catch(() => {
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  const summary = useMemo(() => ({
    active: members.filter((user) => user.status === 'active').length,
    pending: members.filter((user) => user.status === 'pending').length,
    km: records.filter((record) => record.visibility !== 'private').reduce((sum, record) => sum + record.distanceKm, 0),
    review: content.filter((item) => item.status === 'review').length,
  }), [members, records, content]);

  const applyStatus = async () => {
    if (!club || !confirm) return;
    setBusy(true);
    try {
      await platformRepository.updateClubStatus(club.id, confirm.status);
      toast('社团状态已更新，操作已写入审计日志。');
      setConfirm(null);
      await load();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : '更新失败，请稍后重试。', 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (!club) return;
    setBusy(true);
    try {
      const updated = await platformRepository.updateClubSettings(club.id, {
        ownerTitle,
        gradeOptions: gradeText.split(/[，,、\s]+/).filter(Boolean),
        guardianConsent: guardian,
      });
      setClub(updated);
      setOwnerTitle(updated.ownerTitle);
      setGradeText(updated.gradeOptions.join('、'));
      toast('社团设置已保存。');
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : '保存失败，请稍后重试。', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="正在读取社团详情" />;
  if (!club) return <EmptyState icon="alert" title="找不到这个社团" description="它可能已被移除，返回社团列表重新选择。" />;

  const tabs = [
    { key: 'overview', label: '概览' },
    { key: 'members', label: '成员', count: members.length },
    { key: 'records', label: '记录', count: records.length },
    { key: 'content', label: '内容', count: content.length },
    { key: 'settings', label: '设置' },
  ];

  return (
    <>
      <DetailHeader
        backTo="/platform/clubs"
        backLabel="返回学校与社团"
        title={club.name}
        subtitle={club.province + ' · ' + club.city + ' · ' + (club.kind === 'school' ? '学校社团' : '社区跑团') + ' · 负责人 ' + club.ownerName + '（' + club.ownerTitle + '）'}
        badges={<><ClubStatusBadge status={club.status} /><RiskBadge level={club.riskLevel} />{club.verified ? <span className="soft-chip"><Icon name="check" size={12} /> 已认证</span> : null}</>}
        actions={
          <>
            {club.status === 'pending' ? (
              <>
                <Button variant="dangerGhost" onClick={() => setConfirm({ status: 'rejected', title: '驳回入驻申请？', description: '驳回后社团不会出现在成员端。建议先在备注中写清补正材料，再重新提交。', tone: 'danger' })}>驳回</Button>
                <Button variant="primary" icon="check" onClick={() => setConfirm({ status: 'active', title: '通过入驻审核？', description: '通过后社团会标记为已认证，并出现在成员端的找跑团列表中。', tone: 'primary' })}>通过审核</Button>
              </>
            ) : null}
            {club.status === 'active' ? <Button variant="dangerGhost" icon="lock" onClick={() => setConfirm({ status: 'paused', title: '暂停这个社团？', description: '暂停期间社团仍可见，但不能发布新活动或接收新成员。已有记录不受影响。', tone: 'danger' })}>暂停社团</Button> : null}
            {club.status === 'paused' ? <Button variant="primary" icon="refresh" onClick={() => setConfirm({ status: 'active', title: '恢复社团运行？', description: '恢复后社团可以继续发布活动、接收新成员。', tone: 'primary' })}>恢复运行</Button> : null}
            {club.status === 'rejected' ? <Button variant="primary" icon="check" onClick={() => setConfirm({ status: 'active', title: '重新通过审核？', description: '将把社团状态改为运行中，并标记为已认证。', tone: 'primary' })}>重新通过</Button> : null}
          </>
        }
      />

      <div className="detail-summary">
        <div><span>成员</span><strong>{club.memberCount}</strong><small>{summary.active} 在团 · {summary.pending} 待审批</small></div>
        <div><span>本周里程</span><strong>{formatKm(club.weeklyKm)}</strong><small>社团可见记录</small></div>
        <div><span>累计里程</span><strong>{formatKm(club.totalKm)}</strong><small>建团以来</small></div>
        <div><span>监护人同意</span><strong>{club.guardianConsent ? '已收' : '待补'}</strong><small>{club.guardianConsent ? '入团时统一收集' : '需在活动前补齐'}</small></div>
        <div><span>待审核内容</span><strong>{summary.review}</strong><small>共 {content.length} 条内容</small></div>
      </div>

      <DetailTabs tabs={tabs} active={tab} onChange={(key) => setTab(key as TabKey)} />

      {tab === 'overview' ? (
        <div className="split-grid">
          <Card className="panel">
            <div className="panel-head"><div><h2>社团资料</h2><p>入驻时填写，平台可核对。</p></div><span className="panel-head-icon"><Icon name="shield" size={18} /></span></div>
            <div className="info-grid">
              <div className="info-item"><span>学校 / 主体</span><strong>{club.school}</strong></div>
              <div className="info-item"><span>所在地区</span><strong>{club.province} · {club.city}</strong></div>
              <div className="info-item"><span>负责人</span><strong>{club.ownerName} · {club.ownerTitle}</strong></div>
              <div className="info-item"><span>联系电话</span><strong>{club.ownerPhone}</strong></div>
              <div className="info-item"><span>入驻时间</span><strong>{formatDate(club.createdAt)}</strong></div>
              <div className="info-item"><span>最近更新</span><strong>{formatDateTime(club.createdAt)}</strong></div>
            </div>
            <div className="detail-block">
              <h3>社团简介</h3>
              <p>{club.intro}</p>
            </div>
            <div className="detail-block">
              <h3>年级选项</h3>
              <div className="chip-row">{club.gradeOptions.map((grade) => <span className="soft-chip" key={grade}>{grade}</span>)}</div>
              <p className="field-hint">年级由社团自定义，只用于社团内部识别，不参与平台排名。</p>
            </div>
          </Card>

          <div className="stacked-panels">
            <Card className="panel">
              <div className="panel-head"><div><h2>安全与合规</h2><p>平台优先看这些信号。</p></div></div>
              <div className="checklist">
                <div className={club.guardianConsent ? 'check-ok' : 'check-warn'}><Icon name={club.guardianConsent ? 'check' : 'alert'} size={15} /><span>监护人同意</span><strong>{club.guardianConsent ? '已收集' : '待补齐'}</strong></div>
                <div className="check-ok"><Icon name="check" size={15} /><span>负责人联系方式</span><strong>已留档</strong></div>
                <div className={club.riskLevel === 'high' ? 'check-warn' : 'check-ok'}><Icon name={club.riskLevel === 'high' ? 'alert' : 'check'} size={15} /><span>风险等级</span><strong>{club.riskLevel === 'high' ? '高风险' : club.riskLevel === 'medium' ? '中风险' : '低风险'}</strong></div>
                <div className="check-ok"><Icon name="check" size={15} /><span>平台审核</span><strong>{club.verified ? '已认证' : '未认证'}</strong></div>
              </div>
            </Card>
            <Card className="panel">
              <div className="panel-head"><div><h2>最近记录</h2><p>仅展示社团可见与公开记录。</p></div><button type="button" className="text-link" onClick={() => setTab('records')}>全部 <Icon name="chevronRight" size={13} /></button></div>
              <div className="mini-record-list">
                {records.filter((record) => record.visibility !== 'private').slice(0, 4).map((record) => (
                  <div className="mini-record" key={record.id}>
                    <span className="mini-record-icon"><Icon name="activity" size={14} /></span>
                    <div><strong>{record.memberName} · {formatKm(record.distanceKm)}</strong><small>{formatDate(record.date)} · {record.pace} /km</small></div>
                  </div>
                ))}
                {records.filter((record) => record.visibility !== 'private').length === 0 ? <p className="muted-cell">暂无社团可见记录。</p> : null}
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'members' ? (
        <Card className="table-card">
          <div className="table-toolbar"><div><h2 className="section-title">社团成员</h2><p className="section-desc">平台可直接看到所有状态；日常审批由社团负责人完成。</p></div><span className="soft-chip">{members.length} 人</span></div>
          {members.length === 0 ? <EmptyState icon="users" title="还没有成员" /> : (
            <div className="table-wrap">
              <table className="data-table platform-table">
                <thead><tr><th>成员</th><th>年级 / 年龄层</th><th>角色</th><th>本周 / 累计</th><th>监护人同意</th><th>风险标记</th><th>状态</th><th>最近活跃</th></tr></thead>
                <tbody>
                  {members.map((user) => (
                    <tr key={user.id}>
                      <td><div className="person-cell"><Avatar name={user.name} size="sm" /><div><div className="person-name">{user.name}</div><span>@{user.username} · {user.gender}</span></div></div></td>
                      <td>{user.grade} · {user.ageGroup}</td>
                      <td>{user.role === 'owner' ? '负责人' : '成员'}</td>
                      <td><div className="stacked-cell"><strong>{formatKm(user.weeklyKm)}</strong><span>累计 {formatKm(user.totalKm)}</span></div></td>
                      <td>{user.guardianConsent ? <span className="consent-yes"><Icon name="check" size={13} /> 已收</span> : <span className="consent-no">待补</span>}</td>
                      <td>{user.riskFlags.length > 0 ? <span className="risk-flag">{user.riskFlags[0]}</span> : <span className="muted-cell">无</span>}</td>
                      <td><UserStatusBadge status={user.status} /></td>
                      <td className="nowrap muted-cell">{relativeTime(user.lastActiveAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'records' ? (
        <Card className="table-card">
          <div className="table-toolbar">
            <div><h2 className="section-title">跑步记录</h2><p className="section-desc">平台可更正异常记录，但不作为日常功能。所有更正都会写日志。</p></div>
            <span className="soft-chip">社团可见 {formatKm(summary.km)}</span>
          </div>
          {records.length === 0 ? <EmptyState icon="activity" title="还没有记录" /> : (
            <div className="table-wrap">
              <table className="data-table platform-table records-table">
                <thead><tr><th>日期</th><th>成员</th><th>距离</th><th>时长</th><th>配速</th><th>来源</th><th>可见性</th><th>备注</th><th className="align-right">操作</th></tr></thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td className="nowrap">{record.date}</td>
                      <td>{record.memberName}</td>
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

      {tab === 'content' ? (
        <Card className="table-card">
          <div className="table-toolbar"><div><h2 className="section-title">公告、活动与挑战</h2><p className="section-desc">平台全量可见；下线内容会在成员端立即隐藏。</p></div><span className="soft-chip">{content.length} 条</span></div>
          {content.length === 0 ? <EmptyState icon="megaphone" title="还没有内容" /> : (
            <div className="table-wrap">
              <table className="data-table platform-table">
                <thead><tr><th>标题</th><th>类型</th><th>作者</th><th>数据</th><th>创建时间</th><th>状态</th></tr></thead>
                <tbody>
                  {content.map((item) => (
                    <tr key={item.id}>
                      <td><div className="stacked-cell"><strong>{item.title}</strong><span className="note-cell">{item.summary}</span></div></td>
                      <td>{item.type === 'announcement' ? '公告' : item.type === 'activity' ? '活动' : item.type === 'challenge' ? '挑战' : '文章'}</td>
                      <td>{item.author}</td>
                      <td className="muted-cell">{item.stats}</td>
                      <td className="nowrap">{formatDate(item.createdAt)}</td>
                      <td><ContentStatusBadge status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'settings' ? (
        <Card className="panel settings-panel">
          <div className="panel-head"><div><h2>社团设置</h2><p>这里改的是平台侧配置，社团负责人看到后会同步生效。</p></div></div>
          <form className="settings-form" onSubmit={saveSettings}>
            <div className="form-grid">
              <Field label="负责人称呼" htmlFor="owner-title" hint="学校社团常用“社长”，社区跑团常用“团长”。这只是称呼，不代表权限等级。">
                <input id="owner-title" className="input" value={ownerTitle} onChange={(event) => setOwnerTitle(event.target.value)} placeholder="社长 / 团长 / 队长" />
              </Field>
              <Field label="年级选项" htmlFor="grade-options" hint="用中文逗号分隔。系统会自动保留“不填”，成员可以不填。">
                <textarea id="grade-options" className="input textarea grade-textarea" value={gradeText} onChange={(event) => setGradeText(event.target.value)} />
              </Field>
            </div>
            <label className="checkbox-row settings-check">
              <input type="checkbox" checked={guardian} onChange={(event) => setGuardian(event.target.checked)} />
              <span>已统一收集监护人同意（入团或首次活动时）</span>
            </label>
            <div className="form-actions">
              <Button type="submit" variant="primary" loading={busy}>保存设置</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ''}
        description={confirm?.description ?? ''}
        tone={confirm?.tone}
        loading={busy}
        confirmText={confirm?.status === 'active' ? '确认通过' : confirm?.status === 'paused' ? '确认暂停' : '确认驳回'}
        onConfirm={applyStatus}
        onClose={() => setConfirm(null)}
      />
      <RecordEditModal record={recordEdit} open={recordEdit !== null} onClose={() => setRecordEdit(null)} onSaved={load} />
    </>
  );
}
