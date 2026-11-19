import type { PlatformRepository } from './platformRepository';
import {
  platformCities,
  platformWeeklyTrend,
  seedPlatformAccounts,
  seedPlatformActivities,
  seedPlatformClubs,
  seedPlatformContent,
  seedPlatformRecords,
  seedPlatformReports,
  seedPlatformUsers,
  seedPlatformAuditLogs,
} from './mock/platformMockData';
import { PLATFORM_DISPLAY_NAME } from './mock/mockData';
import type {
  ClubSettingsInput,
  NewPlatformAccountInput,
  PlatformAccount,
  PlatformAuditLog,
  PlatformClub,
  PlatformClubStatus,
  PlatformContentItem,
  PlatformContentStatus,
  PlatformOverviewData,
  PlatformReport,
  PlatformUser,
  PlatformUserStatus,
  RecordUpdateInput,
  RunRecord,
} from '../types/models';

const wait = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const nowIso = () => new Date().toISOString();

const clubStatusLabel: Record<PlatformClubStatus, string> = {
  active: '运行中',
  pending: '待审核',
  paused: '已暂停',
  rejected: '未通过',
};

const userStatusLabel: Record<PlatformUserStatus, string> = {
  active: '在团',
  pending: '待审批',
  suspended: '已暂停',
  left: '已离团',
};

const contentStatusLabel: Record<PlatformContentStatus, string> = {
  published: '已发布',
  review: '待审核',
  draft: '草稿',
  offline: '已下线',
};

function formatPace(distanceKm: number, durationMin: number): string {
  const secondsPerKm = Math.round((durationMin * 60) / distanceKm);
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = String(secondsPerKm % 60).padStart(2, '0');
  return minutes + "'" + seconds + '"';
}

export class MockPlatformRepository implements PlatformRepository {
  private clubs: PlatformClub[] = clone(seedPlatformClubs);
  private users: PlatformUser[] = clone(seedPlatformUsers);
  private content: PlatformContentItem[] = clone(seedPlatformContent);
  private reports: PlatformReport[] = clone(seedPlatformReports);
  private accounts: PlatformAccount[] = clone(seedPlatformAccounts);
  private logs: PlatformAuditLog[] = clone(seedPlatformAuditLogs);
  private records: RunRecord[] = clone(seedPlatformRecords);

  private addLog(action: string, target: string, detail: string): void {
    this.logs.unshift({
      id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      actor: PLATFORM_DISPLAY_NAME,
      action,
      target,
      detail,
      createdAt: nowIso(),
      ip: '10.24.8.16',
    });
  }

  async getOverview(): Promise<PlatformOverviewData> {
    await wait();
    const pendingClubList = this.clubs
      .filter((club) => club.status === 'pending')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const pendingReportList = this.reports
      .filter((report) => report.status === 'pending')
      .sort((a, b) => Number(b.priority === 'high') - Number(a.priority === 'high') || b.createdAt.localeCompare(a.createdAt));
    return clone({
      clubs: this.clubs.length,
      activeClubs: this.clubs.filter((club) => club.status === 'active').length,
      users: this.clubs.reduce((sum, club) => sum + club.memberCount, 0),
      weeklyKm: Number(this.clubs.reduce((sum, club) => sum + club.weeklyKm, 0).toFixed(1)),
      pendingClubs: pendingClubList.length,
      pendingReports: pendingReportList.length,
      pendingUsers: this.users.filter((user) => user.status === 'pending').length,
      highRiskReports: pendingReportList.filter((report) => report.priority === 'high').length,
      pendingClubList,
      pendingReportList,
      weeklyTrend: platformWeeklyTrend,
      cities: platformCities,
      activities: seedPlatformActivities,
    });
  }

