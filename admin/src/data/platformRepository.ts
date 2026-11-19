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

export interface PlatformRepository {
  getOverview(): Promise<PlatformOverviewData>;
  listClubs(): Promise<PlatformClub[]>;
  getClub(id: string): Promise<PlatformClub | null>;
  updateClubStatus(id: string, status: PlatformClubStatus): Promise<PlatformClub>;
  updateClubSettings(id: string, input: ClubSettingsInput): Promise<PlatformClub>;
  listUsers(): Promise<PlatformUser[]>;
  getUser(id: string): Promise<PlatformUser | null>;
  updateUserStatus(id: string, status: PlatformUserStatus): Promise<PlatformUser>;
  listContent(): Promise<PlatformContentItem[]>;
  updateContentStatus(id: string, status: PlatformContentStatus): Promise<PlatformContentItem>;
  listReports(): Promise<PlatformReport[]>;
  resolveReport(id: string, resolution: string): Promise<PlatformReport>;
  dismissReport(id: string, resolution?: string): Promise<PlatformReport>;
  listAccounts(): Promise<PlatformAccount[]>;
  createAccount(input: NewPlatformAccountInput): Promise<PlatformAccount>;
  toggleAccountStatus(id: string): Promise<PlatformAccount>;
  listLogs(): Promise<PlatformAuditLog[]>;
  listRecords(): Promise<RunRecord[]>;
  updateRecord(id: string, input: RecordUpdateInput): Promise<RunRecord>;
}
