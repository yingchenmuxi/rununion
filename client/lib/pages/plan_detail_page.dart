// ============================================================
// 模块三配套：跑步计划详情页
//
// 按目标类型展示不同的"进度可视化"内容：
//   volume 跑量   → 已跑 km / 目标 km + 过量训练提醒
//   speed  速度   → 当前最好成绩 vs 目标成绩 差距卡
//   habit  习惯   → 连续打卡卡 / 每周达标格子
//   race   赛事   → 倒计时大卡 + 训练量 + 目标成绩
//   weight 体重   → 体重折线图（CustomPaint 手绘）+ 记体重
// 公共内容：进度头部、周课表、备注、删除计划
//
// 所有进度数据都由后端 /api/plans 实时算好，本页只负责展示。
// 记录体重后重新拉取 /api/plans 刷新整页，并回调 onChanged 让列表页同步刷新。
// ============================================================
import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import 'plans_page.dart' show kGoalTypes, planStatusMeta, kWeekdayNames, kmText;

class PlanDetailPage extends StatefulWidget {
  final String token;
  final Plan plan; // 从列表页带过来的计划对象（含后端算好的进度）
  final VoidCallback onChanged; // 数据变化后通知列表页刷新

  const PlanDetailPage({
    super.key,
    required this.token,
    required this.plan,
    required this.onChanged,
  });

  @override
  State<PlanDetailPage> createState() => _PlanDetailPageState();
}

class _PlanDetailPageState extends State<PlanDetailPage> {
  late Plan _plan = widget.plan;
  bool _saving = false; // 防止重复提交（记体重 / 删除）

  // 重新从后端拉取本计划（进度、体重记录等都是实时计算的）
  Future<void> _refresh() async {
    try {
      final list = await Api.myPlans(widget.token);
      final found = list.where((p) => p.id == _plan.id).toList();
      if (!mounted) return;
      if (found.isNotEmpty) {
        setState(() => _plan = found.first);
      }
      widget.onChanged(); // 通知列表页也刷新
    } on ApiException {
      // 静默失败：详情页保留旧数据即可
    }
  }

