import type { AdminRepository } from './repository';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CLUB_ID,
  CLUB_NAME,
  PLATFORM_DISPLAY_NAME,
  PLATFORM_EMAIL,
  PLATFORM_PASSWORD,
  seedAnnouncements,
  seedChallenges,
  seedInvites,
  seedMembers,
  seedRecords,
} from './mock/mockData';
import type {
  AdminUser,
  Announcement,
  AnnouncementStatus,
  Challenge,
  InviteCode,
  Member,
  MemberStatus,
  NewAnnouncementInput,
  NewChallengeInput,
  NewInviteInput,
  OverviewActivity,
  OverviewData,
  RunRecord,
} from '../types/models';

const wait = (ms = 140) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

function inviteStatus(invite: InviteCode): InviteCode['status'] {
  if (invite.status === 'disabled') return 'disabled';
  if (invite.usedCount >= invite.maxUses) return 'expired';
  return new Date(invite.expiresAt).getTime() >= Date.now() ? 'active' : 'expired';
}

function challengeStatus(startAt: string, endAt: string): Challenge['status'] {
  const now = Date.now();
  if (now < new Date(startAt).getTime()) return 'upcoming';
  if (now > new Date(endAt).getTime()) return 'ended';
  return 'active';
}

export class MockAdminRepository implements AdminRepository {
  private members: Member[] = clone(seedMembers);
  private invites: InviteCode[] = clone(seedInvites);
  private announcements: Announcement[] = clone(seedAnnouncements);
  private challenges: Challenge[] = clone(seedChallenges);
  private records: RunRecord[] = clone(seedRecords);

