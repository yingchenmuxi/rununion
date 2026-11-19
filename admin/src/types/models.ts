export type MemberStatus = 'pending' | 'active' | 'rejected' | 'removed';
export type MemberRole = 'owner' | 'member';

export interface Member {
  id: string;
  name: string;
  username: string;
  grade: string;
  gender: '男' | '女';
  status: MemberStatus;
  role: MemberRole;
  joinedAt: string;
  lastActiveAt: string;
  weeklyKm: number;
  totalKm: number;
  note?: string;
}

export type InviteStatus = 'active' | 'expired' | 'disabled';

export interface InviteCode {
  id: string;
  code: string;
  note: string;
  createdAt: string;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  status: InviteStatus;
}

export type AnnouncementStatus = 'draft' | 'published';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  status: AnnouncementStatus;
  pinned: boolean;
  author: string;
  createdAt: string;
  publishedAt?: string;
}

export type ChallengeStatus = 'upcoming' | 'active' | 'ended';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  targetKm: number;
  startAt: string;
  endAt: string;
  status: ChallengeStatus;
  participantCount: number;
  completedCount: number;
  clubProgressKm: number;
}

export type RecordVisibility = 'club' | 'private' | 'public';
export type RecordSource = 'manual' | 'import' | 'activity';

export interface RunRecord {
  id: string;
  memberId: string;
  memberName: string;
  date: string;
  distanceKm: number;
  durationMin: number;
  pace: string;
  note: string;
  visibility: RecordVisibility;
  createdAt: string;
  clubId?: string;
  clubName?: string;
  source?: RecordSource;
}

export interface OverviewStats {
  pendingMembers: number;
  activeMembers: number;
  weeklyActive: number;
  weeklyKm: number;
  monthlyKm: number;
  activeChallenges: number;
}

export interface OverviewActivity {
  id: string;
  type: 'member' | 'run' | 'challenge' | 'announcement';
  title: string;
  detail: string;
  time: string;
}

export interface OverviewData {
  stats: OverviewStats;
  pending: Member[];
  activities: OverviewActivity[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'platform';
  clubName: string;
  clubId?: string;
  title?: string;
}

export interface NewInviteInput {
  note: string;
  maxUses: number;
  expiresInDays: number;
}

export interface NewAnnouncementInput {
  title: string;
  content: string;
  pinned: boolean;
}

export interface NewChallengeInput {
  title: string;
  description: string;
  targetKm: number;
  startAt: string;
  endAt: string;
}

export type PlatformClubStatus = 'active' | 'pending' | 'paused' | 'rejected';
export type ClubKind = 'school' | 'community';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface PlatformClub {
  id: string;
  name: string;
  school: string;
  province: string;
  city: string;
  kind: ClubKind;
  status: PlatformClubStatus;
  ownerName: string;
  ownerTitle: string;
  ownerPhone: string;
  memberCount: number;
  weeklyKm: number;
  totalKm: number;
  createdAt: string;
  verified: boolean;
  riskLevel: RiskLevel;
  intro: string;
  gradeOptions: string[];
  guardianConsent: boolean;
}

export type PlatformUserStatus = 'active' | 'pending' | 'suspended' | 'left';
export type PlatformAgeGroup = '14–15' | '16–17' | '18–20' | '未填写';

export interface PlatformUser {
  id: string;
  name: string;
  username: string;
  clubId: string;
  clubName: string;
  grade: string;
  ageGroup: PlatformAgeGroup;
  gender: '男' | '女' | '未填写';
  role: 'owner' | 'member';
  status: PlatformUserStatus;
  joinedAt: string;
  lastActiveAt: string;
  weeklyKm: number;
  totalKm: number;
  guardianConsent: boolean;
  riskFlags: string[];
}

export type PlatformContentType = 'announcement' | 'article' | 'activity' | 'challenge';
export type PlatformContentStatus = 'published' | 'review' | 'draft' | 'offline';

export interface PlatformContentItem {
  id: string;
  type: PlatformContentType;
  title: string;
  summary: string;
  clubId: string;
  clubName: string;
  author: string;
  status: PlatformContentStatus;
  createdAt: string;
  stats: string;
}

export type PlatformReportStatus = 'pending' | 'resolved' | 'dismissed';
export type PlatformReportTarget = 'user' | 'club' | 'content' | 'record';

export interface PlatformReport {
  id: string;
  targetType: PlatformReportTarget;
  targetId: string;
  targetName: string;
  clubId: string;
  clubName: string;
  reason: string;
  detail: string;
  reporter: string;
  createdAt: string;
  status: PlatformReportStatus;
  priority: 'high' | 'normal';
  resolution?: string;
}

export type PlatformAccountRole = 'super' | 'ops';
export type PlatformAccountStatus = 'active' | 'disabled';

export interface PlatformAccount {
  id: string;
  name: string;
  email: string;
  role: PlatformAccountRole;
  status: PlatformAccountStatus;
  lastLoginAt: string;
  createdAt: string;
}

export interface PlatformAuditLog {
  id: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  createdAt: string;
  ip: string;
}

export interface PlatformWeeklyPoint {
  label: string;
  km: number;
}

export interface PlatformCityStat {
  city: string;
  clubs: number;
  users: number;
}

export interface PlatformOverviewActivity {
  id: string;
  type: 'club' | 'user' | 'content' | 'report' | 'system';
  title: string;
  detail: string;
  time: string;
}

export interface PlatformOverviewData {
  clubs: number;
  activeClubs: number;
  users: number;
  weeklyKm: number;
  pendingClubs: number;
  pendingReports: number;
  pendingUsers: number;
  highRiskReports: number;
  pendingClubList: PlatformClub[];
  pendingReportList: PlatformReport[];
  weeklyTrend: PlatformWeeklyPoint[];
  cities: PlatformCityStat[];
  activities: PlatformOverviewActivity[];
}

export interface ClubSettingsInput {
  ownerTitle: string;
  gradeOptions: string[];
  guardianConsent: boolean;
}

export interface RecordUpdateInput {
  date: string;
  distanceKm: number;
  durationMin: number;
  note: string;
  visibility: RecordVisibility;
}

export interface NewPlatformAccountInput {
  name: string;
  email: string;
  role: PlatformAccountRole;
}

export type ClubActivityStatus = 'draft' | 'published' | 'ended';
export type ClubActivityTag = '轻松跑' | '训练' | '同城' | '公益';
export type ActivitySignupStatus = 'pending' | 'approved' | 'declined' | 'attended';

export interface ClubActivity {
  id: string;
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
  preparation: string[];
  notes: string;
  status: ClubActivityStatus;
  createdAt: string;
}

export interface ClubActivitySummary extends ClubActivity {
  signupCount: number;
  pendingCount: number;
  confirmedCount: number;
}

export interface ActivitySignup {
  id: string;
  activityId: string;
  memberId: string;
  memberName: string;
  grade: string;
  gender: '男' | '女';
  guardianName: string;
  guardianPhone: string;
  guardianConsent: boolean;
  note: string;
  status: ActivitySignupStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface NewActivityInput {
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
