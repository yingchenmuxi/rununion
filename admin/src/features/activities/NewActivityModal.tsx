import { useEffect, useState } from 'react';
import { activityApi } from '../../data/activityApi';
import type { ClubActivityTag, NewActivityInput } from '../../types/models';
import { Button, Field } from '../../components/ui/primitives';
import { Icon } from '../../components/ui/Icon';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { activityTagOptions } from './activityUi';

interface ActivityFormState {
  title: string;
  tag: ClubActivityTag;
  date: string;
  startTime: string;
  meetingArea: string;
  meetingDetail: string;
  distanceKm: number;
  durationMin: number;
  capacity: number;
  coach: string;
  intensity: string;
  description: string;
  preparation: string;
  notes: string;
}

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function nextSaturday(): string {
  const date = new Date();
  const diff = (6 - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + diff);
  return toInputDate(date);
}

function createInitialForm(): ActivityFormState {
  return {
    title: '',
    tag: '轻松跑',
    date: nextSaturday(),
    startTime: '07:00',
    meetingArea: '学校东门',
    meetingDetail: '',
    distanceKm: 5,
    durationMin: 45,
    capacity: 40,
    coach: '陈教练',
    intensity: '7 分 00 秒/km 左右，跑走结合也可以',
    description: '',
    preparation: '穿跑鞋，带一件外套\n提前 10 分钟到集合点\n跑前少量喝水，不要空腹',
    notes: '如遇雾霾、雷雨或路面结冰，活动会提前在跑团公告里取消。',
  };
}

export function NewActivityModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<ActivityFormState>(createInitialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(createInitialForm());
      setFormError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!formError) return;
    document.querySelector<HTMLElement>(".modal .modal-body")?.scrollTo({ top: 0, behavior: "smooth" });
  }, [formError]);

  const submit = async () => {
    setFormError(null);
    setSaving(true);
    try {
      const input: NewActivityInput = {
        ...form,
        title: form.title.trim(),
        meetingArea: form.meetingArea.trim(),
        coach: form.coach.trim(),
      };
      await activityApi.createActivity(input);
      toast('活动已发布，成员端会看到新的场次。');
      onCreated();
      onClose();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : '发布失败，请稍后再试。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="发布新活动"
      description="面向社团成员的线下活动。未成年人报名后先进入待确认，团长联系监护人后再放行。"
      size="lg"
      onClose={() => { if (!saving) onClose(); }}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>取消</Button>
          <Button variant="primary" icon="send" onClick={submit} loading={saving}>发布活动</Button>
        </>
      )}
    >
      <div className="form-grid">
        {formError ? (
          <div className="form-error field-full" role="alert">
            <Icon name="alert" size={16} />
            <span>{formError}</span>
          </div>
        ) : null}

        <Field label="活动名称" htmlFor="activity-title" required className="field-full">
          <input
            id="activity-title"
            className="input"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="例如：周六校园环湖 5K"
            maxLength={40}
          />
        </Field>

        <Field label="活动类型" htmlFor="activity-tag" required>
          <select
            id="activity-tag"
            className="input"
            value={form.tag}
            onChange={(event) => setForm({ ...form, tag: event.target.value as ClubActivityTag })}
          >
            {activityTagOptions.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        </Field>
        <Field label="人数上限" htmlFor="activity-capacity" required>
          <input
            id="activity-capacity"
            className="input"
            type="number"
            min={1}
            max={200}
            value={form.capacity}
            onChange={(event) => setForm({ ...form, capacity: Number(event.target.value) })}
          />
        </Field>

        <Field label="活动日期" htmlFor="activity-date" required>
          <input
            id="activity-date"
            className="input"
            type="date"
            value={form.date}
            onChange={(event) => setForm({ ...form, date: event.target.value })}
          />
        </Field>
        <Field label="集合时间" htmlFor="activity-time" required>
          <input
            id="activity-time"
            className="input"
            type="time"
            value={form.startTime}
            onChange={(event) => setForm({ ...form, startTime: event.target.value })}
          />
        </Field>

        <Field label="集合地点" htmlFor="activity-area" required>
          <input
            id="activity-area"
            className="input"
            value={form.meetingArea}
            onChange={(event) => setForm({ ...form, meetingArea: event.target.value })}
            placeholder="例如：学校东门"
            maxLength={40}
          />
        </Field>
        <Field label="具体位置" htmlFor="activity-detail" hint="报名确认后才对成员显示">
          <input
            id="activity-detail"
            className="input"
            value={form.meetingDetail}
            onChange={(event) => setForm({ ...form, meetingDetail: event.target.value })}
            placeholder="例如：东门内侧银杏树下"
            maxLength={60}
          />
        </Field>

        <Field label="距离（km）" required>
          <input
            className="input"
            type="number"
            min={1}
            max={100}
            step={0.5}
            value={form.distanceKm}
            onChange={(event) => setForm({ ...form, distanceKm: Number(event.target.value) })}
          />
        </Field>
        <Field label="预计时长（分钟）" required>
          <input
            className="input"
            type="number"
            min={5}
            max={600}
            value={form.durationMin}
            onChange={(event) => setForm({ ...form, durationMin: Number(event.target.value) })}
          />
        </Field>

        <Field label="带跑教练" htmlFor="activity-coach" required>
          <input
            id="activity-coach"
            className="input"
            value={form.coach}
            onChange={(event) => setForm({ ...form, coach: event.target.value })}
            placeholder="例如：陈教练"
            maxLength={20}
          />
        </Field>
        <Field label="强度说明" htmlFor="activity-intensity">
          <input
            id="activity-intensity"
            className="input"
            value={form.intensity}
            onChange={(event) => setForm({ ...form, intensity: event.target.value })}
            placeholder="例如：7 分 00 秒/km 左右，跑走结合也可以"
            maxLength={60}
          />
        </Field>

        <Field label="活动说明" htmlFor="activity-desc" required className="field-full">
          <textarea
            id="activity-desc"
            className="input textarea"
            rows={4}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="路线、节奏、是否设关门时间，以及身体不适时怎么做"
            maxLength={400}
          />
        </Field>

        <Field label="出发前准备" htmlFor="activity-prep" hint="每行一条，成员端会显示为清单" className="field-full">
          <textarea
            id="activity-prep"
            className="input textarea"
            rows={3}
            value={form.preparation}
            onChange={(event) => setForm({ ...form, preparation: event.target.value })}
            maxLength={300}
          />
        </Field>

        <Field label="天气与安全备注" htmlFor="activity-notes" className="field-full">
          <input
            id="activity-notes"
            className="input"
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder="例如：遇到雾霾或雷雨会在公告里取消"
            maxLength={160}
          />
        </Field>

      </div>
    </Modal>
  );
}
