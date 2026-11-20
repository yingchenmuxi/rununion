export type CharityEntry = {
  id: string;
  date: string;
  title: string;
  item: string;
  quantity: string;
  source: string;
  note: string;
  status: '已落实' | '进行中' | '待确认';
};

export const CHARITY_SUMMARY = {
  shoes: 12,
  slots: 8,
  coachHours: 36,
  goalShoes: 20,
  clubs: 4,
};

export const CHARITY_ENTRIES: CharityEntry[] = [
  {
    id: 'ch-001', date: '11 月 16 日', title: '校园环湖 5K 跑鞋支持', item: '跑鞋', quantity: '6 双',
    source: '本地运动品牌（演示）', note: '按鞋码登记后由团长统一发放，不经过学生账户。', status: '已落实',
  },
  {
    id: 'ch-002', date: '11 月 09 日', title: '区级青少年 5K 参赛名额', item: '名额', quantity: '4 个',
    source: '青跑团公益组', note: '含报名费与往返交通，监护人知情后使用。', status: '已落实',
  },
  {
    id: 'ch-003', date: '10 月 26 日', title: '周末训练陪伴', item: '教练时间', quantity: '18 小时',
    source: '康福长跑社教练组', note: '按训练场次记录，不折现、不发放现金。', status: '已落实',
  },
  {
    id: 'ch-004', date: '11 月 22 日', title: '冬训外套与反光背心', item: '装备', quantity: '8 套',
    source: '校友捐赠（演示）', note: '正在统计尺码，预计下周随训练发放。', status: '进行中',
  },
  {
    id: 'ch-005', date: '12 月 06 日', title: '期末接力赛参赛名额', item: '名额', quantity: '4 个',
    source: '待确认', note: '等赛事方确认名额后再登记，不提前承诺。', status: '待确认',
  },
];

export const CHARITY_RULES = [
  '第一版不募集现金，只接收跑鞋、名额和教练时间。',
  '受助学生使用化名，账本不公开学校、住址和联系方式。',
  '每笔物资记录来源、去向和经办跑团，填错可以更正并留痕。',
];
