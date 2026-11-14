// ============================================================
// 模块三：跑步计划页（2.0 五大目标类型版）
//
// 结构：
//   1. 状态筛选条：全部 / 进行中 / 已达成 / 已逾期 / 未开始
//   2. 计划卡片列表：目标类型图标 + 进度条 + 一句话进度 + 状态徽章
//   3. 右下角 + → 两步创建向导：第一步选目标类型或模板，第二步填参数
//   4. 点卡片 → 计划详情页（plan_detail_page.dart）
//
// 五大目标类型（与后端 extras.js 约定一致）：
//   volume 跑量 / speed 速度 / habit 习惯 / race 赛事 / weight 体重
// ============================================================
import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import 'plan_detail_page.dart';

// ---------- 目标类型元信息（图标 / 名称 / 颜色 / 一句话说明） ----------
const Map<String, Map<String, dynamic>> kGoalTypes = {
  'volume': {
    'icon': Icons.route,
    'label': '跑量目标',
    'color': Colors.green,
    'desc': '累计跑量，步步为营',
  },
  'speed': {
    'icon': Icons.speed,
    'label': '速度目标',
    'color': Colors.orange,
    'desc': '冲击某个距离的最好成绩',
  },
  'habit': {
    'icon': Icons.local_fire_department,
    'label': '习惯养成',
    'color': Colors.deepPurple,
    'desc': '每周几次或连续打卡，坚持为王',
  },
  'race': {
    'icon': Icons.emoji_events,
    'label': '赛事备赛',
    'color': Colors.red,
    'desc': '为一场比赛系统备战',
  },
  'weight': {
    'icon': Icons.monitor_weight,
    'label': '体重目标',
    'color': Colors.blue,
    'desc': '记录体重曲线，跑步助力',
  },
};

// ---------- 计划状态元信息（文案 / 颜色） ----------
Map<String, dynamic> planStatusMeta(String status) {
  switch (status) {
    case 'achieved':
      return {'label': '已达成', 'color': Colors.green};
    case 'expired':
      return {'label': '已逾期', 'color': Colors.grey};
    case 'pending':
      return {'label': '未开始', 'color': Colors.blueGrey};
    default:
      return {'label': '进行中', 'color': Colors.orange};
  }
}

// 星期几名称（day: 1=周一 ... 7=周日）
const List<String> kWeekdayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// 课表类型全集（与后端 extras.js 校验一致；"交叉训练"为旧数据兼容别名）
const List<String> kScheduleTypes = ['轻松跑', '配速跑', '间歇', '长距离', '休息', '力量训练'];

// 课表类型配色（列表页今日卡 / 创建向导 / 详情页通用）
const Map<String, Color> kScheduleTypeColors = {
  '轻松跑': Colors.green,
  '配速跑': Colors.blue,
  '间歇': Colors.orange,
  '长距离': Colors.red,
  '休息': Colors.grey,
  '力量训练': Colors.purple,
  '交叉训练': Colors.purple, // 旧数据兼容
};

// 休息类类型：不需要填距离（含旧数据里的"交叉训练"）
bool isRestLikeType(String t) => t == '休息' || t == '交叉训练' || t == '力量训练';

// 取 0.5 的倍数（课表距离习惯用半公里表示）
double round05(double v) => (v * 2).round() / 2;

// 距离显示：2.0 → "2"，2.5 → "2.5"
String kmText(double km) => km % 1 == 0 ? km.toInt().toString() : '$km';

// ============================================================
// 生成科学的默认周课表（7 天全量，未选中的天 = 休息）
// 训练学依据：
//   1. 长距离跑固定放在最后选中的那天（通常是周末），占周跑量 30-40%
//   2. 间歇/配速跑等质量课每周不超过 2 次，且被轻松跑隔开，避免连续高强度
//   3. 按选中天数递进：2 天=轻松+长距离；3 天加配速；4 天起加间歇
//   4. 每次训练至少 2 公里才有训练效果，距离按占比分配后取 0.5 的倍数
//   5. 习惯养成类目标以"能坚持"为第一原则：全部轻松跑、平均分配
//   6. aggressive=true（目标成绩比 PB 快 3% 以上）：3 天计划也加入间歇课、
//      间歇距离占比从 20% 提高到 25%，体现"更高目标需要更多质量课"
// ============================================================
List<Map<String, dynamic>> generateDefaultSchedule(
    List<int> days, double weeklyKm, String goalType,
    {bool aggressive = false}) {
  final sorted = days.toList()..sort();
  final n = sorted.length;
  final rows = <Map<String, dynamic>>[
    for (var d = 1; d <= 7; d++) {'day': d, 'type': '休息', 'km': 0.0},
  ];
  if (n == 0) return rows;

  // 习惯目标：全轻松跑，平均分配，跑不动也能完成
  if (goalType == 'habit') {
    final km = weeklyKm / n < 2 ? 2.0 : weeklyKm / n;
    for (final d in sorted) {
      rows[d - 1]['type'] = '轻松跑';
      rows[d - 1]['km'] = round05(km);
    }
    return rows;
  }

  // 按选中天数的类型模板（顺序 = day 从小到大）
  // aggressive：目标比 PB 快 3% 以上时，3 天计划也排间歇、4 天加配速
  final patterns = aggressive
      ? <int, List<String>>{
          1: ['轻松跑'],
          2: ['轻松跑', '长距离'],
          3: ['轻松跑', '间歇', '长距离'],
          4: ['轻松跑', '间歇', '配速跑', '长距离'],
          5: ['轻松跑', '间歇', '轻松跑', '配速跑', '长距离'],
          6: ['轻松跑', '间歇', '轻松跑', '配速跑', '轻松跑', '长距离'],
          7: ['轻松跑', '间歇', '轻松跑', '配速跑', '轻松跑', '轻松跑', '长距离'],
        }
      : <int, List<String>>{
          1: ['轻松跑'],
          2: ['轻松跑', '长距离'],
          3: ['轻松跑', '配速跑', '长距离'],
          4: ['轻松跑', '间歇', '轻松跑', '长距离'],
          5: ['轻松跑', '间歇', '轻松跑', '配速跑', '长距离'],
          6: ['轻松跑', '间歇', '轻松跑', '配速跑', '轻松跑', '长距离'],
          7: ['轻松跑', '间歇', '轻松跑', '配速跑', '轻松跑', '轻松跑', '长距离'],
        };
  final types = patterns[n]!;

  // 距离占比：长距离 6-7 天时降到 30% 防止单日占比过高；目标激进时间歇 25%
  final longPct = n >= 6 ? 0.30 : 0.40;
  final intervalPct = aggressive ? 0.25 : 0.20; // 间歇课占比
  const tempoPct = 0.15; // 配速跑占比
  final easyCount = types.where((t) => t == '轻松跑').length;
  final qualityTotal = (types.contains('间歇') ? intervalPct : 0.0) +
      (types.contains('配速跑') ? tempoPct : 0.0);
  final easyPct = easyCount > 0 ? (1 - longPct - qualityTotal) / easyCount : 0.0;

  for (var i = 0; i < n; i++) {
    final d = sorted[i];
    final t = types[i];
    final double pct = switch (t) {
      '长距离' => longPct,
      '间歇' => intervalPct,
      '配速跑' => tempoPct,
      _ => easyPct,
    };
    var km = weeklyKm * pct;
    if (km < 2) km = 2; // 单次至少 2 公里
    rows[d - 1]['type'] = t;
    rows[d - 1]['km'] = round05(km);
  }
  return rows;
}

