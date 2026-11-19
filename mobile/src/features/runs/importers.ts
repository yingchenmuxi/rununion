import { haversineMeters, metersToKm } from '@/features/runs/geo';

export type ImportedRun = {
  distanceKm: number;
  durationMin: number;
  date: string;
  title: string;
  note: string;
};

export type ParseResult = { ok: true; runs: ImportedRun[] } | { ok: false; error: string };

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toISODate(date: Date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

function normaliseDate(raw: string | undefined) {
  if (!raw) return toISODate(new Date());
  const match = raw.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (match) return match[1] + '-' + pad(Number(match[2])) + '-' + pad(Number(match[3]));
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return toISODate(parsed);
  return toISODate(new Date());
}

function parseDuration(raw: string) {
  const cleaned = raw.trim().replace(/[^\d:.]/g, '');
  if (!cleaned) return NaN;
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
    if (parts.length === 2) return parts[0] + parts[1] / 60;
    return NaN;
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return NaN;
  return value > 600 ? value / 60 : value;
}

function parseDistance(raw: string) {
  const cleaned = raw.trim().replace(',', '.').replace(/[^\d.]/g, '');
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return NaN;
  return value > 100 ? value / 1000 : value;
}

function cleanRun(distanceKm: number, durationMin: number, date: string, title: string, note: string): ImportedRun | null {
  if (!Number.isFinite(distanceKm) || distanceKm < 0.1 || distanceKm > 100) return null;
  if (!Number.isFinite(durationMin) || durationMin < 1 || durationMin > 600) return null;
  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    durationMin: Math.round(durationMin * 10) / 10,
    date,
    title,
    note,
  };
}

function parseCsv(content: string, fileName: string): ParseResult {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return { ok: false, error: 'CSV 至少需要表头和一行数据。' };
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delimiter).map((header) => header.trim().toLowerCase());
  const find = (keywords: string[]) => headers.findIndex((header) => keywords.some((key) => header.includes(key)));

  const distanceIndex = find(['距离', 'distance', 'km']);
  const durationIndex = find(['时长', '用时', 'duration', 'time']);
  const dateIndex = find(['日期', 'date']);
  const titleIndex = find(['标题', '备注', 'title', 'note', 'name']);

  if (distanceIndex < 0 || durationIndex < 0) {
    return { ok: false, error: 'CSV 需要包含距离和时长两列。' };
  }

  const runs: ImportedRun[] = [];
  for (const line of lines.slice(1, 11)) {
    const cells = line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const run = cleanRun(
      parseDistance(cells[distanceIndex] ?? ''),
      parseDuration(cells[durationIndex] ?? ''),
      normaliseDate(dateIndex >= 0 ? cells[dateIndex] : undefined),
      fileName.replace(/\.[^.]+$/, ''),
      titleIndex >= 0 ? cells[titleIndex] ?? '' : '',
    );
    if (run) runs.push(run);
  }
  return runs.length > 0 ? { ok: true, runs } : { ok: false, error: '没有读到有效的距离和时长。' };
}

type TrackPoint = { lat: number; lon: number; time: number | null };

function extractGpx(content: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  const re = /<(?:trkpt|wpt)\b([^>]*)>([\s\S]*?)<\/(?:trkpt|wpt)>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null && points.length < 5000) {
    const attrs = match[1];
    const lat = Number(attrs.match(/\blat=["']([^"']+)["']/)?.[1]);
    const lon = Number(attrs.match(/\blon=["']([^"']+)["']/)?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const timeText = match[2].match(/<time>([^<]+)<\/time>/)?.[1];
    points.push({ lat, lon, time: timeText ? new Date(timeText).getTime() : null });
  }
  return points;
}

function extractTcx(content: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  const re = /<Trackpoint\b[^>]*>([\s\S]*?)<\/Trackpoint>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null && points.length < 5000) {
    const block = match[1];
    const lat = Number(block.match(/<LatitudeDegrees>([^<]+)<\/LatitudeDegrees>/)?.[1]);
    const lon = Number(block.match(/<LongitudeDegrees>([^<]+)<\/LongitudeDegrees>/)?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const timeText = block.match(/<Time>([^<]+)<\/Time>/)?.[1];
    points.push({ lat, lon, time: timeText ? new Date(timeText).getTime() : null });
  }
  return points;
}

function summarizeTrack(points: TrackPoint[], fileName: string): ParseResult {
  if (points.length < 2) return { ok: false, error: '文件里没有足够的轨迹点。' };
  let meters = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    meters += haversineMeters(
      { latitude: previous.lat, longitude: previous.lon, accuracy: 0, timestamp: 0 },
      { latitude: current.lat, longitude: current.lon, accuracy: 0, timestamp: 0 },
    );
  }
  const timed = points.filter((point) => point.time !== null);
  if (timed.length < 2) return { ok: false, error: '轨迹缺少时间，无法计算时长。' };
  const durationMin = (timed[timed.length - 1].time! - timed[0].time!) / 60000;
  const distanceKm = metersToKm(meters);
  const date = toISODate(new Date(timed[0].time!));
  const run = cleanRun(distanceKm, durationMin, date, fileName.replace(/\.[^.]+$/, ''), '从文件导入');
  return run ? { ok: true, runs: [run] } : { ok: false, error: '轨迹的距离或时长超出可记录范围。' };
}

export function parseRunFile(fileName: string, content: string): ParseResult {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.fit')) {
    return { ok: false, error: 'FIT 是二进制格式，请先在运动软件里导出 GPX、TCX 或 CSV。' };
  }
  if (lowerName.endsWith('.gpx') || content.includes('<gpx')) {
    return summarizeTrack(extractGpx(content), fileName);
  }
  if (lowerName.endsWith('.tcx') || content.includes('<TrainingCenterDatabase')) {
    return summarizeTrack(extractTcx(content), fileName);
  }
  return parseCsv(content, fileName);
}
