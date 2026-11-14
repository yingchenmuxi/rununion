// ============================================================
// 社员详情页（社长/管理员专属）：
// 社长在社团"成员"列表点击某个社员，进入本页查看：
//   1. 社员跑步记录（按日期倒序）
//   2. 社员 PB 成绩（6 个距离，口径与排行榜一致）
//   3. 社员训练计划（状态/进度/一句话统计）
// 社长还可以在这里为社员制定计划（for_user_id）
// ============================================================
import 'package:flutter/material.dart';

import '../api.dart';
import '../widgets/user_avatar.dart';
import 'plans_page.dart';

class ClubMemberDetailPage extends StatefulWidget {
  final String token;
  final int memberId;

  const ClubMemberDetailPage({super.key, required this.token, required this.memberId});

  @override
  State<ClubMemberDetailPage> createState() => _ClubMemberDetailPageState();
}

class _ClubMemberDetailPageState extends State<ClubMemberDetailPage> {
  Map<String, dynamic>? _data; // 后端返回的完整数据
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await Api.clubMemberDetail(widget.token, widget.memberId);
      if (!mounted) return;
      setState(() {
        _data = data;
        _error = null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '加载失败：$e');
    }
  }

  // ---------- 制定计划：跳转到计划创建向导，并带上 for_user_id ----------
  Future<void> _makePlan() async {
    if (_data == null) return;
    final member = _data!['member'] as Map<String, dynamic>;
    final memberName = member['nickname'] as String;
    // 跳转到计划创建页，标记"为社员制定"；创建成功后刷新详情
    final ok = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CreatePlanPage(
          token: widget.token,
          forUserId: widget.memberId,
          forUserName: memberName,
        ),
      ),
    );
    if (ok == true) _load();
  }

  // ---------- 修改计划：进入编辑模式（预填现有参数），保存后刷新 ----------
  Future<void> _editPlan(Map<String, dynamic> plan) async {
    final ok = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CreatePlanPage(token: widget.token, editPlan: plan),
      ),
    );
    if (ok == true) _load();
  }

  // ---------- 删除计划：先弹确认框，删除成功后刷新 ----------
  Future<void> _deletePlan(Map<String, dynamic> plan) async {
    final title = plan['title'] as String? ?? '';
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('删除计划'),
        content: Text('确定要删除"$title"吗？删除后无法恢复。'),
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
      await Api.deletePlan(widget.token, (plan['id'] as num).toInt());
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

  String _fmtSec(int? s) {
    if (s == null) return '-';
    final m = s ~/ 60;
    final sec = (s % 60).toString().padLeft(2, '0');
    return '$m:$sec';
  }

  @override
  Widget build(BuildContext context) {
    final member = _data?['member'] as Map<String, dynamic>?;
    return Scaffold(
      appBar: AppBar(
        title: Text(member?['nickname'] as String? ?? '社员详情'),
        actions: [
          if (member != null)
            IconButton(
              icon: const Icon(Icons.add_task),
              tooltip: '为该社员制定计划',
              onPressed: _makePlan,
            ),
        ],
      ),
      body: _error != null
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(_error!, textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  FilledButton(onPressed: _load, child: const Text('重试')),
                ],
              ),
            )
          : _data == null
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(12),
                    children: [
                      _buildMemberCard(),
                      const SizedBox(height: 12),
                      _buildPbsCard(),
                      const SizedBox(height: 12),
                      _buildPlansCard(),
                      const SizedBox(height: 12),
                      _buildRunsCard(),
                    ],
                  ),
                ),
    );
  }

  // 社员信息卡：头像 + 昵称 + 角色
  Widget _buildMemberCard() {
    final member = _data!['member'] as Map<String, dynamic>;
    final runs = _data!['runs'] as List;
    final totalKm = runs.fold<double>(0, (s, r) => s + ((r['distance_km'] as num).toDouble()));
    return Card(
      child: ListTile(
        leading: UserAvatar(
          avatar: (member['avatar'] ?? '') as String,
          nickname: member['nickname'] as String,
          gender: (member['gender'] ?? '男') as String,
        ),
        title: Text(member['nickname'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text('共 ${runs.length} 次 · ${totalKm.toStringAsFixed(2)} 公里'),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: Colors.blue.shade50,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            switch (member['role'] as String) {
              'president' => '社长',
              'admin' => '管理员',
              _ => '社员',
            },
            style: const TextStyle(fontSize: 11, color: Colors.blue),
          ),
        ),
      ),
    );
  }

  // PB 成绩卡：6 个距离（口径与排行榜一致：必须跑满目标距离）
  Widget _buildPbsCard() {
    final pbs = _data!['pbs'] as Map<String, dynamic>;
    final items = <({String label, int? sec})>[
      (label: '1000 米', sec: pbs['pb_1000'] as int?),
      (label: '3000 米', sec: pbs['pb_3000'] as int?),
      (label: '5000 米', sec: pbs['pb_5000'] as int?),
      (label: '万米', sec: pbs['pb_10000'] as int?),
      (label: '半马', sec: pbs['pb_21097'] as int?),
      (label: '全马', sec: pbs['pb_42195'] as int?),
    ];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('PB 成绩（必须跑满该距离）', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final it in items)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: it.sec != null ? Colors.green.shade50 : Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(it.label, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                        Text(
                          _fmtSec(it.sec),
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: it.sec != null ? Colors.green : Colors.grey,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // 训练计划卡：状态 + 进度 + 一句话统计
  Widget _buildPlansCard() {
    final plans = _data!['plans'] as List;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('训练计划', style: TextStyle(fontWeight: FontWeight.bold)),
                const Spacer(),
                Text('${plans.length} 个', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              ],
            ),
            const SizedBox(height: 8),
            if (plans.isEmpty)
              Text('该社员还没有训练计划，点右上角"制定计划"为他创建一个',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600))
            else
              for (final p in plans.take(5))
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              p['title'] as String,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          _planStatusBadge(p['status'] as String),
                          // 修改该社员的计划（进入编辑模式）
                          IconButton(
                            icon: const Icon(Icons.edit_outlined, size: 18),
                            tooltip: '修改计划',
                            visualDensity: VisualDensity.compact,
                            onPressed: () =>
                                _editPlan(Map<String, dynamic>.from(p as Map)),
                          ),
                          // 删除该社员的计划
                          IconButton(
                            icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red),
                            tooltip: '删除计划',
                            visualDensity: VisualDensity.compact,
                            onPressed: () =>
                                _deletePlan(Map<String, dynamic>.from(p as Map)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        p['stat_line'] as String? ?? '',
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                ),
            if (plans.length > 5)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text('... 共 ${plans.length} 个计划',
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
              ),
          ],
        ),
      ),
    );
  }

  Widget _planStatusBadge(String status) {
    final (label, color) = switch (status) {
      'active' => ('进行中', Colors.green),
      'achieved' => ('已达成', Colors.blue),
      'expired' => ('已逾期', Colors.orange),
      'pending' => ('未开始', Colors.grey),
      _ => ('未知', Colors.grey),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(label, style: TextStyle(fontSize: 11, color: color)),
    );
  }

  // 跑步记录卡：最近 10 条（倒序）
  Widget _buildRunsCard() {
    final runs = _data!['runs'] as List;
    final recent = runs.take(10).toList();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('跑步记录', style: TextStyle(fontWeight: FontWeight.bold)),
                const Spacer(),
                Text('共 ${runs.length} 次', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              ],
            ),
            const SizedBox(height: 8),
            if (recent.isEmpty)
              Text('还没有跑步记录', style: TextStyle(fontSize: 12, color: Colors.grey.shade600))
            else
              for (final r in recent)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      Text(r['run_date'] as String, style: const TextStyle(fontSize: 12)),
                      const SizedBox(width: 12),
                      Text('${(r['distance_km'] as num).toStringAsFixed(2)} km',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      const Spacer(),
                      Text(r['duration_seconds'] != null ? _fmtSec((r['duration_seconds'] as num).toInt()) : '-',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                    ],
                  ),
                ),
          ],
        ),
      ),
    );
  }
}
