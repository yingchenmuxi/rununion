// ============================================================
// 模块四：社团功能页
// 三个子分栏：
//   社团：社团名片（简介/训练时间/训练地点/联系方式）+ 公告 + 任务
//   活动：约跑活动（所有社员都能发起，点击报名/取消报名）
//   成员：成员名单；社长/管理员额外看到活跃度、计划状态与激励徽章
// 权限说明：
//   公告/任务/名片的"发布、修改"只有社长和管理员能做
//   活动所有社员都能发起，发起人/社长/管理员能删除
//   普通社员看不到其他人的跑量和计划状态（后端就不会返回这些字段）
// ============================================================
import 'package:flutter/material.dart';

import '../api.dart';
import '../local_store.dart';
import '../models.dart';
import '../widgets/user_avatar.dart';
import 'club_member_detail_page.dart';
import 'login_page.dart';

// 成员计划状态的配色（四色规则）
// 灰 = 无进行中计划；蓝 = 进行中；橙 = 逾期未达成；金色徽章 = 已达成数量
Color planStateColor(String state) {
  switch (state) {
    case 'active':
      return Colors.blue;
    case 'expired':
      return Colors.orange;
    default:
      return Colors.grey;
  }
}

// 成员筛选条
const List<String> kMemberFilters = ['全部', '无计划', '计划逾期', '本周未跑'];

class ClubPage extends StatefulWidget {
  final String token;
  final User user;
  // 加入社团后通知首页更新用户信息（其他页面也要同步"已加入社团"）
  final void Function(User)? onUserChanged;

  const ClubPage({super.key, required this.token, required this.user, this.onUserChanged});

  @override
  State<ClubPage> createState() => _ClubPageState();
}