  async login(email: string, password: string): Promise<AdminUser> {
    await wait(220);
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      return {
        id: 'admin-001',
        name: '林小满',
        email: ADMIN_EMAIL,
        role: 'owner',
        clubId: CLUB_ID,
        clubName: CLUB_NAME,
        title: '社长',
      };
    }
    if (normalizedEmail === PLATFORM_EMAIL && password === PLATFORM_PASSWORD) {
      return {
        id: 'platform-001',
        name: PLATFORM_DISPLAY_NAME,
        email: PLATFORM_EMAIL,
        role: 'platform',
        clubName: '青跑团平台',
        title: '平台管理员',
      };
    }
    throw new Error('账号或密码不正确，请使用页面下方的演示账号。');
  }

  async getOverview(): Promise<OverviewData> {
    await wait();
    const pending = this.members.filter((m) => m.status === 'pending');
    const activities: OverviewActivity[] = [
      ...this.records.slice(0, 4).map((r, i) => ({
        id: 'act-run-' + r.id,
        type: 'run' as const,
        title: r.memberName + ' 记录了 ' + r.distanceKm.toFixed(1) + ' km',
        detail: r.date + ' · ' + r.pace + ' /km',
        time: i === 0 ? '今天 06:42' : r.date,
      })),
      ...pending.slice(0, 2).map((m, i) => ({
        id: 'act-member-' + m.id,
        type: 'member' as const,
        title: m.name + ' 申请加入社团',
        detail: m.grade + ' · ' + (m.note || '等待管理员审批'),
        time: i === 0 ? '昨天 20:12' : '昨天 19:05',
      })),
      {
        id: 'act-challenge-001',
        type: 'challenge' as const,
        title: '十一月 · 80 公里挑战进行中',
        detail: '64 人参加，21 人完成',
        time: '本月',
      },
      {
        id: 'act-announcement-001',
        type: 'announcement' as const,
        title: '公告《周六校园环湖 5K》已发布',
        detail: '作者：林小满',
        time: '昨天 20:35',
      },
    ].slice(0, 7);

    return {
      stats: {
        pendingMembers: pending.length,
        activeMembers: this.members.filter((m) => m.status === 'active').length,
        weeklyActive: this.members.filter((m) => m.status === 'active' && m.weeklyKm > 0).length,
        weeklyKm: Math.round(this.members.filter((m) => m.status === 'active').reduce((sum, m) => sum + m.weeklyKm, 0) * 10) / 10,
        monthlyKm: 1284,
        activeChallenges: this.challenges.filter((c) => c.status === 'active').length,
      },
      pending: clone(pending),
      activities,
    };
  }

  async listMembers(): Promise<Member[]> {
    await wait();
    const order: Record<MemberStatus, number> = { pending: 0, active: 1, rejected: 2, removed: 3 };
    return clone([...this.members].sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name, 'zh-CN')));
  }

  async updateMemberStatus(id: string, status: MemberStatus): Promise<Member> {
    await wait(180);
    const target = this.members.find((m) => m.id === id);
    if (!target) throw new Error('成员不存在。');
    if (target.role === 'owner' && status !== 'active') throw new Error('社长账号不能被移出或拒绝。');
    target.status = status;
    if (status === 'active' && target.lastActiveAt === target.joinedAt) target.lastActiveAt = nowIso();
    return clone(target);
  }

  async removeMember(id: string): Promise<Member> {
    return this.updateMemberStatus(id, 'removed');
  }

  async resetMemberPassword(id: string): Promise<string> {
    await wait(180);
    const target = this.members.find((m) => m.id === id);
    if (!target) throw new Error('成员不存在。');
    const tail = Math.random().toString(36).slice(2, 8).toUpperCase();
    return 'QR-' + tail;
  }

  async listInvites(): Promise<InviteCode[]> {
    await wait();
    return clone(this.invites.map((invite) => ({ ...invite, status: inviteStatus(invite) })));
  }

  async createInvite(input: NewInviteInput): Promise<InviteCode> {
    await wait(200);
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + input.expiresInDays * 86400000).toISOString();
    const code = 'QINGRUN-' + String(Date.now()).slice(-5);
    const invite: InviteCode = {
      id: 'inv-' + Date.now(),
      code,
      note: input.note.trim() || '未命名邀请码',
      createdAt,
      expiresAt,
      maxUses: Math.max(1, Math.min(100, input.maxUses)),
      usedCount: 0,
      status: 'active',
    };
    this.invites.unshift(invite);
    return clone(invite);
  }

  async disableInvite(id: string): Promise<InviteCode> {
    await wait(160);
    const target = this.invites.find((invite) => invite.id === id);
    if (!target) throw new Error('邀请码不存在。');
    target.status = 'disabled';
    return clone(target);
  }

  async listAnnouncements(): Promise<Announcement[]> {
    await wait();
    return clone([...this.announcements].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt)));
  }

  async createAnnouncement(input: NewAnnouncementInput): Promise<Announcement> {
    await wait(200);
    if (!input.title.trim() || !input.content.trim()) throw new Error('请填写公告标题和正文。');
    const announcement: Announcement = {
      id: 'ann-' + Date.now(),
      title: input.title.trim(),
      content: input.content.trim(),
      status: 'draft',
      pinned: input.pinned,
      author: '林小满',
      createdAt: nowIso(),
    };
    this.announcements.unshift(announcement);
    return clone(announcement);
  }

  async updateAnnouncementStatus(id: string, status: AnnouncementStatus): Promise<Announcement> {
    await wait(160);
    const target = this.announcements.find((announcement) => announcement.id === id);
    if (!target) throw new Error('公告不存在。');
    target.status = status;
    target.publishedAt = status === 'published' ? nowIso() : undefined;
    return clone(target);
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await wait(160);
    this.announcements = this.announcements.filter((announcement) => announcement.id !== id);
  }

  async listChallenges(): Promise<Challenge[]> {
    await wait();
    return clone(this.challenges.map((challenge) => ({ ...challenge, status: challengeStatus(challenge.startAt, challenge.endAt) })));
  }

  async createChallenge(input: NewChallengeInput): Promise<Challenge> {
    await wait(220);
    if (!input.title.trim() || !input.description.trim()) throw new Error('请填写挑战名称和说明。');
    if (!input.startAt || !input.endAt) throw new Error('请选择开始和结束日期。');
    if (new Date(input.startAt).getTime() >= new Date(input.endAt).getTime()) throw new Error('结束日期必须晚于开始日期。');
    const challenge: Challenge = {
      id: 'ch-' + Date.now(),
      title: input.title.trim(),
      description: input.description.trim(),
      targetKm: Math.max(1, input.targetKm),
      startAt: new Date(input.startAt + 'T00:00:00+08:00').toISOString(),
      endAt: new Date(input.endAt + 'T23:59:59+08:00').toISOString(),
      status: challengeStatus(input.startAt, input.endAt),
      participantCount: 0,
      completedCount: 0,
      clubProgressKm: 0,
    };
    this.challenges.unshift(challenge);
    return clone(challenge);
  }

  async endChallenge(id: string): Promise<Challenge> {
    await wait(160);
    const target = this.challenges.find((challenge) => challenge.id === id);
    if (!target) throw new Error('挑战不存在。');
    target.status = 'ended';
    return clone(target);
  }

  async listRecords(): Promise<RunRecord[]> {
    await wait();
    return clone([...this.records]
      .filter((record) => record.visibility !== 'private')
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
  }
}

export const mockAdminRepository = new MockAdminRepository();
export const demoToday = today;
