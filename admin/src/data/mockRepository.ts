import type { AdminRepository } from './repository';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CLUB_ID,
  CLUB_NAME,
  PLATFORM_DISPLAY_NAME,
  PLATFORM_EMAIL,
  PLATFORM_PASSWORD,
} from './mock/mockData';
import type {
  ActivitySignup,
  AdminUser,
  Announcement,
  AnnouncementStatus,
  Challenge,
  ClubActivity,
  ClubActivitySummary,
  InviteCode,
  Member,
  MemberStatus,
  NewActivityInput,
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
  private members: Member[] = [];
  private invites: InviteCode[] = [];
  private announcements: Announcement[] = [];
  private challenges: Challenge[] = [];
  private records: RunRecord[] = [];
  private activities: ClubActivity[] = [];
  private activitySignups: ActivitySignup[] = [];

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
    ];

    return {
      stats: {
        pendingMembers: pending.length,
        activeMembers: this.members.filter((m) => m.status === 'active').length,
        weeklyActive: this.members.filter((m) => m.status === 'active' && m.weeklyKm > 0).length,
        weeklyKm: Math.round(this.members.filter((m) => m.status === 'active').reduce((sum, m) => sum + m.weeklyKm, 0) * 10) / 10,
        monthlyKm: Math.round(this.records.reduce((sum, r) => sum + r.distanceKm, 0) * 10) / 10,
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

  private summarizeActivity(activity: ClubActivity): ClubActivitySummary {
    const rows = this.activitySignups.filter((signup) => signup.activityId === activity.id);
    const activeRows = rows.filter((signup) => signup.status !== 'declined');
    return {
      ...clone(activity),
      signupCount: activeRows.length,
      pendingCount: rows.filter((signup) => signup.status === 'pending').length,
      confirmedCount: rows.filter((signup) => signup.status === 'approved' || signup.status === 'attended' || signup.status === 'absent').length,
      pendingCheckinCount: rows.filter((signup) => signup.status === 'approved').length,
      attendedCount: rows.filter((signup) => signup.status === 'attended').length,
      absentCount: rows.filter((signup) => signup.status === 'absent').length,
    };
  }

  async listActivities(): Promise<ClubActivitySummary[]> {
    await wait();
    const statusOrder: Record<ClubActivity['status'], number> = { published: 0, draft: 1, ended: 2 };
    return clone([...this.activities]
      .sort((a, b) => statusOrder[a.status] - statusOrder[b.status]
        || a.date.localeCompare(b.date)
        || a.startTime.localeCompare(b.startTime))
      .map((activity) => this.summarizeActivity(activity)));
  }

  async getActivity(id: string): Promise<ClubActivity | null> {
    await wait(100);
    const target = this.activities.find((activity) => activity.id === id);
    return target ? clone(target) : null;
  }

  async listActivitySignups(activityId: string): Promise<ActivitySignup[]> {
    await wait();
    const statusOrder: Record<ActivitySignup['status'], number> = { pending: 0, approved: 1, attended: 2, absent: 3, declined: 4 };
    return clone(this.activitySignups
      .filter((signup) => signup.activityId === activityId)
      .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || b.createdAt.localeCompare(a.createdAt)));
  }

  async createActivity(input: NewActivityInput): Promise<ClubActivity> {
    await wait(200);
    const title = input.title.trim();
    const meetingArea = input.meetingArea.trim();
    const coach = input.coach.trim();
    const description = input.description.trim();
    if (title.length < 2) throw new Error('活动名称至少 2 个字。');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('请选择活动日期。');
    if (input.date < today()) throw new Error('活动日期不能早于今天。');
    if (!/^\d{2}:\d{2}$/.test(input.startTime)) throw new Error('请选择集合时间。');
    if (!meetingArea) throw new Error('请填写集合地点。');
    if (!coach) throw new Error('请填写带跑教练。');
    if (!Number.isFinite(input.distanceKm) || input.distanceKm < 1 || input.distanceKm > 100) throw new Error('距离需要在 1 到 100 公里之间。');
    if (!Number.isFinite(input.durationMin) || input.durationMin < 5 || input.durationMin > 600) throw new Error('预计时长需要在 5 到 600 分钟之间。');
    if (!Number.isFinite(input.capacity) || input.capacity < 1 || input.capacity > 200) throw new Error('人数上限需要在 1 到 200 之间。');
    if (description.length < 10) throw new Error('活动说明至少 10 个字，写清楚路线和强度。');
    if (this.activities.some((activity) => activity.status !== 'ended' && activity.date === input.date && activity.startTime === input.startTime)) {
      throw new Error('同一天同一时间已有活动，先调整时间。');
    }
    const activity: ClubActivity = {
      id: 'act-' + Date.now(),
      title,
      tag: input.tag,
      date: input.date,
      startTime: input.startTime,
      meetingArea,
      meetingDetail: input.meetingDetail.trim(),
      distanceKm: input.distanceKm,
      durationMin: input.durationMin,
      capacity: input.capacity,
      coach,
      intensity: input.intensity.trim() || '按自己的节奏跑',
      description,
      preparation: input.preparation.split(/\r?\n|；|;/).map((item) => item.trim()).filter(Boolean),
      notes: input.notes.trim(),
      status: 'published',
      createdAt: nowIso(),
    };
    this.activities.unshift(activity);
    return clone(activity);
  }

  async publishActivity(id: string): Promise<ClubActivity> {
    await wait(160);
    const target = this.activities.find((activity) => activity.id === id);
    if (!target) throw new Error('活动不存在。');
    if (target.status !== 'draft') throw new Error('只有草稿可以发布。');
    if (target.date < today()) throw new Error('活动日期已过去，请先调整日期。');
    target.status = 'published';
    return clone(target);
  }

  async endActivity(id: string): Promise<ClubActivity> {
    await wait(180);
    const target = this.activities.find((activity) => activity.id === id);
    if (!target) throw new Error('活动不存在。');
    if (target.status !== 'published') throw new Error('只有报名中的活动可以结束。');
    target.status = 'ended';
    const reviewedAt = nowIso();
    this.activitySignups
      .filter((signup) => signup.activityId === id && signup.status === 'pending')
      .forEach((signup) => {
        signup.status = 'declined';
        signup.reviewedAt = reviewedAt;
        signup.reviewNote = '活动已结束，系统关闭未确认报名。';
      });
    return clone(target);
  }

  async recordGuardianConsent(id: string): Promise<ActivitySignup> {
    await wait(140);
    const signup = this.activitySignups.find((item) => item.id === id);
    if (!signup) throw new Error('报名记录不存在。');
    if (signup.guardianConsent) throw new Error('监护人同意已经登记过了。');
    if (signup.status !== 'pending') throw new Error('只有待确认的报名可以补登记监护人同意。');
    signup.guardianConsent = true;
    return clone(signup);
  }

  async checkinActivitySignup(id: string, result: 'attended' | 'absent'): Promise<ActivitySignup> {
    await wait(160);
    const signup = this.activitySignups.find((item) => item.id === id);
    if (!signup) throw new Error('报名记录不存在。');
    const activity = this.activities.find((item) => item.id === signup.activityId);
    if (!activity) throw new Error('活动不存在。');
    if (activity.status !== 'ended') throw new Error('活动结束后才能签到。');
    if (signup.status === 'pending' || signup.status === 'declined') {
      throw new Error('只有已确认报名的成员可以签到。');
    }
    if (signup.status === result) throw new Error(result === 'attended' ? '这位成员已经签到。' : '这位成员已经标记为未到。');
    signup.status = result;
    signup.checkinAt = nowIso();
    signup.checkinNote = result === 'attended' ? '赛后签到：已到场。' : '赛后签到：未到场。';
    return clone(signup);
  }

  async resetActivityCheckin(id: string): Promise<ActivitySignup> {
    await wait(140);
    const signup = this.activitySignups.find((item) => item.id === id);
    if (!signup) throw new Error('报名记录不存在。');
    const activity = this.activities.find((item) => item.id === signup.activityId);
    if (!activity) throw new Error('活动不存在。');
    if (activity.status !== 'ended') throw new Error('只有已结束的活动可以撤销签到。');
    if (signup.status !== 'attended' && signup.status !== 'absent') throw new Error('这条报名还没有签到记录。');
    signup.status = 'approved';
    signup.checkinAt = undefined;
    signup.checkinNote = undefined;
    return clone(signup);
  }

  async reviewActivitySignup(id: string, decision: 'approved' | 'declined', note?: string): Promise<ActivitySignup> {
    await wait(180);
    const signup = this.activitySignups.find((item) => item.id === id);
    if (!signup) throw new Error('报名记录不存在。');
    const activity = this.activities.find((item) => item.id === signup.activityId);
    if (!activity) throw new Error('活动不存在。');
    if (activity.status !== 'published') throw new Error('活动不在报名中，不能修改报名状态。');
    if (signup.status !== 'pending') throw new Error('这条报名已经处理过了。');
    if (decision === 'approved') {
      if (!signup.guardianConsent) throw new Error('监护人同意还没登记，先联系监护人补充，再确认报名。');
      const confirmed = this.activitySignups.filter((item) => item.activityId === activity.id && (item.status === 'approved' || item.status === 'attended' || item.status === 'absent')).length;
      if (confirmed >= activity.capacity) throw new Error('名额已满，无法再确认报名。');
    }
    signup.status = decision;
    signup.reviewedAt = nowIso();
    signup.reviewNote = note?.trim() || (decision === 'approved' ? '团长已确认，集合点已开放。' : '团长已取消报名。');
    return clone(signup);
  }
}

export const mockAdminRepository = new MockAdminRepository();
export const demoToday = today;
