export type AnnouncementCategory = 'notice' | 'training' | 'safety';

export type AnnouncementTone = 'neutral' | 'green' | 'coral';

export type MemberAnnouncement = {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  pinned: boolean;
  author: string;
  publishedAt: string;
  read: boolean;
};

export const ANNOUNCEMENT_META: Record<
  AnnouncementCategory,
  { label: string; tone: AnnouncementTone }
> = {
  notice: { label: '通知', tone: 'neutral' },
  training: { label: '训练', tone: 'green' },
  safety: { label: '安全', tone: 'coral' },
};

export function formatAnnouncementDate(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  return date.getMonth() + 1 + ' 月 ' + date.getDate() + ' 日';
}

export function announcementExcerpt(content: string, max = 52) {
  const flat = content.replace(/\s+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max) + '…' : flat;
}
