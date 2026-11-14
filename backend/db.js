// ============================================================
// 数据库模块：负责创建 SQLite 数据库文件和所有数据表
//
// SQLite 是"单文件数据库"：整个数据库就是 data/running_club.db 这一个文件
// 好处：不用安装任何数据库软件，备份 = 复制这个文件
// 说明：node:sqlite 是 Node.js 22.13+ 自带的模块，无需额外安装任何东西
// ============================================================
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

// data 目录不存在就自动创建
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// 打开数据库（文件不存在会自动创建）
const db = new DatabaseSync(path.join(dataDir, 'running_club.db'));

// 建表：加 IF NOT EXISTS，保证重复启动也不会报错
db.exec(`
  -- 用户表：school_id / club_id 是为"多学校、多社团"扩展预留的字段
  -- 现在所有用户默认都属于 1号学校、1号社团
  -- 登录账号 = 手机号（唯一）；昵称只用来显示，可以重复
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,   -- 用户编号，自动递增
    school_id     INTEGER NOT NULL DEFAULT 1,          -- 预留：属于哪个学校
    club_id       INTEGER NOT NULL DEFAULT 1,          -- 预留：属于哪个社团
    phone         TEXT    NOT NULL UNIQUE,             -- 手机号（登录账号，不允许重复）
    nickname      TEXT    NOT NULL,                    -- 昵称（显示用，允许重复）
    gender        TEXT    NOT NULL DEFAULT '男',        -- 性别：男 / 女
    password_hash TEXT    NOT NULL,                    -- 加密后的密码（不存明文）
    role          TEXT    NOT NULL DEFAULT 'member',   -- 角色：member=社员 / president=社长
    created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  -- 跑步记录表：一条记录 = 某个人某天跑的一次步
  -- 用时按"秒"存整数，方便以后算配速、排序
  CREATE TABLE IF NOT EXISTS runs (
    id               INTEGER PRIMARY KEY AUTOINCREMENT, -- 记录编号
    user_id          INTEGER NOT NULL,                  -- 这条记录是谁的（对应用户表的 id）
    run_date         TEXT    NOT NULL,                  -- 跑步日期，格式 YYYY-MM-DD
    distance_km      REAL    NOT NULL,                  -- 距离（公里）
    duration_seconds INTEGER NOT NULL,                  -- 用时（秒）
    created_at       TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  -- 登录凭证表：记录"哪个 token 属于哪个用户"
  -- 用户登录成功后后端发一个 token（通行证），之后每次请求都带上它来证明身份
  CREATE TABLE IF NOT EXISTS tokens (
    token      TEXT PRIMARY KEY,                       -- 通行证字符串
    user_id    INTEGER NOT NULL,                       -- 属于哪个用户
    created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  -- ============ 学校 / 社团表：支持"多学校、多社团"扩展 ============
  -- 学校表：社长注册时创建，记录学校名称和所在省市
  CREATE TABLE IF NOT EXISTS schools (
    id         INTEGER PRIMARY KEY,                    -- 学校编号
    name       TEXT NOT NULL,                          -- 学校名称
    province   TEXT NOT NULL DEFAULT '',               -- 所在省
    city       TEXT NOT NULL DEFAULT '',               -- 所在市
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS clubs (
    id        INTEGER PRIMARY KEY,
    school_id INTEGER NOT NULL,   -- 这个社团属于哪个学校
    name      TEXT NOT NULL       -- 社团名称
  );

  -- ============ 6 大功能模块新增表 ============

  -- 跑步知识文章表：管理员发布，所有人可读
  -- category 用来分组（基础 / 训练 / 装备 / 伤病 等），方便前端分类展示
  CREATE TABLE IF NOT EXISTS articles (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    category   TEXT NOT NULL DEFAULT '基础知识',
    title      TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  -- 跑步计划表：每个用户自己的训练计划
  -- goal_type 决定计划类型与进度算法，goal_data 存该类型的专属参数（JSON 字符串）
  -- 类型：volume 跑量 / speed 速度 / habit 习惯 / race 赛事 / weight 体重
  CREATE TABLE IF NOT EXISTS plans (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,                  -- 计划属于谁
    title      TEXT NOT NULL,                     -- 计划名称，例如"备战半马"
    target_km  REAL NOT NULL,                     -- 目标距离（公里）；体重计划存 0
    weeks      INTEGER NOT NULL,                  -- 周期（周）
    start_date TEXT NOT NULL,                     -- 开始日期 YYYY-MM-DD
    intensity  TEXT NOT NULL DEFAULT '中等',       -- 强度：低 / 中等 / 高
    note       TEXT NOT NULL DEFAULT '',          -- 备注
    goal_type  TEXT NOT NULL DEFAULT 'volume',    -- 目标类型（见上方注释）
    goal_data  TEXT NOT NULL DEFAULT '{}',        -- 类型专属参数（JSON）
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  -- 计划模板表：预设的训练计划模板，管理员可增删，用户一键套用
  CREATE TABLE IF NOT EXISTS plan_templates (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,                    -- 模板名称
    description TEXT NOT NULL DEFAULT '',         -- 一句话说明适合谁
    goal_type   TEXT NOT NULL DEFAULT 'volume',   -- 目标类型（同 plans.goal_type）
    goal_data   TEXT NOT NULL DEFAULT '{}',       -- 模板参数（JSON，含周课表 schedule）
    weeks       INTEGER NOT NULL DEFAULT 4,       -- 周期（周）
    target_km   REAL NOT NULL DEFAULT 0,          -- 目标总跑量
    intensity   TEXT NOT NULL DEFAULT '中等',     -- 建议强度
    note        TEXT NOT NULL DEFAULT '',         -- 模板默认备注
    sort_order  INTEGER NOT NULL DEFAULT 0,       -- 展示顺序（小的在前）
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  -- 体重记录表：体重目标计划用，每人每天最多一条（重复记录覆盖旧的）
  CREATE TABLE IF NOT EXISTS weight_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    log_date   TEXT NOT NULL,                     -- 记录日期 YYYY-MM-DD
    weight_kg  REAL NOT NULL,                     -- 体重（公斤）
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_weight_user_date ON weight_logs(user_id, log_date);

  -- 静息心率记录表：个人中心每日填写，每人每天最多一条（重复记录覆盖旧的）
  CREATE TABLE IF NOT EXISTS resting_heart_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    log_date   TEXT NOT NULL,                     -- 记录日期 YYYY-MM-DD
    heart_rate INTEGER NOT NULL,                  -- 静息心率（次/分）
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_rhr_user_date ON resting_heart_logs(user_id, log_date);

  -- 社团公告表：社长发布，本社团所有人可读
  CREATE TABLE IF NOT EXISTS announcements (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    club_id    INTEGER NOT NULL,                  -- 属于哪个社团
    user_id    INTEGER NOT NULL,                  -- 发布人
    title      TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  -- 社团任务表：社长发布训练任务，本社团所有人可读
  CREATE TABLE IF NOT EXISTS club_tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    club_id    INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    title      TEXT NOT NULL,
    content    TEXT NOT NULL,
    deadline   TEXT NOT NULL DEFAULT '',          -- 截止日期 YYYY-MM-DD，可空
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  -- 约跑活动表：本社团任何成员都可以发起，社团内所有人可报名
  CREATE TABLE IF NOT EXISTS club_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    club_id    INTEGER NOT NULL,                  -- 属于哪个社团
    user_id    INTEGER NOT NULL,                  -- 发起人
    title      TEXT NOT NULL,                     -- 活动名称，例如"周末操场 5 公里"
    event_date TEXT NOT NULL,                     -- 活动日期 YYYY-MM-DD
    event_time TEXT NOT NULL DEFAULT '',          -- 集合时间，例如"07:00"（可空）
    place      TEXT NOT NULL DEFAULT '',          -- 集合地点
    note       TEXT NOT NULL DEFAULT '',          -- 补充说明（配速、距离等）
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  -- 活动报名表：一条 = 某个成员报名了某个活动
  -- (event_id, user_id) 唯一索引保证同一个人不会重复报名（取消报名则删除该行）
  CREATE TABLE IF NOT EXISTS event_signups (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id   INTEGER NOT NULL,                  -- 对应 club_events.id
    user_id    INTEGER NOT NULL,                  -- 报名的用户
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_event_user ON event_signups(event_id, user_id);

  -- ============ 详细跑步数据表：心率 / 触地时间 / 垂直振幅 / 步幅 / 步频 ============
  -- 一条 runs 记录最多对应一条详细数据（1对1），所有指标都可空——填几个算几个
  -- 数据来源：Keep 手表页截图识别 或 手动输入
  CREATE TABLE IF NOT EXISTS run_details (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id              INTEGER NOT NULL UNIQUE,      -- 关联 runs.id，一条跑步记录最多一条详细数据
    heart_rate          INTEGER,                      -- 平均心率（次/分），NULL=没填
    ground_contact_ms   INTEGER,                      -- 触地时间（毫秒），NULL=没填
    vertical_oscillation_cm REAL,                     -- 垂直振幅（厘米），NULL=没填
    stride_length_cm    REAL,                         -- 步幅（厘米），NULL=没填
    cadence_spm         INTEGER,                      -- 步频（步/分钟），NULL=没填
    created_at          TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
  );

  -- ============ 课表打卡表（N3）：跑完在课表上打勾 ============
  -- 一条 = 某用户某周某一天(week_no, day)的训练已打卡
  -- 打卡只是"完成确认"，不影响计划进度（进度仍由 runs 表自动计算）
  -- 唯一索引 (plan_id, week_no, day) 防止同一节课重复打卡
  CREATE TABLE IF NOT EXISTS plan_checkins (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id     INTEGER NOT NULL,                 -- 对应 plans.id
    user_id     INTEGER NOT NULL,                 -- 打卡人（冗余，方便按人清理）
    week_no     INTEGER NOT NULL,                 -- 第几周（1 起）
    day         INTEGER NOT NULL,                 -- 星期几（1=周一 ... 7=周日）
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_checkin ON plan_checkins(plan_id, week_no, day);
  CREATE INDEX IF NOT EXISTS idx_plan_checkin_user ON plan_checkins(user_id);
`);

