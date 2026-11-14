// ============================================================
// 消息中心页：展示站内通知（公告 / 任务 / 约跑 / 入社退社审批结果）
// 进入时加载列表，点击一条自动标记已读，右上角支持一键全部已读
// ============================================================
import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';

class NotificationsPage extends StatefulWidget {
  final String token;

  const NotificationsPage({super.key, required this.token});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<AppNotification>? _list;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await Api.listNotifications(widget.token);
      if (!mounted) return;
      setState(() {
        _list = list;
        _error = null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  // 不同类型用不同图标和颜色，扫一眼就能区分
  IconData _iconOf(String type) {
    switch (type) {
      case 'announcement':
      case 'broadcast':
        return Icons.campaign;
      case 'task':
        return Icons.assignment;
      case 'event':
        return Icons.directions_run;
      case 'join':
        return Icons.group_add;
      case 'leave':
        return Icons.logout;
      case 'president':
        return Icons.admin_panel_settings;
      default:
        return Icons.notifications;
    }
  }

  Color _colorOf(String type) {
    switch (type) {
      case 'announcement':
        return Colors.blue;
      case 'broadcast':
        return Colors.pink;
      case 'task':
        return Colors.deepPurple;
      case 'event':
        return Colors.teal;
      case 'join':
        return Colors.green;
      case 'leave':
        return Colors.orange;
      case 'president':
        return Colors.indigo;
      default:
        return Colors.grey;
    }
  }

  Future<void> _markAllRead() async {
    try {
      await Api.markAllNotificationsRead(widget.token);
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _tap(AppNotification n) async {
    if (!n.isRead) {
      // 先本地置为已读，界面立即变化，网络失败也不影响阅读
      setState(() {
        _list = _list
            ?.map((e) => e.id == n.id
                ? AppNotification(
                    id: e.id,
                    type: e.type,
                    title: e.title,
                    content: e.content,
                    clubId: e.clubId,
                    isRead: true,
                    createdAt: e.createdAt,
                  )
                : e)
            .toList();
      });
      try {
        await Api.markNotificationRead(widget.token, n.id);
      } on ApiException {
        // 标记失败不提示，下次进入会重新加载
      }
    }
    // 全员消息：弹窗显示完整内容，并可回复
    if (n.type == 'broadcast') {
      _showBroadcastReply(n);
    }
  }

  // 广播消息详情 + 回复弹窗
  Future<void> _showBroadcastReply(AppNotification n) async {
    final replyCtrl = TextEditingController();
    bool sending = false;

    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: Text(n.title),
          content: SizedBox(
            width: double.maxFinite,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (n.content.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(n.content, style: const TextStyle(height: 1.5)),
                    ),
                  TextField(
                    controller: replyCtrl,
                    maxLines: 3,
                    maxLength: 500,
                    decoration: const InputDecoration(
                      labelText: '回复管理员（可选）',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('关闭')),
            FilledButton(
              onPressed: sending
                  ? null
                  : () async {
                      final text = replyCtrl.text.trim();
                      if (text.isEmpty) {
                        Navigator.pop(ctx);
                        return;
                      }
                      setDlg(() => sending = true);
                      try {
                        // 通过标题匹配找到对应的广播 id
                        final broadcasts = await Api.listBroadcasts(widget.token);
                        final matches = broadcasts.where((e) => e.title == n.title).toList();
                        final b = matches.isEmpty ? null : matches.first;
                        if (b == null) {
                          if (!ctx.mounted) return;
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('该消息已被删除')),
                          );
                          return;
                        }
                        await Api.replyBroadcast(widget.token, b.id, text);
                        if (!ctx.mounted) return;
                        Navigator.pop(ctx);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('回复已发送')),
                        );
                      } on ApiException catch (e) {
                        setDlg(() => sending = false);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(e.message)),
                        );
                      }
                    },
              child: Text(sending ? '发送中...' : '回复'),
            ),
          ],
        ),
      ),
    );
    replyCtrl.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('消息中心'),
        actions: [
          TextButton(
            onPressed: _markAllRead,
            child: const Text('全部已读'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: Builder(
          builder: (ctx) {
            if (_error != null && _list == null) {
              return ListView(
                children: [
                  const SizedBox(height: 120),
                  Center(child: Text(_error!)),
                  const SizedBox(height: 12),
                  Center(child: OutlinedButton(onPressed: _load, child: const Text('重新加载'))),
                ],
              );
            }
            if (_list == null) return const Center(child: CircularProgressIndicator());
            if (_list!.isEmpty) {
              return ListView(
                children: const [
                  SizedBox(height: 140),
                  Icon(Icons.notifications_none, size: 64, color: Colors.grey),
                  SizedBox(height: 12),
                  Center(child: Text('暂时没有消息')),
                ],
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.all(8),
              itemCount: _list!.length,
              itemBuilder: (_, i) {
                final n = _list![i];
                return Card(
                  color: n.isRead ? null : Colors.blue.shade50,
                  child: ListTile(
                    onTap: () => _tap(n),
                    leading: CircleAvatar(
                      backgroundColor: _colorOf(n.type).withValues(alpha: 0.12),
                      child: Icon(_iconOf(n.type), color: _colorOf(n.type)),
                    ),
                    title: Row(
                      children: [
                        Expanded(
                          child: Text(
                            n.title,
                            style: TextStyle(
                              fontWeight: n.isRead ? FontWeight.normal : FontWeight.bold,
                            ),
                          ),
                        ),
                        if (!n.isRead)
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                          ),
                      ],
                    ),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (n.content.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(n.content, style: const TextStyle(height: 1.4)),
                          ),
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            n.createdAt,
                            style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                          ),
                        ),
                      ],
                    ),
                    isThreeLine: n.content.isNotEmpty,
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
