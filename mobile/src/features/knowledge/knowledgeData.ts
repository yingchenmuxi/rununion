export const KNOWLEDGE_CATEGORIES = ['入门', '呼吸', '配速', '防伤', '营养', '恢复', '比赛', '身体'] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export type KnowledgeArticle = {
  id: string;
  category: KnowledgeCategory;
  title: string;
  summary: string;
  minutes: number;
  level: '入门' | '进阶';
  featured?: boolean;
  body: string[];
  checklist: string[];
  warning?: string;
  related: string[];
};

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: 'breathing',
    category: '呼吸',
    title: '第一次跑 5 公里，怎么不岔气？',
    summary: '先慢后快，把呼吸拉长；岔气时降速，不要硬撑。',
    minutes: 4,
    level: '入门',
    featured: true,
    body: [
      '岔气通常和起跑太快、呼吸太浅、饭后不久运动有关。前 1 公里用能完整说话的强度，鼻子吸气、嘴巴呼气，步子小一点。',
      '呼吸跟着步频走，不必强行数四步一吸。感觉侧腹发紧时先降速，手按住疼的一侧，把呼气拉长；一两分钟不缓解就停下来走。',
      '不要为了配速憋气。跑完慢走 3 分钟，等呼吸平稳再坐下。',
    ],
    checklist: ['起跑前 1 公里能说完整句子', '岔气时先降速，拉长呼气', '持续疼或胸闷立即停止'],
    warning: '如果胸痛、头晕、恶心，或疼痛超过 10 分钟，停止运动并找老师或家长。',
    related: ['warmup', 'easy-pace'],
  },
  {
    id: 'warmup',
    category: '入门',
    title: '跑前 6 分钟热身，比静态拉伸更重要',
    summary: '让身体先热起来，再进入跑步节奏。',
    minutes: 3,
    level: '入门',
    body: [
      '静态拉伸更适合跑后。跑前用快走、慢跑、开合跳把心率和体温提起来，关节也更灵活。',
      '6 分钟流程：快走 1 分钟；慢跑 2 分钟；高抬腿、后踢腿各 30 秒；踝关节绕环 30 秒；最后 1 分钟轻松跑。',
      '热身做到身体发热、呼吸略快即可，不要做到腿软。天冷时多穿一层，热身时间可以再长一点。',
    ],
    checklist: ['先快走再慢跑，别一上来就冲', '活动脚踝、膝盖和髋部', '身体发热即可，不追求累'],
    warning: '有关节旧伤时，先问校医或教练适合你的热身动作。',
    related: ['breathing', 'easy-pace'],
  },
  {
    id: 'easy-pace',
    category: '配速',
    title: '怎么判断今天跑得够慢？',
    summary: '能用鼻子呼吸、能说短句，就是合适的有氧强度。',
    minutes: 4,
    level: '入门',
    body: [
      '轻松跑不是“越快越有效”。青少年日常跑量里，大部分应该是能聊天的强度，剩下的小部分再用来做节奏跑。',
      '自测很简单：能连续说 3 到 5 个字不喘；呼吸可以只用鼻子，或鼻吸口呼；跑完 10 分钟能恢复。',
      '如果每次都要拼尽全力，第二天的训练质量会下降。把“慢”当作训练的一部分，而不是偷懒。',
    ],
    checklist: ['起跑前 5 分钟刻意放慢', '能用短句聊天，不喘到说不出话', '跑完 10 分钟内呼吸恢复'],
    warning: '出现头晕、心悸或胸闷时立即停止，不要用“再坚持一下”压过去。',
    related: ['breathing', 'rest'],
  },
  {
    id: 'knee',
    category: '防伤',
    title: '膝盖外侧疼，先别硬撑',
    summary: '突然加量容易诱发外侧疼痛，先减量，再练臀中肌。',
    minutes: 5,
    level: '进阶',
    body: [
      '膝盖外侧疼，尤其下坡或跑到一定距离后出现，常见于跑量突然增加、路面不平、臀肌力量不足。',
      '先停跑 2 到 3 天，改成走路或骑车；局部冰敷 10 到 15 分钟；每天做侧抬腿、臀桥，每组 10 到 12 次。',
      '恢复跑步时从平时一半的距离开始，连续两次不疼再增加。不要一边疼一边加跑量。',
    ],
    checklist: ['先减量 2 到 3 天，不硬跑', '冰敷 10 到 15 分钟，隔布避免冻伤', '每天做侧抬腿和臀桥'],
    warning: '出现肿胀、膝盖卡住、夜间痛，或一周仍不缓解，去运动医学科或骨科。',
    related: ['easy-pace', 'rest'],
  },
  {
    id: 'shoes',
    category: '入门',
    title: '第一双跑鞋，不用买最贵的',
    summary: '合脚、缓震够用、脚趾前留一点空间，比价格重要。',
    minutes: 3,
    level: '入门',
    body: [
      '跑鞋最重要的是合脚和舒适，不是价格。试穿时脚趾前留约一个拇指宽，脚背不被压住。',
      '下午脚会略微肿胀，尽量下午试鞋，并穿跑步袜试。鞋带系好后，脚后跟应该稳定但不勒。',
      '跑鞋寿命通常在 500 到 800 公里。鞋底磨平、缓震明显变硬，就该考虑更换。',
    ],
    checklist: ['下午试鞋，穿跑步袜', '脚趾前留约一个拇指宽', '新鞋先短距离试跑，不直接上长距离'],
    warning: '不要穿新鞋直接跑长距离或参加比赛，先给脚适应的时间。',
    related: ['warmup', 'easy-pace'],
  },
  {
    id: 'nutrition',
    category: '营养',
    title: '跑前吃什么，跑后补什么',
    summary: '跑前 1 到 2 小时吃点易消化碳水，跑后补水和蛋白质。',
    minutes: 4,
    level: '入门',
    body: [
      '跑前 1 到 2 小时，可以吃香蕉、面包、粥等易消化的碳水。不要空腹跑长距离，也不要刚吃完就出门。',
      '跑后 30 到 60 分钟，补充水、碳水和蛋白质，例如牛奶、鸡蛋、酸奶、米饭。日常三餐比补剂更重要。',
      '青少年不需要能量胶或咖啡因来“提成绩”。如果天气热，跑前跑后都要小口多次喝水。',
    ],
    checklist: ['跑前 1 到 2 小时吃易消化碳水', '跑后先补水，再吃正餐', '不靠能量胶和咖啡因撑训练'],
    warning: '有食物过敏或肠胃问题，按医生和家长的安排来，不自行尝试补剂。',
    related: ['easy-pace', 'rest'],
  },
  {
    id: 'rest',
    category: '恢复',
    title: '休息日也是训练',
    summary: '睡眠和轻松日，让身体把训练变成能力。',
    minutes: 3,
    level: '入门',
    body: [
      '训练刺激加上恢复，才会变成能力。每周至少安排 1 到 2 天完全不跑，或者只散步、做轻拉伸。',
      '睡眠不足时，先把跑量减半。连续两天觉得疲劳、静息心率明显升高，就安排轻松日，不要硬顶。',
      '拉伸、泡沫轴、热水澡可以帮助放松，但不能替代睡眠。把睡觉当成训练计划的一部分。',
    ],
    checklist: ['每周至少 1 到 2 天不跑', '睡不够时主动减量', '连续疲劳两天就安排轻松日'],
    warning: '持续疲劳、体重异常变化或女生月经紊乱，告诉家长并去医院评估。',
    related: ['knee', 'easy-pace'],
  },
  {
    id: 'race',
    category: '比赛',
    title: '第一次校运会 1500 米怎么跑',
    summary: '前 400 米别冲，最后 300 米再提速。',
    minutes: 4,
    level: '进阶',
    body: [
      '1500 米不是全程冲刺。起跑抢到内道后，用能控制的节奏跑前 800 米，不要被旁边的人带乱。',
      '中间 400 米保持步频，最后 300 米逐渐加速。变道前先看身后，不要突然横切。',
      '赛前 2 小时吃饭，提前 40 分钟热身；赛后慢走几分钟，不要立刻坐下或躺下。',
    ],
    checklist: ['前 400 米不抢冲', '最后 300 米再逐步加速', '赛前 2 小时吃饭，提前 40 分钟热身'],
    warning: '比赛当天发烧、胸闷、腹泻或明显不适，不要上场，告诉老师和家长。',
    related: ['warmup', 'breathing'],
  },
  {
    id: 'period',
    category: '身体',
    title: '女生跑步的生理期安排',
    summary: '不硬撑，按身体感觉调整强度和距离。',
    minutes: 5,
    level: '入门',
    body: [
      '生理期可以运动，但不需要按原计划硬练。痛经明显、头晕或量大时，改成散步、拉伸或休息。',
      '如果状态可以，轻松跑 20 到 30 分钟通常没问题。注意保暖、补水和及时更换卫生用品。',
      '记录自己的周期和感受，找到规律。训练计划应该跟着身体调整，而不是让身体去迁就计划。',
    ],
    checklist: ['先感受状态，再决定跑不跑', '不舒服就改成散步或休息', '注意保暖、补水和及时更换'],
    warning: '严重痛经、异常出血或持续头晕，告诉家长并及时就医。',
    related: ['rest', 'easy-pace'],
  },
];

export const FEATURED_ARTICLE = KNOWLEDGE_ARTICLES.find((article) => article.featured) ?? KNOWLEDGE_ARTICLES[0];

export function getKnowledgeArticle(id: string | string[] | undefined) {
  const key = Array.isArray(id) ? id[0] : id;
  return KNOWLEDGE_ARTICLES.find((article) => article.id === key);
}
