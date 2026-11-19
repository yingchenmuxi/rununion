import { useEffect, useState } from 'react';
import { platformRepository } from '../../data';
import { useToast } from '../../components/ui/Toast';
import { Button, Field } from '../../components/ui/primitives';
import { Modal } from '../../components/ui/Modal';
import type { RunRecord } from '../../types/models';
import { visibilityLabels } from './platformUi';

function formatPace(distanceKm: number, durationMin: number): string {
  if (!distanceKm || !durationMin) return '—';
  const secondsPerKm = Math.round((durationMin * 60) / distanceKm);
  return Math.floor(secondsPerKm / 60) + "'" + String(secondsPerKm % 60).padStart(2, '0') + '"';
}

export function RecordEditModal({
  record,
  open,
  onClose,
  onSaved,
}: {
  record: RunRecord | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [date, setDate] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [visibility, setVisibility] = useState<RunRecord['visibility']>('club');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!record) return;
    setDate(record.date);
    setDistanceKm(String(record.distanceKm));
    setDurationMin(String(record.durationMin));
    setVisibility(record.visibility);
    setNote(record.note);
    setError(null);
  }, [record]);

  const handleSave = async () => {
    if (!record) return;
    setBusy(true);
    setError(null);
    try {
      await platformRepository.updateRecord(record.id, {
        date,
        distanceKm: Number(distanceKm),
        durationMin: Number(durationMin),
        visibility,
        note,
      });
      toast('记录已更正，操作已写入审计日志。');
      onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="更正跑步记录"
      description={record ? record.memberName + ' · ' + record.clubName : '平台更正会写入审计日志。'}
      onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>取消</Button>
          <Button variant="primary" onClick={handleSave} loading={busy}>保存更正</Button>
        </>
      )}
    >
      <div className="form-grid">
        <Field label="日期" htmlFor="record-date">
          <input id="record-date" className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="可见性" htmlFor="record-visibility">
          <select id="record-visibility" className="input" value={visibility} onChange={(event) => setVisibility(event.target.value as RunRecord['visibility'])}>
            <option value="club">{visibilityLabels.club}</option>
            <option value="private">{visibilityLabels.private}</option>
            <option value="public">{visibilityLabels.public}</option>
          </select>
        </Field>
        <Field label="距离（km）" htmlFor="record-distance">
          <input id="record-distance" className="input" type="number" min="0.1" step="0.1" value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} />
        </Field>
        <Field label="时长（分钟）" htmlFor="record-duration">
          <input id="record-duration" className="input" type="number" min="1" step="1" value={durationMin} onChange={(event) => setDurationMin(event.target.value)} />
        </Field>
        <Field label="备注" htmlFor="record-note" className="field-full">
          <textarea id="record-note" className="input textarea" value={note} onChange={(event) => setNote(event.target.value)} placeholder="说明为什么更正，方便成员和审计追溯。" />
        </Field>
      </div>
      <p className="field-hint">按当前输入计算：约 {formatPace(Number(distanceKm), Number(durationMin))} /km。保存后会更新成员端记录，并写入平台操作日志。</p>
      {error ? <div className="form-error" style={{ marginTop: 12 }}>{error}</div> : null}
    </Modal>
  );
}
