export const colors = {
  page: '#E9E4D9',
  bg: '#F7F4EC',
  card: '#FFFFFF',
  ink: '#14201B',
  inkSoft: '#3D4B44',
  muted: '#74817A',
  line: '#E6E0D5',
  brand: '#0E5A4A',
  brandDeep: '#0A3F34',
  brandSoft: '#E3EFE9',
  accent: '#E86F51',
  accentSoft: '#FBE9E3',
  gold: '#B98A2E',
  goldSoft: '#F6EDD6',
  white: '#FFFFFF',
  danger: '#B8402C',
} as const;

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const shadow = {
  card: {
    shadowColor: '#14201B',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
};

export const mock = {
  user: { name: '演示同学', initial: '演', school: '康福外国语学校', grade: '高一', level: '新跑者' },
  week: { km: 0, goal: 25, streak: 0, month: 0, rank: 0 },
  club: { name: '康福外国语学校长跑社', short: '康福长跑社', members: 0, weekKm: 0, activities: 0, city: '北京' },
  activities: [] as { day: string; time: string; title: string; meta: string; tag: string }[],
  runs: [] as { date: string; title: string; distance: string; time: string; pace: string }[],
  pbs: [] as { distance: string; result: string; note: string }[],
  badges: [] as { label: string; tone: string }[],
  teamBoard: [] as { rank: number; name: string; km: string; trend: string }[],
  knowledge: { title: '第一次跑 5 公里，怎么不岔气？', body: '先慢后快，呼吸跟着步频走；岔气时降速、按压疼痛侧、把呼吸拉长。', meta: '12 位跑者收藏' },
} as const;
