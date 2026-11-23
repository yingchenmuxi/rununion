import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DEMO_MEMBER_ID } from '@/features/activities/activityData';
import { createRun, fetchMemberRuns, type ApiRun } from './runApi';

export type RunSource = 'gps' | 'screenshot' | 'file' | 'manual';

export const RUN_SOURCE_LABELS: Record<RunSource, string> = {
  gps: 'GPS',
  screenshot: '截图',
  file: '文件',
  manual: '手动',
};

export type RunRecord = {
  id: string;
  date: string;
  title: string;
  distanceKm: number;
  durationMin: number;
  source: RunSource;
};

export type RunDraft = {
  title: string;
  distanceKm: number;
  durationMin: number;
  source: RunSource;
  date?: string;
};

export type WeekPoint = { label: string; km: number; isCurrent: boolean };

type RunStats = {
  weekKm: number;
  monthKm: number;
  weekGoal: number;
  weekPercent: number;
  weeks: WeekPoint[];
  recentRuns: RunRecord[];
};

type RunContextValue = {
  records: RunRecord[];
  recentRuns: RunRecord[];
  stats: RunStats;
  addRun: (draft: RunDraft) => RunRecord;
  refresh: () => Promise<void>;
  syncError: string;
};

const RunContext = createContext<RunContextValue | null>(null);
const WEEK_GOAL = 25;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toISODate(date: Date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

function parseISODate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfWeek(date: Date) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - offset);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function buildSeedRuns(): RunRecord[] {
  const today = new Date();
  const weekStart = startOfWeek(today);
  const currentDate = (offset: number) => {
    const day = addDays(weekStart, offset);
    return toISODate(day > today ? today : day);
  };

  return [
    { id: 'seed-current-3', date: currentDate(2), title: '公园慢跑', distanceKm: 7.2, durationMin: 42.5, source: 'manual' },
    { id: 'seed-current-2', date: currentDate(1), title: '校园环湖', distanceKm: 5.2, durationMin: 28 + 40 / 60, source: 'gps' },
    { id: 'seed-current-1', date: currentDate(0), title: '操场节奏跑', distanceKm: 6.2, durationMin: 37 + 20 / 60, source: 'manual' },
    { id: 'seed-last-2', date: toISODate(addDays(weekStart, -4)), title: '放学慢跑', distanceKm: 7.4, durationMin: 43 + 50 / 60, source: 'manual' },
    { id: 'seed-last-1', date: toISODate(addDays(weekStart, -7)), title: '校园环湖', distanceKm: 5.6, durationMin: 33 + 40 / 60, source: 'manual' },
    { id: 'seed-two-weeks', date: toISODate(addDays(weekStart, -12)), title: '周末拉练', distanceKm: 10.7, durationMin: 63 + 30 / 60, source: 'manual' },
    { id: 'seed-three-weeks', date: toISODate(addDays(weekStart, -17)), title: '公园慢跑', distanceKm: 8.2, durationMin: 48 + 20 / 60, source: 'file' },
  ];
}

export function formatDuration(minutes: number) {
  const totalSeconds = Math.max(0, Math.round(minutes * 60));
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) return hours + ':' + pad(mins) + ':' + pad(secs);
  return pad(mins) + ':' + pad(secs);
}

export function formatPace(distanceKm: number, durationMin: number) {
  if (distanceKm <= 0) return '--';
  const seconds = Math.round((durationMin * 60) / distanceKm);
  return Math.floor(seconds / 60) + "'" + pad(seconds % 60) + '"/km';
}

export function formatRunDate(iso: string) {
  const date = parseISODate(iso);
  return date.getMonth() + 1 + ' 月 ' + date.getDate() + ' 日';
}

const RUN_SOURCES: RunSource[] = ['gps', 'screenshot', 'file', 'manual'];

function toRecord(row: ApiRun): RunRecord {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    distanceKm: row.distanceKm,
    durationMin: row.durationMin,
    source: RUN_SOURCES.includes(row.source) ? row.source : 'manual',
  };
}

export function RunProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<RunRecord[]>(() => buildSeedRuns());
  const [syncError, setSyncError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const rows = await fetchMemberRuns(DEMO_MEMBER_ID);
      setRecords(rows.map(toRecord));
      setSyncError('');
    } catch (cause) {
      setSyncError(cause instanceof Error ? cause.message : '跑步记录同步失败。');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addRun = useCallback((draft: RunDraft) => {
    if (!Number.isFinite(draft.distanceKm) || draft.distanceKm <= 0) {
      throw new Error('距离不正确');
    }
    if (!Number.isFinite(draft.durationMin) || draft.durationMin <= 0) {
      throw new Error('时长不正确');
    }
    const record: RunRecord = {
      id: 'run-' + Date.now() + '-' + Math.round(Math.random() * 1000),
      date: draft.date ?? toISODate(new Date()),
      title: draft.title.trim() || '手动记录',
      distanceKm: Math.round(draft.distanceKm * 10) / 10,
      durationMin: Math.round(draft.durationMin * 10) / 10,
      source: draft.source,
    };
    setRecords((current) => [record, ...current]);
    void createRun({
      memberId: DEMO_MEMBER_ID,
      title: record.title,
      date: record.date,
      distanceKm: record.distanceKm,
      durationMin: record.durationMin,
      source: record.source,
    })
      .then((saved) => {
        setRecords((current) => current.map((item) => (item.id === record.id ? toRecord(saved) : item)));
        setSyncError('');
      })
      .catch((cause) => {
        setSyncError(cause instanceof Error ? cause.message : '这条记录还没同步到后台。');
      });
    return record;
  }, []);

  const stats = useMemo<RunStats>(() => {
    const now = new Date();
    const thisWeek = startOfWeek(now);
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let weekKm = 0;
    let monthKm = 0;
    for (const run of records) {
      const date = parseISODate(run.date);
      if (toISODate(startOfWeek(date)) === toISODate(thisWeek)) weekKm += run.distanceKm;
      if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) monthKm += run.distanceKm;
    }

    const weeks: WeekPoint[] = [];
    for (let offset = 3; offset >= 0; offset -= 1) {
      const start = addDays(thisWeek, -7 * offset);
      const end = addDays(start, 7);
      const km = records
        .filter((run) => {
          const date = parseISODate(run.date);
          return date >= start && date < end;
        })
        .reduce((sum, run) => sum + run.distanceKm, 0);
      const label = offset === 0 ? '本周' : offset === 1 ? '上周' : start.getMonth() + 1 + '/' + start.getDate();
      weeks.push({ label, km: Math.round(km * 10) / 10, isCurrent: offset === 0 });
    }

    const recentRuns = records
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6);

    return {
      weekKm: Math.round(weekKm * 10) / 10,
      monthKm: Math.round(monthKm * 10) / 10,
      weekGoal: WEEK_GOAL,
      weekPercent: Math.round((weekKm / WEEK_GOAL) * 100),
      weeks,
      recentRuns,
    };
  }, [records]);

  const value = useMemo(
    () => ({ records, stats, recentRuns: stats.recentRuns, addRun, refresh, syncError }),
    [records, stats, addRun, refresh, syncError],
  );

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}

export function useRuns() {
  const value = useContext(RunContext);
  if (!value) throw new Error('useRuns 必须在 RunProvider 内使用');
  return value;
}
