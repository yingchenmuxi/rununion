import type { RunRecord } from '../types/models';

const API_BASE = ((import.meta.env.VITE_ACTIVITY_API as string | undefined) || 'http://127.0.0.1:8090/api').replace(/\/$/, '');

export const recordsApi = {
  async listRecords(): Promise<RunRecord[]> {
    const response = await fetch(API_BASE + '/runs');
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((body as { error?: string }).error || '跑步记录加载失败，请确认演示数据服务已启动。');
    }
    return body as RunRecord[];
  },
};