// 计划模板预置数据：INSERT OR IGNORE + 固定 id，重复启动不会重复插入
// 管理员可在后台删除后重建，id 冲突时自动跳过
db.exec(`
  INSERT OR IGNORE INTO plan_templates (id, title, description, goal_type, goal_data, weeks, target_km, intensity, note, sort_order) VALUES
  (1, '21 天习惯养成挑战', '每天跑 2 公里，连续打卡 21 天，专为纯新手设计', 'habit',
   '{"freq_type":"streak","freq_value":21,"schedule":[{"day":1,"type":"轻松跑","km":2},{"day":2,"type":"轻松跑","km":2},{"day":3,"type":"轻松跑","km":2},{"day":4,"type":"轻松跑","km":2},{"day":5,"type":"轻松跑","km":2},{"day":6,"type":"轻松跑","km":2},{"day":7,"type":"轻松跑","km":2}]}',
   3, 42, '低', '连续 21 天每天至少跑 2 公里，跑不动可以快走，关键是别断', 1),
  (2, '隔天慢跑入门', '每周 3 次，跑走结合，4 周养成跑步习惯', 'habit',
   '{"freq_type":"week","freq_value":3,"schedule":[{"day":1,"type":"轻松跑","km":3},{"day":3,"type":"轻松跑","km":3},{"day":6,"type":"轻松跑","km":4}]}',
   4, 40, '低', '每周一/三/六各跑一次，跑不动就走跑结合，坚持 4 周', 2),
  (3, '5km 破 30 分钟', '已有 5km 基础，6 周冲击 30 分钟大关', 'speed',
   '{"distance_km":5,"target_seconds":1800,"schedule":[{"day":2,"type":"轻松跑","km":5},{"day":4,"type":"间歇","km":6},{"day":7,"type":"长距离","km":8}]}',
   6, 114, '中等', '间歇课表：6×400 米快 + 400 米慢；每周日长距离拉耐力', 3),
  (4, '5km 破 25 分钟', '配速 5:00 内，8 周系统进阶', 'speed',
   '{"distance_km":5,"target_seconds":1500,"schedule":[{"day":2,"type":"轻松跑","km":6},{"day":4,"type":"间歇","km":8},{"day":6,"type":"配速跑","km":5},{"day":7,"type":"长距离","km":10}]}',
   8, 232, '高', '需要已有 30 分内基础；间歇以 1km 重复跑为主', 4),
  (5, '10km 完赛计划', '从 5km 到 10km，8 周稳步加量', 'volume',
   '{"schedule":[{"day":2,"type":"轻松跑","km":5},{"day":4,"type":"配速跑","km":6},{"day":7,"type":"长距离","km":12}]}',
   8, 184, '中等', '周日长距离每周加 1 公里，从 8 公里加到 15 公里', 5),
  (6, '半马 16 周备战', '系统备战半程马拉松，月跑量 100+ 公里', 'race',
   '{"race_name":"半程马拉松","race_date":"","race_km":21.0975,"target_seconds":0,"weekly_km":25,"schedule":[{"day":2,"type":"轻松跑","km":6},{"day":4,"type":"配速跑","km":6},{"day":6,"type":"间歇","km":8},{"day":7,"type":"长距离","km":14}]}',
   16, 400, '高', '创建后请把比赛日期填进计划；赛前两周开始减量', 6),
  (7, '校运会 1000 米 6 周速成', '针对校运会 1000 米，速度与抗酸并重', 'speed',
   '{"distance_km":1,"target_seconds":0,"schedule":[{"day":2,"type":"间歇","km":5},{"day":4,"type":"轻松跑","km":4},{"day":6,"type":"配速跑","km":3}]}',
   6, 72, '中等', '间歇以 400m/600m 重复跑为主，目标成绩可自行填写', 7);
`);

