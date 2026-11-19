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
  OverviewData,
  RunRecord,
} from '../types/models';

export interface AdminRepository {
  login(email: string, password: string): Promise<AdminUser>;
  getOverview(): Promise<OverviewData>;
  listMembers(): Promise<Member[]>;
  updateMemberStatus(id: string, status: MemberStatus): Promise<Member>;
  removeMember(id: string): Promise<Member>;
  resetMemberPassword(id: string): Promise<string>;
  listInvites(): Promise<InviteCode[]>;
  createInvite(input: NewInviteInput): Promise<InviteCode>;
  disableInvite(id: string): Promise<InviteCode>;
  listAnnouncements(): Promise<Announcement[]>;
  createAnnouncement(input: NewAnnouncementInput): Promise<Announcement>;
  updateAnnouncementStatus(id: string, status: AnnouncementStatus): Promise<Announcement>;
  deleteAnnouncement(id: string): Promise<void>;
  listChallenges(): Promise<Challenge[]>;
  createChallenge(input: NewChallengeInput): Promise<Challenge>;
  endChallenge(id: string): Promise<Challenge>;
  listRecords(): Promise<RunRecord[]>;
}
