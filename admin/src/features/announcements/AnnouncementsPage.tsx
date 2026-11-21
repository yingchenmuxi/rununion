import { useMemo, useState } from 'react';
import { announcementApi, type AdminAnnouncement, type AnnouncementCategory } from '../../data/announcementApi';
import { useAsync } from '../../lib/useAsync';
import { formatDateTime } from '../../lib/format';
import { Badge, Button, Card, EmptyState, Field, PageHeader, Spinner } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';

const categoryLabel: Record<AnnouncementCategory, string> = {
  notice: '通知',
  training: '训练',
  safety: '安全',
};

export function AnnouncementsPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => announcementApi.listAnnouncements(), []);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', content: '', category: 'notice' as AnnouncementCategory, pinned: false });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminAnnouncement | null>(null);

  const summary = useMemo(() => {
    const list = data ?? [];
    return {
      published: list.filter((item) => item.status === 'published').length,
      drafts: list.filter((item) => item.status === 'draft').length,
      pinned: list.filter((item) => item.pinned).length,
    };
  }, [data]);

  const openEditor = () => {
    setForm({ title: '', content: '', category: 'notice', pinned: false });
    setFormError(null);
    setEditorOpen(true);
  };

  const save = async () => {
    setFormError(null);
    if (!form.title.trim() || !form.content.trim()) {
      setFormError('请填写公告标题和正文。');
      return;
    }
    setSaving(true);
    try {
      await announcementApi.createAnnouncement(form);
      toast('公告已保存为草稿，发布后成员才会看到。');
      setEditorOpen(false);
      reload();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : '保存失败。');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (announcement: AdminAnnouncement) => {
    setBusyId(announcement.id);
    try {
      const nextStatus = announcement.status === 'published' ? 'draft' : 'published';
      await announcementApi.setStatus(announcement.id, nextStatus);
      toast(
        nextStatus === 'published'
          ? '公告已发布，成员会在手机端看到，并收到一条站内消息。'
          : '公告已撤回，成员端不再展示。',
        nextStatus === 'published' ? 'success' : 'info',
      );
      reload();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : '操作失败。', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const togglePinned = async (announcement: AdminAnnouncement) => {
    setBusyId(announcement.id);
    try {
      const next = !announcement.pinned;
      await announcementApi.setPinned(announcement.id, next);
      toast(next ? '公告已置顶，会排在成员端最前面。' : '公告已取消置顶。', 'info');
      reload();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : '操作失败。', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await announcementApi.removeAnnouncement(deleteTarget.id);
      toast('公告已删除。', 'info');
      setDeleteTarget(null);
      reload();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : '删除失败。', 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !data) return <Spinner label="正在加载公告" />;
  if (error) {
    return (
      <Card className="error-card">
        <span className="error-icon"><Icon name="alert" size={22} /></span>
        <div><h3>公告加载失败</h3><p>{error}</p></div>
        <Button variant="secondary" onClick={reload}>重新加载</Button>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="公告"
        description="把集合时间、天气提醒和社团安排说清楚。先保存草稿，发布后成员会在手机端看到，并收到一条站内消息。"
        actions={<Button variant="primary" icon="plus" onClick={openEditor}>新建公告</Button>}
      />

      <section className="stat-grid stat-grid-3">
        <Card className="stat-card"><div className="stat-icon stat-icon-green"><Icon name="megaphone" size={19} /></div><div className="stat-copy"><span>已发布</span><strong>{summary.published}</strong><small>成员可以看到</small></div></Card>
        <Card className="stat-card"><div className="stat-icon stat-icon-gold"><Icon name="edit" size={19} /></div><div className="stat-copy"><span>草稿</span><strong>{summary.drafts}</strong><small>只有管理员可见</small></div></Card>
        <Card className="stat-card"><div className="stat-icon stat-icon-coral"><Icon name="flag" size={19} /></div><div className="stat-copy"><span>置顶</span><strong>{summary.pinned}</strong><small>优先展示</small></div></Card>
      </section>

      {data && data.length > 0 ? (
        <div className="announcement-list">
          {data.map((announcement) => (
            <Card key={announcement.id} className={'announcement-card' + (announcement.pinned ? ' announcement-pinned' : '')}>
              <div className="announcement-head">
                <div className="announcement-badges">
                  {announcement.pinned ? <Badge tone="gold">置顶</Badge> : null}
                  <Badge tone={announcement.status === 'published' ? 'green' : 'gray'}>{announcement.status === 'published' ? '已发布' : '草稿'}</Badge>
                  <Badge tone="gray">{categoryLabel[announcement.category]}</Badge>
                </div>
                <div className="row-actions">
                  <Button variant="ghost" size="sm" loading={busyId === announcement.id} onClick={() => togglePinned(announcement)}>
                    {announcement.pinned ? '取消置顶' : '置顶'}
                  </Button>
                  <Button variant={announcement.status === 'published' ? 'ghost' : 'primary'} size="sm" loading={busyId === announcement.id} onClick={() => toggleStatus(announcement)}>
                    {announcement.status === 'published' ? '撤回' : '发布'}
                  </Button>
                  <Button variant="dangerGhost" size="sm" icon="trash" onClick={() => setDeleteTarget(announcement)}>删除</Button>
                </div>
              </div>
              <h2>{announcement.title}</h2>
              <p className="announcement-content">{announcement.content}</p>
              <div className="announcement-meta">
                <span>{announcement.author}</span>
                <span>{announcement.status === 'published' && announcement.publishedAt ? '发布于 ' + formatDateTime(announcement.publishedAt) : '创建于 ' + formatDateTime(announcement.createdAt)}</span>
                {announcement.status === 'published' ? <span>已读 {announcement.readCount} 人</span> : null}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon="megaphone" title="还没有公告" description="写一条集合通知，或者先把草稿存下来。" action={<Button variant="primary" size="sm" icon="plus" onClick={openEditor}>新建公告</Button>} />
        </Card>
      )}

      <Modal
        open={editorOpen}
        title="新建公告"
        description="公告会先保存为草稿；发布后，社团成员可以在手机端看到。"
        onClose={() => { if (!saving) setEditorOpen(false); }}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setEditorOpen(false)} disabled={saving}>取消</Button>
            <Button variant="primary" onClick={save} loading={saving}>保存草稿</Button>
          </>
        )}
      >
        <div className="form-grid">
          <Field label="标题" htmlFor="announcement-title" required className="field-full">
            <input id="announcement-title" className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="例如：周六校园环湖 5K，7:00 东门集合" maxLength={60} />
          </Field>
          <Field label="分类" htmlFor="announcement-category">
            <select id="announcement-category" className="input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as AnnouncementCategory })}>
              <option value="notice">通知</option>
              <option value="training">训练</option>
              <option value="safety">安全</option>
            </select>
          </Field>
          <Field label="正文" htmlFor="announcement-content" required hint="写清楚时间、地点、装备和注意事项。" className="field-full">
            <textarea id="announcement-content" className="input textarea" rows={7} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="集合时间、路线、配速要求、天气提醒……" maxLength={1000} />
          </Field>
          <label className="checkbox-row field-full">
            <input type="checkbox" checked={form.pinned} onChange={(event) => setForm({ ...form, pinned: event.target.checked })} />
            <span>设为置顶公告（成员端排在前面）</span>
          </label>
          {formError ? <div className="form-error field-full"><Icon name="alert" size={16} /><span>{formError}</span></div> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除这条公告？"
        description="删除后无法恢复。已发布的公告也会从成员端消失。"
        confirmText="删除公告"
        tone="danger"
        loading={busyId === deleteTarget?.id}
        onConfirm={remove}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