// 老库升级：修正模板 6 的周课表（原课表 6+6+8+14=34km/周，与周跑量 25km 矛盾）
// 只在还是旧值时才更新，不影响管理员后续的增删操作
db.exec(`UPDATE plan_templates SET goal_data = '{"race_name":"半程马拉松","race_date":"","race_km":21.0975,"target_seconds":0,"weekly_km":25,"schedule":[{"day":2,"type":"轻松跑","km":5},{"day":4,"type":"配速跑","km":5},{"day":6,"type":"间歇","km":6},{"day":7,"type":"长距离","km":9}]}' WHERE id = 6 AND goal_data LIKE '%"km":14%';`);

// 新增模板 8-10（INSERT OR IGNORE：老库已有同 id 会自动跳过，重启即获得新模板）
// 补齐多样性：万米速度目标 / 体重减脂目标 / 全马赛事目标，覆盖全部五大类型
db.exec(`
  INSERT OR IGNORE INTO plan_templates (id, title, description, goal_type, goal_data, weeks, target_km, intensity, note, sort_order) VALUES
  (8, '万米破 60 分钟', '8 周冲击 10km 一小时大关，耐力速度并重', 'speed',
   '{"distance_km":10,"target_seconds":3600,"schedule":[{"day":2,"type":"轻松跑","km":6},{"day":4,"type":"配速跑","km":8},{"day":6,"type":"间歇","km":5},{"day":7,"type":"长距离","km":11}]}',
   8, 240, '中等', '目标配速 6:00/km；间歇以 800m × 5 组为主，组间慢跑 400m 恢复', 8),
  (9, '轻量减脂跑走 8 周', '跑走结合控制体重，每周 3-4 次低强度', 'weight',
   '{"start_kg":70,"target_kg":65,"schedule":[{"day":1,"type":"轻松跑","km":3},{"day":3,"type":"轻松跑","km":3},{"day":5,"type":"力量训练","km":0},{"day":6,"type":"轻松跑","km":4}]}',
   8, 0, '低', '模板体重仅为示例，套用后请改成自己的；配合饮食控制，每周减 0.25-0.5 kg 最健康', 9),
  (10, '全马 18 周完赛', '已有半马经验，系统备战全程马拉松', 'race',
   '{"race_name":"全程马拉松","race_date":"","race_km":42.195,"target_seconds":0,"weekly_km":40,"schedule":[{"day":2,"type":"轻松跑","km":8},{"day":4,"type":"配速跑","km":8},{"day":6,"type":"间歇","km":8},{"day":7,"type":"长距离","km":16}]}',
   18, 720, '高', '适合已完成半马者；长距离最高 32km，赛前 3 周逐步减量', 10);
`);