class PlansPage extends StatefulWidget {
  final String token;
  final User user;
  // 逾期计划数量变化时通知主页（底部导航"计划"tab 上显示小红点）
  final ValueChanged<int>? onOverdueChanged;

  const PlansPage({
    super.key,
    required this.token,
    required this.user,
    this.onOverdueChanged,
  });

  @override
  State<PlansPage> createState() => _PlansPageState();
}

class _PlansPageState extends State<PlansPage> {
  List<Plan>? _plans;
  String? _error;
  String _filter = '全部'; // 当前状态筛选

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final list = await Api.myPlans(widget.token);
      if (!mounted) return;
      setState(() => _plans = list);
      // 通知主页更新"计划"tab 的小红点（逾期未达成的计划数量）
      widget.onOverdueChanged?.call(list.where((p) => p.status == 'expired').length);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _plans = [];
      });
    }
  }

  Future<void> _openCreate() async {
    final ok = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => CreatePlanPage(token: widget.token)),
    );
    if (ok == true) _load();
  }

  Future<void> _delete(Plan p) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('删除计划'),
        content: Text('确定要删除"${p.title}"吗？删除后无法恢复。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('删除'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await Api.deletePlan(widget.token, p.id);
      if (!mounted) return;
      _toast('已删除');
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      _toast(e.message);
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  // N3：今日训练卡打卡，切换某节课的打卡状态后整体刷新
  Future<void> _toggleCheckin(Plan p, int weekNo, int day) async {
    try {
      final checked = await Api.togglePlanCheckin(widget.token, p.id, weekNo, day);
      if (!mounted) return;
      _toast(checked ? '打卡成功，继续保持！' : '已取消打卡');
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      _toast(e.message);
    }
  }

  // 按筛选条件过滤计划
  List<Plan> get _filtered {
    final list = _plans ?? [];
    if (_filter == '全部') return list;
    final statusKey = switch (_filter) {
      '进行中' => 'active',
      '已达成' => 'achieved',
      '已逾期' => 'expired',
      '未开始' => 'pending',
      _ => '',
    };
    return list.where((p) => p.status == statusKey).toList();
  }

  // ---------- 今日训练卡（N3：可直接打卡） ----------
  // 从所有「进行中」计划的周课表里，找出今天（按星期几匹配）安排的训练并汇总展示
  // 每节课右侧有打卡圆圈，跑完点一下打勾；再点一次取消
  Widget _buildTodayCard() {
    final plans = _plans ?? const <Plan>[];
    if (plans.isEmpty) return const SizedBox.shrink();
    final todayIdx = DateTime.now().weekday; // Dart: 1=周一 ... 7=周日，与课表 day 一致
    final today = DateTime.now();
    final todayOnly = DateTime(today.year, today.month, today.day);
    // 汇总今天所有训练项：{计划, 类型, km, 第几周, 是否已打卡}
    final sessions =
        <({Plan plan, String type, double km, int weekNo, bool checked})>[];
    for (final p in plans) {
      if (p.status != 'active') continue; // 只看进行中的计划
      // 当前是该计划的第几周（1 起）
      // 统一按"周一~周日"为一周：第 1 周从开始日期所在周的周一算起（与后端一致）
      final planStart = DateTime.parse(p.startDate);
      final weekStart = planStart.subtract(Duration(days: planStart.weekday - 1));
      final weekNo = todayOnly.difference(weekStart).inDays ~/ 7 + 1;
      final sched = (p.goalData['schedule'] as List?) ?? const [];
      for (final e in sched) {
        final m = e as Map;
        if (((m['day'] as num?) ?? 0).toInt() != todayIdx) continue;
        final type = (m['type'] ?? '') as String;
        final km = (m['km'] as num?)?.toDouble() ?? 0;
        if (isRestLikeType(type) || km <= 0) continue;
        sessions.add((
          plan: p,
          type: type,
          km: km,
          weekNo: weekNo,
          checked: p.checkins.contains('$weekNo-$todayIdx'),
        ));
      }
    }

    final now = DateTime.now();
    final dateStr =
        '${now.month}月${now.day}日 ${kWeekdayNames[todayIdx - 1]}';
    return Card(
      color: Colors.green.shade50,
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.today, color: Colors.green, size: 20),
                const SizedBox(width: 6),
                Text('今日训练 · $dateStr',
                    style: const TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 8),
            if (sessions.isEmpty)
              Text(
                '今天没有安排跑步。好好休息或做些力量训练，恢复也是训练的一部分。',
                style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
              )
            else
              for (final s in sessions)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      // 打卡圆圈：已打卡=绿勾，未打卡=空心圈，点一下切换
                      GestureDetector(
                        onTap: () => _toggleCheckin(s.plan, s.weekNo, todayIdx),
                        child: Icon(
                          s.checked
                              ? Icons.check_circle
                              : Icons.radio_button_unchecked,
                          size: 22,
                          color: s.checked ? Colors.green : Colors.grey,
                        ),
                      ),
                      const SizedBox(width: 8),
                      // 类型徽章（颜色与详情页课表一致）
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: (kScheduleTypeColors[s.type] ?? Colors.green)
                              .withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          s.type,
                          style: TextStyle(
                            fontSize: 11,
                            color: kScheduleTypeColors[s.type] ?? Colors.green,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(s.plan.title,
                            style: const TextStyle(fontSize: 13),
                            overflow: TextOverflow.ellipsis),
                      ),
                      Text('${kmText(s.km)} km',
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: Colors.green)),
                    ],
                  ),
                ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (_error != null) {
      body = Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: _load, child: const Text('重试')),
          ],
        ),
      );
    } else if (_plans == null) {
      body = const Center(child: CircularProgressIndicator());
    } else {
      final list = _filtered;
      final overdue = (_plans ?? const <Plan>[]).where((p) => p.status == 'expired').toList();
      body = RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: [
            // 逾期提醒横幅：有逾期未达成的计划时出现，点击直接筛选到"已逾期"
            if (overdue.isNotEmpty)
              Card(
                color: Colors.orange.shade50,
                margin: const EdgeInsets.only(bottom: 10),
                child: InkWell(
                  borderRadius: BorderRadius.circular(8),
                  onTap: () => setState(() => _filter = '已逾期'),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        const Icon(Icons.warning_amber_rounded, color: Colors.orange),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '有 ${overdue.length} 个计划已逾期未达成',
                                style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.orange),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '点这里查看原因，调整目标或重新制定计划，别让计划停在半路上',
                                style: TextStyle(fontSize: 12, color: Colors.orange.shade800),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right, color: Colors.orange),
                      ],
                    ),
                  ),
                ),
              ),
            // 状态筛选条
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: ['全部', '进行中', '已达成', '已逾期', '未开始']
                    .map((s) => Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(s),
                            selected: _filter == s,
                            onSelected: (_) => setState(() => _filter = s),
                          ),
                        ))
                    .toList(),
              ),
            ),
            const SizedBox(height: 8),
            // 今日训练卡：汇总进行中计划在今天安排的训练
            if (_plans != null && _plans!.isNotEmpty) _buildTodayCard(),
            if (list.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 80),
                child: Text(
                  _plans!.isEmpty
                      ? '还没有跑步计划\n点右下角 + 选一个目标开始吧'
                      : '这个状态下暂时没有计划',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey.shade600, height: 1.8),
                ),
              ),
            for (final p in list) _PlanCard(plan: p, onTap: _openDetail, onDelete: _delete),
          ],
        ),
      );
    }

    return Scaffold(
      body: body,
      floatingActionButton: FloatingActionButton(
        onPressed: _openCreate,
        child: const Icon(Icons.add),
      ),
    );
  }

  Future<void> _openDetail(Plan p) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => PlanDetailPage(token: widget.token, plan: p, onChanged: _load),
      ),
    );
  }
}

