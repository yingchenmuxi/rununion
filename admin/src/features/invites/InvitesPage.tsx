import { useMemo, useState } from 'react';
import { repository } from '../../data';
import { useAsync } from '../../lib/useAsync';
import { formatDate } from '../../lib/format';
import type { InviteCode } from '../../types/models';
import { Badge, Button, Card, EmptyState, Field, PageHeader, ProgressBar, Spinner } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';

const statusLabel: Record<InviteCode['status'], string> = {
  active: '可用',
  expired: '已过期',
  disabled: '已停用',
};

const statusTone: Record<InviteCode['status'], 'green' | 'gray'> = {
  active: 'green',
  expired: 'gray',
  disabled: 'gray',
};

export function InvitesPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => repository.listInvites(), []);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ note: '', maxUses: 10, expiresInDays: 30 });
  const [disableTarget, setDisableTarget] = useState<InviteCode | null>(null);
  const [disabling, setDisabling] = useState(false);

  const summary = useMemo(() => {
    const invites = data ?? [];
    return {
      active: invites.filter((invite) => invite.status === 'active').length,
      used: invites.reduce((sum, invite) => sum + invite.usedCount, 0),
      capacity: invites.reduce((sum, invite) => sum + invite.maxUses, 0),
      disabled: invites.filter((invite) => invite.status === 'disabled').length,
    };
  }, [data]);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast('邀请码已复制：' + code);
    } catch {
      toast('复制失败，请手动选择邀请码。', 'error');
    }
  };

  const createInvite = async () => {
    setFormError(null);
    if (form.maxUses < 1 || form.maxUses > 100) {
      setFormError('使用次数需要在 1 到 100 之间。');
      return;
    }
    if (form.expiresInDays < 1 || form.expiresInDays > 90) {
      setFormError('有效期需要在 1 到 90 天之间。');
      return;
    }
    setCreating(true);
    try {
      await repository.createInvite(form);
      toast('新的邀请码已生成。');
      setCreateOpen(false);
      setForm({ note: '', maxUses: 10, expiresInDays: 30 });
      reload();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : '生成失败。');
    } finally {
      setCreating(false);
    }
  };

  const disableInvite = async () => {
    if (!disableTarget) return;
    setDisabling(true);
    try {
      await repository.disableInvite(disableTarget.id);
      toast(disableTarget.code + ' 已停用。', 'info');
      setDisableTarget(null);
      reload();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : '停用失败。', 'error');
    } finally {
      setDisabling(false);
    }
  };

  if (loading && !data) return <Spinner label="正在加载邀请码" />;
  if (error) {
    return (
      <Card className="error-card">
        <span className="error-icon"><Icon name="alert" size={22} /></span>
        <div><h3>邀请码加载失败</h3><p>{error}</p></div>
        <Button variant="secondary" onClick={reload}>重新加载</Button>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="邀请码"
        description="生成一次性或多次可用的邀请码，让新成员带着明确入口加入社团。"
        actions={<Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>生成邀请码</Button>}
      />

      <section className="stat-grid stat-grid-4">
        <Card className="stat-card"><div className="stat-icon stat-icon-green"><Icon name="ticket" size={19} /></div><div className="stat-copy"><span>可用邀请码</span><strong>{summary.active}</strong><small>现在可以分享</small></div></Card>
        <Card className="stat-card"><div className="stat-icon stat-icon-gold"><Icon name="users" size={19} /></div><div className="stat-copy"><span>累计使用</span><strong>{summary.used}</strong><small>来自所有邀请码</small></div></Card>
        <Card className="stat-card"><div className="stat-icon stat-icon-blue"><Icon name="activity" size={19} /></div><div className="stat-copy"><span>名额上限</span><strong>{summary.capacity}</strong><small>已生成的总名额</small></div></Card>
        <Card className="stat-card"><div className="stat-icon stat-icon-coral"><Icon name="lock" size={19} /></div><div className="stat-copy"><span>已停用</span><strong>{summary.disabled}</strong><small>不再接受新成员</small></div></Card>
      </section>

      <Card className="table-card">
        <div className="panel-head">
          <div><h2>全部邀请码</h2><p>过期或停用后，已加入的成员不受影响。</p></div>
          <Badge tone="gray">{data?.length ?? 0} 个</Badge>
        </div>

        {data && data.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>邀请码</th><th>用途</th><th>有效期</th><th>使用情况</th><th>状态</th><th className="align-right">操作</th></tr>
              </thead>
              <tbody>
                {data.map((invite) => (
                  <tr key={invite.id}>
                    <td>
                      <div className="invite-code-cell">
                        <code>{invite.code}</code>
                        <button type="button" className="icon-button icon-button-small" onClick={() => copyCode(invite.code)} aria-label={'复制 ' + invite.code}><Icon name="copy" size={15} /></button>
                      </div>
                    </td>
                    <td>{invite.note}</td>
                    <td className="muted-cell">至 {formatDate(invite.expiresAt)}</td>
                    <td>
                      <div className="usage-cell">
                        <span>{invite.usedCount} / {invite.maxUses}</span>
                        <ProgressBar value={invite.usedCount} max={invite.maxUses} tone={invite.usedCount >= invite.maxUses ? 'gold' : 'green'} />
                      </div>
                    </td>
                    <td><Badge tone={statusTone[invite.status]}>{statusLabel[invite.status]}</Badge></td>
                    <td>
                      <div className="row-actions">
                        <Button variant="ghost" size="sm" onClick={() => copyCode(invite.code)}>复制</Button>
                        {invite.status === 'active' ? <Button variant="dangerGhost" size="sm" onClick={() => setDisableTarget(invite)}>停用</Button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="ticket" title="还没有邀请码" description="生成第一个邀请码，开始邀请社团成员。" action={<Button variant="primary" size="sm" icon="plus" onClick={() => setCreateOpen(true)}>生成邀请码</Button>} />
        )}
      </Card>

      <Modal
        open={createOpen}
        title="生成邀请码"
        description="邀请码只用于加入当前社团。分享前请确认对方是本校同学。"
        onClose={() => { if (!creating) setCreateOpen(false); }}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>取消</Button>
            <Button variant="primary" onClick={createInvite} loading={creating}>生成</Button>
          </>
        )}
      >
        <div className="form-grid">
          <Field label="用途备注" hint="例如：高一（3）班专场" className="field-full">
            <input className="input" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="给这个邀请码一个容易辨认的名字" />
          </Field>
          <Field label="最多使用次数" hint="1–100 次">
            <input className="input" type="number" min={1} max={100} value={form.maxUses} onChange={(event) => setForm({ ...form, maxUses: Number(event.target.value) })} />
          </Field>
          <Field label="有效期" hint="1–90 天">
            <input className="input" type="number" min={1} max={90} value={form.expiresInDays} onChange={(event) => setForm({ ...form, expiresInDays: Number(event.target.value) })} />
          </Field>
          {formError ? <div className="form-error field-full"><Icon name="alert" size={16} /><span>{formError}</span></div> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(disableTarget)}
        title={'停用 ' + (disableTarget?.code ?? '') + '？'}
        description="停用后，这个邀请码不能再被使用；已经通过它加入的成员不受影响。"
        confirmText="停用邀请码"
        tone="danger"
        loading={disabling}
        onConfirm={disableInvite}
        onClose={() => setDisableTarget(null)}
      />
    </div>
  );
}