// 老库升级：模板 9 里的"交叉训练"统一改为"力量训练"（只在还是旧值时更新）
db.exec(`UPDATE plan_templates SET goal_data = replace(goal_data, '交叉训练', '力量训练') WHERE id = 9 AND goal_data LIKE '%交叉训练%';`);

// 旧数据库迁移：早期版本的 schools 表没有 province / city 两列
// CREATE TABLE IF NOT EXISTS 对已存在的表不会改结构，所以这里手动补列。
// 通过 PRAGMA 查看表里现有列，缺哪列就补哪列，重复启动不会报错。
const schoolColumns = db.prepare('PRAGMA table_info(schools)').all();
const hasProvince = schoolColumns.some((c) => c.name === 'province');
const hasCity = schoolColumns.some((c) => c.name === 'city');
const hasSchoolCreatedAt = schoolColumns.some((c) => c.name === 'created_at');
if (!hasProvince) {
  db.exec("ALTER TABLE schools ADD COLUMN province TEXT NOT NULL DEFAULT ''");
}
if (!hasCity) {
  db.exec("ALTER TABLE schools ADD COLUMN city TEXT NOT NULL DEFAULT ''");
}
if (!hasSchoolCreatedAt) {
  // SQLite ALTER TABLE ADD COLUMN 不支持非常量 DEFAULT，先用固定值占位
  db.exec("ALTER TABLE schools ADD COLUMN created_at TEXT NOT NULL DEFAULT ''");
  // 给已有行回填真实的创建时间（估算：用一个统一的时间）
  db.exec("UPDATE schools SET created_at = COALESCE(created_at, datetime('now','localtime')) WHERE created_at = ''");
}

