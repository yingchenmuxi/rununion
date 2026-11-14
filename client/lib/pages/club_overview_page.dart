// ============================================================
// 社团总览页（社长专属）：
// 展示全社每个人的跑步记录，按人分组，带汇总（总次数、总公里数）
// 点一个人可以展开/收起他的记录明细
// ============================================================
import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';

class ClubOverviewPage extends StatefulWidget {
  final String token;

  const ClubOverviewPage({super.key, required this.token});

  @override
  State<ClubOverviewPage> createState() => _ClubOverviewPageState();
}

class _ClubOverviewPageState extends State<ClubOverviewPage> {
  List<MemberSummary>? _members; // null 表示还在加载
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final members = await Api.clubOverview(widget.token);
      if (!mounted) return;
      setState(() => _members = members);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _members = [];
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // 出错了：显示错误 + 重试按钮
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: _load, child: const Text('重试')),
          ],
        ),
      );
    }
    // 还在加载
    if (_members == null) {
      return const Center(child: CircularProgressIndicator());
    }
    // 没有任何记录
    if (_members!.isEmpty) {
      return const Center(child: Text('还没有社员提交过跑步记录'));
    }
    // 下拉可以刷新
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(8),
        itemCount: _members!.length,
        itemBuilder: (context, i) {
          final m = _members![i];
          return Card(
            margin: const EdgeInsets.symmetric(vertical: 6),
            child: ExpansionTile(
              leading: CircleAvatar(
                backgroundColor: m.gender == '女' ? Colors.pink.shade100 : Colors.green.shade100,
                child: Text(m.nickname.isNotEmpty ? m.nickname.characters.first : '?'),
              ),
              title: Row(
                children: [
                  Text(m.nickname, style: const TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(width: 6),
                  // 性别小标签：男=蓝色，女=粉色
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                    decoration: BoxDecoration(
                      color: m.gender == '女' ? Colors.pink.shade50 : Colors.blue.shade50,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      m.gender,
                      style: TextStyle(
                        fontSize: 11,
                        color: m.gender == '女' ? Colors.pink : Colors.blue,
                      ),
                    ),
                  ),
                ],
              ),
              subtitle: Text('共 ${m.runCount} 次 · 合计 ${m.totalKm.toStringAsFixed(2)} 公里'),
              children: [
                // 这个人的每条记录
                for (final r in m.records)
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.directions_run, color: Colors.green),
                    title: Text(r.runDate),
                    subtitle: Text('用时 ${r.durationText} · 配速 ${r.paceText}'),
                    trailing: Text('${r.distanceKm.toStringAsFixed(2)} km'),
                  ),
                const SizedBox(height: 4),
              ],
            ),
          );
        },
      ),
    );
  }
}