// ---------- 计划卡片 ----------
class _PlanCard extends StatelessWidget {
  final Plan plan;
  final void Function(Plan) onTap;
  final void Function(Plan) onDelete;

  const _PlanCard({required this.plan, required this.onTap, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final meta = kGoalTypes[plan.goalType] ?? kGoalTypes['volume']!;
    final Color color = meta['color'] as Color;
    final status = planStatusMeta(plan.status);
    final Color statusColor = status['color'] as Color;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => onTap(plan),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 第一行：类型图标 + 标题 + 状态徽章 + 删除
              Row(
                children: [
                  Icon(meta['icon'] as IconData, color: color, size: 22),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      plan.title,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      status['label'] as String,
                      style: TextStyle(fontSize: 11, color: statusColor, fontWeight: FontWeight.bold),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline, size: 20, color: Colors.red),
                    onPressed: () => onDelete(plan),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              // 第二行：一句话进度
              Text(
                plan.statLine,
                style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
              ),
              const SizedBox(height: 8),
              // 第三行：进度条 + 百分比
              Row(
                children: [
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: plan.percent / 100,
                        minHeight: 8,
                        backgroundColor: Colors.grey.shade200,
                        valueColor: AlwaysStoppedAnimation(color),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    '${plan.percent}%',
                    style: TextStyle(fontWeight: FontWeight.bold, color: color, fontSize: 13),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              // 第四行：元信息（周期 / 强度 / 逾期或倒计时 / 过量提醒）
              Wrap(
                spacing: 10,
                runSpacing: 4,
                children: [
                  Text('${plan.weeks} 周 · 强度${plan.intensity}',
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                  Text('${plan.startDate} ~ ${plan.endDate}',
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                  // 赛事倒计时
                  if (plan.extra['countdown_days'] != null)
                    Text(
                      (plan.extra['countdown_days'] as num) > 0
                          ? '距比赛 ${plan.extra['countdown_days']} 天'
                          : '比赛日已到',
                      style: const TextStyle(
                          fontSize: 12, color: Colors.red, fontWeight: FontWeight.bold),
                    ),
                  // 过量训练提醒
                  if (plan.extra['overtrain'] == true)
                    const Text('本周跑量偏高，注意恢复',
                        style: TextStyle(fontSize: 12, color: Colors.deepOrange)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ============================================================
// 两步创建向导
// 第一步：选目标类型（5 张大卡片）或从模板一键开始
// 第二步：填公共字段 + 类型专属参数 + 选择每周跑步日
// ============================================================
class CreatePlanPage extends StatefulWidget {
  final String token;
  // 社长为社员制定计划时传入：目标社员编号与昵称；普通创建留空
  final int? forUserId;
  final String? forUserName;
  // 编辑模式：传入现有计划（来自计划列表接口，goal_data 已解析为 Map）
  // 传入后跳过"选类型"第一步，直接改基础信息和课表，保存时走修改接口
  final Map<String, dynamic>? editPlan;

  const CreatePlanPage({super.key, required this.token, this.forUserId, this.forUserName, this.editPlan});

  @override
  State<CreatePlanPage> createState() => _CreatePlanPageState();
}

class _CreatePlanPageState extends State<CreatePlanPage> {
  int _step = 0; // 0=选类型 1=填参数
  String _type = ''; // 选中的目标类型
  List<PlanTemplate>? _templates;

  // 公共字段
  final _titleCtrl = TextEditingController();
  final _weeksCtrl = TextEditingController(text: '4');
  final _noteCtrl = TextEditingController();
  DateTime _startDate = DateTime.now();
  String _intensity = '中等';

  // 类型专属字段控制器
  final _targetKmCtrl = TextEditingController(); // volume 总跑量
  final _weeklyKmCtrl = TextEditingController(); // volume 按周跑量换算
  String _speedDistance = '5'; // speed 目标距离
  final _speedMinCtrl = TextEditingController(); // speed 目标成绩 分
  final _speedSecCtrl = TextEditingController(); // speed 目标成绩 秒
  String _habitMode = 'week'; // habit：week 每周N次 / streak 连续N天
  final _habitValueCtrl = TextEditingController(text: '3'); // habit N
  final _raceNameCtrl = TextEditingController(); // race 比赛名称
  DateTime? _raceDate; // race 比赛日期（可空）
  final _raceKmCtrl = TextEditingController(text: '21.1'); // race 比赛距离
  final _raceWeeklyCtrl = TextEditingController(text: '25'); // race 每周跑量
  final _raceMinCtrl = TextEditingController(); // race 目标成绩 分
  final _raceSecCtrl = TextEditingController(); // race 目标成绩 秒
  final _startKgCtrl = TextEditingController(); // weight 起始体重
  final _targetKgCtrl = TextEditingController(); // weight 目标体重

  // 每周跑步日（生成周课表用）
  Set<int> _days = {2, 4, 7}; // 默认周二/四/周日
  // 周课表 7 天全量（未选中的天 = 休息），每行可手动改类型和距离
  List<Map<String, dynamic>> _rows = [];
  final List<TextEditingController> _kmCtrls =
      List.generate(7, (_) => TextEditingController());
  // 用户手动改过的天：重新生成默认课表时不覆盖这些天的编排
  Set<int> _editedDays = {};
  // 用户的 PB 数据（用于按"目标 vs PB"的差距自动调整课表强度）
  MyStats? _stats;

  @override
  void initState() {
    super.initState();
    _startDate = _dateOnly(DateTime.now());
    if (widget.editPlan != null) {
      // 编辑模式：跳过"选类型"第一步，把现有计划参数全部填进表单
      _step = 1;
      final p = widget.editPlan!;
      _fillForm(
        type: (p['goal_type'] as String?) ?? 'volume',
        g: (p['goal_data'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{},
        title: (p['title'] as String?) ?? '',
        weeks: (p['weeks'] as num?)?.toInt(),
        intensity: (p['intensity'] as String?) ?? '中等',
        note: (p['note'] as String?) ?? '',
        targetKm: (p['target_km'] as num?)?.toDouble() ?? 0,
        startDate: p['start_date'] as String?,
      );
    } else {
      _rows = generateDefaultSchedule(_days.toList(), 0, 'volume');
      _syncKmCtrls();
    }
    _loadTemplates();
    // 异步加载 PB：加载完成后第二步顶部会显示"目标 vs PB"对比
    Api.myStats(widget.token).then((s) {
      if (mounted) setState(() => _stats = s);
    }).catchError((_) {}); // 加载失败不影响创建流程
  }

  // 是否编辑模式
  bool get _isEdit => widget.editPlan != null;

  @override
  void dispose() {
    for (final c in [_titleCtrl, _weeksCtrl, _noteCtrl, _targetKmCtrl, _weeklyKmCtrl, _speedMinCtrl, _speedSecCtrl, _habitValueCtrl, _raceNameCtrl, _raceKmCtrl, _raceWeeklyCtrl, _raceMinCtrl, _raceSecCtrl, _startKgCtrl, _targetKgCtrl]) {
      c.dispose();
    }
    for (final c in _kmCtrls) {
      c.dispose();
    }
    super.dispose();
  }

  // 把 _rows 的距离同步到输入框（0 = 空）
  void _syncKmCtrls() {
    for (var i = 0; i < 7; i++) {
      final km = _rows[i]['km'] as double;
      _kmCtrls[i].text = km > 0 ? kmText(km) : '';
    }
  }

  // 当前计划的周均跑量（生成课表用）
  double _currentWeeklyKm() {
    if (_type == 'race') return double.tryParse(_raceWeeklyCtrl.text.trim()) ?? 0;
    if (_type == 'speed') return 10; // 速度计划默认参考值，用户可手动改课表
    final weeks = int.tryParse(_weeksCtrl.text.trim()) ?? 0;
    final target = double.tryParse(_targetKmCtrl.text.trim()) ?? 0;
    return weeks > 0 ? target / weeks : 0;
  }

  // 重新生成默认课表：手改过的天（_editedDays）保留原编排
  void _regenSchedule() {
    final defaults = generateDefaultSchedule(
      _days.toList(),
      _currentWeeklyKm(),
      _type,
      aggressive: _isAggressive(), // 目标比 PB 快 3% 以上时自动加强质量课
    );
    for (var i = 0; i < 7; i++) {
      final d = defaults[i]['day'] as int;
      if (_editedDays.contains(d) && _days.contains(d)) continue; // 保留手动编排
      _rows[i] = defaults[i];
    }
    _syncKmCtrls();
  }

  // ---------- PB 与目标对比（速度/赛事类型用） ----------
  // 找该距离对应的 PB（秒），没有则返回 null
  int? _pbForDistance(double km) {
    final s = _stats;
    if (s == null) return null;
    int? pick(double d, int? pb) => (km - d).abs() < 0.05 ? pb : null;
    return pick(1, s.pb1000) ??
        pick(3, s.pb3000) ??
        pick(5, s.pb5000) ??
        pick(10, s.pb10000) ??
        pick(21.0975, s.pb21097) ??
        pick(42.195, s.pb42195);
  }

  // 当前目标距离（速度/赛事类型），其他类型返回 null
  double? _goalDistanceKm() {
    if (_type == 'speed') return double.tryParse(_speedDistance);
    if (_type == 'race') return double.tryParse(_raceKmCtrl.text.trim());
    return null;
  }

  // 当前目标成绩（秒），没填返回 null
  int? _goalTargetSeconds() {
    if (_type == 'speed') {
      final min = int.tryParse(_speedMinCtrl.text.trim()) ?? 0;
      final sec = int.tryParse(_speedSecCtrl.text.trim()) ?? 0;
      return min * 60 + sec > 0 ? min * 60 + sec : null;
    }
    if (_type == 'race') {
      final min = int.tryParse(_raceMinCtrl.text.trim()) ?? 0;
      final sec = int.tryParse(_raceSecCtrl.text.trim()) ?? 0;
      return min * 60 + sec > 0 ? min * 60 + sec : null;
    }
    return null;
  }

  // 目标是否比 PB 快 3% 以上（决定是否自动加强质量课）
  bool _isAggressive() {
    final dist = _goalDistanceKm();
    final target = _goalTargetSeconds();
    if (dist == null || target == null || dist <= 0) return false;
    final pb = _pbForDistance(dist);
    if (pb == null || pb <= 0) return false;
    final pbPace = pb / dist;
    final targetPace = target / dist;
    return (pbPace - targetPace) / pbPace > 0.03;
  }

  // 配速显示：334 秒 → 5'34"
  String _paceText(int s) {
    final m = s ~/ 60;
    final ss = (s % 60).toString().padLeft(2, '0');
    return "$m'$ss\"";
  }

  // PB 对比提示条（第三步顶部）：展示"PB 配速 → 目标配速"及自动调整说明
  Widget _buildPbHint() {
    if (_type != 'speed' && _type != 'race') return const SizedBox.shrink();
    final dist = _goalDistanceKm();
    final target = _goalTargetSeconds();
    String text;
    if (dist == null || dist <= 0 || target == null) {
      text = '填好目标成绩后，系统会参考你的 PB 成绩自动调整课表强度。';
    } else {
      final pb = _pbForDistance(dist);
      if (pb == null || pb <= 0) {
        text = '暂无 ${kmText(dist)} 公里的 PB 记录，按标准强度生成课表；跑出成绩后再定目标会更科学。';
      } else {
        final pbPace = pb / dist;
        final targetPace = target / dist;
        final gap = ((pbPace - targetPace) / pbPace * 100).round();
        if (gap > 3) {
          text = 'PB 配速 ${_paceText(pbPace.round())}/km → 目标配速 ${_paceText(targetPace.round())}/km（快 $gap%）——已自动加强质量课（间歇占比提高到 25%）。';
        } else if (gap >= 0) {
          text = 'PB 配速 ${_paceText(pbPace.round())}/km → 目标配速 ${_paceText(targetPace.round())}/km（快 $gap%）——按标准强度生成课表。';
        } else {
          text = '目标配速比 PB 慢 ${-gap}%——以有氧耐力为主生成课表。';
        }
      }
    }
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.insights, size: 18, color: Colors.blue.shade700),
          const SizedBox(width: 8),
          Expanded(
              child: Text(text,
                  style: const TextStyle(fontSize: 12, height: 1.4))),
        ],
      ),
    );
  }

  DateTime _dateOnly(DateTime d) => DateTime(d.year, d.month, d.day);

  Future<void> _loadTemplates() async {
    try {
      final list = await Api.planTemplates(widget.token);
      if (!mounted) return;
      setState(() => _templates = list);
    } on ApiException {
      // 模板加载失败不影响手动创建
    }
  }

  // ---------- 第一步：选择类型 ----------
  void _pickType(String type) {
    setState(() {
      _type = type;
      _step = 1;
      // 换类型后按新目标重新生成默认课表（手改过的天保留）
      _editedDays = {};
      _regenSchedule();
    });
  }

  // 从模板开始：把模板参数全部填进表单
  void _pickTemplate(PlanTemplate t) {
    setState(() {
      _step = 1;
      _fillForm(
        type: t.goalType,
        g: t.goalData,
        title: t.title,
        weeks: t.weeks,
        intensity: t.intensity,
        note: t.note,
        targetKm: t.targetKm,
      );
    });
  }

  // 把一份计划的参数填进表单（套模板 / 编辑模式共用）
  // 课表编排视同"手动编辑"，之后点"恢复默认"才会被自动生成覆盖
  void _fillForm({
    required String type,
    required Map<String, dynamic> g,
    String title = '',
    int? weeks,
    String intensity = '中等',
    String note = '',
    double targetKm = 0,
    String? startDate,
  }) {
    _type = type;
    _titleCtrl.text = title;
    if (weeks != null) _weeksCtrl.text = '$weeks';
    _intensity = const ['低', '中等', '高'].contains(intensity) ? intensity : '中等';
    _noteCtrl.text = note;
    _targetKmCtrl.text = targetKm > 0 ? targetKm.toStringAsFixed(0) : '';
    if (startDate != null) {
      final parts = startDate.split('-');
      if (parts.length == 3) {
        final y = int.tryParse(parts[0]);
        final m = int.tryParse(parts[1]);
        final d = int.tryParse(parts[2]);
        if (y != null && m != null && d != null) _startDate = DateTime(y, m, d);
      }
    }
    // 完整载入课表：7 天全量，没安排的天 = 休息
    final sched = (g['schedule'] as List?) ?? [];
    _rows = [
      for (var d = 1; d <= 7; d++) {'day': d, 'type': '休息', 'km': 0.0},
    ];
    _editedDays = {};
    for (final e in sched) {
      final m = e as Map;
      final d = ((m['day'] as num?) ?? 1).toInt().clamp(1, 7);
      final km = ((m['km'] as num?) ?? 0).toDouble();
      _rows[d - 1] = {
        'day': d,
        'type': (m['type'] ?? '轻松跑') as String,
        'km': km,
      };
      if (km > 0 || (m['type'] as String?) == '力量训练' || (m['type'] as String?) == '交叉训练') {
        _editedDays.add(d);
      }
    }
    // 选中天 = 课表里所有非休息日
    final days = _rows
        .where((r) => (r['type'] as String) != '休息')
        .map((r) => r['day'] as int)
        .toSet();
    if (days.isNotEmpty) _days = days;
    _syncKmCtrls();
    // 类型专属参数
    if (type == 'speed') {
      _speedDistance = '${(g['distance_km'] as num?)?.toDouble() ?? 5}';
      final ts = (g['target_seconds'] as num?)?.toInt() ?? 0;
      _speedMinCtrl.text = ts > 0 ? '${ts ~/ 60}' : '';
      _speedSecCtrl.text = ts > 0 ? '${ts % 60}' : '';
    } else if (type == 'habit') {
      _habitMode = (g['freq_type'] as String?) ?? 'week';
      _habitValueCtrl.text = '${(g['freq_value'] as num?)?.toInt() ?? 3}';
    } else if (type == 'race') {
      _raceNameCtrl.text = (g['race_name'] as String?) ?? '';
      _raceKmCtrl.text = '${(g['race_km'] as num?)?.toDouble() ?? 21.1}';
      _raceWeeklyCtrl.text = '${(g['weekly_km'] as num?)?.toInt() ?? 25}';
      final rd = (g['race_date'] as String?) ?? '';
      if (rd.isNotEmpty) {
        final parts = rd.split('-');
        if (parts.length == 3) {
          final y = int.tryParse(parts[0]);
          final m = int.tryParse(parts[1]);
          final d = int.tryParse(parts[2]);
          if (y != null && m != null && d != null) _raceDate = DateTime(y, m, d);
        }
      }
      final ts = (g['target_seconds'] as num?)?.toInt() ?? 0;
      _raceMinCtrl.text = ts > 0 ? '${ts ~/ 60}' : '';
      _raceSecCtrl.text = ts > 0 ? '${ts % 60}' : '';
    } else if (type == 'weight') {
      _startKgCtrl.text = '${(g['start_kg'] as num?) ?? ''}'.replaceAll('.0', '');
      _targetKgCtrl.text = '${(g['target_kg'] as num?) ?? ''}'.replaceAll('.0', '');
    }
  }

  // ---------- 周跑步日选择：切换某天 ----------
  void _toggleDay(int day, bool selected) {
    setState(() {
      if (selected) {
        _days.add(day);
      } else {
        _days.remove(day);
        _editedDays.remove(day);
        _rows[day - 1] = {'day': day, 'type': '休息', 'km': 0.0};
        _kmCtrls[day - 1].text = '';
      }
      // 为新选中的天补默认编排（已手动改过的天保留）
      _regenSchedule();
    });
  }

  // ---------- 保存 ----------
  bool _saving = false; // 保存中标记：防止连续点击重复创建计划
  Future<void> _save() async {
    if (_saving) return;
    final title = _titleCtrl.text.trim();
    if (title.isEmpty) return _toast('计划名称不能为空');
    final weeks = int.tryParse(_weeksCtrl.text.trim());
    if (weeks == null || weeks < 1 || weeks > 52) return _toast('周期必须是 1-52 周');

    final startStr = _formatDate(_startDate);
    double targetKm = 0;
    final goalData = <String, dynamic>{};

    if (_type == 'volume') {
      targetKm = double.tryParse(_targetKmCtrl.text.trim()) ?? 0;
      if (targetKm <= 0) return _toast('目标跑量必须大于 0');
    } else if (_type == 'speed') {
      final dist = double.tryParse(_speedDistance);
      if (dist == null || dist <= 0) return _toast('请选择目标距离');
      targetKm = dist;
      final min = int.tryParse(_speedMinCtrl.text.trim()) ?? 0;
      final sec = int.tryParse(_speedSecCtrl.text.trim()) ?? 0;
      goalData['distance_km'] = dist;
      goalData['target_seconds'] = min * 60 + sec; // 都为空 = 0 = 不设目标成绩
    } else if (_type == 'habit') {
      final v = int.tryParse(_habitValueCtrl.text.trim());
      if (v == null || v < 1) return _toast('请填写打卡目标次数/天数');
      goalData['freq_type'] = _habitMode;
      goalData['freq_value'] = v;
      targetKm = 10; // 习惯计划跑量仅参考
    } else if (_type == 'race') {
      final name = _raceNameCtrl.text.trim();
      if (name.isEmpty) return _toast('请填写比赛名称');
      final raceKm = double.tryParse(_raceKmCtrl.text.trim());
      final weeklyKm = double.tryParse(_raceWeeklyCtrl.text.trim());
      if (raceKm == null || raceKm <= 0) return _toast('比赛距离必须大于 0');
      if (weeklyKm == null || weeklyKm <= 0) return _toast('每周目标跑量必须大于 0');
      goalData['race_name'] = name;
      goalData['race_date'] = _raceDate != null ? _formatDate(_raceDate!) : '';
      goalData['race_km'] = raceKm;
      goalData['weekly_km'] = weeklyKm;
      final min = int.tryParse(_raceMinCtrl.text.trim()) ?? 0;
      final sec = int.tryParse(_raceSecCtrl.text.trim()) ?? 0;
      goalData['target_seconds'] = min * 60 + sec;
      targetKm = weeklyKm * weeks;
    } else if (_type == 'weight') {
      final sk = double.tryParse(_startKgCtrl.text.trim());
      final tk = double.tryParse(_targetKgCtrl.text.trim());
      if (sk == null || sk < 20 || sk > 300) return _toast('起始体重需在 20-300 kg');
      if (tk == null || tk < 20 || tk > 300) return _toast('目标体重需在 20-300 kg');
      if (sk == tk) return _toast('目标体重不能等于起始体重');
      goalData['start_kg'] = sk;
      goalData['target_kg'] = tk;
      targetKm = 0;
    }

    // 周课表：体重目标不需要；其他类型保存编辑后的 7 天课表（含休息日）
    if (_type != 'weight' && _days.isNotEmpty) {
      goalData['schedule'] = [
        for (final r in _rows)
          {'day': r['day'], 'type': r['type'], 'km': r['km']},
      ];
    }

    setState(() => _saving = true); // 按钮变灰，避免重复提交
    try {
      if (_isEdit) {
        // 编辑模式：走修改接口（权限由后端判断：本人/管理员/本社社长）
        await Api.updatePlan(
          widget.token,
          (widget.editPlan!['id'] as num).toInt(),
          title: title,
          targetKm: targetKm,
          weeks: weeks,
          startDate: startStr,
          intensity: _intensity,
          note: _noteCtrl.text.trim(),
          goalType: _type,
          goalData: goalData,
        );
      } else if (widget.forUserId != null) {
        // 社长为社员制定：走 addPlanForUser；普通创建：走 addPlan
        await Api.addPlanForUser(
          widget.token,
          forUserId: widget.forUserId!,
          title: title,
          targetKm: targetKm,
          weeks: weeks,
          startDate: startStr,
          intensity: _intensity,
          note: _noteCtrl.text.trim(),
          goalType: _type,
          goalData: goalData,
        );
      } else {
        await Api.addPlan(
          widget.token,
          title: title,
          targetKm: targetKm,
          weeks: weeks,
          startDate: startStr,
          intensity: _intensity,
          note: _noteCtrl.text.trim(),
          goalType: _type,
          goalData: goalData,
        );
      }
      if (!mounted) return;
      _toast(_isEdit
          ? '计划已保存'
          : (widget.forUserName != null ? '已为 ${widget.forUserName} 创建计划' : '计划创建成功'));
      Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _saving = false); // 失败后允许重试
      _toast(e.message);
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  String _formatDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  // 选择日期的通用对话框
  Future<void> _pickDate({required bool isRaceDate}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isRaceDate ? (_raceDate ?? _startDate.add(const Duration(days: 30))) : _startDate,
      firstDate: isRaceDate ? DateTime.now() : DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 730)),
    );
    if (picked == null) return;
    setState(() {
      if (isRaceDate) {
        _raceDate = _dateOnly(picked);
      } else {
        _startDate = _dateOnly(picked);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(switch (_step) {
          0 => '新建计划 · 选择目标',
          1 => _isEdit ? '修改计划 · 基础信息' : '新建计划 · 基础信息',
          _ => _isEdit ? '修改计划 · 训练计划' : '新建计划 · 训练计划',
        }),
        // 编辑模式第一步不能再退回"选类型"（目标类型不允许改），用默认返回键退出页面
        leading: (_step > 0 && !(_isEdit && _step == 1))
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => setState(() => _step -= 1),
              )
            : null,
      ),
      body: switch (_step) {
        0 => _buildStep0(),
        1 => _buildStep1(),
        _ => _buildStep2(),
      },
      bottomNavigationBar: _step == 1
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: FilledButton.icon(
                  onPressed: _goStep2,
                  icon: const Icon(Icons.arrow_forward),
                  label: const Text('下一步：制定训练计划'),
                ),
              ),
            )
          : _step == 2
              ? SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                    child: FilledButton.icon(
                      onPressed: _saving ? null : _save,
                      icon: _saving
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.check),
                      label: Text(_saving ? '保存中...' : (_isEdit ? '保存修改' : '创建计划')),
                    ),
                  ),
                )
              : null,
    );
  }

  // ---------- 第一步 ----------
  Widget _buildStep0() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('选择一个目标类型', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const SizedBox(height: 10),
        for (final entry in kGoalTypes.entries)
          Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: (entry.value['color'] as Color).withValues(alpha: 0.12),
                child: Icon(entry.value['icon'] as IconData, color: entry.value['color'] as Color),
              ),
              title: Text(entry.value['label'] as String,
                  style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text(entry.value['desc'] as String),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => _pickType(entry.key),
            ),
          ),
        const Divider(height: 32),
        Row(
          children: [
            const Text('从模板一键开始', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
            const SizedBox(width: 8),
            Text('自动填好所有参数', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
          ],
        ),
        const SizedBox(height: 10),
        if (_templates == null)
          const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator()))
        else if (_templates!.isEmpty)
          Text('暂无模板', style: TextStyle(color: Colors.grey.shade600)),
        for (final t in _templates ?? const <PlanTemplate>[])
          Card(
            margin: const EdgeInsets.only(bottom: 8),
            color: Colors.green.shade50.withValues(alpha: 0.5),
            child: ListTile(
              leading: Icon(
                (kGoalTypes[t.goalType]?['icon'] ?? Icons.flag) as IconData,
                color: (kGoalTypes[t.goalType]?['color'] ?? Colors.green) as Color,
              ),
              title: Text(t.title, style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text('${t.description}\n${t.weeks} 周 · 强度${t.intensity}', maxLines: 2),
              isThreeLine: true,
              trailing: const Icon(Icons.flash_on, color: Colors.green),
              onTap: () => _pickTemplate(t),
            ),
          ),
      ],
    );
  }

  // ---------- 第二步：基础信息（距离/目标时间/强度/周期/开始日期等） ----------
  Widget _buildStep1() {
    final meta = kGoalTypes[_type]!;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // 目标类型横幅
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: (meta['color'] as Color).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Icon(meta['icon'] as IconData, color: meta['color'] as Color),
              const SizedBox(width: 8),
              Text('${meta['label']} · ${meta['desc']}',
                  style: const TextStyle(fontWeight: FontWeight.bold)),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // 公共字段
        TextField(
          controller: _titleCtrl,
          decoration: const InputDecoration(
            labelText: '计划名称',
            hintText: '例如：备战校运会 1000 米',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(
            child: TextField(
              controller: _weeksCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                  labelText: '周期（周）', suffixText: '周', border: OutlineInputBorder()),
              onChanged: (_) => setState(_regenSchedule), // 周数变化 → 周均跑量变化 → 重算课表
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: TextEditingController(text: _formatDate(_startDate)),
              readOnly: true,
              decoration: const InputDecoration(
                  labelText: '开始日期', border: OutlineInputBorder()),
              onTap: () => _pickDate(isRaceDate: false),
            ),
          ),
        ]),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _intensity,
          decoration: const InputDecoration(labelText: '强度', border: OutlineInputBorder()),
          items: const [
            DropdownMenuItem(value: '低', child: Text('低（每周 2-3 次）')),
            DropdownMenuItem(value: '中等', child: Text('中等（每周 3-4 次）')),
            DropdownMenuItem(value: '高', child: Text('高（每周 5 次以上）')),
          ],
          onChanged: (v) => setState(() => _intensity = v ?? '中等'),
        ),
        const SizedBox(height: 16),
        _buildTypeFields(),
        const SizedBox(height: 16),
        TextField(
          controller: _noteCtrl,
          maxLines: 2,
          decoration: const InputDecoration(
            labelText: '备注（可选）',
            border: OutlineInputBorder(),
            alignLabelWithHint: true,
          ),
        ),
        const SizedBox(height: 8),
        Text('下一步将根据上面的基础信息和你的 PB 成绩自动生成周课表，生成后仍可手动调整。',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
      ],
    );
  }

  // 进入第三步（训练计划）：按第一步填写的基础信息重算默认课表
  void _goStep2() {
    setState(() {
      _step = 2;
      _regenSchedule();
    });
  }

  // ---------- 第三步：训练计划（周课表） ----------
  Widget _buildStep2() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // PB vs 目标 对比提示（速度/赛事类型显示，其他类型隐藏）
        _buildPbHint(),
        // 每周跑步日（体重目标不需要课表）
        if (_type != 'weight') ...[
          const Divider(height: 32),
          const Text('每周跑步日（自动生成周课表，可手动调整）',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 4),
          Text('系统按"轻松跑+质量课+长距离"科学编排：长距离放最后一天、质量课不连日；每一行都可以改成自己的安排',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              for (var i = 0; i < 7; i++)
                FilterChip(
                  label: Text(kWeekdayNames[i]),
                  selected: _days.contains(i + 1),
                  onSelected: (sel) => _toggleDay(i + 1, sel),
                ),
            ],
          ),
          const SizedBox(height: 10),
          _buildScheduleEditor(),
        ] else ...[
          const Divider(height: 32),
          Text('体重目标按"每周记录体重 + 折线图"推进，不需要安排周课表。',
              style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
        ],
        const SizedBox(height: 8),
      ],
    );
  }

  // 类型专属参数表单
  Widget _buildTypeFields() {
    if (_type == 'volume') {
      final weeks = int.tryParse(_weeksCtrl.text.trim()) ?? 0;
      final weekly = double.tryParse(_weeklyKmCtrl.text.trim());
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        TextField(
          controller: _targetKmCtrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(
            labelText: '目标总跑量（公里）',
            suffixText: 'km',
            border: OutlineInputBorder(),
          ),
          onChanged: (_) => setState(_regenSchedule), // 总跑量变化 → 周均变化 → 重算课表
        ),
        const SizedBox(height: 8),
        // 智能换算：按周跑量 × 周数
        Row(children: [
          Expanded(
            child: TextField(
              controller: _weeklyKmCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: '按周跑量算（可选）',
                suffixText: 'km/周',
                border: OutlineInputBorder(),
                isDense: true,
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),
          const SizedBox(width: 8),
          Text('× $weeks 周', style: TextStyle(color: Colors.grey.shade700)),
          const SizedBox(width: 8),
          FilledButton.tonal(
            onPressed: (weekly != null && weekly > 0 && weeks > 0)
                ? () {
                    _targetKmCtrl.text = (weekly * weeks).toStringAsFixed(0);
                    setState(() {});
                  }
                : null,
            child: const Text('填入'),
          ),
        ]),
        if (weeks > 0 && _targetKmCtrl.text.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              '即每周 ${(double.tryParse(_targetKmCtrl.text) ?? 0) / weeks} km',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
          ),
      ]);
    }
    if (_type == 'speed') {
      const distances = {'1': '1000 米', '3': '3000 米', '5': '5000 米', '10': '10000 米（万米）', '21.0975': '半程马拉松', '42.195': '全程马拉松'};
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        DropdownButtonFormField<String>(
          initialValue: _speedDistance,
          decoration: const InputDecoration(labelText: '目标距离', border: OutlineInputBorder()),
          items: distances.entries
              .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
              .toList(),
          onChanged: (v) => setState(() => _speedDistance = v ?? '5'),
        ),
        const SizedBox(height: 12),
        Text('目标成绩（不填 = 跑出成绩即达成）',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
        const SizedBox(height: 6),
        Row(children: [
          Expanded(
            child: TextField(
              controller: _speedMinCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                  labelText: '分', border: OutlineInputBorder(), isDense: true),
            ),
          ),
          const Padding(padding: EdgeInsets.symmetric(horizontal: 6), child: Text('分')),
          Expanded(
            child: TextField(
              controller: _speedSecCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                  labelText: '秒', border: OutlineInputBorder(), isDense: true),
            ),
          ),
          const Padding(padding: EdgeInsets.symmetric(horizontal: 6), child: Text('秒')),
        ]),
      ]);
    }
    if (_type == 'habit') {
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'week', label: Text('每周 N 次')),
            ButtonSegment(value: 'streak', label: Text('连续 N 天')),
          ],
          selected: {_habitMode},
          onSelectionChanged: (s) => setState(() => _habitMode = s.first),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _habitValueCtrl,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: _habitMode == 'week' ? '每周目标次数' : '连续目标天数',
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          _habitMode == 'week' ? '每周跑够次数即该周达标，全部周达标 = 计划达成' : '窗口内最长连续打卡达到目标天数 = 计划达成',
          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
        ),
      ]);
    }
    if (_type == 'race') {
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        TextField(
          controller: _raceNameCtrl,
          decoration: const InputDecoration(
            labelText: '比赛名称',
            hintText: '例如：校运会 1000 米 / 城市半马',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(
            child: TextField(
              controller: TextEditingController(text: _raceDate != null ? _formatDate(_raceDate!) : ''),
              readOnly: true,
              decoration: const InputDecoration(
                  labelText: '比赛日期（可选）', border: OutlineInputBorder()),
              onTap: () => _pickDate(isRaceDate: true),
            ),
          ),
          if (_raceDate != null)
            IconButton(
              icon: const Icon(Icons.clear),
              onPressed: () => setState(() => _raceDate = null),
            ),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(
            child: TextField(
              controller: _raceKmCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                  labelText: '比赛距离', suffixText: 'km', border: OutlineInputBorder()),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
                controller: _raceWeeklyCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                    labelText: '每周目标跑量', suffixText: 'km', border: OutlineInputBorder()),
                onChanged: (_) => setState(_regenSchedule), // 周跑量变化 → 重算课表
              ),
          ),
        ]),
        const SizedBox(height: 12),
        Text('目标成绩（可选）', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
        const SizedBox(height: 6),
        Row(children: [
          Expanded(
            child: TextField(
              controller: _raceMinCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                  labelText: '分', border: OutlineInputBorder(), isDense: true),
            ),
          ),
          const Padding(padding: EdgeInsets.symmetric(horizontal: 6), child: Text('分')),
          Expanded(
            child: TextField(
              controller: _raceSecCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                  labelText: '秒', border: OutlineInputBorder(), isDense: true),
            ),
          ),
          const Padding(padding: EdgeInsets.symmetric(horizontal: 6), child: Text('秒')),
        ]),
      ]);
    }
    // weight
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Expanded(
          child: TextField(
            controller: _startKgCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
                labelText: '当前体重', suffixText: 'kg', border: OutlineInputBorder()),
          ),
        ),
        const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Icon(Icons.arrow_forward)),
        Expanded(
          child: TextField(
            controller: _targetKgCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(
                labelText: '目标体重', suffixText: 'kg', border: OutlineInputBorder()),
          ),
        ),
      ]),
      const SizedBox(height: 6),
      Text('创建后每周到详情页记录一次体重，看曲线变化',
          style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
    ]);
  }

  // 周课表编辑器：7 天全量展示，每行可改类型和距离（手动周课表）
  Widget _buildScheduleEditor() {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('周课表（每周重复）',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)),
              const Spacer(),
              // 恢复默认：清空手动修改标记，按当前参数重新生成
              TextButton(
                style: TextButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                ),
                onPressed: () => setState(() {
                  _editedDays.clear();
                  _regenSchedule();
                }),
                child: const Text('恢复默认', style: TextStyle(fontSize: 12)),
              ),
            ],
          ),
          for (var i = 0; i < 7; i++) _scheduleRow(i),
          const SizedBox(height: 4),
          Text('休息/力量训练不需要填距离；改过的行不会被"恢复默认"之外的操作覆盖',
              style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
        ],
      ),
    );
  }

  // 单天课表行：星期 + 类型下拉 + 距离输入
  Widget _scheduleRow(int i) {
    final row = _rows[i];
    final day = row['day'] as int;
    final type = row['type'] as String;
    final selected = _days.contains(day);
    final isRestLike = isRestLikeType(type);
    final color = selected ? Colors.green : Colors.grey;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          SizedBox(
            width: 44,
            child: Text(kWeekdayNames[day - 1],
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color)),
          ),
          // 类型下拉
          Expanded(
            child: DropdownButtonFormField<String>(
              // key 带上当前类型：外部改值（恢复默认/切换星期）时强制重建，让下拉框跟着刷新
              key: ValueKey('schedule-$day-$type'),
              initialValue: kScheduleTypes.contains(type) ? type : '轻松跑',
              isDense: true,
              decoration: InputDecoration(
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                fillColor: Colors.white,
                filled: true,
              ),
              items: [
                for (final t in kScheduleTypes)
                  DropdownMenuItem(
                    value: t,
                    child: Text(t, style: TextStyle(fontSize: 12, color: kScheduleTypeColors[t])),
                  ),
              ],
              onChanged: (v) {
                if (v == null) return;
                setState(() {
                  _rows[i]['type'] = v;
                  _editedDays.add(day);
                  if (isRestLikeType(v)) {
                    _rows[i]['km'] = 0.0;
                    _kmCtrls[i].text = '';
                  } else if ((_rows[i]['km'] as double) <= 0) {
                    // 从休息改成跑步：给一个默认距离（周跑量的 30%，至少 2km）
                    final wk = _currentWeeklyKm();
                    final km = round05(wk * 0.3 < 2 ? 2 : wk * 0.3);
                    _rows[i]['km'] = km;
                    _kmCtrls[i].text = kmText(km);
                  }
                });
              },
            ),
          ),
          const SizedBox(width: 6),
          // 距离输入（休息/力量训练禁用）
          SizedBox(
            width: 64,
            child: TextField(
              controller: _kmCtrls[i],
              enabled: !isRestLike,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12),
              decoration: InputDecoration(
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                fillColor: Colors.white,
                filled: true,
              ),
              onChanged: (v) {
                setState(() {
                  _rows[i]['km'] = double.tryParse(v) ?? 0;
                  _editedDays.add(day);
                });
              },
            ),
          ),
          const SizedBox(width: 4),
          SizedBox(
            width: 24,
            child: Text(isRestLike ? '—' : 'km',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
          ),
        ],
      ),
    );
  }
}