// users 表迁移：加 avatar 列（存 emoji 字符，避免上传文件带来的复杂度）
// 用户可以在"个人中心"挑一个 emoji 当头像，没设置就用昵称第一个字
const userColumns = db.prepare('PRAGMA table_info(users)').all();
const hasAvatar = userColumns.some((c) => c.name === 'avatar');
if (!hasAvatar) {
  db.exec("ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT ''");
}

// plans 表迁移：加 目标类型 / 类型参数 两列（计划模块 2.0：五大目标类型）
// 首次迁移时清空旧版计划数据——旧计划没有类型信息，无法换算进度（已确认放弃旧数据）
const planColumns = db.prepare('PRAGMA table_info(plans)').all();
const hasGoalType = planColumns.some((c) => c.name === 'goal_type');
if (!hasGoalType) {
  db.exec("ALTER TABLE plans ADD COLUMN goal_type TEXT NOT NULL DEFAULT 'volume'");
  db.exec("ALTER TABLE plans ADD COLUMN goal_data TEXT NOT NULL DEFAULT '{}'");
  db.exec('DELETE FROM plans');
}

// clubs 表迁移：社团名片字段（简介 / 训练时间 / 训练地点 / 联系方式）
// 老库没有这些列，通过 PRAGMA 检查后按需补齐，重复启动不会报错
const clubColumns = db.prepare('PRAGMA table_info(clubs)').all();
const clubExtraCols = [
  ['intro', "TEXT NOT NULL DEFAULT ''"],
  ['training_time', "TEXT NOT NULL DEFAULT ''"],
  ['training_place', "TEXT NOT NULL DEFAULT ''"],
  ['contact', "TEXT NOT NULL DEFAULT ''"],
  ['created_at', "TEXT NOT NULL DEFAULT ''"],
];
for (const [col, def] of clubExtraCols) {
  if (!clubColumns.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE clubs ADD COLUMN ${col} ${def}`);
  }
}
// clubs.created_at 迁移：回填已有行的时间
if (!clubColumns.some((c) => c.name === 'created_at')) {
  db.exec("UPDATE clubs SET created_at = datetime('now','localtime') WHERE created_at = ''");
}

// articles 表迁移：加 摘要 / 封面图 / 标签 / 附件 列
// 用于升级版"跑步知识"模块（支持搜索、卡片封面、附件链接）
const articleColumns = db.prepare('PRAGMA table_info(articles)').all();
const hasSummary = articleColumns.some((c) => c.name === 'summary');
const hasImageUrl = articleColumns.some((c) => c.name === 'image_url');
const hasTags = articleColumns.some((c) => c.name === 'tags');
const hasAttachment = articleColumns.some((c) => c.name === 'attachment_url');
if (!hasSummary) {
  db.exec("ALTER TABLE articles ADD COLUMN summary TEXT NOT NULL DEFAULT ''");
}
if (!hasImageUrl) {
  db.exec("ALTER TABLE articles ADD COLUMN image_url TEXT NOT NULL DEFAULT ''");
}
if (!hasTags) {
  db.exec("ALTER TABLE articles ADD COLUMN tags TEXT NOT NULL DEFAULT ''");
}
if (!hasAttachment) {
  db.exec("ALTER TABLE articles ADD COLUMN attachment_url TEXT NOT NULL DEFAULT ''");
}

// 不再预置"默认学校 / 默认社团"：
// 社长必须通过申请审批才能创建学校和社团，无社团用户可自由选择加入已有社团

// club_events 表迁移：加 max_participants 列（人数上限，0 = 不限）
// 用于 N6「活动签到 + 人数上限」：发布活动时可设上限，报名满员后其他人不能再报
const eventColumns = db.prepare('PRAGMA table_info(club_events)').all();
if (!eventColumns.some((c) => c.name === 'max_participants')) {
  db.exec("ALTER TABLE club_events ADD COLUMN max_participants INTEGER NOT NULL DEFAULT 0");
}

// 活动签到表：记录"谁在哪个活动上被点名签到了"
// 发起人 / 社长 / 管理员在活动当天可对已报名的成员打勾确认到场
// (event_id, user_id) 唯一索引保证同一个人同一活动只签到一次
db.exec(`
  CREATE TABLE IF NOT EXISTS event_checkins (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id   INTEGER NOT NULL,                  -- 对应 club_events.id
    user_id    INTEGER NOT NULL,                  -- 被签到的用户（必须已报名）
    checked_by INTEGER NOT NULL,                  -- 执行签到的人（发起人/社长/管理员）
    checked_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_checkin_event_user ON event_checkins(event_id, user_id);
`);

// ============================================================
// 社长申请制迁移（2026-10 改版）
// 背景：社长不再凭邀请码自助建校建社，改为"先注册为无社团用户 → 提交申请 → 管理员审批"
// 因此 users.school_id / club_id 必须允许为 NULL（无社团状态），并新增 deleted_at 支持软删除
// SQLite 不能修改列约束，只能重建表：建新表 → 拷数据 → 删旧表 → 改名
// 通过 deleted_at 是否存在来判断是否已迁移过，重复启动不会重复执行
// ============================================================
const usersColsNow = db.prepare('PRAGMA table_info(users)').all();
if (!usersColsNow.some((c) => c.name === 'deleted_at')) {
  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE users_new (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        school_id     INTEGER,                          -- NULL = 无社团人员（申请中/未被分配）
        club_id       INTEGER,                          -- NULL = 无社团人员
        phone         TEXT    NOT NULL UNIQUE,
        nickname      TEXT    NOT NULL,
        gender        TEXT    NOT NULL DEFAULT '男',
        password_hash TEXT    NOT NULL,
        role          TEXT    NOT NULL DEFAULT 'member', -- member=社员 / president=社长 / admin=管理员
        avatar        TEXT    NOT NULL DEFAULT '',
        deleted_at    TEXT,                             -- NULL=正常；有值=已被软删除（回收站）
        created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      );
      INSERT INTO users_new (id, school_id, club_id, phone, nickname, gender, password_hash, role, avatar, created_at)
        SELECT id, school_id, club_id, phone, nickname, gender, password_hash, role, COALESCE(avatar, ''), created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `);
    db.exec('COMMIT');
    console.log('[迁移] users 表已重建：school_id/club_id 允许 NULL，新增 deleted_at 软删除列');
  } catch (e) {
    db.exec('ROLLBACK');
    console.error('[迁移] users 表重建失败：', e);
    throw e;
  }
}