  async listClubs(): Promise<PlatformClub[]> {
    await wait();
    return clone([...this.clubs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async getClub(id: string): Promise<PlatformClub | null> {
    await wait(80);
    const club = this.clubs.find((item) => item.id === id);
    return club ? clone(club) : null;
  }

  async updateClubStatus(id: string, status: PlatformClubStatus): Promise<PlatformClub> {
    await wait(160);
    const club = this.clubs.find((item) => item.id === id);
    if (!club) throw new Error('社团不存在，可能已被移除。');
    const previous = club.status;
    club.status = status;
    if (status === 'active') club.verified = true;
    this.addLog('更新社团状态', club.name, clubStatusLabel[previous] + ' → ' + clubStatusLabel[status]);
    return clone(club);
  }

  async updateClubSettings(id: string, input: ClubSettingsInput): Promise<PlatformClub> {
    await wait(160);
    const club = this.clubs.find((item) => item.id === id);
    if (!club) throw new Error('社团不存在，可能已被移除。');
    const grades = Array.from(new Set(input.gradeOptions.map((item) => item.trim()).filter(Boolean)));
    if (grades.length === 0) throw new Error('至少保留一个年级选项。');
    if (!grades.includes('不填')) grades.push('不填');
    club.ownerTitle = input.ownerTitle.trim() || club.ownerTitle;
    club.gradeOptions = grades;
    club.guardianConsent = input.guardianConsent;
    this.addLog(
      '更新社团设置',
      club.name,
      '负责人称呼：' + club.ownerTitle + '；年级选项：' + grades.join('、') + '；监护人同意：' + (input.guardianConsent ? '已收' : '待补'),
    );
    return clone(club);
  }

  async listUsers(): Promise<PlatformUser[]> {
    await wait();
    return clone([...this.users].sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt)));
  }

  async getUser(id: string): Promise<PlatformUser | null> {
    await wait(80);
    const user = this.users.find((item) => item.id === id);
    return user ? clone(user) : null;
  }

  async updateUserStatus(id: string, status: PlatformUserStatus): Promise<PlatformUser> {
    await wait(160);
    const user = this.users.find((item) => item.id === id);
    if (!user) throw new Error('用户不存在，可能已离团。');
    const previous = user.status;
    user.status = status;
    this.addLog('更新用户状态', user.name + ' · ' + user.clubName, userStatusLabel[previous] + ' → ' + userStatusLabel[status]);
    return clone(user);
  }

  async listContent(): Promise<PlatformContentItem[]> {
    await wait();
    return clone([...this.content].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async updateContentStatus(id: string, status: PlatformContentStatus): Promise<PlatformContentItem> {
    await wait(160);
    const item = this.content.find((current) => current.id === id);
    if (!item) throw new Error('内容不存在，可能已被删除。');
    const previous = item.status;
    item.status = status;
    this.addLog('更新内容状态', item.title, contentStatusLabel[previous] + ' → ' + contentStatusLabel[status]);
    return clone(item);
  }

  async listReports(): Promise<PlatformReport[]> {
    await wait();
    return clone([...this.reports].sort((a, b) => Number(b.priority === 'high') - Number(a.priority === 'high') || b.createdAt.localeCompare(a.createdAt)));
  }

  async resolveReport(id: string, resolution: string): Promise<PlatformReport> {
    await wait(160);
    const report = this.reports.find((item) => item.id === id);
    if (!report) throw new Error('举报不存在，可能已被处理。');
    const clean = resolution.trim();
    if (!clean) throw new Error('请填写处理说明，方便后续追溯。');
    report.status = 'resolved';
    report.resolution = clean;
    this.addLog('处理举报', report.id + ' · ' + report.targetName, clean);
    return clone(report);
  }

  async dismissReport(id: string, resolution = '举报不成立，已驳回。'): Promise<PlatformReport> {
    await wait(160);
    const report = this.reports.find((item) => item.id === id);
    if (!report) throw new Error('举报不存在，可能已被处理。');
    report.status = 'dismissed';
    report.resolution = resolution;
    this.addLog('驳回举报', report.id + ' · ' + report.targetName, resolution);
    return clone(report);
  }

  async listAccounts(): Promise<PlatformAccount[]> {
    await wait();
    return clone([...this.accounts].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }

  async createAccount(input: NewPlatformAccountInput): Promise<PlatformAccount> {
    await wait(180);
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (!name) throw new Error('请填写管理员姓名。');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('请填写有效的邮箱地址。');
    if (this.accounts.some((account) => account.email === email)) throw new Error('这个邮箱已经有一个平台账号。');
    const account: PlatformAccount = {
      id: 'platform-' + Date.now(),
      name,
      email,
      role: input.role,
      status: 'active',
      lastLoginAt: '',
      createdAt: nowIso(),
    };
    this.accounts.push(account);
    this.addLog('新增管理员', name, '角色：' + (input.role === 'super' ? '超级管理员' : '运营管理员'));
    return clone(account);
  }

  async toggleAccountStatus(id: string): Promise<PlatformAccount> {
    await wait(160);
    const account = this.accounts.find((item) => item.id === id);
    if (!account) throw new Error('平台账号不存在。');
    if (account.status === 'active' && account.role === 'super') {
      const activeSupers = this.accounts.filter((item) => item.role === 'super' && item.status === 'active');
      if (activeSupers.length <= 1) throw new Error('至少保留一个启用中的超级管理员，避免无人能登录。');
    }
    account.status = account.status === 'active' ? 'disabled' : 'active';
    this.addLog(account.status === 'active' ? '启用管理员' : '停用管理员', account.name, account.email);
    return clone(account);
  }

  async listLogs(): Promise<PlatformAuditLog[]> {
    await wait();
    return clone(this.logs);
  }

  async listRecords(): Promise<RunRecord[]> {
    await wait();
    return clone([...this.records].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
  }

  async updateRecord(id: string, input: RecordUpdateInput): Promise<RunRecord> {
    await wait(180);
    const record = this.records.find((item) => item.id === id);
    if (!record) throw new Error('记录不存在，可能已被删除。');
    if (!input.date) throw new Error('请选择记录日期。');
    if (!Number.isFinite(input.distanceKm) || input.distanceKm <= 0) throw new Error('距离必须大于 0。');
    if (!Number.isFinite(input.durationMin) || input.durationMin <= 0) throw new Error('时长必须大于 0。');
    const oldDistance = record.distanceKm;
    const oldVisibility = record.visibility;
    record.date = input.date;
    record.distanceKm = Number(input.distanceKm.toFixed(2));
    record.durationMin = Math.round(input.durationMin);
    record.pace = formatPace(record.distanceKm, record.durationMin);
    record.note = input.note.trim();
    record.visibility = input.visibility;
    this.addLog(
      '更正跑步记录',
      record.memberName + ' · ' + record.date,
      '距离 ' + oldDistance.toFixed(1) + ' → ' + record.distanceKm.toFixed(1) + ' km；可见性 ' + oldVisibility + ' → ' + input.visibility,
    );
    return clone(record);
  }
}

export const mockPlatformRepository = new MockPlatformRepository();
