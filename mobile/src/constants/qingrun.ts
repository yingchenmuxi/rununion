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
  user: { name: '林小满', initial: '林', school: '康福外国语学校', grade: '高一', level: '青苗跑者 Lv.3' },
  week: { km: 18.6, goal: 25, streak: 3, month: 42.3, rank: 12 },
  club: { name: '康福外国语学校长跑社', short: '康福长跑社', members: 128, weekKm: 326, activities: 12, city: '北京' },
  activities: [
    { day: '周六', time: '07:00', title: '校园环湖 5K', meta: '学校东门集合 · 24 人已报名', tag: '轻松跑' },
    { day: '周日', time: '16:30', title: '操场间歇入门', meta: '学校田径场 · 18 人已报名', tag: '训练' },
  ],
  runs: [
    { date: '11 月 14 日', title: '校园环湖', distance: '5.2 km', time: '28:40', pace: "5'31\"/km" },
    { date: '11 月 12 日', title: '操场慢跑', distance: '3.0 km', time: '18:20', pace: "6'07\"/km" },
    { date: '11 月 09 日', title: '周末拉练', distance: '8.4 km', time: '49:10', pace: "5'51\"/km" },
  ],
  pbs: [
    { distance: '1500m', result: '5:12', note: '校运会' },
    { distance: '5K', result: '24:30', note: '本月' },
    { distance: '10K', result: '52:08', note: '上月' },
    { distance: '半马', result: '待记录', note: '下一站' },
    { distance: '全马', result: '待记录', note: '慢慢来' },
  ],
  badges: [
    { label: '初次开跑', tone: 'green' },
    { label: '连续三周', tone: 'gold' },
    { label: '5K 破 PB', tone: 'coral' },
  ],
  teamBoard: [
    { rank: 1, name: '高一（3）班', km: '86.4 km', trend: '+12%' },
    { rank: 2, name: '高二（1）班', km: '72.1 km', trend: '+8%' },
    { rank: 3, name: '高一（7）班', km: '65.8 km', trend: '+5%' },
    { rank: 4, name: '高一（2）班', km: '58.2 km', trend: '+3%' },
  ],
  knowledge: { title: '第一次跑 5 公里，怎么不岔气？', body: '先慢后快，呼吸跟着步频走；岔气时降速、按压疼痛侧、把呼吸拉长。', meta: '12 位跑者收藏' },
} as const;
