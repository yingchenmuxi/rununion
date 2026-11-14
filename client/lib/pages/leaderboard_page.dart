// ============================================================
// 模块五：多维度排行榜页
//
// 两个维度：
//   1. 范围切换（页面顶部）：社团内（默认）/ 总体（跨学校所有用户）
//   2. 榜单切换（TabBar，可横向滚动），共 13 个榜单，按"坚持 → 速度"排序：
//      本周距离 / 月跑量 / 总距离 —— 跑量类（新老都能拼）
//      社团榜 —— 各学校的长跑社之间比总跑量（全平台对比，无范围切换）
//      进步之星 / 连续打卡 / 最长距离 —— 坚持类（新人友好）
//      1000米PB / 3000米PB / 5000米PB / 万米PB / 半马PB / 全马PB —— 速度类（老将追求）
// ============================================================
import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../widgets/user_avatar.dart';

class LeaderboardPage extends StatefulWidget {
  final String token;
  final User user;

  const LeaderboardPage({super.key, required this.token, required this.user});

  @override
  State<LeaderboardPage> createState() => _LeaderboardPageState();
}

class _LeaderboardPageState extends State<LeaderboardPage> with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;

  // 范围：club=社团内（默认），all=总体
  String _scope = 'club';

  // 每个榜单的缓存：key="scope:type"，value=排行数据 / null=加载中 / 带错误
  final Map<String, List<LeaderboardEntry>?> _data = {};
  final Map<String, String?> _errors = {};

  // 11 个榜单的配置：type=接口类型，name=显示名，unit=数值格式
  // unit 说明：km=公里 / time=用时 / days=天数 / growth=增长公里数
  static const List<Map<String, String>> _boards = [
    {'type': 'week', 'name': '本周距离', 'unit': 'km'},
    {'type': 'month', 'name': '月跑量', 'unit': 'km'},
    {'type': 'total', 'name': '总距离', 'unit': 'km'},
    {'type': 'club', 'name': '社团榜', 'unit': 'club'},
    {'type': 'progress', 'name': '进步之星', 'unit': 'growth'},
    {'type': 'streak', 'name': '连续打卡', 'unit': 'days'},
    {'type': 'longest', 'name': '最长距离', 'unit': 'km'},
    {'type': 'pb1000', 'name': '1000米PB', 'unit': 'time'},
    {'type': 'pb3000', 'name': '3000米PB', 'unit': 'time'},
    {'type': 'pb5000', 'name': '5000米PB', 'unit': 'time'},
    {'type': 'pb10000', 'name': '万米PB', 'unit': 'time'},
    {'type': 'pb21097', 'name': '半马PB', 'unit': 'time'},
    {'type': 'pb42195', 'name': '全马PB', 'unit': 'time'},
  ];

  // 各榜单的空状态提示文案（说明上榜规则，引导用户）
  static const Map<String, String> _emptyHints = {
    'progress': '还没有人本周跑量超过上周\n快去跑步，成为第一个进步之星！',
    'streak': '还没有人保持连续打卡\n今天跑一次就能上榜',
    'longest': '还没有跑步记录',
    'club': '还没有社团产生跑量\n跑一次，为母校拿下第一个里程！',
    'pb1000': '还没有人跑过 1 公里以上的记录',
    'pb3000': '还没有人跑过 3 公里以上的记录',
    'pb5000': '还没有人跑过 5 公里以上的记录',
    'pb10000': '还没有人跑过 10 公里以上的记录',
    'pb21097': '还没有人跑过半马（21.1 公里）以上的记录',
    'pb42195': '还没有人跑过全马（42.2 公里）以上的记录',
  };

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: _boards.length, vsync: this);
    _tabCtrl.addListener(() {
      // 切到新 tab 时如果还没加载过，就去加载；同时刷新"范围切换"的显示/隐藏
      if (_tabCtrl.indexIsChanging) return;
      setState(() {});
      _ensureLoaded(_boards[_tabCtrl.index]['type']!);
    });
    // 默认加载第一个榜
    _load(_boards[0]['type']!);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  String _cacheKey(String type) => '$_scope:$type';

  void _ensureLoaded(String type) {
    if (!_data.containsKey(_cacheKey(type))) _load(type);
  }

  Future<void> _load(String type) async {
    final key = _cacheKey(type);
    setState(() {
      _data[key] = null;
      _errors[key] = null;
    });
    try {
      final list = await Api.leaderboard(widget.token, type, scope: _scope);
      if (!mounted) return;
      setState(() => _data[key] = list);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _errors[key] = e.message;
        _data[key] = [];
      });
    }
  }

  // 切换范围：清空全部缓存，重新加载当前榜单
  void _switchScope(String scope) {
    if (scope == _scope) return;
    setState(() {
      _scope = scope;
      _data.clear();
      _errors.clear();
    });
    _load(_boards[_tabCtrl.index]['type']!);
  }

  // 把秒数格式化为 "分:秒" 或 "时:分:秒"
  String _formatSeconds(double seconds) {
    final s = seconds.round();
    if (s >= 3600) {
      final h = s ~/ 3600;
      final m = (s % 3600) ~/ 60;
      final sec = s % 60;
      return '$h:${m.toString().padLeft(2, '0')}:${sec.toString().padLeft(2, '0')}';
    }
    final m = s ~/ 60;
    final sec = s % 60;
    return '$m:${sec.toString().padLeft(2, '0')}';
  }

  // 按榜单类型格式化数值
  String _formatValue(String unit, double value) {
    switch (unit) {
      case 'time':
        return _formatSeconds(value);
      case 'days':
        return '${value.round()} 天';
      case 'growth':
        return '+${value.toStringAsFixed(2)} km';
      default: // km / club（社团榜也是比公里数）
        return '${value.toStringAsFixed(2)} km';
    }
  }

  // 副标题：优先用后端给的 detail；否则按榜单类型给默认说明
  String? _subtitle(String type, String unit, LeaderboardEntry e) {
    if (e.detail.isNotEmpty) return e.detail;
    if (unit == 'time') return e.runDate.isNotEmpty ? '破纪录日期 ${e.runDate}' : null;
    if (type == 'longest') return e.runDate.isNotEmpty ? '达成日期 ${e.runDate}' : null;
    if (type == 'streak') return e.runDate.isNotEmpty ? '最近打卡 ${e.runDate}' : null;
    return '共 ${e.runCount} 次';
  }

  // 第 1/2/3 名的奖牌颜色
  Color? _rankColor(int rank) {
    switch (rank) {
      case 1:
        return Colors.amber; // 金
      case 2:
        return Colors.grey; // 银
      case 3:
        return Colors.brown; // 铜
      default:
        return null;
    }
  }

  Widget _buildBoard(String type, String unit) {
    final key = _cacheKey(type);
    final list = _data[key];
    final err = _errors[key];

    if (err != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(err, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: () => _load(type), child: const Text('重试')),
          ],
        ),
      );
    }
    if (list == null) return const Center(child: CircularProgressIndicator());
    if (list.isEmpty) {
      return Center(
        child: Text(
          _emptyHints[type] ?? '还没有数据',
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.grey.shade600, height: 1.6),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => _load(type),
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: list.length,
        itemBuilder: (context, i) {
          final e = list[i];
          final rank = i + 1;
          final medal = _rankColor(rank);
          // 社团榜：按后端标记判断"我所在的社团"；其他榜：按用户 id 判断
          final isClubBoard = type == 'club';
          final isMe = isClubBoard ? e.isMine : e.userId == widget.user.id;
          final sub = _subtitle(type, unit, e);

          return Card(
            margin: const EdgeInsets.only(bottom: 6),
            color: isMe ? Colors.green.shade50 : null,
            child: ListTile(
              leading: SizedBox(
                width: 60,
                child: Row(
                  children: [
                    // 名次
                    SizedBox(
                      width: 24,
                      child: medal != null
                          ? Icon(Icons.emoji_events, color: medal, size: 24)
                          : Text(
                              '$rank',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                              textAlign: TextAlign.center,
                            ),
                    ),
                    const SizedBox(width: 4),
                    // 社团榜显示群体图标，其他榜显示用户头像
                    isClubBoard
                        ? Icon(Icons.groups, size: 30, color: Colors.green.shade700)
                        : UserAvatar(avatar: e.avatar, nickname: e.nickname, gender: e.gender, size: 32),
                  ],
                ),
              ),
              title: Row(
                children: [
                  Flexible(
                    child: Text(
                      e.nickname,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (isMe) ...[
                    const SizedBox(width: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(
                        color: Colors.green,
                        borderRadius: BorderRadius.circular(3),
                      ),
                      child: Text(
                        isClubBoard ? '我社' : '我',
                        style: const TextStyle(fontSize: 10, color: Colors.white),
                      ),
                    ),
                  ],
                ],
              ),
              subtitle: sub == null ? null : Text(sub),
              trailing: Text(
                _formatValue(unit, e.value),
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: medal ?? (unit == 'growth' ? Colors.green.shade700 : Colors.black87),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // 社团榜本身就是全平台社团对比，不需要"社团内/总体"切换
    final isClubTab = _boards[_tabCtrl.index]['type'] == 'club';
    return Scaffold(
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(48),
        child: AppBar(
          automaticallyImplyLeading: false,
          title: TabBar(
            controller: _tabCtrl,
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [for (final b in _boards) Tab(text: b['name'])],
          ),
        ),
      ),
      body: Column(
        children: [
          // 范围切换：社团内 / 总体（社团榜 Tab 下隐藏）
          if (!isClubTab)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 2),
              child: SizedBox(
                width: double.infinity,
                child: SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'club', label: Text('社团内'), icon: Icon(Icons.group)),
                    ButtonSegment(value: 'all', label: Text('总体'), icon: Icon(Icons.public)),
                  ],
                  selected: {_scope},
                  onSelectionChanged: (s) => _switchScope(s.first),
                ),
              ),
            ),
          Expanded(
            child: TabBarView(
              controller: _tabCtrl,
              children: [
                for (final b in _boards) _buildBoard(b['type']!, b['unit']!),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