// 社长申请表：无社团用户提交"我想当社长"的申请，管理员在后台审批
// status: pending=待审批 / approved=已批准（自动建校建社并任命） / rejected=已拒绝
db.exec(`
  CREATE TABLE IF NOT EXISTS president_applications (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,                   -- 申请人（users.id）
    school_name   TEXT    NOT NULL,                   -- 学校名称
    club_name     TEXT    NOT NULL DEFAULT '长跑社',   -- 社团名称
    province      TEXT    NOT NULL DEFAULT '',        -- 省份
    city          TEXT    NOT NULL DEFAULT '',        -- 城市
    note          TEXT    NOT NULL DEFAULT '',        -- 申请留言（自我介绍等）
    status        TEXT    NOT NULL DEFAULT 'pending', -- pending / approved / rejected
    reject_reason TEXT    NOT NULL DEFAULT '',        -- 拒绝原因（拒绝时填写）
    handled_by    INTEGER,                            -- 审批的管理员 id
    handled_at    TEXT,                               -- 审批时间
    created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

// 社团成员申请表：记录"加入社团"和"退出社团"两类申请，由社长或管理员审批
// type: join=申请加入 / leave=申请退出
// status: pending=待审批 / approved=已通过 / rejected=已驳回 / canceled=申请人自行撤回
db.exec(`
  CREATE TABLE IF NOT EXISTS membership_requests (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,                   -- 申请人（users.id）
    club_id       INTEGER NOT NULL,                   -- 目标社团（clubs.id）
    type          TEXT    NOT NULL,                   -- join 加入申请 / leave 退出申请
    reason        TEXT    NOT NULL DEFAULT '',        -- 申请理由 / 退社原因
    status        TEXT    NOT NULL DEFAULT 'pending', -- pending / approved / rejected / canceled
    reject_reason TEXT    NOT NULL DEFAULT '',        -- 驳回原因
    handled_by    INTEGER,                            -- 审批人 id（社长或管理员）
    handled_at    TEXT,                               -- 审批时间
    created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

// 站内通知表：把"用户主动来看"变成"系统主动告诉用户"
// type 用于前端区分图标：announcement 公告 / task 任务 / event 约跑 /
//                        join 入社结果 / leave 退社结果 / president 社长申请结果 / system 系统
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,                   -- 这条通知发给谁
    type       TEXT    NOT NULL DEFAULT 'system',  -- 通知类型（见上方注释）
    title      TEXT    NOT NULL,                   -- 标题
    content    TEXT    NOT NULL DEFAULT '',        -- 正文（可为空）
    club_id    INTEGER,                            -- 关联社团（可空）
    is_read    INTEGER NOT NULL DEFAULT 0,         -- 0=未读 / 1=已读
    created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

// ============================================================
// 高频查询索引补齐（性能优化：社团看板 / 排行榜 / 后台列表都依赖这些字段过滤）
// ============================================================
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_runs_user_date ON runs(user_id, run_date);      -- 我的记录 / 成员跑量汇总
  CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(user_id);                   -- 我的计划列表
  CREATE INDEX IF NOT EXISTS idx_tokens_user ON tokens(user_id);                 -- 按用户清理 token
  CREATE INDEX IF NOT EXISTS idx_users_club ON users(club_id);                   -- 社团成员列表
  CREATE INDEX IF NOT EXISTS idx_ann_club ON announcements(club_id);             -- 社团公告
  CREATE INDEX IF NOT EXISTS idx_tasks_club ON club_tasks(club_id);              -- 社团任务
  CREATE INDEX IF NOT EXISTS idx_events_club ON club_events(club_id);            -- 社团活动
  CREATE INDEX IF NOT EXISTS idx_signups_user ON event_signups(user_id);         -- 我报名的活动
  CREATE INDEX IF NOT EXISTS idx_pa_user ON president_applications(user_id, status); -- 我的申请状态
  CREATE INDEX IF NOT EXISTS idx_mr_club ON membership_requests(club_id, status); -- 社长待审列表
  CREATE INDEX IF NOT EXISTS idx_mr_user ON membership_requests(user_id, status); -- 我的社团申请进度
  CREATE INDEX IF NOT EXISTS idx_notify_user ON notifications(user_id, is_read); -- 消息中心未读统计
`);

// tokens 表迁移：加 expires_at（token 过期时间）
// 之前的 token 永久有效；迁移时给老 token 统一续 30 天作为缓冲
const tokenCols = db.prepare('PRAGMA table_info(tokens)').all();
if (!tokenCols.some((c) => c.name === 'expires_at')) {
  db.exec("ALTER TABLE tokens ADD COLUMN expires_at TEXT");
  // 老 token 统一续 30 天，避免升级后立即被踢下线
  db.exec("UPDATE tokens SET expires_at = datetime('now','localtime','+30 days') WHERE expires_at IS NULL");
}

// ============================================================
// 全员沟通（广播）表：管理员向所有用户发布消息，用户可查看并回复
// broadcasts  一条 = 管理员发的一条全员消息（同时会给所有用户插一条 notification）
// broadcast_replies 一条 = 某个用户对某条广播的回复（管理员在后台查看）
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS broadcasts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id   INTEGER NOT NULL,                   -- 发布的管理员
    title      TEXT    NOT NULL,
    content    TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_broadcasts_time ON broadcasts(created_at DESC);

  CREATE TABLE IF NOT EXISTS broadcast_replies (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    broadcast_id INTEGER NOT NULL,                 -- 对应 broadcasts.id
    user_id      INTEGER NOT NULL,                 -- 回复的用户
    content      TEXT    NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_broadcast_reply ON broadcast_replies(broadcast_id, id);
`);

// 注意：知识文章的种子数据在 seed_articles.js 里，需要更新文章时执行
//   node seed_articles.js
// 脚本会清空旧文章并插入最新的系统知识库。

module.exports = db;