  // ---------- 记录体重（体重目标专用） ----------
  Future<void> _recordWeight() async {
    final extra = _plan.extra;
    final latest = (extra['latest_weight'] as num?)?.toDouble();
    final ctrl = TextEditingController(
      text: latest != null ? latest.toStringAsFixed(1) : '',
    );
    DateTime date = DateTime.now();
    String dateText = _fmtDate(date);

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialog) => AlertDialog(
          title: const Text('记录体重'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // 同一天重复记录会覆盖当天的旧数据
              TextField(
                controller: ctrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: '今天体重',
                  suffixText: 'kg',
                  border: OutlineInputBorder(),
                ),
                autofocus: true,
              ),
              const SizedBox(height: 12),
              // 日期默认今天，可选过去某天补记
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.event),
                title: Text(dateText),
                trailing: const Icon(Icons.chevron_right),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: ctx,
                    initialDate: date,
                    firstDate: DateTime(2020),
                    lastDate: DateTime.now(),
                  );
                  if (picked != null) {
                    setDialog(() {
                      date = picked;
                      dateText = _fmtDate(picked);
                    });
                  }
                },
              ),
              const Text('同一天重复记录会覆盖当天数据',
                  style: TextStyle(fontSize: 12, color: Colors.grey)),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('保存')),
          ],
        ),
      ),
    );
    if (ok != true) return;

    final kg = double.tryParse(ctrl.text.trim());
    if (kg == null || kg < 20 || kg > 300) {
      _toast('体重需在 20-300 kg 之间');
      return;
    }
    setState(() => _saving = true);
    try {
      await Api.addWeight(widget.token, dateText, kg);
      await _refresh();
      if (!mounted) return;
      _toast('已记录 ${kg.toStringAsFixed(1)} kg');
    } on ApiException catch (e) {
      if (!mounted) return;
      _toast(e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // ---------- 删除计划 ----------
  Future<void> _delete() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('删除计划'),
        content: Text('确定要删除"${_plan.title}"吗？删除后无法恢复。'),
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
      await Api.deletePlan(widget.token, _plan.id);
      if (!mounted) return;
      widget.onChanged();
      Navigator.pop(context);
    } on ApiException catch (e) {
      if (!mounted) return;
      _toast(e.message);
    }
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  String _fmtDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  // 秒数 → "分:秒" 或 "时:分:秒"（成绩显示用）
  String _fmtSec(num? total) {
    if (total == null) return '--:--';
    final s = total.round();
    String two(int n) => n.toString().padLeft(2, '0');
    if (s >= 3600) {
      return '${s ~/ 3600}:${two((s % 3600) ~/ 60)}:${two(s % 60)}';
    }
    return '${s ~/ 60}:${two(s % 60)}';
  }

  @override
  Widget build(BuildContext context) {
    final meta = kGoalTypes[_plan.goalType] ?? kGoalTypes['volume']!;
    final Color color = meta['color'] as Color;
    final status = planStatusMeta(_plan.status);

    return Scaffold(
      appBar: AppBar(
        title: Text(_plan.title, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(icon: const Icon(Icons.delete_outline, color: Colors.red), onPressed: _delete),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.all(14),
          children: [
            // 达成祝贺横幅：完成计划 = 一枚金色徽章（社团成员列表和个人中心都能看到）
            if (_plan.status == 'achieved')
              Card(
                color: const Color(0xFFFFF8E1),
                margin: const EdgeInsets.only(bottom: 10),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      const Text('🏅', style: TextStyle(fontSize: 30)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              '计划达成！你获得了一枚金色徽章',
                              style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF9A6B00)),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              '继续保持跑步习惯，争取下个计划也顺利达成！',
                              style: TextStyle(fontSize: 12, color: Colors.brown.shade600),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            _buildHeader(color, status),
            _typeSection(color), // 类型专属可视化区块
            _buildSchedule(),    // 周课表
            if (_plan.note.isNotEmpty) _buildNote(),
            const SizedBox(height: 8),
            // 删除按钮
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
              onPressed: _delete,
              icon: const Icon(Icons.delete_outline),
              label: const Text('删除该计划'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  // ---------- 顶部：类型 + 进度条 + 状态 ----------
  Widget _buildHeader(Color color, Map<String, dynamic> status) {
    final meta = kGoalTypes[_plan.goalType] ?? kGoalTypes['volume']!;
    return Card(
      color: color.withValues(alpha: 0.06),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: color.withValues(alpha: 0.15),
                  child: Icon(meta['icon'] as IconData, color: color, size: 20),
                ),
                const SizedBox(width: 10),
                Text(meta['label'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                const Spacer(),
                // 状态徽章
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: (status['color'] as Color).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    status['label'] as String,
                    style: TextStyle(
                        fontSize: 12,
                        color: status['color'] as Color,
                        fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            // 大号百分比 + 进度条
            Center(
              child: Text(
                '${_plan.percent}%',
                style: TextStyle(
                    fontSize: 40, fontWeight: FontWeight.bold, color: color, height: 1.1),
              ),
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: _plan.percent / 100,
                minHeight: 10,
                backgroundColor: Colors.grey.shade200,
                valueColor: AlwaysStoppedAnimation(color),
              ),
            ),
            const SizedBox(height: 10),
            Center(
              child: Text(
                _plan.statLine,
                style: TextStyle(fontSize: 14, color: Colors.grey.shade700),
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: 8),
            // 元信息：周期 / 强度 / 起止日期
            Center(
              child: Wrap(
                spacing: 12,
                children: [
                  Text('${_plan.weeks} 周 · 强度${_plan.intensity}',
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                  Text('${_plan.startDate} ~ ${_plan.endDate}',
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ---------- 类型专属区块（按 goalType 分发） ----------
  Widget _typeSection(Color color) {
    switch (_plan.goalType) {
      case 'volume':
        return _volumeSection();
      case 'speed':
        return _speedSection();
      case 'habit':
        return _habitSection();
      case 'race':
        return _raceSection();
      case 'weight':
        return _weightSection();
      default:
        return const SizedBox.shrink();
    }
  }

  // 跑量目标：已跑 / 目标 + 过量提醒
  Widget _volumeSection() {
    final done = (_plan.extra['done_km'] as num?)?.toDouble() ?? 0;
    return _card(
      icon: Icons.route,
      title: '跑量明细',
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _bigNum(done.toStringAsFixed(1), '已跑 (km)', Colors.green),
            _bigNum(_plan.targetKm.toStringAsFixed(0), '目标 (km)', Colors.grey),
            _bigNum((_plan.targetKm - done).clamp(0, 9999).toStringAsFixed(1), '还差 (km)',
                Colors.orange),
          ],
        ),
        if (_plan.extra['overtrain'] == true) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.deepOrange.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Row(
              children: [
                Icon(Icons.warning_amber, color: Colors.deepOrange, size: 18),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '本周跑量已超过计划周均的 130%，过量训练容易受伤，建议安排 1-2 天休息或力量训练。',
                    style: TextStyle(fontSize: 12, color: Colors.deepOrange),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  // 速度目标：最好成绩 vs 目标成绩
  Widget _speedSection() {
    final extra = _plan.extra;
    final dist = (extra['distance_km'] as num?)?.toDouble() ?? _plan.targetKm;
    final best = (extra['best_seconds'] as num?)?.toInt();
    final target = (extra['target_seconds'] as num?)?.toInt() ?? 0;

    return _card(
      icon: Icons.speed,
      title: '成绩追踪（${dist.toStringAsFixed(dist == dist.roundToDouble() ? 0 : 1)} km）',
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _bigNum(_fmtSec(best), '当前最好成绩', Colors.green),
            if (target > 0) ...[
              const Icon(Icons.arrow_forward, color: Colors.grey),
              _bigNum(_fmtSec(target), '目标成绩', Colors.orange),
            ],
          ],
        ),
        const SizedBox(height: 10),
        if (best == null)
          const Text(
            '还没有跑满该距离的完整记录，去运动记录页打卡一次吧。',
            style: TextStyle(fontSize: 12, color: Colors.grey),
          )
        else if (target > 0 && best > target)
          Text(
            '距目标还差 ${_fmtSec(best - target)}，坚持配速训练，很快就能突破！',
            style: const TextStyle(fontSize: 12, color: Colors.orange),
          )
        else if (target > 0)
          const Text(
            '目标达成！可以创建一个更有挑战的新目标了。',
            style: TextStyle(fontSize: 12, color: Colors.green, fontWeight: FontWeight.bold),
          ),
      ],
    );
  }

  // 习惯目标：连续打卡卡 / 每周达标格子
  Widget _habitSection() {
    final extra = _plan.extra;
    if (extra['freq_type'] == 'streak') {
      final cur = (extra['current_streak'] as num?)?.toInt() ?? 0;
      final maxS = (extra['max_streak'] as num?)?.toInt() ?? 0;
      final goal = (extra['freq_value'] as num?)?.toInt() ?? 0;
      return _card(
        icon: Icons.local_fire_department,
        title: '连续打卡',
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _bigNum('$cur', '当前连续（天）', Colors.deepPurple),
              _bigNum('$maxS', '最长连续（天）', Colors.green),
              _bigNum('$goal', '目标（天）', Colors.grey),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            cur > 0 ? '连续打卡 $cur 天，继续保持，断了就要重新数哦！' : '最近还没有连续打卡，今天跑一次点亮火焰吧。',
            style: TextStyle(fontSize: 12, color: cur > 0 ? Colors.deepPurple : Colors.grey),
          ),
        ],
      );
    }
    // 每周 N 次：格子墙，每格代表计划里的一周
    final weeksDone = ((extra['weeks_done'] as List?) ?? const [])
        .map((e) => e == true || e == 1)
        .toList();
    return _card(
      icon: Icons.event_available,
      title: '每周达标情况（每周 ${extra['freq_value']} 次）',
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (var i = 0; i < weeksDone.length; i++)
              Container(
                width: 64,
                padding: const EdgeInsets.symmetric(vertical: 6),
                decoration: BoxDecoration(
                  color: weeksDone[i]
                      ? Colors.green.withValues(alpha: 0.15)
                      : Colors.grey.shade200,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  children: [
                    Text('第${i + 1}周',
                        style: TextStyle(fontSize: 11, color: Colors.grey.shade700)),
                    const SizedBox(height: 2),
                    Icon(
                      weeksDone[i] ? Icons.check_circle : Icons.radio_button_unchecked,
                      size: 18,
                      color: weeksDone[i] ? Colors.green : Colors.grey,
                    ),
                  ],
                ),
              ),
          ],
        ),
        if (weeksDone.isEmpty)
          const Text('计划刚开始，第一周跑够次数就会点亮。',
              style: TextStyle(fontSize: 12, color: Colors.grey)),
      ],
    );
  }

  // 赛事目标：倒计时大卡 + 训练量 + 目标成绩
  Widget _raceSection() {
    final extra = _plan.extra;
    final done = (extra['done_km'] as num?)?.toDouble() ?? 0;
    final planned = (extra['planned_total'] as num?)?.toDouble() ?? 0;
    final best = (extra['best_seconds'] as num?)?.toInt();
    final target = (extra['target_seconds'] as num?)?.toInt() ?? 0;
    final raceDate = (extra['race_date'] as String?) ?? '';
    final raceKm = (_plan.goalData['race_km'] as num?)?.toDouble() ?? 0;

    return Column(
      children: [
        // 倒计时大卡（有比赛日期才显示）
        if (extra['countdown_days'] != null)
          Card(
            color: Colors.red.withValues(alpha: 0.07),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Text(
                    (extra['race_name'] as String?) ?? '比赛',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    (extra['countdown_days'] as num) > 0
                        ? '${extra['countdown_days']}'
                        : '0',
                    style: const TextStyle(
                        fontSize: 48,
                        fontWeight: FontWeight.bold,
                        color: Colors.red,
                        height: 1.1),
                  ),
                  const Text('天 · 距比赛',
                      style: TextStyle(fontSize: 13, color: Colors.grey)),
                  const SizedBox(height: 6),
                  Text(raceDate.isEmpty ? '' : '比赛日期：$raceDate · 距离 ${raceKm}km',
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                ],
              ),
            ),
          ),
        _card(
          icon: Icons.emoji_events,
          title: '备赛训练量',
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _bigNum(done.toStringAsFixed(1), '已训练 (km)', Colors.red),
                _bigNum(planned.toStringAsFixed(0), '计划总量 (km)', Colors.grey),
              ],
            ),
            if (_plan.extra['overtrain'] == true) ...[
              const SizedBox(height: 12),
              const Text(
                '⚠ 本周跑量偏高，赛前注意减量恢复，避免带伤上场。',
                style: TextStyle(fontSize: 12, color: Colors.deepOrange),
              ),
            ],
          ],
        ),
        // 目标成绩卡（填了目标成绩才显示）
        if (target > 0)
          _card(
            icon: Icons.timer,
            title: '目标成绩（${raceKm}km）',
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _bigNum(_fmtSec(best), '当前最好成绩', Colors.green),
                  const Icon(Icons.arrow_forward, color: Colors.grey),
                  _bigNum(_fmtSec(target), '比赛目标', Colors.red),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                best == null
                    ? '还没有跑满 ${raceKm}km 的完整记录，长距离拉练时可以测一次。'
                    : (best <= target
                        ? '状态已达标！按这个水平正常发挥就能实现目标。'
                        : '距目标还差 ${_fmtSec(best - target)}，赛前四周重点练配速。'),
                style: TextStyle(
                    fontSize: 12,
                    color: best != null && best <= target ? Colors.green : Colors.grey),
              ),
            ],
          ),
      ],
    );
  }

  // 体重目标：折线图 + 记体重按钮
  Widget _weightSection() {
    final extra = _plan.extra;
    final start = (extra['start_kg'] as num?)?.toDouble() ?? 0;
    final target = (extra['target_kg'] as num?)?.toDouble() ?? 0;
    final latest = (extra['latest_weight'] as num?)?.toDouble();
    final logs = ((extra['weight_logs'] as List?) ?? const [])
        .map((e) => {
              'date': (e['log_date'] ?? '') as String,
              'kg': (e['weight_kg'] as num?)?.toDouble() ?? 0,
            })
        .toList();
    final losing = target < start; // true=减重，false=增重

    return _card(
      icon: Icons.monitor_weight,
      title: '体重曲线',
      trailing: FilledButton.tonalIcon(
        onPressed: _saving ? null : _recordWeight,
        icon: const Icon(Icons.edit, size: 16),
        label: const Text('记体重'),
        style: FilledButton.styleFrom(
          visualDensity: VisualDensity.compact,
          backgroundColor: Colors.blue.withValues(alpha: 0.1),
          foregroundColor: Colors.blue,
        ),
      ),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _bigNum(start.toStringAsFixed(1), '起始 (kg)', Colors.grey),
            _bigNum(
                latest != null ? latest.toStringAsFixed(1) : '--',
                '当前 (kg)',
                Colors.blue),
            _bigNum(target.toStringAsFixed(1), '目标 (kg)',
                losing ? Colors.green : Colors.orange),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          losing ? '减重计划：管住嘴迈开腿，每周稳定下降 0.25-0.5 kg 最健康' : '增重/增肌计划：配合力量训练与充足蛋白质',
          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
        ),
        const SizedBox(height: 10),
        // 折线图：不足 2 个点时不画，引导先记录
        SizedBox(
          height: 180,
          child: logs.length < 2
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.show_chart, size: 40, color: Colors.grey),
                      const SizedBox(height: 6),
                      Text(
                        logs.isEmpty ? '还没有体重记录，点右上角"记体重"开始' : '再记录一次就能看到曲线变化',
                        style: const TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                    ],
                  ),
                )
              : CustomPaint(
                  size: Size.infinite,
                  painter: _WeightChartPainter(logs: logs, targetKg: target),
                ),
        ),
      ],
    );
  }

  // ---------- 周课表打卡（N3） ----------
  // 显示本周课表：每节课可点右侧圆圈打卡/取消打卡
  // 规则与后端一致：休息日不可打卡、未来日期不可打卡、只有本人能打卡
  Widget _buildSchedule() {
    final sched = ((_plan.goalData['schedule'] as List?) ?? const [])
        .map((e) => {
              'day': ((e['day'] as num?) ?? 1).toInt().clamp(1, 7),
              'type': (e['type'] ?? '轻松跑') as String,
              'km': (e['km'] as num?)?.toDouble() ?? 0,
            })
        .toList();
    if (sched.isEmpty) return const SizedBox.shrink();
    sched.sort((a, b) => (a['day'] as int).compareTo(b['day'] as int));

    // 计算当前是计划的第几周（1 起；未开始=0，已结束=weeks+1）
    // 统一按"周一~周日"为一周：第 1 周从开始日期所在周的周一算起，
    // 这样周四创建的计划，周四的课就对应今天，可以正常打卡
    final start = DateTime.parse(_plan.startDate);
    final weekStart = start.subtract(Duration(days: start.weekday - 1));
    final today = DateTime.now();
    final todayOnly = DateTime(today.year, today.month, today.day);
    final weekNo = todayOnly.difference(weekStart).inDays ~/ 7 + 1;

    // 不同课表类型配不同颜色，一眼区分训练强度
    const typeColors = {
      '轻松跑': Colors.green,
      '配速跑': Colors.blue,
      '间歇': Colors.orange,
      '长距离': Colors.red,
      '休息': Colors.grey,
      '力量训练': Colors.purple,
      '交叉训练': Colors.purple, // 旧数据兼容
    };

    return _card(
      icon: Icons.calendar_month,
      title: weekNo >= 1 && weekNo <= _plan.weeks
          ? '本周课表打卡（第 $weekNo 周）'
          : '每周课表（按周重复）',
      children: [
        // 计划未开始/已结束时给个提示，此时只读展示课表不打卡
        if (weekNo < 1)
          const Padding(
            padding: EdgeInsets.only(bottom: 8),
            child: Text('计划还未开始，开始后才能打卡',
                style: TextStyle(fontSize: 12, color: Colors.grey)),
          )
        else if (weekNo > _plan.weeks)
          const Padding(
            padding: EdgeInsets.only(bottom: 8),
            child: Text('计划周期已结束，课表仅作回顾',
                style: TextStyle(fontSize: 12, color: Colors.grey)),
          ),
        for (final item in sched)
          _scheduleRow(item, weekNo, typeColors, todayOnly, weekStart),
      ],
    );
  }

  // 单条课表行：星期 + 类型徽章 + 距离 + 打卡按钮
  Widget _scheduleRow(Map<String, dynamic> item, int weekNo,
      Map<String, Color> typeColors, DateTime todayOnly, DateTime weekStart) {
    final day = item['day'] as int;
    final type = item['type'] as String;
    final km = item['km'] as double;
    final isRest = type == '休息';
    // 这节课对应的具体日期：第 1 周周一 + 偏移
    final dateOfItem = weekStart.add(Duration(days: (weekNo - 1) * 7 + (day - 1)));
    final isFuture = dateOfItem.isAfter(todayOnly);
    // 计划开始日期之前的课不算数（比如周四创建的计划，本周周一~周三不能补打卡）
    final planStartOnly = DateTime.parse(_plan.startDate);
    final isBeforeStart = dateOfItem.isBefore(planStartOnly);
    final inPlan = weekNo >= 1 && weekNo <= _plan.weeks;
    final checked = _plan.checkins.contains('$weekNo-$day');
    final canTap = !isRest && inPlan && !isFuture && !isBeforeStart && !_saving;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 48,
            child: Text(
              kWeekdayNames[day - 1],
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: (typeColors[type] ?? Colors.green).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              type,
              style: TextStyle(
                  fontSize: 11,
                  color: typeColors[type] ?? Colors.green,
                  fontWeight: FontWeight.bold),
            ),
          ),
          const Spacer(),
          Text(
            km > 0 ? '${kmText(km)} km' : '—',
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: km > 0 ? Colors.green : Colors.grey),
          ),
          const SizedBox(width: 8),
          // 打卡圆圈：已打卡=绿色实心勾；可打卡=空心圈；不可打卡=灰色减号
          GestureDetector(
            onTap: canTap ? () => _toggleCheckin(weekNo, day) : null,
            child: Icon(
              checked
                  ? Icons.check_circle
                  : (canTap ? Icons.radio_button_unchecked : Icons.remove_circle_outline),
              size: 22,
              color: checked
                  ? Colors.green
                  : (canTap ? Colors.grey : Colors.grey.shade300),
            ),
          ),
        ],
      ),
    );
  }

  // 切换打卡状态，成功后整页刷新（进度、打卡记录都在 /api/plans 里）
  Future<void> _toggleCheckin(int weekNo, int day) async {
    setState(() => _saving = true);
    try {
      final checked =
          await Api.togglePlanCheckin(widget.token, _plan.id, weekNo, day);
      await _refresh();
      if (!mounted) return;
      _toast(checked ? '打卡成功，继续保持！' : '已取消打卡');
    } on ApiException catch (e) {
      if (!mounted) return;
      _toast(e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // ---------- 备注 ----------
  Widget _buildNote() {
    return _card(
      icon: Icons.sticky_note_2,
      title: '备注',
      children: [
        Text(_plan.note, style: const TextStyle(fontSize: 13, height: 1.5)),
      ],
    );
  }

  // 通用卡片容器
  Widget _card({
    required IconData icon,
    required String title,
    Widget? trailing,
    required List<Widget> children,
  }) {
    return Card(
      margin: const EdgeInsets.only(top: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: Colors.grey.shade700),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(title,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                ),
                if (trailing != null) trailing,
              ],
            ),
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      ),
    );
  }

  // 大数字统计项（标签在数字下面）
  Widget _bigNum(String value, String label, Color color) {
    return Column(
      children: [
        Text(value,
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
      ],
    );
  }
}

