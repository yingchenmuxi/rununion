import type { AdminRepository } from './repository';
import type { PlatformRepository } from './platformRepository';
import { mockAdminRepository } from './mockRepository';
import { mockPlatformRepository } from './mockPlatformRepository';

// 接入 PocketBase 时，只需要在这里替换成 pocketbaseRepository，
// 页面不需要知道数据来自示例数据还是真实数据库。
export const repository: AdminRepository = mockAdminRepository;
export const platformRepository: PlatformRepository = mockPlatformRepository;
