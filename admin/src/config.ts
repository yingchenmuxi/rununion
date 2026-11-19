import type { IconName } from './components/ui/Icon';

export const APP_NAME = '青跑团 · 管理后台';
export const CLUB_NAME = '康福外国语学校长跑社';
export const DATA_SOURCE = (import.meta.env.VITE_DATA_SOURCE as string | undefined) ?? 'mock';
export const DEMO_MODE = DATA_SOURCE !== 'pocketbase';
export const POCKETBASE_URL = (import.meta.env.VITE_POCKETBASE_URL as string | undefined) ?? 'http://127.0.0.1:8091';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '概览', icon: 'home', description: '今天社团里发生了什么' },
  { to: '/members', label: '成员', icon: 'users', description: '审批、查看和维护成员' },
  { to: '/invites', label: '邀请码', icon: 'ticket', description: '把新成员带进来' },
  { to: '/announcements', label: '公告', icon: 'megaphone', description: '发布社团通知' },
  { to: '/activities', label: '活动', icon: 'calendar', description: '发布活动与审核报名' },
  { to: '/challenges', label: '挑战', icon: 'flag', description: '线上挑战与进度' },
  { to: '/records', label: '记录与导出', icon: 'list', description: '社团可见跑步记录' },
];

export const PLATFORM_NAME = '青跑团 · 平台总后台';

export const PLATFORM_NAV_ITEMS: NavItem[] = [
  { to: '/platform', label: '总览', icon: 'home', description: '全平台今天怎么样' },
  { to: '/platform/clubs', label: '学校与社团', icon: 'users', description: '入驻、审核与运营状态' },
  { to: '/platform/users', label: '全部用户', icon: 'user', description: '成员、负责人和账号状态' },
  { to: '/platform/content', label: '内容与活动', icon: 'megaphone', description: '公告、文章、活动与挑战' },
  { to: '/platform/records', label: '跑步记录', icon: 'activity', description: '查看与更正异常记录' },
  { to: '/platform/moderation', label: '审核与举报', icon: 'alert', description: '风险队列与处理留痕' },
  { to: '/platform/system', label: '系统与权限', icon: 'lock', description: '管理员、配置与审计日志' },
];
