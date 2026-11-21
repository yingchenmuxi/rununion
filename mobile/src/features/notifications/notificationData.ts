export type NotificationType =
  | 'activity_confirmed'
  | 'activity_declined'
  | 'activity_reminder'
  | 'activity_changed'
  | 'activity_ended'
  | 'attendance'
  | 'announcement';

export type MemberNotification = {
  id: string;
  memberId: string;
  type: NotificationType;
  title: string;
  body: string;
  activityId?: string;
  announcementId?: string;
  createdAt: string;
  readAt?: string | null;
};

export const NOTIFICATION_META: Record<
  NotificationType,
  { glyph: string; label: string; tone: 'neutral' | 'green' | 'gold' | 'coral' }
> = {
  activity_confirmed: { glyph: '确', label: '报名确认', tone: 'green' },
  activity_declined: { glyph: '退', label: '报名取消', tone: 'neutral' },
  activity_reminder: { glyph: '提', label: '活动提醒', tone: 'gold' },
  activity_changed: { glyph: '变', label: '活动变更', tone: 'gold' },
  activity_ended: { glyph: '止', label: '活动结束', tone: 'neutral' },
  attendance: { glyph: '勤', label: '出勤记录', tone: 'green' },
  announcement: { glyph: '公', label: '跑团公告', tone: 'green' },
};

export function notificationTone(notification: MemberNotification) {
  if (notification.type === 'attendance' && notification.body.includes('未到')) return 'coral' as const;
  return NOTIFICATION_META[notification.type].tone;
}

export function formatNotificationTime(iso: string) {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return minutes + ' 分钟前';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + ' 小时前';
  const days = Math.floor(hours / 24);
  if (days < 7) return days + ' 天前';
  return new Date(time).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}