// ============================================================
// 体重折线图画笔（CustomPaint）
// 数据点：[{date: 'YYYY-MM-DD', kg: 65.2}, ...]，横轴均匀分布
// 同时画出目标体重的横向虚线，方便对比当前走势
// ============================================================
class _WeightChartPainter extends CustomPainter {
  final List<Map<String, dynamic>> logs;
  final double targetKg;

  _WeightChartPainter({required this.logs, required this.targetKg});

  @override
  void paint(Canvas canvas, Size size) {
    final values = logs.map((e) => e['kg'] as double).toList();
    // 边距：左边留出纵轴标签空间，下面留日期标签
    const left = 38.0, right = 10.0, top = 14.0, bottom = 20.0;
    final chartW = size.width - left - right;
    final chartH = size.height - top - bottom;
    if (chartW <= 0 || chartH <= 0) return;

    // 纵轴范围：所有值 + 目标线，上下各留 0.5kg 余量
    double minV = values.reduce((a, b) => a < b ? a : b);
    double maxV = values.reduce((a, b) => a > b ? a : b);
    if (targetKg > 0) {
      minV = minV < targetKg ? minV : targetKg;
      maxV = maxV > targetKg ? maxV : targetKg;
    }
    minV -= 0.5;
    maxV += 0.5;
    if (maxV - minV < 1) maxV = minV + 1; // 数据全相同时强制拉开范围

    double yOf(double v) => top + chartH * (1 - (v - minV) / (maxV - minV));
    double xOf(int i) =>
        logs.length == 1 ? left + chartW / 2 : left + chartW * i / (logs.length - 1);

    final labelStyle = TextStyle(fontSize: 10, color: Colors.grey.shade600);

    void drawLabel(String text, double x, double y, {bool right = false}) {
      final tp = TextPainter(
        text: TextSpan(text: text, style: labelStyle),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas,
          Offset(right ? x - tp.width : x - tp.width / 2, y - tp.height / 2));
    }

    // 背景网格线（上下限两条）
    final gridPaint = Paint()
      ..color = Colors.grey.shade200
      ..strokeWidth = 1;
    canvas.drawLine(Offset(left, yOf(maxV - 0.5)), Offset(left + chartW, yOf(maxV - 0.5)), gridPaint);
    canvas.drawLine(Offset(left, yOf(minV + 0.5)), Offset(left + chartW, yOf(minV + 0.5)), gridPaint);
    drawLabel((maxV - 0.5).toStringAsFixed(1), 4, yOf(maxV - 0.5), right: true);
    drawLabel((minV + 0.5).toStringAsFixed(1), 4, yOf(minV + 0.5), right: true);

    // 目标体重虚线（橙色）
    if (targetKg > 0) {
      final ty = yOf(targetKg);
      final dashPaint = Paint()
        ..color = Colors.orange
        ..strokeWidth = 1.5;
      for (double x = left; x < left + chartW; x += 10) {
        canvas.drawLine(Offset(x, ty), Offset((x + 5).clamp(left, left + chartW), ty), dashPaint);
      }
      drawLabel('目标 ${targetKg.toStringAsFixed(1)}', 4, ty, right: true);
    }

    // 折线 + 数据点
    final linePaint = Paint()
      ..color = Colors.blue
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;
    final dotPaint = Paint()..color = Colors.blue;
    final dotBorder = Paint()
      ..color = Colors.white
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    final points = <Offset>[
      for (var i = 0; i < logs.length; i++) Offset(xOf(i), yOf(values[i])),
    ];
    for (var i = 0; i < points.length - 1; i++) {
      canvas.drawLine(points[i], points[i + 1], linePaint);
    }
    for (final p in points) {
      canvas.drawCircle(p, 4, dotPaint);
      canvas.drawCircle(p, 4, dotBorder);
    }

    // 横轴：第一个和最后一个日期（只显示月-日）
    if (logs.length >= 2) {
      final first = (logs.first['date'] as String);
      final last = (logs.last['date'] as String);
      drawLabel(first.length >= 10 ? first.substring(5) : first, points.first.dx, size.height - 8);
      drawLabel(last.length >= 10 ? last.substring(5) : last, points.last.dx, size.height - 8);
    }
  }

  @override
  bool shouldRepaint(covariant _WeightChartPainter old) =>
      old.logs.length != logs.length ||
      old.targetKg != targetKg ||
      old.logs.toString() != logs.toString();
}
