import { useMemo, useState } from 'react';
import { challengeApi } from '../../data/challengeApi';
import { useAsync } from '../../lib/useAsync';
import { formatDate } from '../../lib/format';
import type { Challenge } from '../../types/models';
import { Badge, Button, Card, EmptyState, Field, PageHeader, ProgressBar, Spinner } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';

const statusLabel: Record<Challenge['status'], string> = {
  upcoming: '未开始',
  active: '进行中',
  ended: '已结束',
};

const statusTone: Record<Challenge['status'], 'gold' | 'green' | 'gray'> = {
  upcoming: 'gold',
  active: 'green',
  ended: 'gray',
};

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function addDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export function ChallengesPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => challengeApi.listChallenges(), []);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    targetKm: 60,
    startAt: toInputDate(addDays(1)),
    endAt: toInputDate(addDays(31)),
  });
  const [endTarget, setEndTarget] = useState<Challenge | null>(null);
  const [ending, setEnding] = useState(false);

  const summary = useMemo(() => {
    const list = data ?? [];
    return {
      active: list.filter((item) => item.status === 'active').length,
      upcoming: list.filter((item) => item.status === 'upcoming').length,
      participants: list.filter((item) => item.status === 'active').reduce((sum, item) => sum + item.participantCount, 0),
    };
  }, [data]);

  const openCreate = () => {
    setForm({
      title: '',
      description: '',
      targetKm: 60,
      startAt: toInputDate(addDays(1)),
      endAt: toInputDate(addDays(31)),
    });
    setFormError(null);
    setCreateOpen(true);
  };

  const createChallenge = async () => {
    setFormError(null);
    if (!form.title.trim() || !form.description.trim()) {
      setFormError('请填写挑战名称和说明。');
      return;
    }
    if (!form.startAt || !form.endAt) {
      setFormError('请选择开始和结束日期。');
      return;
    }
    if (form.endAt < form.startAt) {
      setFormError('结束日期不能早于开始日期。');
      return;
    }
    setSaving(true);
    try {
      await challengeApi.createChallenge(form);
      toast('新的挑战已创建。');
      setCreateOpen(false);
      reload();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : '创建失败。');
    } finally {
      setSaving(false);
    }
  };

  const endChallenge = async () => {
    if (!endTarget) return;
    setEnding(true);
    try {
      await challengeApi.endChallenge(endTarget.id);
      toast('挑战已结束，记录进入只读。', 'info');
      setEndTarget(null);
      reload();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : '结束失败。', 'error');
    } finally {
      setEnding(false);
    }
  };

  if (loading && !data) return <Spinner label="正在加载挑战" />;
  if (error) {
    return (
      <Card className="error-card">
        <span className="error-icon"><Icon name="alert" size={22} /></span>
        <div><h3>挑战加载失败</h3><p>{error}</p></div>
        <Button variant="secondary" onClick={reload}>重新加载</Button>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="挑战"
        description="用一段时间的累计里程，给社团一个共同的小目标。只记录个人进度，不做速度排名。"
        actions={<Button variant="primary" icon="plus" onClick={openCreate}>新建挑战</Button>}
      />

      <section className="stat-grid stat-grid-3">
        <Card className="stat-card"><div className="stat-icon stat-icon-green"><Icon name="flag" size={19} /></div><div className="stat-copy"><span>进行中</span><strong>{summary.active}</strong><small>正在累计里程</small></div></Card>
        <Card className="stat-card"><div className="stat-icon stat-icon-gold"><Icon name="calendar" size={19} /></div><div className="stat-copy"><span>未开始</span><strong>{summary.upcoming}</strong><small>等待开始日期</small></div></Card>
        <Card className="stat-card"><div className="stat-icon stat-icon-blue"><Icon name="users" size={19} /></div><div className="stat-copy"><span>参与人次</span><strong>{summary.participants}</strong><small>进行中的挑战</small></div></Card>
      </section>

      {data && data.length > 0 ? (
        <div className="challenge-grid">
          {data.map((challenge) => (
            <Card key={challenge.id} className={'challenge-card challenge-' + challenge.status}>
              <div className="challenge-head">
                <Badge tone={statusTone[challenge.status]}>{statusLabel[challenge.status]}</Badge>
                <span className="challenge-range"><Icon name="calendar" size={14} />{formatDate(challenge.startAt)} — {formatDate(challenge.endAt)}</span>
              </div>
              <h2>{challenge.title}</h2>
              <p className="challenge-desc">{challenge.description}</p>

              <div className="challenge-progress">
                <div className="challenge-progress-head">
                  <span>社团平均进度</span>
                  <strong>{challenge.clubProgressKm.toFixed(1)} / {challenge.targetKm} km</strong>
                </div>
                <ProgressBar value={challenge.clubProgressKm} max={challenge.targetKm} tone={challenge.status === 'ended' ? 'gold' : 'green'} />
              </div>

              <div className="challenge-stats">
                <div><strong>{challenge.participantCount}</strong><span>人参加</span></div>
                <div><strong>{challenge.completedCount}</strong><span>人完成</span></div>
                <div><strong>{challenge.targetKm}</strong><span>km / 人</span></div>
              </div>

              <div className="challenge-foot">
                {challenge.status === 'active' ? <Button variant="dangerGhost" size="sm" onClick={() => setEndTarget(challenge)}>结束挑战</Button> : null}
                {challenge.status === 'upcoming' ? <span className="challenge-note">开始后自动累计社团可见记录</span> : null}
                {challenge.status === 'ended' ? <span className="challenge-note">已结束，进度只读</span> : null}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon="flag" title="还没有挑战" description="给社团定一个累计里程的小目标，例如“本月 80 公里”。" action={<Button variant="primary" size="sm" icon="plus" onClick={openCreate}>新建挑战</Button>} />
        </Card>
      )}

      <Modal
        open={createOpen}
        title="新建挑战"
        description="挑战按社团可见记录自动累计；私密记录不计入。V0.1 只显示个人进度，不做排名。"
        onClose={() => { if (!saving) setCreateOpen(false); }}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={saving}>取消</Button>
            <Button variant="primary" onClick={createChallenge} loading={saving}>创建挑战</Button>
          </>
        )}
      >
        <div className="form-grid">
          <Field label="挑战名称" htmlFor="challenge-title" required className="field-full">
            <input id="challenge-title" className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="例如：十二月 · 60 公里" maxLength={60} />
          </Field>
          <Field label="挑战说明" htmlFor="challenge-desc" required className="field-full">
            <textarea id="challenge-desc" className="input textarea" rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="目标、参与方式和注意事项" maxLength={300} />
          </Field>
          <Field label="个人目标（km）" required>
            <input className="input" type="number" min={1} max={1000} value={form.targetKm} onChange={(event) => setForm({ ...form, targetKm: Number(event.target.value) })} />
          </Field>
          <Field label="开始日期" required>
            <input className="input" type="date" value={form.startAt} onChange={(event) => setForm({ ...form, startAt: event.target.value })} />
          </Field>
          <Field label="结束日期" required>
            <input className="input" type="date" value={form.endAt} onChange={(event) => setForm({ ...form, endAt: event.target.value })} />
          </Field>
          {formError ? <div className="form-error field-full"><Icon name="alert" size={16} /><span>{formError}</span></div> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(endTarget)}
        title={'结束“' + (endTarget?.title ?? '') + '”？'}
        description="结束后，挑战进度变为只读，补录的记录不再计入。成员仍可以在成长页看到自己的历史记录。"
        confirmText="结束挑战"
        tone="danger"
        loading={ending}
        onConfirm={endChallenge}
        onClose={() => setEndTarget(null)}
      />
    </div>
  );
}
