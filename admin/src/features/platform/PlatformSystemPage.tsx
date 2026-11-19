import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { platformRepository } from '../../data';
import { formatDate, formatDateTime, relativeTime } from '../../lib/format';
import { useToast } from '../../components/ui/Toast';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Avatar, Button, Card, EmptyState, Field, PageHeader, Spinner } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { Modal } from '../../components/ui/Modal';
import type { PlatformAccount, PlatformAccountRole, PlatformAuditLog } from '../../types/models';
import { PlatformPager, usePagedRows } from './paging';

type TabKey = 'accounts' | 'logs';

const roleLabels: Record<PlatformAccountRole, string> = {
  super: '超级管理员',
  ops: '运营管理员',
};

export function PlatformSystemPage() {
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>('accounts');
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [logs, setLogs] = useState<PlatformAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logQuery, setLogQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'ops' as PlatformAccountRole });
  const [busy, setBusy] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<PlatformAccount | null>(null);

  const load = async () => {
    const [nextAccounts, nextLogs] = await Promise.all([
      platformRepository.listAccounts(),
      platformRepository.listLogs(),
    ]);
    setAccounts(nextAccounts);
    setLogs(nextLogs);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  const filteredLogs = useMemo(() => {
    const needle = logQuery.trim().toLowerCase();
    if (!needle) return logs;
    return logs.filter((log) => [log.actor, log.action, log.target, log.detail, log.ip].join(' ').toLowerCase().includes(needle));
  }, [logs, logQuery]);
  const pagedLogs = usePagedRows(filteredLogs, logQuery);

  const stats = useMemo(() => ({
    active: accounts.filter((account) => account.status === 'active').length,
    supers: accounts.filter((account) => account.role === 'super' && account.status === 'active').length,
    disabled: accounts.filter((account) => account.status === 'disabled').length,
  }), [accounts]);

  const createAccount = async (event?: FormEvent) => {
    event?.preventDefault();
    setBusy(true);
    try {
      await platformRepository.createAccount(form);
      toast('管理员账号已创建。V0.1 只写入账号记录，不会发送邀请邮件。');
      setCreating(false);
      setForm({ name: '', email: '', role: 'ops' });
      await load();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : '创建失败，请检查后重试。', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleAccount = async () => {
    if (!toggleTarget) return;
    setBusy(true);
    try {
      await platformRepository.toggleAccountStatus(toggleTarget.id);
      toast(toggleTarget.status === 'active' ? '账号已停用。' : '账号已重新启用。');
      setToggleTarget(null);
      await load();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : '操作失败，请稍后重试。', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="正在读取平台账号与日志" />;

  return (
    <>
      <PageHeader
        title="系统与权限"
        description="平台账号、角色说明与操作日志。第一版超级管理员和运营管理员同权限，所有变更都会留痕。"
        actions={tab === 'accounts' ? <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>新增管理员</Button> : <Button variant="secondary" icon="refresh" onClick={load}>刷新日志</Button>}
      />

      <div className="detail-tabs system-tabs">
        <button type="button" className={'detail-tab' + (tab === 'accounts' ? ' detail-tab-active' : '')} onClick={() => setTab('accounts')}>账号与权限<span>{accounts.length}</span></button>
        <button type="button" className={'detail-tab' + (tab === 'logs' ? ' detail-tab-active' : '')} onClick={() => setTab('logs')}>操作日志<span>{logs.length}</span></button>
      </div>

      {tab === 'accounts' ? (
        <>
          <div className="stat-grid stat-grid-3">
            <Card className="stat-card"><span className="stat-icon stat-icon-green"><Icon name="users" size={19} /></span><div className="stat-copy"><span>启用账号</span><strong>{stats.active}</strong><small>{stats.supers} 位超级管理员</small></div></Card>
            <Card className="stat-card"><span className="stat-icon stat-icon-gold"><Icon name="lock" size={19} /></span><div className="stat-copy"><span>已停用</span><strong>{stats.disabled}</strong><small>无法登录，记录保留</small></div></Card>
            <Card className="stat-card"><span className="stat-icon stat-icon-blue"><Icon name="shield" size={19} /></span><div className="stat-copy"><span>权限模型</span><strong>同权限</strong><small>V0.1 暂不细分</small></div></Card>
          </div>

          <div className="split-grid system-accounts">
            <Card className="table-card">
              <div className="section-head">
                <div><h2 className="section-title">平台管理员</h2><p className="section-desc">平台账号不绑定社团，可查看全部社团的数据。</p></div>
              </div>
              <div className="table-wrap">
                <table className="data-table account-table">
                  <thead><tr><th>管理员</th><th>角色</th><th>最近登录</th><th>状态</th><th className="align-right">操作</th></tr></thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account.id}>
                        <td><div className="account-cell"><Avatar name={account.name} size="sm" tone={account.role === 'super' ? 'green' : 'blue'} /><div className="stacked-cell"><strong>{account.name}</strong><span>{account.email}</span></div></div></td>
                        <td><span className={'role-tag role-tag-' + account.role}>{roleLabels[account.role]}</span></td>
                        <td className="nowrap"><div className="stacked-cell"><strong>{account.lastLoginAt ? formatDate(account.lastLoginAt) : '尚未登录'}</strong><span>{account.lastLoginAt ? relativeTime(account.lastLoginAt) : '等待首次登录'}</span></div></td>
                        <td><span className={'status-dot ' + (account.status === 'active' ? 'status-dot-on' : 'status-dot-off')}>{account.status === 'active' ? '启用中' : '已停用'}</span></td>
                        <td className="align-right">
                          <Button size="sm" variant={account.status === 'active' ? 'dangerGhost' : 'secondary'} onClick={() => setToggleTarget(account)}>
                            {account.status === 'active' ? '停用' : '启用'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-footnote">至少保留一个启用中的超级管理员；最后一个不能被停用。</div>
            </Card>

            <div className="stacked-panels">
              <Card className="policy-card">
                <div className="section-head"><div><h2 className="section-title">权限说明</h2><p className="section-desc">先把边界写清楚，再谈分工。</p></div></div>
                <ul className="checklist">
                  <li><span className="check-ok"><Icon name="check" size={13} /></span><div><strong>超级管理员</strong><p>可管理账号、社团、用户、内容、记录与举报。不能停用最后一个启用中的超级管理员。</p></div></li>
                  <li><span className="check-ok"><Icon name="check" size={13} /></span><div><strong>运营管理员</strong><p>V0.1 与超级管理员同权限，方便小团队协作；后续再拆审核、客服、只读等角色。</p></div></li>
                  <li><span className="check-ok"><Icon name="check" size={13} /></span><div><strong>操作留痕</strong><p>社团状态、用户状态、内容上下线、记录更正、举报处理、账号变更均写入日志。</p></div></li>
                  <li><span className="check-warn"><Icon name="alert" size={13} /></span><div><strong>V0.1 限制</strong><p>新增账号不会发邀请邮件，也不在本页设置密码；正式版接入邮箱验证与首次登录改密。</p></div></li>
                </ul>
              </Card>

              <Card className="policy-card">
                <div className="section-head"><div><h2 className="section-title">数据与未成年人策略</h2><p className="section-desc">平台能看全量，但界面只展示治理需要的信息。</p></div></div>
                <ul className="checklist">
                  <li><span className="check-ok"><Icon name="check" size={13} /></span><div><strong>最少必要</strong><p>列表不展示手机号、精确位置和私密记录正文；年级只给社团内部使用。</p></div></li>
                  <li><span className="check-ok"><Icon name="check" size={13} /></span><div><strong>监护人同意</strong><p>社团入驻时统一收集一次，公开分享、线下活动、照片和定位另行确认。</p></div></li>
                  <li><span className="check-ok"><Icon name="check" size={13} /></span><div><strong>记录更正</strong><p>只用于纠错和审计，不提供日常代填；更正会保留原始值与操作人。</p></div></li>
                </ul>
              </Card>
            </div>
          </div>
        </>
      ) : (
        <Card className="table-card">
          <div className="table-toolbar">
            <div className="section-head"><div><h2 className="section-title">操作日志</h2><p className="section-desc">按时间倒序，最多保留最近 500 条；V0.1 只读。</p></div></div>
            <div className="search-box">
              <Icon name="search" size={16} />
              <input value={logQuery} onChange={(event) => setLogQuery(event.target.value)} placeholder="搜索操作人、动作、对象或 IP" />
            </div>
          </div>
          {filteredLogs.length === 0 ? <EmptyState icon="search" title="没有匹配的日志" description="换个关键词再试，或者清空搜索。" /> : (
            <div className="table-wrap">
              <table className="data-table log-table">
                <thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>对象</th><th>详情</th><th>IP</th></tr></thead>
                <tbody>
                  {pagedLogs.pageRows.map((log) => (
                    <tr key={log.id}>
                      <td className="nowrap"><div className="stacked-cell"><strong>{formatDate(log.createdAt)}</strong><span>{formatDateTime(log.createdAt).slice(11)} · {relativeTime(log.createdAt)}</span></div></td>
                      <td><strong>{log.actor}</strong></td>
                      <td><span className="log-action">{log.action}</span></td>
                      <td>{log.target}</td>
                      <td className="note-cell">{log.detail}</td>
                      <td className="mono-cell">{log.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <PlatformPager page={pagedLogs.page} pageCount={pagedLogs.pageCount} total={filteredLogs.length} pageSize={pagedLogs.pageSize} onChange={pagedLogs.setPage} />
          <div className="table-footnote">共 {filteredLogs.length} 条日志 · 审计日志本身不可在界面修改或删除</div>
        </Card>
      )}

      <Modal
        open={creating}
        title="新增平台管理员"
        description="创建后账号即启用。V0.1 不会发送邮件，也不会生成密码。"
        onClose={() => setCreating(false)}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>取消</Button>
            <Button variant="primary" loading={busy} onClick={() => createAccount()}>创建账号</Button>
          </>
        )}
      >
        <form className="form-grid" onSubmit={createAccount}>
          <Field label="姓名" required htmlFor="account-name">
            <input id="account-name" className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：李静" />
          </Field>
          <Field label="登录邮箱" required htmlFor="account-email" hint="正式版会向这个邮箱发送首次登录邀请。">
            <input id="account-email" className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@qingrun.local" />
          </Field>
          <Field label="角色" required htmlFor="account-role" hint="V0.1 两种角色权限相同。">
            <select id="account-role" className="input" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as PlatformAccountRole })}>
              <option value="ops">运营管理员</option>
              <option value="super">超级管理员</option>
            </select>
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={toggleTarget !== null}
        title={toggleTarget?.status === 'active' ? '停用这个账号？' : '重新启用这个账号？'}
        description={toggleTarget ? (toggleTarget.status === 'active' ? toggleTarget.name + ' 将无法登录平台，已有操作记录不受影响。' : toggleTarget.name + ' 将恢复登录权限。') : ''}
        tone={toggleTarget?.status === 'active' ? 'danger' : 'primary'}
        confirmText={toggleTarget?.status === 'active' ? '确认停用' : '确认启用'}
        loading={busy}
        onConfirm={toggleAccount}
        onClose={() => setToggleTarget(null)}
      />
    </>
  );
}
