// ============================================================
// 主页（壳）：底部导航栏 + 6 大功能模块
//   0. 跑步知识普及
//   1. 运动记录与上传
//   2. 跑步计划制定
//   3. 社团功能（社团名片 / 公告 / 任务 / 约跑活动 / 成员）
//   4. 多维度排行榜
//   5. 个人中心
// 管理员顶栏还有"后台"入口
// ============================================================
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import '../config.dart';
import '../models.dart';
import 'admin_page.dart';
import 'club_page.dart';
import 'knowledge_page.dart';
import 'leaderboard_page.dart';
import 'notifications_page.dart';
import 'plans_page.dart';
import 'profile_page.dart';
import 'record_page.dart';

class HomePage extends StatefulWidget {
  final User user; // 当前登录的用户
  final String token; // 登录通行证，请求接口时要带上

  const HomePage({super.key, required this.user, required this.token});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _tabIndex = 1; // 默认打开"记录"页（最常用）
  late User _user; // 个人中心修改资料后会更新这个
  int _overduePlans = 0; // 逾期未达成的计划数量（计划 tab 小红点）
  int _unread = 0; // 未读站内通知数量（顶栏铃铛角标）

  // 6 个 tab 的标题（顶栏显示）
  static const List<String> _titles = [
    '跑步知识',
    '运动记录',
    '跑步计划',
    '社团',
    '排行榜',
    '个人中心',
  ];

  @override
  void initState() {
    super.initState();
    _user = widget.user;
    _loadUnread();
    // 启动后检查是否有新版本（仅安卓 APP 弹窗提示，网页版刷新浏览器即为最新）
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkUpdate());
  }

  // ---------- 版本更新检查 ----------
  // 安卓 APP 每次启动请求一次后端版本号，服务端版本更高就弹窗提示去下载新安装包
  Future<void> _checkUpdate() async {
    if (kIsWeb) return; // 网页版刷新浏览器就是最新，无需提示
    try {
      final data = await Api.appVersion();
      final remote = (data['version'] ?? '').toString();
      if (!_isNewerVersion(remote, kAppVersion)) return;
      if (!mounted) return;

      final notes = (data['notes'] ?? '').toString();
      final url = (data['download_url'] ?? '/app-release.apk').toString();

      final go = await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          title: const Text('发现新版本'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('最新版本：$remote（当前 $kAppVersion）'),
              if (notes.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  notes,
                  style: const TextStyle(fontSize: 13, color: Colors.black54),
                ),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('以后再说'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('立即更新'),
            ),
          ],
        ),
      );
      if (go != true) return;

      // 后端返回相对路径，拼上当前服务器地址后用系统浏览器打开下载
      final full = url.startsWith('http') ? url : '$kBaseUrl$url';
      await launchUrl(Uri.parse(full), mode: LaunchMode.externalApplication);
    } catch (_) {
      // 版本检查失败不影响正常使用，静默忽略
    }
  }

  // 比较版本号：remote 比 local 新返回 true（按 1.2.3 逐段比较数字）
  bool _isNewerVersion(String remote, String local) {
    final a = remote.split('.').map((e) => int.tryParse(e) ?? 0).toList();
    final b = local.split('.').map((e) => int.tryParse(e) ?? 0).toList();
    final len = a.length > b.length ? a.length : b.length;
    for (var i = 0; i < len; i++) {
      final x = i < a.length ? a[i] : 0;
      final y = i < b.length ? b[i] : 0;
      if (x != y) return x > y;
    }
    return false;
  }

  // 拉取未读消息数（失败不打扰用户，下次进入再刷新）
  Future<void> _loadUnread() async {
    try {
      final n = await Api.notificationUnreadCount(widget.token);
      if (mounted && n != _unread) setState(() => _unread = n);
    } on ApiException {
      // 忽略网络异常
    }
  }

  // 打开消息中心，返回后刷新未读数
  Future<void> _openNotifications() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => NotificationsPage(token: widget.token)),
    );
    _loadUnread();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_tabIndex]),
        actions: [
          // 消息中心：未读数量显示为红点角标
          IconButton(
            tooltip: '消息中心',
            onPressed: _openNotifications,
            icon: Badge(
              isLabelVisible: _unread > 0,
              label: Text(_unread > 99 ? '99+' : '$_unread'),
              child: const Icon(Icons.notifications_outlined),
            ),
          ),
          // 管理员多一个"后台管理"入口
          if (_user.isAdmin)
            TextButton.icon(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => AdminPage(token: widget.token)),
                );
              },
              icon: const Icon(Icons.admin_panel_settings, size: 18),
              label: const Text('后台'),
            ),
          const SizedBox(width: 8),
        ],
      ),
      // 用 IndexedStack 保证切换 tab 时各页面状态不丢失（列表位置、表单内容等）
      body: IndexedStack(
        index: _tabIndex,
        children: [
          KnowledgePage(token: widget.token, user: _user),
          RecordPage(token: widget.token, user: _user),
          PlansPage(
            token: widget.token,
            user: _user,
            onOverdueChanged: (n) {
              if (mounted && n != _overduePlans) setState(() => _overduePlans = n);
            },
          ),
          ClubPage(
            token: widget.token,
            user: _user,
            // 加入社团后同步更新首页用户信息（其他 tab 也能感知已加入社团）
            onUserChanged: (updated) => setState(() => _user = updated),
          ),
          LeaderboardPage(token: widget.token, user: _user),
          ProfilePage(
            token: widget.token,
            user: _user,
            onUserChanged: (updated) => setState(() => _user = updated),
          ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _tabIndex,
        onTap: (i) => setState(() => _tabIndex = i),
        type: BottomNavigationBarType.fixed, // 6 个 tab 必须 fixed，否则会错位
        items: [
          const BottomNavigationBarItem(icon: Icon(Icons.menu_book), label: '知识'),
          const BottomNavigationBarItem(icon: Icon(Icons.directions_run), label: '记录'),
          // 计划 tab：有逾期未达成计划时显示小红点数字
          BottomNavigationBarItem(
            icon: Badge(
              isLabelVisible: _overduePlans > 0,
              label: Text('$_overduePlans'),
              child: const Icon(Icons.flag),
            ),
            label: '计划',
          ),
          const BottomNavigationBarItem(icon: Icon(Icons.groups), label: '社团'),
          const BottomNavigationBarItem(icon: Icon(Icons.emoji_events), label: '排行'),
          const BottomNavigationBarItem(icon: Icon(Icons.person), label: '我的'),
        ],
      ),
    );
  }
}