class _ClubPageState extends State<ClubPage> with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;
  late User _user; // 本页最新用户信息（加入社团后会更新）

  ClubProfile? _profile;
  List<Announcement>? _announcements;
  List<ClubTask>? _tasks;
  List<ClubMember>? _members;
  List<ClubEvent>? _events;

  String? _errProfile;
  String? _errAnn;
  String? _errTask;
  String? _errMember;
  String? _errEvent;

  String _memberFilter = '全部'; // 成员列表筛选：全部 / 无计划 / 计划逾期 / 本周未跑

  // ---------- 无社团用户专用状态 ----------
  Application? _application; // 我最近一条社长申请（null = 还没申请过）
  bool _appLoaded = false; // 申请状态是否已加载完成

  // ---------- 社团成员申请（入社 / 退社）----------
  MyMembership? _membership; // 我的入社/退社申请进度
  List<MembershipRequest>? _pendingRequests; // 社长/管理员待审批列表
  bool _loadingRequests = false;

  @override
  void initState() {
    super.initState();
    _user = widget.user;
    _tabCtrl = TabController(length: 3, vsync: this);
    // 切换分栏时重建（活动页的 + 按钮只在活动分栏显示）
    _tabCtrl.addListener(() => setState(() {}));
    if (_user.hasClub) {
      _loadAll();
    } else {
      // 无社团用户：只加载申请进度（社长申请 + 入社申请）
      _loadApplication();
      _loadMembership();
    }
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  // 首次进入：并行加载各块数据（某一块失败不影响其他块）
  void _loadAll() {
    _loadProfile();
    _loadAnnouncements();
    _loadTasks();
    _loadMembers();
    _loadEvents();
    _loadMembership();
    // 社长/管理员：额外加载待审批的入社/退社申请
    if (_canPublish) _loadPendingRequests();
  }

  // 加载我的入社/退社申请进度（无社团用户看入社进度，社员看退社进度）
  Future<void> _loadMembership() async {
    try {
      final m = await Api.myMembership(widget.token);
      if (!mounted) return;
      setState(() => _membership = m);
    } on ApiException {
      // 加载失败不打断主流程
    }
  }

  // 加载本社团待审批的入社/退社申请（仅社长/管理员）
  Future<void> _loadPendingRequests() async {
    try {
      final list = await Api.listMembershipRequests(widget.token);
      if (!mounted) return;
      setState(() => _pendingRequests = list);
    } on ApiException {
      if (!mounted) return;
      setState(() => _pendingRequests = []);
    }
  }

  Future<void> _loadProfile() async {
    setState(() => _errProfile = null);
    try {
      final p = await Api.clubProfile(widget.token);
      if (!mounted) return;
      setState(() => _profile = p);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _errProfile = e.message);
    }
  }

  Future<void> _loadAnnouncements() async {
    setState(() => _errAnn = null);
    try {
      final list = await Api.clubAnnouncements(widget.token);
      if (!mounted) return;
      setState(() => _announcements = list);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _errAnn = e.message;
        _announcements = [];
      });
    }
  }

  Future<void> _loadTasks() async {
    setState(() => _errTask = null);
    try {
      final list = await Api.clubTasks(widget.token);
      if (!mounted) return;
      setState(() => _tasks = list);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _errTask = e.message;
        _tasks = [];
      });
    }
  }

  Future<void> _loadMembers() async {
    setState(() => _errMember = null);
    try {
      final list = await Api.clubMembers(widget.token);
      if (!mounted) return;
      setState(() => _members = list);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _errMember = e.message;
        _members = [];
      });
    }
  }

  Future<void> _loadEvents() async {
    setState(() => _errEvent = null);
    try {
      final list = await Api.clubEvents(widget.token);
      if (!mounted) return;
      setState(() => _events = list);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _errEvent = e.message;
        _events = [];
      });
    }
  }

  // ============================================================
  // 无社团用户：申请进度加载 / 提交申请 / 界面
  // ============================================================

  // 加载我最近一条社长申请
  Future<void> _loadApplication() async {
    try {
      final app = await Api.myApplication(widget.token);
      if (!mounted) return;
      setState(() {
        _application = app;
        _appLoaded = true;
      });
    } on ApiException {
      if (!mounted) return;
      setState(() => _appLoaded = true); // 加载失败也展示界面（按无申请处理）
    }
  }

  // 无社团用户：浏览所有社团并提交入社申请（需社长审批）
  Future<void> _showJoinClubDialog() async {
    List<OpenClub> clubs;
    try {
      clubs = await Api.listOpenClubs(widget.token);
    } on ApiException catch (e) {
      _toast(e.message);
      return;
    }
    if (!mounted) return;
    if (clubs.isEmpty) {
      _toast('暂时还没有社团，可以申请成为社长来创建');
      return;
    }

    int? selected;
    final reasonCtrl = TextEditingController();
    bool submitting = false;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: const Text('申请加入社团'),
          content: SizedBox(
            width: double.maxFinite,
            child: ListView(
              shrinkWrap: true,
              children: [
                ...clubs.map((c) => RadioListTile<int>(
                      value: c.id,
                      groupValue: selected,
                      onChanged: submitting ? null : (v) => setDlg(() => selected = v),
                      title: Text(c.name),
                      subtitle: Text(
                        '${c.schoolName.isEmpty ? '未设置学校' : c.schoolName} · ${c.memberCount} 名成员'
                        '${c.trainingTime.isEmpty ? '' : '\n训练时间：${c.trainingTime}'}',
                      ),
                      isThreeLine: c.trainingTime.isNotEmpty,
                    )),
                const SizedBox(height: 8),
                TextField(
                  controller: reasonCtrl,
                  enabled: !submitting,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: '申请留言（选填）',
                    hintText: '介绍一下自己，方便社长通过申请',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '提交后需该社团社长审批，通过后自动加入社团',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: submitting ? null : () => Navigator.pop(ctx, false),
              child: const Text('取消'),
            ),
            FilledButton(
              onPressed: (submitting || selected == null)
                  ? null
                  : () async {
                      // 防重复提交：提交中按钮置灰
                      setDlg(() => submitting = true);
                      try {
                        final msg = await Api.requestJoinClub(
                          widget.token,
                          selected!,
                          reason: reasonCtrl.text.trim(),
                        );
                        if (!ctx.mounted) return;
                        Navigator.pop(ctx, true);
                        _toast(msg);
                        // 刷新申请进度，页面会显示"审核中"
                        await _loadMembership();
                      } on ApiException catch (e) {
                        setDlg(() => submitting = false);
                        if (ctx.mounted) {
                          ScaffoldMessenger.of(ctx)
                              .showSnackBar(SnackBar(content: Text(e.message)));
                        }
                      }
                    },
              child: Text(submitting ? '提交中...' : '提交申请'),
            ),
          ],
        ),
      ),
    );
    reasonCtrl.dispose();
    if (ok != true || !mounted) return;
    setState(() {}); // 刷新页面上的申请状态卡
  }

  // 弹出"申请成为社长"对话框（无社团时补申请 / 被驳回后重新申请）
  Future<void> _showApplyDialog() async {
    final schoolCtrl = TextEditingController(
        text: (_application?.isRejected ?? false) ? _application!.schoolName : '');
    final clubCtrl = TextEditingController(
        text: (_application?.isRejected ?? false) ? _application!.clubName : '');
    final noteCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('申请成为社长'),
        content: Form(
          key: formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: schoolCtrl,
                  decoration: const InputDecoration(
                    labelText: '学校/社团名称（必填）',
                    hintText: '例如 华师附中',
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) =>
                      (v == null || v.trim().length < 2) ? '学校名称至少 2 个字' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: clubCtrl,
                  decoration: const InputDecoration(
                    labelText: '社团名称（选填，默认"长跑社"）',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: noteCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: '申请留言（选填）',
                    hintText: '向管理员介绍一下你和社团的情况',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          FilledButton(
            onPressed: () async {
              if (!(formKey.currentState?.validate() ?? false)) return;
              try {
                await Api.applyPresident(
                  widget.token,
                  schoolName: schoolCtrl.text.trim(),
                  clubName: clubCtrl.text.trim(),
                  note: noteCtrl.text.trim(),
                );
                if (ctx.mounted) Navigator.pop(ctx, true);
              } on ApiException catch (e) {
                if (ctx.mounted) {
                  ScaffoldMessenger.of(ctx)
                      .showSnackBar(SnackBar(content: Text(e.message)));
                }
              }
            },
            child: const Text('提交申请'),
          ),
        ],
      ),
    );
    schoolCtrl.dispose();
    clubCtrl.dispose();
    noteCtrl.dispose();
    if (ok == true) {
      _toast('申请已提交，请等待管理员审批');
      _loadApplication();
    }
  }

  // 无社团用户看到的界面：入社申请进度 + 社长申请进度
  Widget _buildNoClubView() {
    if (!_appLoaded) {
      return const Center(child: CircularProgressIndicator());
    }
    final app = _application;
    final joinReq = _membership?.join;
    final joinPending = joinReq != null && joinReq.isPending;
    return RefreshIndicator(
      onRefresh: () async {
        await Future.wait([_loadApplication(), _loadMembership()]);
      },
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const SizedBox(height: 40),
          const Icon(Icons.groups_outlined, size: 72, color: Colors.grey),
          const SizedBox(height: 16),
          const Text(
            '你还没有加入社团',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            '可以申请加入已有社团（需社长审批），也可以申请成为社长创建自己的社团。',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey.shade600, height: 1.6),
          ),
          const SizedBox(height: 24),
          // 主入口：浏览已有社团并提交入社申请
          FilledButton.icon(
            onPressed: joinPending ? null : _showJoinClubDialog,
            icon: const Icon(Icons.group_add),
            label: Text(joinPending ? '入社申请审核中' : '浏览并申请加入社团'),
          ),
          const SizedBox(height: 8),
          // ---------- 入社申请进度卡片 ----------
          if (joinReq != null) ...[
            Card(
              color: joinReq.isPending
                  ? Colors.blue.shade50
                  : joinReq.status == 'approved'
                      ? Colors.green.shade50
                      : Colors.red.shade50,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          joinReq.isPending
                              ? Icons.hourglass_top
                              : joinReq.status == 'approved'
                                  ? Icons.check_circle_outline
                                  : Icons.cancel_outlined,
                          color: joinReq.isPending
                              ? Colors.blue
                              : joinReq.status == 'approved'
                                  ? Colors.green
                                  : Colors.red,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '入社申请：${joinReq.statusText}',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text('申请社团：${joinReq.clubName}'),
                    if (joinReq.reason.isNotEmpty) Text('申请留言：${joinReq.reason}'),
                    Text('提交时间：${joinReq.createdAt}'),
                    if (joinReq.isPending) ...[
                      const Padding(
                        padding: EdgeInsets.only(top: 8),
                        child: Text('社长审批中，通过后重新进入 APP 即可看到社团内容。'),
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: () async {
                            try {
                              await Api.cancelMembershipRequest(widget.token, joinReq.id);
                              _toast('申请已撤回');
                              await _loadMembership();
                            } on ApiException catch (e) {
                              _toast(e.message);
                            }
                          },
                          child: const Text('撤回申请'),
                        ),
                      ),
                    ],
                    if (joinReq.status == 'rejected')
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          '驳回原因：${joinReq.rejectReason.isEmpty ? '未填写' : joinReq.rejectReason}',
                          style: const TextStyle(color: Colors.red),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
          // ---------- 申请进度卡片 ----------
          if (app != null) ...[
            Card(
              color: app.isPending
                  ? Colors.orange.shade50
                  : app.isApproved
                      ? Colors.green.shade50
                      : Colors.red.shade50,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          app.isPending
                              ? Icons.hourglass_top
                              : app.isApproved
                                  ? Icons.check_circle_outline
                                  : Icons.cancel_outlined,
                          color: app.isPending
                              ? Colors.orange
                              : app.isApproved
                                  ? Colors.green
                                  : Colors.red,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '社长申请：${app.statusText}',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text('申请学校：${app.schoolName}（${app.clubName}）'),
                    if (app.note.isNotEmpty) Text('申请留言：${app.note}'),
                    Text('提交时间：${app.createdAt}'),
                    if (app.isPending)
                      const Padding(
                        padding: EdgeInsets.only(top: 8),
                        child: Text('管理员审批中，通过后你会自动成为社长，重新登录即可生效。'),
                      ),
                    if (app.isRejected) ...[
                      const SizedBox(height: 8),
                      Text(
                        '驳回原因：${app.rejectReason.isEmpty ? '未填写' : app.rejectReason}',
                        style: const TextStyle(color: Colors.red),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],
          // ---------- 申请按钮：没有申请过 或 上一次被驳回 时显示 ----------
          if (app == null || app.isRejected)
            FilledButton.icon(
              onPressed: _showApplyDialog,
              icon: const Icon(Icons.badge_outlined),
              label: Text(app == null ? '申请成为社长' : '重新申请'),
            ),
          // 审批通过但还没重新登录：提示重新登录刷新身份
          if (app != null && app.isApproved) ...[
            FilledButton.icon(
              onPressed: () async {
                await LocalStore.clear();
                if (!mounted) return;
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const LoginPage()),
                  (_) => false,
                );
              },
              icon: const Icon(Icons.login),
              label: const Text('申请已通过，重新登录成为社长'),
            ),
          ],
        ],
      ),
    );
  }

  // 社长转让社长身份给自己社团的另一个普通成员
  // 后端会把全社团 token 全部清掉（角色变化后必须重新登录刷新身份）
  Future<void> _transferPresident() async {
    final members = _members ?? const <ClubMember>[];
    // 可转让目标 = 本社团普通社员（排除自己、其他社长、回收站用户）
    final candidates = members.where((m) => m.id != _user.id && m.role == 'member').toList();
    if (candidates.isEmpty) {
      _toast('社团没有其他普通社员，无法转让');
      return;
    }

    // 选目标成员对话框
    int? targetId;
    final pick = await showDialog<bool>(context: context, builder: (ctx) => StatefulBuilder(
      builder: (ctx, setDlg) => AlertDialog(
        title: const Text('转让社长'),
        content: SizedBox(
          width: 320,
          child: ListView.separated(
            shrinkWrap: true,
            itemCount: candidates.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, i) => RadioListTile<int>(
              title: Text(candidates[i].nickname),
              value: candidates[i].id,
              groupValue: targetId,
              onChanged: (v) => setDlg(() => targetId = v!),
            ),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          FilledButton(
            onPressed: targetId == null ? null : () => Navigator.pop(ctx, true),
            child: const Text('选择'),
          ),
        ],
      ),
    ));
    if (pick != true || targetId == null) return;

    // 二次确认（危险操作双保险）
    final ok2 = await _confirm(
      '确认转让？',
      '转让后：\n'
      '· 你自己将降级为普通社员\n'
      '· 你选择的成员成为新社长\n'
      '· 全体社员需重新登录以获取新身份\n\n'
      '此操作不可撤销，确定继续吗？',
    );
    if (!ok2) return;

    final targetName = candidates.firstWhere((m) => m.id == targetId).nickname;
    try {
      await Api.transferMyClubPresident(widget.token, targetId!);
      if (!mounted) return;
      await showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          icon: const Icon(Icons.check_circle, color: Colors.green, size: 48),
          title: const Text('转让成功'),
          content: Text('「$targetName」已成为新社长。\n全体社员需重新登录。'),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('去登录'),
            ),
          ],
        ),
      );
      if (!mounted) return;
      await LocalStore.clear();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginPage()),
        (_) => false,
      );
    } on ApiException catch (e) {
      _toast(e.message);
    }
  }

  // ============================================================
  // 社长删除自己的社团（危险操作）
  // ============================================================
  Future<void> _deleteMyClub() async {
    // 第一次确认
    final ok1 = await _confirm(
      '解散社团？',
      '解散后：\n'
      '· 全体社员（包括你）变成无社团用户\n'
      '· 社团公告、任务、约跑活动全部删除\n'
      '· 你将自动退出登录\n\n'
      '此操作不可撤销，确定继续吗？',
    );
    if (!ok1) return;
    // 第二次确认（危险操作双保险）
    final ok2 = await _confirm('最后确认', '真的要解散社团吗？此操作不可撤销！');
    if (!ok2) return;
    try {
      await Api.deleteMyClub(widget.token);
      if (!mounted) return;
      await showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          icon: const Icon(Icons.check_circle, color: Colors.green, size: 48),
          title: const Text('社团已解散'),
          content: const Text('全体社员已变为无社团用户。\n请重新登录。'),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('去登录'),
            ),
          ],
        ),
      );
      if (!mounted) return;
      await LocalStore.clear();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginPage()),
        (_) => false,
      );
    } on ApiException catch (e) {
      _toast(e.message);
    }
  }

  // 社长/管理员：可以发布公告、任务，修改社团名片
  bool get _canPublish => _user.isPresident || _user.isAdmin;

  // 活动删除权限：发起人 / 社长 / 管理员
  bool _canDeleteEvent(ClubEvent e) =>
      e.userId == _user.id || _canPublish;

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<bool> _confirm(String title, String content) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(content),
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
    return ok == true;
  }

  // ============================================================
  // 社团名片
  // ============================================================

  Future<void> _editProfile() async {
    final p = _profile;
    if (p == null) return;
    final introCtrl = TextEditingController(text: p.intro);
    final timeCtrl = TextEditingController(text: p.trainingTime);
    final placeCtrl = TextEditingController(text: p.trainingPlace);
    final contactCtrl = TextEditingController(text: p.contact);

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('编辑社团名片'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: introCtrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: '社团简介',
                  hintText: '例如：欢迎所有热爱跑步的同学，零基础也能加入',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: timeCtrl,
                decoration: const InputDecoration(
                  labelText: '常规训练时间',
                  hintText: '例如：每周二、四 19:00，周六 08:00',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: placeCtrl,
                decoration: const InputDecoration(
                  labelText: '常规训练地点',
                  hintText: '例如：学校东区田径场',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: contactCtrl,
                decoration: const InputDecoration(
                  labelText: '联系方式',
                  hintText: '例如：QQ 群 123456 / 微信 xx',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('保存')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await Api.updateClubProfile(
        widget.token,
        intro: introCtrl.text.trim(),
        trainingTime: timeCtrl.text.trim(),
        trainingPlace: placeCtrl.text.trim(),
        contact: contactCtrl.text.trim(),
      );
      if (!mounted) return;
      _toast('名片已保存');
      _loadProfile();
    } on ApiException catch (e) {
      if (!mounted) return;
      _toast(e.message);
    }
  }

  Widget _buildProfileCard() {
    if (_errProfile != null) {
      return Card(
        child: ListTile(
          leading: const Icon(Icons.error_outline, color: Colors.red),
          title: Text(_errProfile!),
          trailing: TextButton(onPressed: _loadProfile, child: const Text('重试')),
        ),
      );
    }
    if (_profile == null) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }
    final p = _profile!;
    // 名片里的信息行（值为空时不显示，社长可点右上角编辑补充）
    final rows = <(IconData, String, String)>[
      (Icons.schedule, '训练时间', p.trainingTime),
      (Icons.place_outlined, '训练地点', p.trainingPlace),
      (Icons.contact_phone_outlined, '联系方式', p.contact),
    ];

    return Card(
      color: Colors.green.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.groups, color: Colors.green, size: 28),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p.name,
                        style: const TextStyle(fontSize: 19, fontWeight: FontWeight.bold),
                      ),
                      if (p.schoolName.isNotEmpty)
                        Text(
                          p.schoolName,
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                        ),
                    ],
                  ),
                ),
                // 成员数
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text('${p.memberCount} 人', style: const TextStyle(fontSize: 12)),
                ),
                if (_canPublish)
                  IconButton(
                    icon: const Icon(Icons.edit_outlined, size: 20),
                    tooltip: '编辑社团名片',
                    onPressed: _editProfile,
                  ),
              ],
            ),
            if (p.intro.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(p.intro, style: const TextStyle(fontSize: 13, height: 1.5)),
            ],
            const SizedBox(height: 8),
            for (final r in rows)
              if (r.$3.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(r.$1, size: 15, color: Colors.green.shade700),
                      const SizedBox(width: 6),
                      Text('${r.$2}：', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                      Expanded(child: Text(r.$3, style: const TextStyle(fontSize: 13))),
                    ],
                  ),
                ),
            if (_canPublish &&
                p.intro.isEmpty &&
                p.trainingTime.isEmpty &&
                p.trainingPlace.isEmpty &&
                p.contact.isEmpty)
              Text(
                '点击右上角编辑按钮，补充社团简介、训练时间和地点，让新同学更容易加入',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600, height: 1.5),
              ),
          ],
        ),
      ),
    );
  }

  // ============================================================
  // 公告 / 任务
  // ============================================================

  // 小节标题（右侧可带"发布"按钮）
  Widget _sectionHeader(String title, IconData icon, {VoidCallback? onAdd}) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 4),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.grey.shade700),
          const SizedBox(width: 6),
          Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const Spacer(),
          if (onAdd != null)
            FilledButton.tonalIcon(
              onPressed: onAdd,
              icon: const Icon(Icons.add, size: 16),
              label: const Text('发布'),
            ),
        ],
      ),
    );
  }

  Future<void> _showAddAnnouncementDialog() async {
    final titleCtrl = TextEditingController();
    final contentCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('发布公告'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleCtrl,
                decoration: const InputDecoration(labelText: '标题', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: contentCtrl,
                maxLines: 5,
                decoration: const InputDecoration(
                  labelText: '内容',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('发布')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await Api.addAnnouncement(widget.token, titleCtrl.text.trim(), contentCtrl.text.trim());
      if (!mounted) return;
      _toast('发布成功');
      _loadAnnouncements();
    } on ApiException catch (e) {
      if (!mounted) return;
      _toast(e.message);
    }
  }

  Future<void> _showAddTaskDialog() async {
    final titleCtrl = TextEditingController();
    final contentCtrl = TextEditingController();
    final deadlineCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('发布任务'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleCtrl,
                decoration: const InputDecoration(labelText: '任务标题', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: contentCtrl,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: '任务内容',
                  hintText: '例如：本周每人至少跑 3 次，总距离 ≥ 10 公里',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: deadlineCtrl,
                readOnly: true,
                decoration: const InputDecoration(
                  labelText: '截止日期（可选）',
                  suffixIcon: Icon(Icons.calendar_month),
                  border: OutlineInputBorder(),
                ),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: ctx,
                    initialDate: DateTime.now().add(const Duration(days: 7)),
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 365)),
                  );
                  if (picked != null) {
                    deadlineCtrl.text =
                        '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
                  }
                },
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('发布')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await Api.addClubTask(
        widget.token,
        titleCtrl.text.trim(),
        contentCtrl.text.trim(),
        deadlineCtrl.text.trim(),
      );
      if (!mounted) return;
      _toast('发布成功');
      _loadTasks();
    } on ApiException catch (e) {
      if (!mounted) return;
      _toast(e.message);
    }
  }

  Future<void> _deleteAnnouncement(Announcement a) async {
    if (!await _confirm('删除公告', '确定要删除"${a.title}"吗？')) return;
    try {
      await Api.deleteAnnouncement(widget.token, a.id);
      if (!mounted) return;
      _toast('已删除');
      _loadAnnouncements();
    } on ApiException catch (e) {
      if (!mounted) return;
      _toast(e.message);
    }
  }

  Future<void> _deleteTask(ClubTask t) async {
    if (!await _confirm('删除任务', '确定要删除"${t.title}"吗？')) return;
    try {
      await Api.deleteClubTask(widget.token, t.id);
      if (!mounted) return;
      _toast('已删除');
      _loadTasks();
    } on ApiException catch (e) {
      if (!mounted) return;
      _toast(e.message);
    }
  }

  Widget _announcementTile(Announcement a) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Colors.blue.shade50,
          child: const Icon(Icons.campaign, color: Colors.blue),
        ),
        title: Text(a.title, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(a.content),
            const SizedBox(height: 4),
            Text(
              '${a.authorNickname} · ${a.createdAt.split(' ').first}',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
          ],
        ),
        trailing: _canPublish
            ? IconButton(
                icon: const Icon(Icons.delete_outline, color: Colors.red),
                onPressed: () => _deleteAnnouncement(a),
              )
            : null,
        isThreeLine: true,
      ),
    );
  }

  Widget _taskTile(ClubTask t) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: Colors.orange.shade50,
          child: const Icon(Icons.assignment, color: Colors.orange),
        ),
        title: Text(t.title, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(t.content),
            const SizedBox(height: 4),
            Row(
              children: [
                if (t.deadline.isNotEmpty) ...[
                  const Icon(Icons.alarm, size: 12, color: Colors.red),
                  const SizedBox(width: 2),
                  Text('截止 ${t.deadline}', style: const TextStyle(fontSize: 12, color: Colors.red)),
                  const SizedBox(width: 8),
                ],
                Text(
                  '${t.authorNickname} · ${t.createdAt.split(' ').first}',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
              ],
            ),
          ],
        ),
        trailing: _canPublish
            ? IconButton(
                icon: const Icon(Icons.delete_outline, color: Colors.red),
                onPressed: () => _deleteTask(t),
              )
            : null,
        isThreeLine: true,
      ),
    );
  }

  // ============================================================
  // 活动分栏
  // ============================================================

  Future<void> _showAddEventDialog() async {
    final titleCtrl = TextEditingController();
    final dateCtrl = TextEditingController();
    final timeCtrl = TextEditingController();
    final placeCtrl = TextEditingController();
    final noteCtrl = TextEditingController();
    final maxCtrl = TextEditingController(); // 人数上限（N6，留空=不限）

    String fmt(DateTime d) =>
        '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('发起约跑'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleCtrl,
                decoration: const InputDecoration(
                  labelText: '活动名称',
                  hintText: '例如：周末操场 5 公里',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: dateCtrl,
                readOnly: true,
                decoration: const InputDecoration(
                  labelText: '活动日期',
                  suffixIcon: Icon(Icons.calendar_month),
                  border: OutlineInputBorder(),
                ),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: ctx,
                    initialDate: DateTime.now().add(const Duration(days: 1)),
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 365)),
                  );
                  if (picked != null) dateCtrl.text = fmt(picked);
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: timeCtrl,
                readOnly: true,
                decoration: const InputDecoration(
                  labelText: '集合时间（可选）',
                  suffixIcon: Icon(Icons.access_time),
                  border: OutlineInputBorder(),
                ),
                onTap: () async {
                  final picked = await showTimePicker(context: ctx, initialTime: const TimeOfDay(hour: 8, minute: 0));
                  if (picked != null) {
                    timeCtrl.text =
                        '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
                  }
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: placeCtrl,
                decoration: const InputDecoration(
                  labelText: '集合地点（可选）',
                  hintText: '例如：学校东区田径场',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteCtrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: '补充说明（可选）',
                  hintText: '例如：配速 6:00/km，跑完一起吃早饭',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: maxCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: '人数上限（可选）',
                  hintText: '留空表示不限人数',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.group_outlined),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('发布')),
        ],
      ),
    );
    if (ok != true) return;
    if (dateCtrl.text.isEmpty) {
      _toast('请选择活动日期');
      return;
    }
    final maxP = int.tryParse(maxCtrl.text.trim()) ?? 0;
    if (maxP < 0) {
      _toast('人数上限不能为负数');
      return;
    }
    try {
      await Api.addClubEvent(
        widget.token,
        title: titleCtrl.text.trim(),
        eventDate: dateCtrl.text,
        eventTime: timeCtrl.text,
        place: placeCtrl.text.trim(),
        note: noteCtrl.text.trim(),
        maxParticipants: maxP,
      );
      if (!mounted) return;
      _toast('发布成功');
      _loadEvents();
    } on ApiException catch (e) {
      if (!mounted) return;
      _toast(e.message);
    }
  }

  Future<void> _deleteEvent(ClubEvent e) async {
    if (!await _confirm('删除活动', '确定要删除"${e.title}"吗？')) return;
    try {
      await Api.deleteClubEvent(widget.token, e.id);
      if (!mounted) return;
      _toast('已删除');
      _loadEvents();
    } on ApiException catch (e) {
      if (!mounted) return;
      _toast(e.message);
    }
  }

  Future<void> _toggleSignup(ClubEvent e) async {
    try {
      await Api.toggleEventSignup(widget.token, e.id);
      if (!mounted) return;
      _loadEvents();
    } on ApiException catch (err) {
      if (!mounted) return;
      _toast(err.message);
    }
  }

  // N6 签到管理面板：列出全部已报名成员，点击打勾/取消打勾
  // 仅发起人 / 社长 / 管理员能打开（入口按钮已做条件渲染，后端接口再做一次校验）
  Future<void> _showCheckinSheet(ClubEvent e) async {
    List<EventCheckinRow> rows;
    try {
      rows = await Api.eventCheckins(widget.token, e.id);
    } on ApiException catch (err) {
      if (!mounted) return;
      _toast(err.message);
      return;
    }
    if (!mounted) return;
    final Set<int> pendingIds = {}; // 防连点：记录正在请求签到切换的成员 id
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('签到管理 · ${e.title}',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text('点击成员即可标记 / 取消到场',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                const SizedBox(height: 12),
                if (rows.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: Center(child: Text('还没有人报名', style: TextStyle(color: Colors.grey))),
                  )
                else
                  Flexible(
                    child: ListView.builder(
                      shrinkWrap: true,
                      itemCount: rows.length,
                      itemBuilder: (_, i) {
                        final r = rows[i];
                        return ListTile(
                          dense: true,
                          leading: CircleAvatar(
                            radius: 16,
                            child: Text(r.avatar.isNotEmpty ? r.avatar : (r.nickname.isNotEmpty ? r.nickname[0] : '?')),
                          ),
                          title: Text(r.nickname),
                          trailing: Icon(
                            r.checked ? Icons.check_circle : Icons.radio_button_unchecked,
                            color: r.checked ? Colors.green : Colors.grey,
                          ),
                          onTap: () async {
                            if (pendingIds.contains(r.userId)) return; // 请求中，忽略连点
                            pendingIds.add(r.userId);
                            try {
                              final res = await Api.toggleEventCheckin(widget.token, e.id, r.userId);
                              setSheetState(() {
                                rows[i] = EventCheckinRow(
                                  userId: r.userId,
                                  nickname: r.nickname,
                                  avatar: r.avatar,
                                  checked: res['checked'] == true,
                                );
                              });
                            } on ApiException catch (err) {
                              if (mounted) _toast(err.message);
                            } finally {
                              pendingIds.remove(r.userId);
                            }
                          },
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
    // 面板关闭后刷新活动列表（签到人数可能变了）
    _loadEvents();
  }

  // 活动日期显示：2026-10-25 → 10月25日 周日
  String _eventDateText(String date) {
    try {
      final d = DateTime.parse(date);
      const names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
      return '${d.month}月${d.day}日 ${names[d.weekday - 1]}';
    } catch (_) {
      return date;
    }
  }

  Widget _eventCard(ClubEvent e) {
    final past = e.isPast;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      color: past ? Colors.grey.shade100 : null,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.directions_run, color: past ? Colors.grey : Colors.green),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    e.title,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: past ? Colors.grey.shade600 : null,
                    ),
                  ),
                ),
                if (_canDeleteEvent(e))
                  IconButton(
                    icon: const Icon(Icons.delete_outline, size: 20, color: Colors.red),
                    tooltip: '删除活动',
                    onPressed: () => _deleteEvent(e),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                Icon(Icons.event, size: 14, color: Colors.grey.shade600),
                const SizedBox(width: 4),
                Text(
                  '${_eventDateText(e.eventDate)}${e.eventTime.isEmpty ? '' : ' ${e.eventTime}'}',
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade800),
                ),
                if (past) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text('已结束', style: TextStyle(fontSize: 11)),
                  ),
                ],
              ],
            ),
            if (e.place.isNotEmpty) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(Icons.place_outlined, size: 14, color: Colors.grey.shade600),
                  const SizedBox(width: 4),
                  Expanded(child: Text(e.place, style: const TextStyle(fontSize: 13))),
                ],
              ),
            ],
            if (e.note.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(e.note, style: TextStyle(fontSize: 13, color: Colors.grey.shade700, height: 1.4)),
            ],
            const SizedBox(height: 8),
            Row(
              children: [
                // 报名进度：设了上限显示 "x/y"，没设上限显示 "x 人已报名"
                Text(
                  e.maxParticipants > 0
                      ? '${e.authorNickname} 发起 · 报名 ${e.signupCount}/${e.maxParticipants}'
                      : '${e.authorNickname} 发起 · ${e.signupCount} 人已报名',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
                if (e.maxParticipants > 0 && e.isFull) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade50,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: Colors.orange.shade200),
                    ),
                    child: Text('已满员', style: TextStyle(fontSize: 11, color: Colors.orange.shade800)),
                  ),
                ],
                // 我已签到的小标记
                if (e.checked) ...[
                  const SizedBox(width: 6),
                  Icon(Icons.how_to_reg, size: 14, color: Colors.green.shade700),
                ],
                const Spacer(),
                FilledButton.tonal(
                  // 满员且我还没报名：禁用报名按钮（后端也会拦截，双保险）
                  onPressed: past || (!e.signed && e.isFull) ? null : () => _toggleSignup(e),
                  style: FilledButton.styleFrom(
                    backgroundColor: e.signed ? Colors.grey.shade300 : Colors.green.shade100,
                    foregroundColor: e.signed ? Colors.grey.shade800 : Colors.green.shade800,
                    minimumSize: const Size(0, 34),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                  ),
                  child: Text(e.signed ? '已报名 · 取消' : (e.isFull ? '已满员' : '我要报名')),
                ),
              ],
            ),
            // 发起人/社长/管理员的签到管理入口
            if (_canDeleteEvent(e)) ...[
              const SizedBox(height: 4),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: () => _showCheckinSheet(e),
                  icon: Icon(Icons.fact_check_outlined, size: 16, color: Colors.green.shade700),
                  label: Text(
                    '签到管理（已签到 ${e.checkinCount}/${e.signupCount}）',
                    style: TextStyle(fontSize: 12, color: Colors.green.shade700),
                  ),
                  style: TextButton.styleFrom(
                    minimumSize: const Size(0, 30),
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  // ============================================================
  // 成员分栏
  // ============================================================

  // 当前筛选后的成员列表
  List<ClubMember> get _filteredMembers {
    final list = _members ?? const <ClubMember>[];
    switch (_memberFilter) {
      case '无计划':
        return list.where((m) => m.planState == 'no_plan').toList();
      case '计划逾期':
        return list.where((m) => m.planState == 'expired').toList();
      case '本周未跑':
        return list.where((m) => m.weekKm <= 0).toList();
      default:
        return list;
    }
  }

  // 社长视角顶部汇总：无计划人数 / 逾期人数 / 本周未跑人数
  Widget _memberSummary() {
    final list = _members ?? const <ClubMember>[];
    final noPlan = list.where((m) => m.planState == 'no_plan').length;
    final expired = list.where((m) => m.planState == 'expired').length;
    final noRun = list.where((m) => m.weekKm <= 0).length;

    Widget stat(String label, int count, String filter, Color color) {
      final selected = _memberFilter == filter;
      return Expanded(
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () => setState(() => _memberFilter = selected ? '全部' : filter),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 10),
            margin: const EdgeInsets.symmetric(horizontal: 3),
            decoration: BoxDecoration(
              color: selected ? color.withValues(alpha: 0.15) : Colors.grey.shade100,
              borderRadius: BorderRadius.circular(8),
              border: selected ? Border.all(color: color) : null,
            ),
            child: Column(
              children: [
                Text(
                  '$count',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color),
                ),
                Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
              ],
            ),
          ),
        ),
      );
    }

    return Row(
      children: [
        stat('无计划', noPlan, '无计划', Colors.grey.shade700),
        stat('计划逾期', expired, '计划逾期', Colors.orange),
        stat('本周未跑', noRun, '本周未跑', Colors.blueGrey),
      ],
    );
  }

  Widget _memberCard(ClubMember m) {
    final canSeeDetail = _canPublish; // 只有社长/管理员能看详情
    final color = planStateColor(m.planState);

    // 普通社员：只显示头像、昵称、角色
    if (!canSeeDetail) {
      return Card(
        margin: const EdgeInsets.only(bottom: 8),
        child: ListTile(
          leading: UserAvatar(avatar: m.avatar, nickname: m.nickname, gender: m.gender),
          title: Row(
            children: [
              Text(m.nickname, style: const TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(width: 6),
              _roleChip(m),
            ],
          ),
        ),
      );
    }

    // 计划状态文案
    String planText;
    switch (m.planState) {
      case 'active':
        planText = '${m.planTitle} · 进度 ${m.progress}%';
        break;
      case 'expired':
        planText = '${m.planTitle} 已逾期 ${m.expiredDays} 天未达成';
        break;
      default:
        planText = '暂无进行中的计划';
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      clipBehavior: Clip.antiAlias,
      child: Container(
        decoration: BoxDecoration(
          border: Border(left: BorderSide(color: color, width: 5)),
        ),
        child: ListTile(
          leading: UserAvatar(avatar: m.avatar, nickname: m.nickname, gender: m.gender),
          title: Row(
            children: [
              Flexible(
                child: Text(
                  m.nickname,
                  style: const TextStyle(fontWeight: FontWeight.bold),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 6),
              _roleChip(m),
              // 已达成计划数 = 金色徽章（激励）
              if (m.achievedCount > 0) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF3CD),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFD4A017)),
                  ),
                  child: Text(
                    '🏅 ${m.achievedCount}',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF9A6B00)),
                  ),
                ),
              ],
            ],
          ),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 3),
              Text(
                planText,
                style: TextStyle(
                  fontSize: 12.5,
                  color: m.planState == 'expired' ? Colors.orange.shade800 : Colors.grey.shade700,
                  fontWeight: m.planState == 'expired' ? FontWeight.bold : FontWeight.normal,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '本周 ${m.weekKm.toStringAsFixed(1)} km · 共 ${m.runCount} 次 · '
                '${m.daysSinceLast == null ? "还没跑过" : "最近 ${m.lastRunDate}（${m.daysSinceLast} 天前）"}',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
              ),
            ],
          ),
          trailing: const Icon(Icons.chevron_right),
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ClubMemberDetailPage(
                  token: widget.token,
                  memberId: m.id,
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  // 角色小标签
  Widget _roleChip(ClubMember m) {
    if (m.role == 'member') return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: m.role == 'admin' ? Colors.red.shade50 : Colors.blue.shade50,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        m.roleText,
        style: TextStyle(
          fontSize: 11,
          color: m.role == 'admin' ? Colors.red : Colors.blue,
        ),
      ),
    );
  }

  // ============================================================
  // 三个子分栏构建
  // ============================================================

  Widget _buildClubTab() {
    final ann = _announcements;
    final tasks = _tasks;
    return RefreshIndicator(
      onRefresh: () async {
        await Future.wait([_loadProfile(), _loadAnnouncements(), _loadTasks()]);
      },
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          _buildProfileCard(),
          const SizedBox(height: 8),
          // ---------- 公告区 ----------
          _sectionHeader('社团公告', Icons.campaign_outlined,
              onAdd: _canPublish ? _showAddAnnouncementDialog : null),
          if (_errAnn != null)
            _inlineError(_errAnn!, _loadAnnouncements)
          else if (ann == null)
            const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
          else if (ann.isEmpty)
            _emptyHint('还没有公告', _canPublish ? '点右上角"发布"通知大家' : '等待社长发布通知')
          else
            ...ann.map(_announcementTile),
          const SizedBox(height: 12),
          // ---------- 任务区 ----------
          _sectionHeader('社团任务', Icons.assignment_outlined,
              onAdd: _canPublish ? _showAddTaskDialog : null),
          if (_errTask != null)
            _inlineError(_errTask!, _loadTasks)
          else if (tasks == null)
            const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
          else if (tasks.isEmpty)
            _emptyHint('还没有任务', _canPublish ? '点右上角"发布"布置训练任务' : '等待社长发布训练任务')
          else
            ...tasks.map(_taskTile),
          const SizedBox(height: 30),
          // ---------- 危险区：社长专属操作 ----------
          if (_user.isPresident)
            Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
              OutlinedButton.icon(
                onPressed: _transferPresident,
                icon: const Icon(Icons.swap_horiz),
                label: const Text('转让社长'),
              ),
              TextButton.icon(
                onPressed: _deleteMyClub,
                icon: const Icon(Icons.delete_forever, color: Colors.red),
                label: const Text('解散社团', style: TextStyle(color: Colors.red)),
              ),
            ]),
        ],
      ),
    );
  }

  Widget _buildEventsTab() {
    if (_errEvent != null) return _errorView(_errEvent!, _loadEvents);
    if (_events == null) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: _loadEvents,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          Card(
            color: Colors.green.shade50,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  const Icon(Icons.groups, color: Colors.green),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '约跑活动：所有社员都能发起，点右下角 + 组织一次跑步吧',
                      style: TextStyle(fontSize: 13, color: Colors.green.shade900),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          if (_events!.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 60),
              child: Text(
                '还没有约跑活动\n点右下角 + 发起第一次约跑',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade600, height: 1.8),
              ),
            )
          else
            ..._events!.map(_eventCard),
        ],
      ),
    );
  }

  // ============================================================
  // 社团成员申请：退社申请（社员） / 审批（社长、管理员）
  // ============================================================

  // 社员提交退社申请（需社长或管理员审批）
  Future<void> _requestLeave() async {
    final reasonCtrl = TextEditingController();
    bool submitting = false;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: const Text('申请退出社团'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('退出申请需要社长或管理员同意，通过后你将变成无社团用户。'),
              const SizedBox(height: 12),
              TextField(
                controller: reasonCtrl,
                enabled: !submitting,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: '退社原因（选填）',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: submitting ? null : () => Navigator.pop(ctx, false),
              child: const Text('取消'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Colors.red),
              onPressed: submitting
                  ? null
                  : () async {
                      setDlg(() => submitting = true);
                      try {
                        final msg = await Api.requestLeaveClub(
                          widget.token,
                          reason: reasonCtrl.text.trim(),
                        );
                        if (!ctx.mounted) return;
                        Navigator.pop(ctx, true);
                        _toast(msg);
                        await _loadMembership();
                      } on ApiException catch (e) {
                        setDlg(() => submitting = false);
                        if (ctx.mounted) {
                          ScaffoldMessenger.of(ctx)
                              .showSnackBar(SnackBar(content: Text(e.message)));
                        }
                      }
                    },
              child: Text(submitting ? '提交中...' : '提交申请'),
            ),
          ],
        ),
      ),
    );
    reasonCtrl.dispose();
    if (ok == true && mounted) setState(() {});
  }

  // 社长/管理员审批一条入社/退社申请
  Future<void> _handleRequest(MembershipRequest r, bool approve) async {
    String reason = '';
    if (!approve) {
      final ctrl = TextEditingController();
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('驳回申请'),
          content: TextField(
            controller: ctrl,
            maxLines: 2,
            autofocus: true,
            decoration: const InputDecoration(
              labelText: '驳回原因（必填，至少 2 个字）',
              border: OutlineInputBorder(),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
            FilledButton(
              onPressed: () {
                final r = ctrl.text.trim();
                if (r.length < 2) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('请填写至少 2 个字的驳回原因')),
                  );
                  return;
                }
                Navigator.pop(ctx, true);
              },
              child: const Text('确认驳回'),
            ),
          ],
        ),
      );
      if (ok != true) {
        ctrl.dispose();
        return;
      }
      reason = ctrl.text.trim();
      ctrl.dispose();
    }

    setState(() => _loadingRequests = true);
    try {
      if (approve) {
        await Api.approveMembershipRequest(widget.token, r.id);
      } else {
        await Api.rejectMembershipRequest(widget.token, r.id, reason: reason);
      }
      _toast(approve ? '已同意' : '已驳回');
      await Future.wait([_loadPendingRequests(), _loadMembers()]);
    } on ApiException catch (e) {
      _toast(e.message);
    } finally {
      if (mounted) setState(() => _loadingRequests = false);
    }
  }

  // 待审批申请列表（社长/管理员在成员分栏顶部看到）
  Widget _buildPendingRequests() {
    final list = _pendingRequests ?? [];
    if (list.isEmpty) return const SizedBox.shrink();
    return Card(
      color: Colors.orange.shade50,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.how_to_reg, color: Colors.orange, size: 20),
                const SizedBox(width: 6),
                Text(
                  '待审批的社团申请（${list.length}）',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 4),
            ...list.map((r) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${r.nickname} · ${r.typeText}',
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                          ),
                          TextButton(
                            onPressed: _loadingRequests ? null : () => _handleRequest(r, true),
                            child: const Text('同意'),
                          ),
                          TextButton(
                            onPressed: _loadingRequests ? null : () => _handleRequest(r, false),
                            child: const Text('驳回', style: TextStyle(color: Colors.red)),
                          ),
                        ],
                      ),
                      Text(
                        '${r.gender} · ${r.phone}'
                        '${r.reason.isEmpty ? '' : '\n留言：${r.reason}'}'
                        '\n提交时间：${r.createdAt}',
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade700, height: 1.5),
                      ),
                    ],
                  ),
                )),
          ],
        ),
      ),
    );
  }

  Widget _buildMembersTab() {
    if (_errMember != null) return _errorView(_errMember!, _loadMembers);
    if (_members == null) return const Center(child: CircularProgressIndicator());
    if (_members!.isEmpty) {
      return const Center(child: Text('社团还没有成员'));
    }

    // 普通社员：只有名单 + 退社申请入口
    if (!_canPublish) {
      final leaveReq = _membership?.leave;
      final leavePending = leaveReq != null && leaveReq.isPending;
      return RefreshIndicator(
        onRefresh: () async {
          await Future.wait([_loadMembers(), _loadMembership()]);
        },
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                '社团成员（${_members!.length} 人）',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
            ..._members!.map(_memberCard),
            const SizedBox(height: 24),
            // ---------- 退社申请区 ----------
            if (leaveReq != null && leavePending)
              Card(
                color: Colors.orange.shade50,
                child: ListTile(
                  leading: const Icon(Icons.hourglass_top, color: Colors.orange),
                  title: const Text('退社申请审核中'),
                  subtitle: Text(
                    '提交时间：${leaveReq.createdAt}'
                    '${leaveReq.reason.isEmpty ? '' : '\n原因：${leaveReq.reason}'}',
                  ),
                  trailing: TextButton(
                    onPressed: () async {
                      try {
                        await Api.cancelMembershipRequest(widget.token, leaveReq.id);
                        _toast('申请已撤回');
                        await _loadMembership();
                      } on ApiException catch (e) {
                        _toast(e.message);
                      }
                    },
                    child: const Text('撤回'),
                  ),
                ),
              )
            else ...[
              if (leaveReq != null && leaveReq.status == 'rejected')
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    '上次退社申请被驳回：${leaveReq.rejectReason.isEmpty ? '未填写原因' : leaveReq.rejectReason}',
                    style: const TextStyle(color: Colors.red, fontSize: 12),
                  ),
                ),
              Center(
                child: TextButton.icon(
                  onPressed: _requestLeave,
                  icon: const Icon(Icons.logout, color: Colors.red),
                  label: const Text('申请退出社团', style: TextStyle(color: Colors.red)),
                ),
              ),
            ],
          ],
        ),
      );
    }

    // 社长/管理员：汇总 + 筛选 + 状态列表
    final list = _filteredMembers;
    return RefreshIndicator(
      onRefresh: () async {
        await _loadMembers();
        await _loadPendingRequests();
      },
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          _memberSummary(),
          const SizedBox(height: 10),
          // 待审批的入社/退社申请
          _buildPendingRequests(),
          if ((_pendingRequests ?? []).isNotEmpty) const SizedBox(height: 10),
          SizedBox(
            height: 36,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: kMemberFilters
                  .map((f) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(f),
                          selected: _memberFilter == f,
                          onSelected: (_) => setState(() => _memberFilter = f),
                        ),
                      ))
                  .toList(),
            ),
          ),
          const SizedBox(height: 8),
          // 图例：四色规则
          Row(
            children: [
              _legendDot(Colors.grey, '无进行中计划'),
              const SizedBox(width: 10),
              _legendDot(Colors.blue, '进行中'),
              const SizedBox(width: 10),
              _legendDot(Colors.orange, '逾期未达成'),
              const SizedBox(width: 10),
              const Text('🏅 已达成数', style: TextStyle(fontSize: 11, color: Colors.grey)),
            ],
          ),
          const SizedBox(height: 8),
          if (list.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 60),
              child: Text(
                '这个筛选下没有成员',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade600),
              ),
            )
          else
            ...list.map(_memberCard),
        ],
      ),
    );
  }

  Widget _legendDot(Color color, String text) {
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 3),
        Text(text, style: const TextStyle(fontSize: 11, color: Colors.grey)),
      ],
    );
  }

  Widget _emptyHint(String title, String subtitle) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 18),
      child: Column(
        children: [
          Text(title, style: TextStyle(color: Colors.grey.shade600)),
          const SizedBox(height: 4),
          Text(subtitle, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
        ],
      ),
    );
  }

  Widget _inlineError(String msg, Future<void> Function() onRetry) {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.error_outline, color: Colors.red),
        title: Text(msg),
        trailing: TextButton(onPressed: onRetry, child: const Text('重试')),
      ),
    );
  }

  Widget _errorView(String msg, Future<void> Function() onRetry) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(msg, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('重试')),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // 无社团用户：不显示三个分栏，只显示申请进度界面
    if (!_user.hasClub) {
      return Scaffold(
        appBar: AppBar(
          automaticallyImplyLeading: false,
          title: const Text('社团'),
        ),
        body: _buildNoClubView(),
      );
    }
    return Scaffold(
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(48),
        child: AppBar(
          automaticallyImplyLeading: false,
          title: TabBar(
            controller: _tabCtrl,
            tabs: const [
              Tab(text: '社团'),
              Tab(text: '活动'),
              Tab(text: '成员'),
            ],
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabCtrl,
        children: [
          _buildClubTab(),
          _buildEventsTab(),
          _buildMembersTab(),
        ],
      ),
      // 活动分栏右下角 + 发起约跑（所有社员都能看到）
      floatingActionButton: _tabCtrl.index == 1
          ? FloatingActionButton(
              onPressed: _showAddEventDialog,
              tooltip: '发起约跑',
              child: const Icon(Icons.add),
            )
          : null,
    );
  }
}
