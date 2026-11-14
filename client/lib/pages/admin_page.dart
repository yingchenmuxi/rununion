// ============================================================
// 管理员后台页（全功能版）：
// - 顶部系统概览卡片（8 个核心指标）
// - 6 个分 tab：用户管理、跑步记录、训练计划、学校社团、社团内容、计划模板
// - 支持：搜索、筛选、新增、编辑弹窗、重置密码、删除确认
// - 只有 role = 'admin' 的登录用户才能进入此页
// ============================================================
import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../widgets/dashboard_charts.dart'; // N10 数据看板自绘图表

class AdminPage extends StatefulWidget {
  final String token;

  const AdminPage({super.key, required this.token});

  @override
  State<AdminPage> createState() => _AdminPageState();
}

class _AdminPageState extends State<AdminPage> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // 概览数据
  AdminOverview? _overview;
  bool _loading = true;
  String? _error;

  // 各 tab 数据：懒加载（只在进入对应 tab 时才请求）
  final Map<dynamic, dynamic> _tabData = {}; // key 可以是 int（tab index）或 String（子数据如 'schools'/'clubs'）
  final Map<int, bool> _tabLoaded = {};

  // 学校/社团缓存（各 tab 共用，下拉选择用）
  List<AdminSchool> _schools = [];
  List<AdminClub> _clubs = [];
  bool _dictLoaded = false;

  // 搜索关键词（用户/记录 tab 用）
  String _userQ = '';
  String _runQ = '';

  // 用户管理筛选条件（走后端查询参数）
  String _userRole = ''; // '' 全部 / member / president / admin
  int? _userClubId; // null = 全部社团
  bool _userBin = false; // true = 回收站（已删除用户）

  // N13 批量操作：用户多选模式
  bool _batchMode = false; // true = 列表进入多选状态
  final Set<int> _selectedUserIds = {}; // 已勾选的用户 id

  // 社团内容筛选：null = 全部社团
  int? _contentClubId;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 10, vsync: this);
    _tabController.addListener(_onTabChanged);
    _loadOverview();
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    super.dispose();
  }

  void _onTabChanged() {
    if (!_tabController.indexIsChanging) {
      _ensureTabLoaded(_tabController.index);
    }
  }

  // ============================================================
  // 数据加载
  // ============================================================

  Future<void> _loadOverview() async {
    setState(() { _loading = true; _error = null; });
    try {
      final ov = await Api.adminOverview(widget.token);
      if (!mounted) return;
      setState(() { _overview = ov; _loading = false; });
      _ensureTabLoaded(0); // 预加载第一个 tab
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() { _error = e.message; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = '加载失败: $e'; _loading = false; });
    }
  }

  // 确保字典（学校/社团）已加载，下拉选择用
  Future<void> _ensureDictLoaded() async {
    if (_dictLoaded) return;
    try {
      final s = await Api.adminSchools(widget.token);
      final c = await Api.adminClubs(widget.token);
      if (!mounted) return;
      setState(() { _schools = s; _clubs = c; _dictLoaded = true; });
    } catch (_) {}
  }

  // 懒加载指定 tab 数据
  Future<void> _ensureTabLoaded(int idx) async {
    if (_tabLoaded[idx] == true) return;
    await _ensureDictLoaded();
    _tabLoaded[idx] = true;
    try {
      dynamic data;
      switch (idx) {
        case 0:
          // 用户管理：带上搜索词 / 角色 / 社团 / 回收站 参数，由后端过滤（带分页，前端暂时只看第一页）
          data = (await Api.adminUsers(widget.token,
              q: _userQ, role: _userRole, clubId: _userClubId, deleted: _userBin)).list;
          break;
        case 1:
          // 社团申请：入社 / 退社申请 + 社长申请
          try {
            final ms = await Api.listMembershipRequests(widget.token);
            _tabData['memberships'] = ms;
          } catch (_) {
            _tabData['memberships'] = <MembershipRequest>[];
          }
          // 社长申请：待审批的排最前（后端已排序）
          data = await Api.adminApplications(widget.token);
          break;
        case 2:
          data = (await Api.adminRuns(widget.token)).list;
          break;
        case 3:
          data = (await Api.adminPlans(widget.token)).list;
          break;
        case 4: {
          final s = await Api.adminSchools(widget.token);
          final c = await Api.adminClubs(widget.token);
          if (!mounted) return;
          setState(() { _schools = s; _clubs = c; _dictLoaded = true; });
          data = null; // 分别存学校和社团
          _tabData['schools'] = s;
          _tabData['clubs'] = c;
          return;
        }
        case 5: {
          final a = await Api.adminAnnouncements(widget.token);
          final t = await Api.adminTasks(widget.token);
          final e = await Api.adminEvents(widget.token);
          _tabData['announcements'] = a;
          _tabData['tasks'] = t;
          _tabData['events'] = e;
          return;
        }
        case 6: {
          // 知识文章：管理端直接复用公开文章列表接口
          // 注意：listArticles 返回的是 ({List<Article> list, bool hasMore}) record，必须取 .list
          try {
            data = (await Api.listArticles(widget.token)).list;
          } catch (_) {
            data = <Article>[];
          }
          break;
        }
        case 7:
          try { data = await Api.planTemplates(widget.token); } catch (_) { data = <PlanTemplate>[]; }
          break;
        case 8:
          // 数据看板（N10）：统计趋势 / 分布 / 对比
          data = await Api.adminDashboard(widget.token);
          break;
        case 9:
          // 全员沟通：管理员发布的全员消息列表
          try { data = await Api.adminListBroadcasts(widget.token); } catch (_) { data = <Broadcast>[]; }
          break;
        default: return;
      }
      if (!mounted) return;
      setState(() { _tabData[idx] = data; });
    } on ApiException catch (e) {
      if (!mounted) return;
      _showError(e.message);
      _tabLoaded[idx] = false; // 失败允许重试
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  // 刷新当前 tab（删除/编辑后调用）
  Future<void> _refreshCurrentTab() async {
    final idx = _tabController.index;
    _tabLoaded[idx] = false;
    await _ensureTabLoaded(idx);
    // 同时刷新概览
    try {
      final ov = await Api.adminOverview(widget.token);
      if (!mounted) return;
      setState(() { _overview = ov; });
    } catch (_) {}
  }

  // 按当前筛选条件（搜索/角色/社团/回收站）重新加载用户列表
  Future<void> _reloadUsers() async {
    _tabLoaded[0] = false;
    if (mounted) setState(() => _tabData[0] = null); // 先显示加载圈
    await _ensureTabLoaded(0);
  }

  // ============================================================
  // UI 构建
  // ============================================================

  @override
  Widget build(BuildContext context) {
    final pending = _overview?.pendingApplications ?? 0;
    return Scaffold(
      appBar: AppBar(title: const Text('管理员后台'), bottom: _loading && _overview == null ? null : TabBar(
        controller: _tabController,
        isScrollable: true,
        tabs: [
          const Tab(text: '用户管理'),
          // 待审批数量直接显示在页签上，避免管理员漏看
          Tab(text: pending > 0 ? '申请审批($pending)' : '申请审批'),
          const Tab(text: '跑步记录'),
          const Tab(text: '训练计划'),
          const Tab(text: '学校社团'),
          const Tab(text: '社团内容'),
          const Tab(text: '知识文章'),
          const Tab(text: '计划模板'),
          const Tab(text: '数据看板'),
          const Tab(text: '全员沟通'),
        ],
      )),
      body: _loading && _overview == null
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
              : Column(children: [
                  _buildOverview(),
                  Expanded(child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildUsersTab(),
                      _buildApplicationsTab(),
                      _buildRunsTab(),
                      _buildPlansTab(),
                      _buildSchoolClubTab(),
                      _buildContentTab(),
                      _buildArticlesTab(),
                      _buildTemplatesTab(),
                      _buildDashboardTab(),
                      _buildBroadcastsTab(),
                    ],
                  )),
                ]),
    );
  }

  // ---------- 概览 ----------
  // 用横向滚动卡片：不管手机屏幕多窄，文字都不会被挤成两行或溢出卡片
  Widget _buildOverview() {
    final ov = _overview;
    if (ov == null) return const SizedBox.shrink();
    return Container(
      color: Colors.grey.shade100,
      height: 86,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        children: [
          _overviewCard(Icons.people, '总用户', '${ov.totalUsers}', Colors.blue),
          _overviewCard(Icons.directions_run, '总跑步次数', '${ov.totalRuns}', Colors.green),
          _overviewCard(Icons.route, '总公里', ov.totalKm.toStringAsFixed(1), Colors.orange),
          _overviewCard(Icons.school, '学校数', '${ov.totalSchools}', Colors.purple),
          _overviewCard(Icons.group, '社团数', '${ov.totalClubs}', Colors.teal),
          _overviewCard(Icons.flag, '计划数', '${ov.totalPlans}', Colors.amber),
          _overviewCard(Icons.event, '活动数', '${ov.totalEvents}', Colors.pink),
          _overviewCard(Icons.article, '知识文章', '${ov.totalArticles}', Colors.indigo),
          _overviewCard(Icons.assignment_ind, '待审申请', '${ov.pendingApplications}', Colors.red,
              onTap: () => _tabController.animateTo(1)),
        ],
      ),
    );
  }

  Widget _overviewCard(IconData icon, String label, String value, Color color, {VoidCallback? onTap}) {
    return Card(
      margin: const EdgeInsets.only(right: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: SizedBox(
          width: 108,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Icon(icon, size: 18, color: color),
                  const SizedBox(width: 4),
                  Flexible(child: Text(value, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold))),
                ]),
                const SizedBox(height: 4),
                Text(label, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11, color: Colors.grey)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ============================================================
  // Tab 0：用户管理
  // ============================================================

  Widget _buildUsersTab() {
    final all = _tabData[0] as List<AdminUser>?;
    // 搜索框做前端过滤（社团/角色/回收站由后端过滤）
    final users = all == null
        ? null
        : (_userQ.isEmpty
            ? all
            : all.where((u) => u.nickname.contains(_userQ) || u.phone.contains(_userQ)).toList());

    return Column(children: [
      _buildTabHeader(
        hint: '搜索昵称或手机号…',
        value: _userQ,
        onChanged: (v) => setState(() => _userQ = v),
        buttonLabel: _userBin ? null : '新增用户',
        onPressed: _userBin ? null : _addUserDialog,
      ),
      // N13：批量操作工具条（回收站模式下不显示）
      if (!_userBin) _buildBatchBar(),
      _buildUserFilterBar(),
      Expanded(child: users == null
          ? const Center(child: CircularProgressIndicator())
          : users.isEmpty
              ? Center(child: Text(_userBin ? '回收站是空的' : '暂无匹配的用户'))
              : ListView.builder(padding: const EdgeInsets.all(8), itemCount: users.length, itemBuilder: (_, i) {
                  final u = users[i];
                  final isPresident = u.role == 'president';
                  // 批量多选模式：整行点击=勾选，不显示右上角菜单
                  if (_batchMode) {
                    final checked = _selectedUserIds.contains(u.id);
                    return Card(child: ListTile(
                      onTap: () => setState(() {
                        if (checked) { _selectedUserIds.remove(u.id); } else { _selectedUserIds.add(u.id); }
                      }),
                      leading: Checkbox(
                        value: checked,
                        onChanged: (_) => setState(() {
                          if (checked) { _selectedUserIds.remove(u.id); } else { _selectedUserIds.add(u.id); }
                        }),
                      ),
                      title: Text('${u.nickname}（${u.roleText}）', overflow: TextOverflow.ellipsis),
                      subtitle: Text(
                        '${u.phone} · ${u.clubName.isEmpty ? '无社团' : u.clubName}',
                      ),
                    ));
                  }
                  return Card(child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: isPresident ? Colors.amber.shade200 : null,
                      child: Text(u.nickname.isNotEmpty ? u.nickname[0] : '?'),
                    ),
                    title: Row(children: [
                      Flexible(child: Text('${u.nickname}（${u.roleText}）', overflow: TextOverflow.ellipsis)),
                      if (isPresident) const Padding(
                        padding: EdgeInsets.only(left: 4),
                        child: Icon(Icons.workspace_premium, size: 16, color: Colors.amber),
                      ),
                      if (u.isDeleted) Container(
                        margin: const EdgeInsets.only(left: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                        decoration: BoxDecoration(color: Colors.red.shade100, borderRadius: BorderRadius.circular(6)),
                        child: Text('回收站', style: TextStyle(fontSize: 10, color: Colors.red.shade700)),
                      ),
                    ]),
                    subtitle: Text(
                      '${u.phone} · ${u.gender}\n'
                      '${u.schoolName.isEmpty ? '无学校' : u.schoolName} · '
                      '${u.clubName.isEmpty ? '无社团' : u.clubName}\n'
                      '跑步 ${u.runCount} 次 · 共 ${u.totalKm.toStringAsFixed(1)} 公里'
                      '${u.isDeleted && u.deletedAt.isNotEmpty ? '\n删除时间：${u.deletedAt}' : ''}',
                    ),
                    isThreeLine: true,
                    trailing: PopupMenuButton<String>(
                      tooltip: '操作',
                      onSelected: (v) {
                        switch (v) {
                          case 'reset': _resetPasswordDialog(u); break;
                          case 'edit': _editUserDialog(u); break;
                          case 'president': _setPresidentDialog(u); break;
                          case 'delete': _deleteUser(u); break;
                          case 'restore': _restoreUser(u); break;
                          case 'purge': _permanentDeleteUser(u); break;
                        }
                      },
                      itemBuilder: (_) => u.isDeleted
                          ? const [
                              PopupMenuItem(value: 'restore', child: Text('从回收站恢复')),
                              PopupMenuItem(value: 'purge', child: Text('彻底删除（不可恢复）')),
                            ]
                          : [
                              const PopupMenuItem(value: 'edit', child: Text('编辑资料')),
                              const PopupMenuItem(value: 'reset', child: Text('重置密码')),
                              // 只有无社长身份的普通社员、且已加入社团，才能被任命为社长
                              if (u.role == 'member' && u.clubId != null)
                                const PopupMenuItem(value: 'president', child: Text('设为社长')),
                              const PopupMenuItem(value: 'delete', child: Text('移入回收站')),
                            ],
                    ),
                  ));
                })),
      // N13：多选模式下底部固定批量操作栏
      if (_batchMode && _selectedUserIds.isNotEmpty) _buildBatchActionBar(),
    ]);
  }

  // N13 批量操作工具条：批量导入 + 进入/退出多选模式
  Widget _buildBatchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 4),
      child: Row(children: [
        TextButton.icon(
          onPressed: _batchImportDialog,
          icon: const Icon(Icons.upload_file, size: 18),
          label: const Text('批量导入'),
        ),
        const SizedBox(width: 8),
        TextButton.icon(
          onPressed: () => setState(() {
            _batchMode = !_batchMode;
            _selectedUserIds.clear(); // 切换模式时清空已选，避免误操作
          }),
          icon: Icon(_batchMode ? Icons.close : Icons.checklist, size: 18),
          label: Text(_batchMode ? '退出多选' : '批量操作'),
        ),
        if (_batchMode) ...[
          const SizedBox(width: 8),
          Text('已选 ${_selectedUserIds.length} 人',
              style: const TextStyle(fontSize: 12, color: Colors.grey)),
        ],
      ]),
    );
  }

  // N13 底部批量操作栏：转社团 / 调角色
  Widget _buildBatchActionBar() {
    return Material(
      elevation: 8,
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(children: [
          Text('已选 ${_selectedUserIds.length} 人',
              style: const TextStyle(fontWeight: FontWeight.bold)),
          const Spacer(),
          TextButton.icon(
            onPressed: _batchTransferDialog,
            icon: const Icon(Icons.swap_horiz, size: 18),
            label: const Text('转社团'),
          ),
          const SizedBox(width: 8),
          FilledButton.icon(
            onPressed: _batchRoleDialog,
            icon: const Icon(Icons.manage_accounts, size: 18),
            label: const Text('调角色'),
          ),
        ]),
      ),
    );
  }

  // 用户筛选条：全部 / 回收站 / 社团 / 角色
  Widget _buildUserFilterBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 4),
      child: Wrap(spacing: 8, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
        ChoiceChip(
          label: const Text('全部用户'),
          selected: !_userBin,
          onSelected: (_) {
            if (_userBin) { setState(() => _userBin = false); _reloadUsers(); }
          },
        ),
        ChoiceChip(
          label: const Text('回收站'),
          selected: _userBin,
          onSelected: (_) {
            if (!_userBin) { setState(() => _userBin = true); _reloadUsers(); }
          },
        ),
        DropdownButton<int?>(
          value: _userClubId,
          hint: const Text('全部社团'),
          underline: const SizedBox.shrink(),
          items: [
            const DropdownMenuItem<int?>(value: null, child: Text('全部社团')),
            ..._clubs.map((c) => DropdownMenuItem<int?>(value: c.id, child: Text(c.name))),
          ],
          onChanged: (v) {
            setState(() => _userClubId = v);
            _reloadUsers();
          },
        ),
        DropdownButton<String>(
          value: _userRole,
          underline: const SizedBox.shrink(),
          items: const [
            DropdownMenuItem(value: '', child: Text('全部角色')),
            DropdownMenuItem(value: 'member', child: Text('社员')),
            DropdownMenuItem(value: 'president', child: Text('社长')),
            DropdownMenuItem(value: 'admin', child: Text('管理员')),
          ],
          onChanged: (v) {
            setState(() => _userRole = v ?? '');
            _reloadUsers();
          },
        ),
      ]),
    );
  }

  Future<void> _addUserDialog() async {
    final result = await _userFormDialog(title: '新增用户');
    if (result == null) return;
    try {
      await Api.adminCreateUser(widget.token, result);
      if (!mounted) return;
      _showError('用户已创建');
      _refreshCurrentTab();
    } on ApiException catch (e) { _showError(e.message); }
  }

  Future<void> _editUserDialog(AdminUser u) async {
    final result = await _userFormDialog(title: '编辑用户', initial: u);
    if (result == null) return;
    try {
      await Api.adminUpdateUser(widget.token, u.id, result);
      if (!mounted) return;
      _showError('已保存');
      _refreshCurrentTab();
    } on ApiException catch (e) { _showError(e.message); }
  }

  // 设为社长：把本社团该成员提升为社长（原社长自动降为社员）
  Future<void> _setPresidentDialog(AdminUser u) async {
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('设为社长'),
      content: Text('确定把「${u.nickname}」设为「${u.clubName}」的社长吗？\n原社长会自动降为普通社员。'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('确认任命')),
      ],
    ));
    if (ok != true) return;
    try {
      await Api.adminSetPresident(widget.token, u.clubId!, u.id);
      if (!mounted) return;
      _showError('已任命为社长');
      _refreshCurrentTab();
    } on ApiException catch (e) { _showError(e.message); }
  }

  // ============================================================
  // N13 批量操作对话框：批量导入 / 批量转社团 / 批量调角色
  // 统一步骤：对话框收集输入 → 关闭对话框 → 调接口 → 结果弹窗展示成功/失败明细
  // ============================================================

  // 批量导入：每行一位用户，格式「手机号,昵称,性别,密码」（英文逗号分隔）
  Future<void> _batchImportDialog() async {
    await _ensureDictLoaded();
    final textC = TextEditingController();
    int? clubId; // null = 不加入社团

    // 对话框返回 {text, clubId}，null 表示取消
    final input = await showDialog<Map<String, dynamic>>(context: context, builder: (ctx) => StatefulBuilder(
      builder: (ctx, setDlg) => AlertDialog(
        title: const Text('批量导入用户'),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('每行一位用户，英文逗号分隔：\n手机号,昵称,性别,密码\n\n示例：\n13800000001,张三,男,123456\n13800000002,李四,女,abc123',
              style: TextStyle(fontSize: 12, color: Colors.grey)),
          const SizedBox(height: 8),
          TextField(
            controller: textC,
            maxLines: 8,
            decoration: const InputDecoration(
              border: OutlineInputBorder(),
              hintText: '把名单粘贴到这里…',
            ),
          ),
          const SizedBox(height: 8),
          DropdownButton<int?>(
            value: clubId,
            isExpanded: true,
            hint: const Text('统一加入社团（可选）'),
            items: [
              const DropdownMenuItem<int?>(value: null, child: Text('暂不加入社团')),
              ..._clubs.map((c) => DropdownMenuItem<int?>(value: c.id, child: Text(c.name))),
            ],
            onChanged: (v) => setDlg(() => clubId = v),
          ),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, {'text': textC.text, 'club_id': clubId}),
            child: const Text('开始导入'),
          ),
        ],
      ),
    ));
    if (input == null) return;

    // 解析文本：逐行拆分，跳过空行；格式不对的行直接在前端拦截，不发请求
    final users = <Map<String, dynamic>>[];
    final lines = (input['text'] as String).split('\n');
    for (var i = 0; i < lines.length; i++) {
      final line = lines[i].trim();
      if (line.isEmpty) continue;
      final parts = line.split(',').map((s) => s.trim()).toList();
      if (parts.length != 4) {
        _showError('第 ${i + 1} 行格式不对，应为「手机号,昵称,性别,密码」4 段：$line');
        return;
      }
      users.add({'phone': parts[0], 'nickname': parts[1], 'gender': parts[2], 'password': parts[3]});
    }
    if (users.isEmpty) { _showError('名单为空，请先粘贴内容'); return; }

    try {
      final res = await Api.adminBatchImportUsers(widget.token, users, clubId: input['club_id'] as int?);
      if (!mounted) return;
      await _showBatchResult('导入结果', res);
      _refreshCurrentTab();
    } on ApiException catch (e) { _showError(e.message); }
  }

  // 批量转社团：把勾选的用户统一转移到目标社团（学校自动跟随）
  Future<void> _batchTransferDialog() async {
    await _ensureDictLoaded();
    final ids = _selectedUserIds.toList();
    int? clubId;
    bool noClub = false; // true = 移出社团

    final ok = await showDialog<bool>(context: context, builder: (ctx) => StatefulBuilder(
      builder: (ctx, setDlg) => AlertDialog(
        title: Text('批量转社团（${ids.length} 人）'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          RadioListTile<bool>(
            title: const Text('转移到目标社团'),
            value: false, groupValue: noClub,
            onChanged: (v) => setDlg(() => noClub = v!),
          ),
          if (!noClub)
            DropdownButton<int?>(
              value: clubId,
              isExpanded: true,
              hint: const Text('选择目标社团'),
              items: _clubs.map((c) => DropdownMenuItem<int?>(value: c.id, child: Text(c.name))).toList(),
              onChanged: (v) => setDlg(() => clubId = v),
            ),
          RadioListTile<bool>(
            title: const Text('移出社团（变为无社团用户）'),
            value: true, groupValue: noClub,
            onChanged: (v) => setDlg(() => noClub = v!),
          ),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('确认转移')),
        ],
      ),
    ));
    if (ok != true) return;
    if (!noClub && clubId == null) { _showError('请先选择目标社团'); return; }

    try {
      final res = await Api.adminBatchTransferClub(widget.token, ids, noClub ? null : clubId);
      if (!mounted) return;
      setState(() { _batchMode = false; _selectedUserIds.clear(); });
      await _showBatchResult('转移结果', res);
      _refreshCurrentTab();
    } on ApiException catch (e) { _showError(e.message); }
  }

  // 批量调角色：把勾选的用户统一设为社员/社长/管理员
  Future<void> _batchRoleDialog() async {
    final ids = _selectedUserIds.toList();
    String role = 'member';

    final ok = await showDialog<bool>(context: context, builder: (ctx) => StatefulBuilder(
      builder: (ctx, setDlg) => AlertDialog(
        title: Text('批量调整角色（${ids.length} 人）'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          RadioListTile<String>(title: const Text('普通社员'), value: 'member', groupValue: role,
              onChanged: (v) => setDlg(() => role = v!)),
          RadioListTile<String>(title: const Text('社长'), value: 'president', groupValue: role,
              onChanged: (v) => setDlg(() => role = v!)),
          RadioListTile<String>(title: const Text('管理员'), value: 'admin', groupValue: role,
              onChanged: (v) => setDlg(() => role = v!)),
          const SizedBox(height: 4),
          const Text('提示：不能包含自己；系统至少保留一个管理员。',
              style: TextStyle(fontSize: 12, color: Colors.grey)),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('确认调整')),
        ],
      ),
    ));
    if (ok != true) return;

    try {
      final res = await Api.adminBatchChangeRole(widget.token, ids, role);
      if (!mounted) return;
      setState(() { _batchMode = false; _selectedUserIds.clear(); });
      await _showBatchResult('调整结果', res);
      _refreshCurrentTab();
    } on ApiException catch (e) { _showError(e.message); }
  }

  // 批量操作结果弹窗：上面一行总结，下面列出失败明细（若有）
  Future<void> _showBatchResult(String title, Map<String, dynamic> res) async {
    final failed = ((res['failed'] ?? []) as List);
    await showDialog(context: context, builder: (ctx) => AlertDialog(
      title: Text(title),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text((res['message'] ?? '操作完成').toString(),
            style: const TextStyle(fontWeight: FontWeight.bold)),
        if (failed.isNotEmpty) ...[
          const SizedBox(height: 8),
          const Text('失败明细：', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
          for (final f in failed)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('• ${f is Map ? (f['error'] ?? f.toString()) : f}',
                  style: const TextStyle(fontSize: 12)),
            ),
        ],
      ])),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('知道了'))],
    ));
  }

  Future<Map<String, dynamic>?> _userFormDialog({required String title, AdminUser? initial}) async {
    await _ensureDictLoaded(); // 确保学校/社团字典已加载
    final phoneC = TextEditingController(text: initial?.phone ?? '');
    final nickC = TextEditingController(text: initial?.nickname ?? '');
    final pwdC = TextEditingController();
    final noteC = TextEditingController(text: initial?.avatar ?? '');
    String gender = initial?.gender ?? '男';
    String role = initial?.role ?? 'member';
    int? schoolId = initial?.schoolId;
    int? clubId = initial?.clubId;

    // 注意：AlertDialog 是独立路由，页面 setState 刷不到它，
    // 所以对话框内部的选项必须用 StatefulBuilder 的 setDlg 刷新
    return showDialog<Map<String, dynamic>>(context: context, builder: (ctx) => StatefulBuilder(
      builder: (ctx, setDlg) => AlertDialog(
        title: Text(title),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          TextField(controller: phoneC, decoration: const InputDecoration(labelText: '手机号（11位）')),
          TextField(controller: nickC, decoration: const InputDecoration(labelText: '昵称')),
          if (initial == null) // 新增时才显示密码
            TextField(controller: pwdC, obscureText: true, decoration: const InputDecoration(labelText: '密码（至少6位）')),
          const SizedBox(height: 8),
          Row(children: [
            const Text('性别：'),
            Expanded(child: RadioListTile<String>(title: const Text('男'), value: '男', groupValue: gender,
                onChanged: (v) => setDlg(() => gender = v!))),
            Expanded(child: RadioListTile<String>(title: const Text('女'), value: '女', groupValue: gender,
                onChanged: (v) => setDlg(() => gender = v!))),
          ]),
          const SizedBox(height: 4),
          Row(children: [
            const Text('角色：'),
            Expanded(child: DropdownButtonFormField<String>(
              value: role,
              decoration: const InputDecoration(border: InputBorder.none),
              items: const [DropdownMenuItem(value: 'member', child: Text('社员')), DropdownMenuItem(value: 'president', child: Text('社长')), DropdownMenuItem(value: 'admin', child: Text('管理员'))],
              onChanged: (v) => setDlg(() => role = v!),
            )),
          ]),
          Row(children: [
            const Text('学校：'),
            Expanded(child: DropdownButtonFormField<int>(
              value: schoolId,
              decoration: const InputDecoration(border: InputBorder.none),
              items: [
                const DropdownMenuItem<int>(value: null, child: Text('无社团（不加入任何学校）')),
                ..._schools.map((s) => DropdownMenuItem<int>(value: s.id, child: Text('${s.name}（${s.city}）'))),
              ],
              onChanged: (v) => setDlg(() { schoolId = v; clubId = null; }),
            )),
          ]),
          Row(children: [
            const Text('社团：'),
            Expanded(child: DropdownButtonFormField<int>(
              value: clubId,
              decoration: const InputDecoration(border: InputBorder.none),
              items: [
                const DropdownMenuItem<int>(value: null, child: Text('自动选择该校第一个社团')),
                ..._clubs.where((c) => schoolId == null || c.schoolId == schoolId).map((c) => DropdownMenuItem<int>(value: c.id, child: Text(c.name))),
              ],
              onChanged: schoolId == null ? null : (v) => setDlg(() => clubId = v),
            )),
          ]),
          if (initial != null) TextField(controller: noteC, decoration: const InputDecoration(labelText: '头像 URL（可留空）')),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
          FilledButton(onPressed: () {
            final phone = phoneC.text.trim();
            final nick = nickC.text.trim();
            final pwd = pwdC.text;
            if (phone.length != 11 || !RegExp(r'^1\d{10}$').hasMatch(phone)) { _showError('手机号格式不正确'); return; }
            if (nick.length < 2) { _showError('昵称至少 2 个字'); return; }
            if (initial == null && pwd.length < 6) { _showError('密码至少 6 位'); return; }
            if (initial == null && schoolId == null) { _showError('新增用户必须选择学校'); return; }
            final Map<String, dynamic> body = {
              'phone': phone, 'nickname': nick, 'gender': gender, 'role': role,
            };
            // 选了学校才提交归属；不选表示保持/设置为"无社团"
            if (schoolId != null) {
              body['school_id'] = schoolId;
              body['club_id'] = clubId;
            }
            if (initial == null) body['password'] = pwd;
            if (initial != null) body['avatar'] = noteC.text;
            Navigator.pop(ctx, body);
          }, child: const Text('保存')),
        ],
      ),
    ));
  }

  Future<void> _resetPasswordDialog(AdminUser u) async {
    final c = TextEditingController();
    final result = await showDialog<String>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('重置密码'),
      content: TextField(controller: c, obscureText: true, decoration: const InputDecoration(labelText: '新密码（至少6位）')),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
        FilledButton(onPressed: () => Navigator.pop(ctx, c.text), child: const Text('确认')),
      ],
    ));
    if (result == null || result.length < 6) { if (result != null) _showError('密码至少 6 位'); return; }
    try {
      await Api.adminResetPassword(widget.token, u.id, result);
      if (!mounted) return;
      _showError('密码已重置');
    } on ApiException catch (e) { _showError(e.message); }
  }

  // 删除用户 = 移入回收站（软删除，数据保留，可恢复）
  Future<void> _deleteUser(AdminUser u) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: const Text('移入回收站'),
      content: Text('确定把「${u.nickname}」(${u.phone}) 移入回收站吗？\n该用户将无法登录，数据会保留，可在回收站里恢复。'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(_, false), child: const Text('取消')),
        FilledButton(onPressed: () => Navigator.pop(_, true), style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('移入回收站')),
      ],
    ));
    if (ok != true) return;
    try {
      await Api.adminDeleteUser(widget.token, u.id);
      if (!mounted) return;
      _showError('已移入回收站');
      _refreshCurrentTab();
    } on ApiException catch (e) { _showError(e.message); }
  }

  // 从回收站恢复用户
  Future<void> _restoreUser(AdminUser u) async {
    try {
      await Api.adminRestoreUser(widget.token, u.id);
      if (!mounted) return;
      _showError('已恢复');
      _refreshCurrentTab();
    } on ApiException catch (e) { _showError(e.message); }
  }

  // 彻底删除（仅回收站里的用户可操作，数据全部清除）
  Future<void> _permanentDeleteUser(AdminUser u) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: const Text('彻底删除'),
      content: Text('确定彻底删除「${u.nickname}」(${u.phone}) 吗？\n该用户的跑步记录、计划、活动等全部数据会被清除，无法恢复！'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(_, false), child: const Text('取消')),
        FilledButton(onPressed: () => Navigator.pop(_, true), style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('彻底删除')),
      ],
    ));
    if (ok != true) return;
    try {
      await Api.adminPermanentDeleteUser(widget.token, u.id);
      if (!mounted) return;
      _showError('已彻底删除');
      _refreshCurrentTab();
    } on ApiException catch (e) { _showError(e.message); }
  }

  // ============================================================
  // Tab 1：社长申请审批
  // ============================================================

  Widget _buildApplicationsTab() {
    final apps = _tabData[1] as List<Application>?;
    final ms = (_tabData['memberships'] as List<MembershipRequest>?) ?? <MembershipRequest>[];
    if (apps == null) return const Center(child: CircularProgressIndicator());
    if (apps.isEmpty && ms.isEmpty) return const Center(child: Text('暂无待审批的申请'));

    return ListView(padding: const EdgeInsets.all(8), children: [
      // ---------- 入社 / 退社申请 ----------
      if (ms.isNotEmpty) ...[
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
          child: Text('入社 / 退社申请（${ms.length}）',
              style: const TextStyle(fontWeight: FontWeight.bold)),
        ),
        ...ms.map(_membershipCard),
        const SizedBox(height: 12),
      ],
      // ---------- 社长申请 ----------
      if (apps.isNotEmpty)
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 4, vertical: 6),
          child: Text('社长申请', style: TextStyle(fontWeight: FontWeight.bold)),
        ),
      ...apps.map(_applicationCard),
    ]);
  }

  // 一条入社/退社申请卡片
  Widget _membershipCard(MembershipRequest r) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
              child: Text('${r.nickname}（${r.phone}）',
                  style: const TextStyle(fontWeight: FontWeight.bold)),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: r.isJoin ? Colors.blue : Colors.deepOrange,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text('${r.typeText} · ${r.clubName}',
                  style: const TextStyle(color: Colors.white, fontSize: 11)),
            ),
          ]),
          const SizedBox(height: 6),
          Text('学校：${r.schoolName.isEmpty ? '未设置' : r.schoolName}'),
          if (r.reason.isNotEmpty) Text('申请理由：${r.reason}'),
          Text('提交时间：${r.createdAt}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: FilledButton.icon(
              onPressed: () => _handleMembership(r, true),
              icon: const Icon(Icons.check, size: 18),
              label: const Text('同意'),
            )),
            const SizedBox(width: 8),
            Expanded(child: OutlinedButton.icon(
              onPressed: () => _handleMembership(r, false),
              icon: const Icon(Icons.close, size: 18),
              label: const Text('驳回'),
              style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
            )),
          ]),
        ]),
      ),
    );
  }

  // 管理员审批入社/退社申请
  Future<void> _handleMembership(MembershipRequest r, bool approve) async {
    String reason = '';
    if (!approve) {
      final c = TextEditingController();
      final text = await showDialog<String>(context: context, builder: (ctx) => AlertDialog(
        title: const Text('驳回申请'),
        content: TextField(
          controller: c,
          maxLines: 2,
          decoration: const InputDecoration(labelText: '驳回原因（会显示给申请人）'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, c.text.trim()),
            child: const Text('确认驳回'),
          ),
        ],
      ));
      if (text == null) { c.dispose(); return; }
      reason = text;
      c.dispose();
    }
    try {
      if (approve) {
        await Api.approveMembershipRequest(widget.token, r.id);
      } else {
        await Api.rejectMembershipRequest(widget.token, r.id, reason: reason);
      }
      if (!mounted) return;
      _showError(approve ? '已同意' : '已驳回');
      _tabLoaded[0] = false; // 成员归属变了，用户管理界面也要刷新
      await _refreshCurrentTab();
    } on ApiException catch (e) { _showError(e.message); }
  }

  // 一条社长申请卡片
  Widget _applicationCard(Application a) {
    final color = a.isPending
        ? Colors.orange
        : a.isApproved
            ? Colors.green
            : Colors.red;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text('${a.nickname}（${a.phone}）',
                style: const TextStyle(fontWeight: FontWeight.bold))),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(10)),
              child: Text(a.statusText, style: const TextStyle(color: Colors.white, fontSize: 11)),
            ),
          ]),
          const SizedBox(height: 6),
          Text('申请学校/社团：${a.schoolName}${a.clubName.isEmpty ? '' : ' · ${a.clubName}'}'),
          if (a.province.isNotEmpty || a.city.isNotEmpty)
            Text('所在地区：${a.province} ${a.city}'),
          if (a.note.isNotEmpty) Text('申请留言：${a.note}'),
          Text('提交时间：${a.createdAt}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
          if (a.isRejected && a.rejectReason.isNotEmpty)
            Text('驳回原因：${a.rejectReason}', style: const TextStyle(fontSize: 12, color: Colors.red)),
          if (a.isPending) ...[
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: FilledButton.icon(
                onPressed: () => _approveApplication(a),
                icon: const Icon(Icons.check, size: 18),
                label: const Text('批准'),
              )),
              const SizedBox(width: 8),
              Expanded(child: OutlinedButton.icon(
                onPressed: () => _rejectApplication(a),
                icon: const Icon(Icons.close, size: 18),
                label: const Text('驳回'),
                style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
              )),
            ]),
          ],
        ]),
      ),
    );
  }

  // 批准申请：后端自动建学校 + 建社团 + 任命申请人为社长
  Future<void> _approveApplication(Application a) async {
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('批准申请'),
      content: Text('批准「${a.nickname}」的申请？\n系统会自动创建学校「${a.schoolName}」和社团「${a.clubName}」，并把 TA 任命为社长。'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('批准')),
      ],
    ));
    if (ok != true) return;
    try {
      await Api.adminApproveApplication(widget.token, a.id);
      if (!mounted) return;
      _showError('已批准，申请人已成为社长');
      _tabLoaded[0] = false; // 用户/社团数据都变了，强制刷新
      _dictLoaded = false;
      _refreshCurrentTab();
    } on ApiException catch (e) { _showError(e.message); }
  }

  // 驳回申请：必须填写驳回原因（会展示给申请人）
  Future<void> _rejectApplication(Application a) async {
    final reasonC = TextEditingController();
    final reason = await showDialog<String>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('驳回申请'),
      content: TextField(
        controller: reasonC,
        maxLines: 3,
        decoration: const InputDecoration(labelText: '驳回原因（会显示给申请人）', hintText: '例如：学校名称不规范，请填写全称'),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
        FilledButton(onPressed: () {
          final t = reasonC.text.trim();
          if (t.isEmpty) { _showError('请填写驳回原因'); return; }
          Navigator.pop(ctx, t);
        }, style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('确认驳回')),
      ],
    ));
    if (reason == null || reason.isEmpty) return;
    try {
      await Api.adminRejectApplication(widget.token, a.id, reason);
      if (!mounted) return;
      _showError('已驳回');
      _refreshCurrentTab();
    } on ApiException catch (e) { _showError(e.message); }
  }

  // ============================================================
  // Tab 2：跑步记录
  // ============================================================

  Widget _buildRunsTab() {
    final runs = _tabData[2] as List<AdminRun>?;
    if (runs == null) return const Center(child: CircularProgressIndicator());
    final filtered = _runQ.isEmpty
        ? runs
        : runs.where((r) => r.nickname.contains(_runQ) || r.phone.contains(_runQ)).toList();

    return Column(children: [
      _buildTabHeader(
        hint: '搜索昵称或手机号…',
        value: _runQ,
        onChanged: (v) => setState(() => _runQ = v),
        buttonLabel: null, onPressed: null,
      ),
      Expanded(child: filtered.isEmpty
          ? const Center(child: Text('暂无跑步记录'))
          : ListView.builder(padding: const EdgeInsets.all(8), itemCount: filtered.length, itemBuilder: (_, i) {
              final r = filtered[i];
              return Card(child: ListTile(
                leading: const Icon(Icons.directions_run, color: Colors.green),
                title: Text('${r.nickname} · ${r.runDate}'),
                subtitle: Text(
                  '${r.distanceKm.toStringAsFixed(2)} 公里 · ${r.durationText} · 配速 ${r.paceText}\n'
                  '${r.phone} · ${r.schoolName.isEmpty ? '-' : r.schoolName}',
                ),
                isThreeLine: true,
                trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                  IconButton(icon: const Icon(Icons.edit, color: Colors.blue), tooltip: '编辑', onPressed: () => _editRunDialog(r)),
                  IconButton(icon: const Icon(Icons.delete, color: Colors.red), tooltip: '删除', onPressed: () => _deleteRun(r)),
                ]),
              ));
            })),
    ]);
  }

  Future<void> _editRunDialog(AdminRun r) async {
    final dateC = TextEditingController(text: r.runDate);
    final distC = TextEditingController(text: r.distanceKm.toStringAsFixed(2));
    final durC = TextEditingController(text: r.durationSeconds.toString());
    await showDialog(context: context, builder: (ctx) => AlertDialog(
      title: const Text('编辑跑步记录'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: dateC, decoration: const InputDecoration(labelText: '日期 YYYY-MM-DD')),
        TextField(controller: distC, decoration: const InputDecoration(labelText: '距离（公里）'), keyboardType: TextInputType.number),
        TextField(controller: durC, decoration: const InputDecoration(labelText: '用时（秒）'), keyboardType: TextInputType.number),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
        FilledButton(onPressed: () async {
          try {
            await Api.adminUpdateRun(widget.token, r.id, {
              'run_date': dateC.text.trim(),
              'distance_km': double.tryParse(distC.text) ?? 0,
              'duration_seconds': int.tryParse(durC.text) ?? 0,
            });
            if (!mounted) return;
            _showError('已保存');
            Navigator.pop(ctx);
            _refreshCurrentTab();
          } on ApiException catch (e) { _showError(e.message); }
        }, child: const Text('保存')),
      ],
    ));
  }

  Future<void> _deleteRun(AdminRun r) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: const Text('删除记录'),
      content: Text('确定删除「${r.nickname}」在 ${r.runDate} 的跑步记录吗？'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(_, false), child: const Text('取消')),
        FilledButton(onPressed: () => Navigator.pop(_, true), style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('删除')),
      ],
    ));
    if (ok != true) return;
    try {
      await Api.adminDeleteRun(widget.token, r.id);
      if (!mounted) return;
      _showError('已删除');
      _refreshCurrentTab();
    } on ApiException catch (e) { _showError(e.message); }
  }

  // ============================================================
  // Tab 3：训练计划
  // ============================================================

  static const Map<String, String> _goalTypeNames = {
    'volume': '跑量目标', 'speed': '速度目标', 'habit': '习惯养成', 'race': '赛事备赛', 'weight': '体重目标',
  };

  Widget _buildPlansTab() {
    final plans = _tabData[3] as List<AdminPlan>?;
    if (plans == null) return const Center(child: CircularProgressIndicator());
    return plans.isEmpty
        ? const Center(child: Text('暂无训练计划'))
        : ListView.builder(padding: const EdgeInsets.all(8), itemCount: plans.length, itemBuilder: (_, i) {
            final p = plans[i];
            return Card(child: ListTile(
              leading: const Icon(Icons.flag, color: Colors.amber),
              title: Text('${p.title} · ${_goalTypeNames[p.goalType] ?? p.goalType}'),
              subtitle: Text(
                '${p.ownerNickname}（${p.ownerPhone}）${p.clubName.isEmpty ? '' : ' · ' + p.clubName}\n'
                '${p.weeks} 周 · ${p.startDate} · ${p.intensity}'
                '${p.targetKm > 0 ? ' · ${p.targetKm.toStringAsFixed(0)}km' : ''}',
              ),
              isThreeLine: true,
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                IconButton(icon: const Icon(Icons.edit, color: Colors.blue), tooltip: '编辑', onPressed: () => _editPlanDialog(p)),
                IconButton(icon: const Icon(Icons.delete, color: Colors.red), tooltip: '删除', onPressed: () => _deletePlan(p)),
              ]),
            ));
          });
  }

  Future<void> _editPlanDialog(AdminPlan p) async {
    final titleC = TextEditingController(text: p.title);
    final weeksC = TextEditingController(text: p.weeks.toString());
    final startC = TextEditingController(text: p.startDate);
    final targetC = TextEditingController(text: p.targetKm.toStringAsFixed(1));
    final noteC = TextEditingController(text: p.note);
    String intensity = p.intensity;
    String goalType = p.goalType;

    await showDialog(context: context, builder: (ctx) => StatefulBuilder(
      builder: (ctx, setDlg) => AlertDialog(
      title: const Text('编辑计划'),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: titleC, decoration: const InputDecoration(labelText: '计划名称')),
        Row(children: [
          const Text('目标类型：'),
          Expanded(child: DropdownButtonFormField<String>(
            value: goalType,
            decoration: const InputDecoration(border: InputBorder.none),
            items: _goalTypeNames.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
            onChanged: (v) => setDlg(() => goalType = v!),
          )),
        ]),
        Row(children: [
          const Text('强度：'),
          Expanded(child: DropdownButtonFormField<String>(
            value: intensity,
            decoration: const InputDecoration(border: InputBorder.none),
            items: const [DropdownMenuItem(value: '低', child: Text('低')), DropdownMenuItem(value: '中等', child: Text('中等')), DropdownMenuItem(value: '高', child: Text('高'))],
            onChanged: (v) => setDlg(() => intensity = v!),
          )),
        ]),
        TextField(controller: weeksC, decoration: const InputDecoration(labelText: '周期（周）'), keyboardType: TextInputType.number),
        TextField(controller: startC, decoration: const InputDecoration(labelText: '开始日期 YYYY-MM-DD')),
        TextField(controller: targetC, decoration: const InputDecoration(labelText: '目标跑量 km'), keyboardType: TextInputType.number),
        TextField(controller: noteC, decoration: const InputDecoration(labelText: '备注'), maxLines: 2),
      ])),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
        FilledButton(onPressed: () async {
          try {
            await Api.adminUpdatePlan(widget.token, p.id, {
              'title': titleC.text.trim(),
              'goal_type': goalType,
              'intensity': intensity,
              'weeks': int.tryParse(weeksC.text) ?? 4,
              'start_date': startC.text.trim(),
              'target_km': double.tryParse(targetC.text) ?? 0,
              'note': noteC.text,
            });
            if (!mounted) return;
            _showError('已保存');
            Navigator.pop(ctx);
            _refreshCurrentTab();
          } on ApiException catch (e) { _showError(e.message); }
        }, child: const Text('保存')),
      ],
      ),
    ));
  }

  Future<void> _deletePlan(AdminPlan p) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: const Text('删除计划'),
      content: Text('确定删除「${p.ownerNickname}」的计划「${p.title}」吗？'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(_, false), child: const Text('取消')),
        FilledButton(onPressed: () => Navigator.pop(_, true), style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('删除')),
      ],
    ));
    if (ok != true) return;
    try {
      await Api.adminDeletePlan(widget.token, p.id);
      if (!mounted) return;
      _showError('已删除');
      _refreshCurrentTab();
    } on ApiException catch (e) { _showError(e.message); }
  }

  // ============================================================
  // Tab 4：学校 & 社团（切换子 tab）
  // ============================================================

  int _subTab = 0; // 0=学校，1=社团

  Widget _buildSchoolClubTab() {
    final schools = _tabData['schools'] as List<AdminSchool>?;
    final clubs = _tabData['clubs'] as List<AdminClub>?;

    return Column(children: [
      Container(color: Colors.grey.shade200, child: Row(children: [
        Expanded(child: TextButton(
          onPressed: () => setState(() => _subTab = 0),
          style: TextButton.styleFrom(foregroundColor: _subTab == 0 ? Colors.white : Colors.black54, backgroundColor: _subTab == 0 ? Colors.blue : Colors.transparent),
          child: const Text('学校管理'),
        )),
        Expanded(child: TextButton(
          onPressed: () => setState(() => _subTab = 1),
          style: TextButton.styleFrom(foregroundColor: _subTab == 1 ? Colors.white : Colors.black54, backgroundColor: _subTab == 1 ? Colors.blue : Colors.transparent),
          child: const Text('社团管理'),
        )),
      ])),
      Expanded(child: _subTab == 0 ? _buildSchoolList(schools) : _buildClubList(clubs)),
    ]);
  }

  Widget _buildSchoolList(List<AdminSchool>? schools) {
    if (schools == null) return const Center(child: CircularProgressIndicator());
    return Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(12, 8, 12, 4), child: SizedBox(width: double.infinity, child: FilledButton.icon(
        onPressed: _addSchoolDialog, icon: const Icon(Icons.add), label: const Text('新增学校'),
      ))),
      Expanded(child: schools.isEmpty
          ? const Center(child: Text('暂无学校'))
          : ListView.builder(padding: const EdgeInsets.all(8), itemCount: schools.length, itemBuilder: (_, i) {
              final s = schools[i];
              return Card(child: ListTile(
                leading: const Icon(Icons.school, color: Colors.purple),
                title: Text(s.name),
                subtitle: Text('${s.province}${s.city.isNotEmpty ? ' · ' + s.city : ''} · ${s.clubCount} 个社团 · ${s.userCount} 名成员'),
                trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                  IconButton(icon: const Icon(Icons.edit, color: Colors.blue), tooltip: '编辑', onPressed: () => _editSchoolDialog(s)),
                  if (s.id != 1) IconButton(icon: const Icon(Icons.delete, color: Colors.red), tooltip: '删除', onPressed: () => _deleteSchool(s)),
                ]),
              ));
            })),
    ]);
  }

  Future<void> _addSchoolDialog() async {
    final nameC = TextEditingController();
    final provC = TextEditingController();
    final cityC = TextEditingController();
    await showDialog(context: context, builder: (ctx) => AlertDialog(
      title: const Text('新增学校'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: nameC, decoration: const InputDecoration(labelText: '学校名称')),
        TextField(controller: provC, decoration: const InputDecoration(labelText: '省份')),
        TextField(controller: cityC, decoration: const InputDecoration(labelText: '城市')),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
        FilledButton(onPressed: () async {
          final name = nameC.text.trim();
          if (name.length < 2) { _showError('学校名称至少 2 个字'); return; }
          try {
            await Api.adminCreateSchool(widget.token, {'name': name, 'province': provC.text.trim(), 'city': cityC.text.trim()});
            if (!mounted) return;
            _showError('已创建');
            Navigator.pop(ctx);
            _refreshCurrentTab();
          } on ApiException catch (e) { _showError(e.message); }
        }, child: const Text('保存')),
      ],
    ));
  }

  Future<void> _editSchoolDialog(AdminSchool s) async {
    final nameC = TextEditingController(text: s.name);
    final provC = TextEditingController(text: s.province);
    final cityC = TextEditingController(text: s.city);
    await showDialog(context: context, builder: (ctx) => AlertDialog(
      title: const Text('编辑学校'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: nameC, decoration: const InputDecoration(labelText: '学校名称')),
        TextField(controller: provC, decoration: const InputDecoration(labelText: '省份')),
        TextField(controller: cityC, decoration: const InputDecoration(labelText: '城市')),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
        FilledButton(onPressed: () async {
          try {
            await Api.adminUpdateSchool(widget.token, s.id, {'name': nameC.text.trim(), 'province': provC.text.trim(), 'city': cityC.text.trim()});
            if (!mounted) return;
            _showError('已保存');
            Navigator.pop(ctx);
            _refreshCurrentTab();
          } on ApiException catch (e) { _showError(e.message); }
        }, child: const Text('保存')),
      ],
    ));
  }

  Future<void> _deleteSchool(AdminSchool s) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: const Text('删除学校'),
      content: Text('确定删除「${s.name}」吗？\n注意：学校下还有 ${s.clubCount} 个社团、${s.userCount} 名成员时不允许删除。'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(_, false), child: const Text('取消')),
        FilledButton(onPressed: () => Navigator.pop(_, true), style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('删除')),
      ],
    ));
    if (ok != true) return;
    try {
      await Api.adminDeleteSchool(widget.token, s.id);
      if (!mounted) return;
      _showError('已删除');
      _refreshCurrentTab();
    } on ApiException catch (e) { _showError(e.message); }
  }

  Widget _buildClubList(List<AdminClub>? clubs) {
    if (clubs == null) return const Center(child: CircularProgressIndicator());
    return Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(12, 8, 12, 4), child: SizedBox(width: double.infinity, child: FilledButton.icon(
        onPressed: _addClubDialog, icon: const Icon(Icons.add), label: const Text('新增社团'),
      ))),
      Expanded(child: clubs.isEmpty
          ? const Center(child: Text('暂无社团'))
          : ListView.builder(padding: const EdgeInsets.all(8), itemCount: clubs.length, itemBuilder: (_, i) {
              final c = clubs[i];
              return Card(child: ListTile(
                leading: const Icon(Icons.group, color: Colors.teal),
                title: Text(c.name),
                // 社长信息放在最醒目的位置：社团列表点进去就是成员管理，社长排第一位
                subtitle: Text(
                  '社长：${c.presidentNickname.isEmpty ? '暂无（可到成员里任命）' : c.presidentNickname}\n'
                  '${c.schoolName} · ${c.memberCount} 名成员 · ${c.eventCount} 个活动',
                ),
                isThreeLine: true,
                onTap: () => _openClubMembers(c),
                trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                  IconButton(icon: const Icon(Icons.edit, color: Colors.blue), tooltip: '编辑社团', onPressed: () => _editClubDialog(c)),
                  IconButton(icon: const Icon(Icons.delete, color: Colors.red), tooltip: '删除社团', onPressed: () => _deleteClub(c)),
                ]),
              ));
            })),
    ]);
  }

  // 点社团 → 跳到"用户管理"并自动按该社团筛选，社长排在最上面
  void _openClubMembers(AdminClub c) {
    setState(() {
      _userBin = false; // 回收站模式下没有成员
      _userRole = '';
      _userClubId = c.id;
      _userQ = '';
    });
    _tabController.animateTo(0);
    _reloadUsers();
  }

  Future<void> _addClubDialog() async {
    await _ensureDictLoaded();
    final nameC = TextEditingController();
    final introC = TextEditingController();
    final timeC = TextEditingController();
    final placeC = TextEditingController();
    final contactC = TextEditingController();
    int? schoolId;
    await showDialog(context: context, builder: (ctx) => StatefulBuilder(
      builder: (ctx, setDlg) => AlertDialog(
      title: const Text('新增社团'),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Row(children: [
          const Text('学校：'),
          Expanded(child: DropdownButtonFormField<int>(
            value: schoolId,
            decoration: const InputDecoration(border: InputBorder.none),
            items: _schools.map((s) => DropdownMenuItem<int>(value: s.id, child: Text(s.name))).toList(),
            onChanged: (v) => setDlg(() => schoolId = v!),
          )),
        ]),
        TextField(controller: nameC, decoration: const InputDecoration(labelText: '社团名称')),
        TextField(controller: introC, decoration: const InputDecoration(labelText: '简介')),
        TextField(controller: timeC, decoration: const InputDecoration(labelText: '固定训练时间')),
        TextField(controller: placeC, decoration: const InputDecoration(labelText: '集合地点')),
        TextField(controller: contactC, decoration: const InputDecoration(labelText: '联系方式')),
      ])),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
        FilledButton(onPressed: () async {
          if (schoolId == null) { _showError('请先选择学校'); return; }
          final name = nameC.text.trim();
          if (name.length < 2) { _showError('社团名称至少 2 个字'); return; }
          try {
            await Api.adminCreateClub(widget.token, {
              'school_id': schoolId, 'name': name, 'intro': introC.text.trim(),
              'training_time': timeC.text.trim(), 'training_place': placeC.text.trim(), 'contact': contactC.text.trim(),
            });
            if (!mounted) return;
            _showError('已创建');
            Navigator.pop(ctx);
            _refreshCurrentTab();
          } on ApiException catch (e) { _showError(e.message); }
        }, child: const Text('保存')),
      ],
      ),
    ));
  }

  Future<void> _editClubDialog(AdminClub c) async {
    await _ensureDictLoaded();
    final nameC = TextEditingController(text: c.name);
    final introC = TextEditingController(text: c.intro);
    final timeC = TextEditingController(text: c.trainingTime);
    final placeC = TextEditingController(text: c.trainingPlace);
    final contactC = TextEditingController(text: c.contact);
    int schoolId = c.schoolId;
    await showDialog(context: context, builder: (ctx) => StatefulBuilder(
      builder: (ctx, setDlg) => AlertDialog(
      title: const Text('编辑社团'),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Row(children: [
          const Text('学校：'),
          Expanded(child: DropdownButtonFormField<int>(
            value: schoolId,
            decoration: const InputDecoration(border: InputBorder.none),
            items: _schools.map((s) => DropdownMenuItem<int>(value: s.id, child: Text(s.name))).toList(),
            onChanged: (v) => setDlg(() => schoolId = v!),
          )),
        ]),
        TextField(controller: nameC, decoration: const InputDecoration(labelText: '社团名称')),
        TextField(controller: introC, decoration: const InputDecoration(labelText: '简介')),
        TextField(controller: timeC, decoration: const InputDecoration(labelText: '固定训练时间')),
        TextField(controller: placeC, decoration: const InputDecoration(labelText: '集合地点')),
        TextField(controller: contactC, decoration: const InputDecoration(labelText: '联系方式')),
      ])),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
        FilledButton(onPressed: () async {
          try {
            await Api.adminUpdateClub(widget.token, c.id, {
              'school_id': schoolId, 'name': nameC.text.trim(), 'intro': introC.text.trim(),
              'training_time': timeC.text.trim(), 'training_place': placeC.text.trim(), 'contact': contactC.text.trim(),
            });
            if (!mounted) return;
            _showError('已保存');
            Navigator.pop(ctx);
            _refreshCurrentTab();
          } on ApiException catch (e) { _showError(e.message); }
        }, child: const Text('保存')),
      ],
      ),
    ));
  }

  Future<void> _deleteClub(AdminClub c) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: const Text('删除社团'),
      content: Text('确定删除「${c.name}」吗？\n\n该社团 ${c.memberCount} 名成员会全部变成"无社团"用户，'
          '社团的公告、任务、约跑活动也会一并删除，操作不可恢复！'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(_, false), child: const Text('取消')),
        FilledButton(onPressed: () => Navigator.pop(_, true), style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('确认删除')),
      ],
    ));
    if (ok != true) return;
    try {
      await Api.adminDeleteClub(widget.token, c.id);
      if (!mounted) return;
      _showError('社团已删除');
      _tabLoaded[0] = false;
      _refreshCurrentTab();
    } on ApiException catch (e) { _showError(e.message); }
  }

  // ============================================================
  // Tab 5：社团内容（公告 / 任务 / 活动 子 tab）
  // ============================================================

  int _contentSubTab = 0;

  Widget _buildContentTab() {
    final rawAnns = _tabData['announcements'] as List<AdminAnnouncement>?;
    final rawTasks = _tabData['tasks'] as List<AdminTask>?;
    final rawEvts = _tabData['events'] as List<AdminEvent>?;

    // 按社团过滤（管理员可以直接管某个社团的内容）
    final anns = rawAnns == null
        ? null
        : (_contentClubId == null ? rawAnns : rawAnns.where((e) => e.clubId == _contentClubId).toList());
    final tasks = rawTasks == null
        ? null
        : (_contentClubId == null ? rawTasks : rawTasks.where((e) => e.clubId == _contentClubId).toList());
    final evts = rawEvts == null
        ? null
        : (_contentClubId == null ? rawEvts : rawEvts.where((e) => e.clubId == _contentClubId).toList());

    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 4, 12, 0),
        child: Row(children: [
          const Text('按社团筛选：'),
          const SizedBox(width: 8),
          DropdownButton<int?>(
            value: _contentClubId,
            hint: const Text('全部社团'),
            underline: const SizedBox.shrink(),
            items: [
              const DropdownMenuItem<int?>(value: null, child: Text('全部社团')),
              ..._clubs.map((c) => DropdownMenuItem<int?>(value: c.id, child: Text(c.name))),
            ],
            onChanged: (v) => setState(() => _contentClubId = v),
          ),
        ]),
      ),
      Container(color: Colors.grey.shade200, child: Row(children: [
        _contentBtn('公告', 0), _contentBtn('任务', 1), _contentBtn('活动', 2),
      ])),
      Expanded(child: IndexedStack(index: _contentSubTab, children: [
        _buildAnnList(anns), _buildTaskList(tasks), _buildEventList(evts),
      ])),
    ]);
  }

  Widget _contentBtn(String label, int idx) {
    return Expanded(child: TextButton(
      onPressed: () => setState(() => _contentSubTab = idx),
      style: TextButton.styleFrom(
        foregroundColor: _contentSubTab == idx ? Colors.white : Colors.black54,
        backgroundColor: _contentSubTab == idx ? Colors.blue : Colors.transparent,
      ),
      child: Text(label),
    ));
  }

  Widget _buildAnnList(List<AdminAnnouncement>? list) {
    if (list == null) return const Center(child: CircularProgressIndicator());
    return list.isEmpty
        ? const Center(child: Text('暂无公告'))
        : ListView.builder(padding: const EdgeInsets.all(8), itemCount: list.length, itemBuilder: (_, i) {
            final a = list[i];
            return Card(child: ListTile(
              leading: const Icon(Icons.campaign, color: Colors.blue),
              title: Text(a.title),
              subtitle: Text('${a.clubName.isEmpty ? '（未知社团）' : a.clubName} · ${a.authorNickname} · ${a.createdAt}'),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                IconButton(icon: const Icon(Icons.edit, color: Colors.blue), tooltip: '编辑', onPressed: () => _editAnn(a)),
                IconButton(icon: const Icon(Icons.delete, color: Colors.red), tooltip: '删除', onPressed: () => _deleteAnn(a)),
              ]),
            ));
          });
  }

  // 管理员代改公告（N11：补齐"只能删不能改"的短板）
  Future<void> _editAnn(AdminAnnouncement a) async {
    final title = TextEditingController(text: a.title);
    final content = TextEditingController(text: a.content);
    bool saving = false;
    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: const Text('编辑公告'),
          content: SizedBox(
            width: double.maxFinite,
            child: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                TextField(controller: title, decoration: const InputDecoration(labelText: '标题')),
                TextField(controller: content, maxLines: 5, decoration: const InputDecoration(labelText: '内容')),
              ]),
            ),
          ),
          actions: [
            TextButton(onPressed: saving ? null : () => Navigator.pop(ctx), child: const Text('取消')),
            FilledButton(
              onPressed: saving
                  ? null
                  : () async {
                      setDlg(() => saving = true);
                      try {
                        await Api.adminUpdateAnnouncement(
                          widget.token, a.id,
                          title: title.text.trim(), content: content.text.trim(),
                        );
                        if (!ctx.mounted) return;
                        Navigator.pop(ctx);
                        _showError('已保存');
                        _refreshCurrentTab();
                      } on ApiException catch (e) {
                        setDlg(() => saving = false);
                        _showError(e.message);
                      }
                    },
              child: Text(saving ? '保存中...' : '保存'),
            ),
          ],
        ),
      ),
    );
    title.dispose();
    content.dispose();
  }

  Future<void> _deleteAnn(AdminAnnouncement a) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: const Text('删除公告'), content: Text('确定删除「${a.title}」吗？'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(_, false), child: const Text('取消')),
        FilledButton(onPressed: () => Navigator.pop(_, true), style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('删除')),
      ],
    ));
    if (ok != true) return;
    try { await Api.adminDeleteAnnouncement(widget.token, a.id); _showError('已删除'); _refreshCurrentTab(); }
    on ApiException catch (e) { _showError(e.message); }
  }

  Widget _buildTaskList(List<AdminTask>? list) {
    if (list == null) return const Center(child: CircularProgressIndicator());
    return list.isEmpty
        ? const Center(child: Text('暂无任务'))
        : ListView.builder(padding: const EdgeInsets.all(8), itemCount: list.length, itemBuilder: (_, i) {
            final t = list[i];
            return Card(child: ListTile(
              leading: const Icon(Icons.assignment, color: Colors.orange),
              title: Text(t.title),
              subtitle: Text('${t.clubName.isEmpty ? '（未知社团）' : t.clubName} · ${t.authorNickname} · 截止 ${t.deadline}'),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                IconButton(icon: const Icon(Icons.edit, color: Colors.blue), tooltip: '编辑', onPressed: () => _editTask(t)),
                IconButton(icon: const Icon(Icons.delete, color: Colors.red), tooltip: '删除', onPressed: () => _deleteTask(t)),
              ]),
            ));
          });
  }

  // 管理员代改任务
  Future<void> _editTask(AdminTask t) async {
    final title = TextEditingController(text: t.title);
    final content = TextEditingController(text: t.content);
    final deadline = TextEditingController(text: t.deadline);
    bool saving = false;
    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: const Text('编辑任务'),
          content: SizedBox(
            width: double.maxFinite,
            child: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                TextField(controller: title, decoration: const InputDecoration(labelText: '标题')),
                TextField(controller: content, maxLines: 5, decoration: const InputDecoration(labelText: '内容')),
                TextField(controller: deadline, decoration: const InputDecoration(labelText: '截止日期（YYYY-MM-DD，可空）')),
              ]),
            ),
          ),
          actions: [
            TextButton(onPressed: saving ? null : () => Navigator.pop(ctx), child: const Text('取消')),
            FilledButton(
              onPressed: saving
                  ? null
                  : () async {
                      setDlg(() => saving = true);
                      try {
                        await Api.adminUpdateTask(
                          widget.token, t.id,
                          title: title.text.trim(), content: content.text.trim(),
                          deadline: deadline.text.trim(),
                        );
                        if (!ctx.mounted) return;
                        Navigator.pop(ctx);
                        _showError('已保存');
                        _refreshCurrentTab();
                      } on ApiException catch (e) {
                        setDlg(() => saving = false);
                        _showError(e.message);
                      }
                    },
              child: Text(saving ? '保存中...' : '保存'),
            ),
          ],
        ),
      ),
    );
    title.dispose();
    content.dispose();
    deadline.dispose();
  }

  Future<void> _deleteTask(AdminTask t) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: const Text('删除任务'), content: Text('确定删除「${t.title}」吗？'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(_, false), child: const Text('取消')),
        FilledButton(onPressed: () => Navigator.pop(_, true), style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('删除')),
      ],
    ));
    if (ok != true) return;
    try { await Api.adminDeleteTask(widget.token, t.id); _showError('已删除'); _refreshCurrentTab(); }
    on ApiException catch (e) { _showError(e.message); }
  }

  Widget _buildEventList(List<AdminEvent>? list) {
    if (list == null) return const Center(child: CircularProgressIndicator());
    return list.isEmpty
        ? const Center(child: Text('暂无约跑活动'))
        : ListView.builder(padding: const EdgeInsets.all(8), itemCount: list.length, itemBuilder: (_, i) {
            final e = list[i];
            return Card(child: ListTile(
              leading: const Icon(Icons.event, color: Colors.pink),
              title: Text('${e.title} · ${e.eventDate} ${e.eventTime}'),
              subtitle: Text('${e.place} · ${e.clubName.isEmpty ? '' : e.clubName} · ${e.authorNickname} · 报名 ${e.maxParticipants > 0 ? '${e.signupCount}/${e.maxParticipants}' : '${e.signupCount} 人'} · 已签到 ${e.checkinCount} 人'),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                IconButton(icon: const Icon(Icons.edit, color: Colors.blue), tooltip: '编辑', onPressed: () => _editEvent(e)),
                IconButton(icon: const Icon(Icons.delete, color: Colors.red), tooltip: '删除', onPressed: () => _deleteEvent(e)),
              ]),
            ));
          });
  }

  // 管理员代改约跑活动
  Future<void> _editEvent(AdminEvent e) async {
    final title = TextEditingController(text: e.title);
    final date = TextEditingController(text: e.eventDate);
    final time = TextEditingController(text: e.eventTime);
    final place = TextEditingController(text: e.place);
    final note = TextEditingController(text: e.note);
    final maxP = TextEditingController(text: e.maxParticipants > 0 ? '${e.maxParticipants}' : '');
    bool saving = false;
    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: const Text('编辑约跑活动'),
          content: SizedBox(
            width: double.maxFinite,
            child: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                TextField(controller: title, decoration: const InputDecoration(labelText: '活动名称')),
                TextField(controller: date, decoration: const InputDecoration(labelText: '活动日期（YYYY-MM-DD）')),
                TextField(controller: time, decoration: const InputDecoration(labelText: '集合时间（HH:MM，可空）')),
                TextField(controller: place, decoration: const InputDecoration(labelText: '集合地点')),
                TextField(controller: note, maxLines: 3, decoration: const InputDecoration(labelText: '补充说明')),
                TextField(controller: maxP, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: '人数上限（留空=不限）')),
              ]),
            ),
          ),
          actions: [
            TextButton(onPressed: saving ? null : () => Navigator.pop(ctx), child: const Text('取消')),
            FilledButton(
              onPressed: saving
                  ? null
                  : () async {
                      setDlg(() => saving = true);
                      try {
                        await Api.adminUpdateEvent(
                          widget.token, e.id,
                          title: title.text.trim(),
                          eventDate: date.text.trim(),
                          eventTime: time.text.trim(),
                          place: place.text.trim(),
                          note: note.text.trim(),
                          maxParticipants: int.tryParse(maxP.text.trim()) ?? 0,
                        );
                        if (!ctx.mounted) return;
                        Navigator.pop(ctx);
                        _showError('已保存');
                        _refreshCurrentTab();
                      } on ApiException catch (err) {
                        setDlg(() => saving = false);
                        _showError(err.message);
                      }
                    },
              child: Text(saving ? '保存中...' : '保存'),
            ),
          ],
        ),
      ),
    );
    for (final c in [title, date, time, place, note, maxP]) {
      c.dispose();
    }
  }

  Future<void> _deleteEvent(AdminEvent e) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: const Text('删除活动'), content: Text('确定删除约跑活动「${e.title}」吗？报名记录也会一并清除。'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(_, false), child: const Text('取消')),
        FilledButton(onPressed: () => Navigator.pop(_, true), style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('删除')),
      ],
    ));
    if (ok != true) return;
    try { await Api.adminDeleteEvent(widget.token, e.id); _showError('已删除'); _refreshCurrentTab(); }
    on ApiException catch (e) { _showError(e.message); }
  }

  // ============================================================
  // Tab 6：计划模板
  // ============================================================

  // ============================================================
  // 知识文章管理（N12：把文章管理并入后台）
  // ============================================================

  Widget _buildArticlesTab() {
    final list = _tabData[6] as List<Article>?;
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 6, 12, 6),
        child: Row(children: [
          Expanded(
            child: Text(
              list == null ? '知识文章' : '知识文章（${list.length} 篇）',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
          FilledButton.icon(
            onPressed: () => _articleDialog(),
            icon: const Icon(Icons.add, size: 18),
            label: const Text('新增文章'),
          ),
        ]),
      ),
      Expanded(
        child: list == null
            ? const Center(child: CircularProgressIndicator())
            : (list.isEmpty
                ? const Center(child: Text('暂无文章'))
                : ListView.builder(
                    padding: const EdgeInsets.all(8),
                    itemCount: list.length,
                    itemBuilder: (_, i) {
                      final a = list[i];
                      return Card(
                        child: ListTile(
                          leading: const Icon(Icons.menu_book, color: Colors.green),
                          title: Text(a.title, maxLines: 2, overflow: TextOverflow.ellipsis),
                          subtitle: Text('${a.category} · ${a.createdAt}'),
                          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                            IconButton(
                              tooltip: '编辑',
                              icon: const Icon(Icons.edit, color: Colors.blue),
                              onPressed: () => _articleDialog(article: a),
                            ),
                            IconButton(
                              tooltip: '删除',
                              icon: const Icon(Icons.delete, color: Colors.red),
                              onPressed: () => _deleteArticle(a),
                            ),
                          ]),
                        ),
                      );
                    })),
      ),
    ]);
  }

  // 新增 / 编辑文章弹窗（article 为空 = 新增）
  Future<void> _articleDialog({Article? article}) async {
    final category = TextEditingController(text: article?.category ?? '🌱 入门必读');
    final title = TextEditingController(text: article?.title ?? '');
    final summary = TextEditingController(text: article?.summary ?? '');
    final content = TextEditingController(text: article?.content ?? '');
    final tags = TextEditingController(text: article?.tags ?? '');
    final imageUrl = TextEditingController(text: article?.imageUrl ?? '');
    final attachmentUrl = TextEditingController(text: article?.attachmentUrl ?? '');
    bool saving = false;

    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: Text(article == null ? '新增知识文章' : '编辑知识文章'),
          content: SizedBox(
            width: double.maxFinite,
            child: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                TextField(controller: category, decoration: const InputDecoration(labelText: '分类')),
                TextField(controller: title, decoration: const InputDecoration(labelText: '标题（必填）')),
                TextField(controller: summary, decoration: const InputDecoration(labelText: '摘要（列表显示）')),
                TextField(
                  controller: content,
                  maxLines: 8,
                  decoration: const InputDecoration(labelText: '正文（必填）'),
                ),
                TextField(controller: tags, decoration: const InputDecoration(labelText: '标签（逗号分隔）')),
                TextField(controller: imageUrl, decoration: const InputDecoration(labelText: '封面图地址（可空）')),
                TextField(controller: attachmentUrl, decoration: const InputDecoration(labelText: '附件地址（可空）')),
              ]),
            ),
          ),
          actions: [
            TextButton(
              onPressed: saving ? null : () => Navigator.pop(ctx),
              child: const Text('取消'),
            ),
            FilledButton(
              onPressed: saving
                  ? null
                  : () async {
                      if (title.text.trim().isEmpty || content.text.trim().isEmpty) {
                        _showError('标题和正文不能为空');
                        return;
                      }
                      setDlg(() => saving = true);
                      try {
                        if (article == null) {
                          await Api.addArticle(
                            widget.token,
                            category: category.text.trim(),
                            title: title.text.trim(),
                            summary: summary.text.trim(),
                            content: content.text.trim(),
                            tags: tags.text.trim(),
                            imageUrl: imageUrl.text.trim(),
                            attachmentUrl: attachmentUrl.text.trim(),
                          );
                        } else {
                          await Api.updateArticle(
                            widget.token,
                            article.id,
                            category: category.text.trim(),
                            title: title.text.trim(),
                            summary: summary.text.trim(),
                            content: content.text.trim(),
                            tags: tags.text.trim(),
                            imageUrl: imageUrl.text.trim(),
                            attachmentUrl: attachmentUrl.text.trim(),
                          );
                        }
                        if (!ctx.mounted) return;
                        Navigator.pop(ctx);
                        _showError('已保存');
                        _tabLoaded[6] = false;
                        _refreshCurrentTab();
                      } on ApiException catch (e) {
                        setDlg(() => saving = false);
                        _showError(e.message);
                      }
                    },
              child: Text(saving ? '保存中...' : '保存'),
            ),
          ],
        ),
      ),
    );
    for (final c in [category, title, summary, content, tags, imageUrl, attachmentUrl]) {
      c.dispose();
    }
  }

  Future<void> _deleteArticle(Article a) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('删除文章'),
        content: Text('确定删除「${a.title}」吗？此操作不可恢复。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(_, false), child: const Text('取消')),
          FilledButton(
            onPressed: () => Navigator.pop(_, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('删除'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await Api.deleteArticle(widget.token, a.id);
      _showError('已删除');
      _tabLoaded[6] = false;
      _refreshCurrentTab();
    } on ApiException catch (e) {
      _showError(e.message);
    }
  }

  Widget _buildTemplatesTab() {
    final templates = _tabData[7] as List<PlanTemplate>?;
    if (templates == null) return const Center(child: CircularProgressIndicator());
    return Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(12, 10, 12, 4), child: SizedBox(width: double.infinity, child: FilledButton.icon(
        onPressed: _addTemplateDialog, icon: const Icon(Icons.add), label: const Text('新增计划模板'),
      ))),
      Expanded(child: templates.isEmpty
          ? const Center(child: Text('暂无模板，点上方按钮添加'))
          : ListView.builder(padding: const EdgeInsets.all(8), itemCount: templates.length, itemBuilder: (_, i) {
              final t = templates[i];
              return Card(child: ListTile(
                leading: const Icon(Icons.flag, color: Colors.green),
                title: Text(t.title),
                subtitle: Text(
                  '${_goalTypeNames[t.goalType] ?? t.goalType} · ${t.weeks} 周 · 强度${t.intensity}'
                  '${t.targetKm > 0 ? ' · ${t.targetKm.toStringAsFixed(0)} km' : ''}\n${t.description}',
                ),
                isThreeLine: true,
                trailing: IconButton(icon: const Icon(Icons.delete, color: Colors.red), onPressed: () => _deleteTemplate(t)),
              ));
            })),
    ]);
  }

  // ============================================================
  // 数据看板（N10）：趋势 / 分布 / 对比 的可视化展示
  // 布局：顶部 4 个核心指标卡 → 折线图×2 → 柱状图 → 社团对比 → 饼图×2
  // ============================================================
  Widget _buildDashboardTab() {
    final d = _tabData[8] as AdminDashboard?;
    if (d == null) return const Center(child: CircularProgressIndicator());

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        // ---------- 今日核心指标卡 ----------
        Row(children: [
          _dashStatCard('今日新增', '${d.todayNewUsers}', Icons.person_add, Colors.blue),
          _dashStatCard('今日跑步', '${d.todayRuns}', Icons.directions_run, Colors.green),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          _dashStatCard('本周活跃', '${d.weekActiveUsers}', Icons.groups, Colors.orange),
          _dashStatCard('人均跑量', '${d.avgKmPerUser.toStringAsFixed(1)}km', Icons.route, Colors.purple),
        ]),
        const SizedBox(height: 12),

        // ---------- 近 30 天新增用户趋势 ----------
        _dashCard('近 30 天新增用户', DashboardLineChart(
          values: [for (final p in d.newUsersTrend) p.value],
          dates: [for (final p in d.newUsersTrend) p.date],
          color: Colors.blue,
        )),
        const SizedBox(height: 12),

        // ---------- 近 30 天活跃用户趋势 ----------
        _dashCard('近 30 天活跃人数（当日有跑步）', DashboardLineChart(
          values: [for (final p in d.activeUsersTrend) p.value],
          dates: [for (final p in d.activeUsersTrend) p.date],
          color: Colors.green,
        )),
        const SizedBox(height: 12),

        // ---------- 近 12 周跑量趋势 ----------
        _dashCard('近 12 周跑量趋势（km）', DashboardBarChart(
          values: [for (final p in d.weeklyKmTrend) p.value],
          labels: [for (final p in d.weeklyKmTrend) p.date],
          color: Colors.teal,
        )),
        const SizedBox(height: 12),

        // ---------- 社团总跑量 TOP10 ----------
        _dashCard('社团总跑量 TOP10', DashboardClubBarList(
          names: [for (final c in d.clubComparison) '${c.clubName}（${c.schoolName}）'],
          values: [for (final c in d.clubComparison) c.km],
          tail: [for (final c in d.clubComparison) '${c.members}'],
        )),
        const SizedBox(height: 12),

        // ---------- 用户角色分布 ----------
        _dashCard('用户角色分布', DashboardPieChart(
          labels: [for (final s in d.roleDistribution) _roleName(s.label)],
          counts: [for (final s in d.roleDistribution) s.count],
          colors: const [Colors.blue, Colors.orange, Colors.red],
        )),
        const SizedBox(height: 12),

        // ---------- 计划状态分布 ----------
        _dashCard('训练计划状态分布', DashboardPieChart(
          labels: [for (final s in d.planStatusDistribution) s.label],
          counts: [for (final s in d.planStatusDistribution) s.count],
          colors: const [Colors.blue, Colors.green, Colors.grey],
        )),
        const SizedBox(height: 12),
      ],
    );
  }

  // 看板小卡片：标题 + 内容
  Widget _dashCard(String title, Widget child) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            child,
          ],
        ),
      ),
    );
  }

  // 看板顶部统计小卡（一行两个）
  Widget _dashStatCard(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Card(
        margin: const EdgeInsets.symmetric(horizontal: 4),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          child: Row(children: [
            Icon(icon, color: color, size: 26),
            const SizedBox(width: 8),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color),
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              ],
            )),
          ]),
        ),
      ),
    );
  }

  // 角色英文 → 中文显示
  String _roleName(String role) {
    switch (role) {
      case 'admin': return '管理员';
      case 'president': return '社长';
      default: return '社员';
    }
  }

  Future<void> _addTemplateDialog() async {
    final titleC = TextEditingController();
    final descC = TextEditingController();
    final noteC = TextEditingController();
    final weeksC = TextEditingController(text: '4');
    final kmC = TextEditingController(text: '0');
    String goalType = 'volume';
    String intensity = '中等';
    await showDialog(context: context, builder: (ctx) => StatefulBuilder(
      builder: (ctx, setDlg) => AlertDialog(
      title: const Text('新增计划模板'),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: titleC, decoration: const InputDecoration(labelText: '模板名称')),
        Row(children: [
          const Text('目标类型：'),
          Expanded(child: DropdownButtonFormField<String>(
            value: goalType,
            decoration: const InputDecoration(border: InputBorder.none),
            items: _goalTypeNames.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
            onChanged: (v) => setDlg(() => goalType = v!),
          )),
        ]),
        Row(children: [
          const Text('强度：'),
          Expanded(child: DropdownButtonFormField<String>(
            value: intensity,
            decoration: const InputDecoration(border: InputBorder.none),
            items: const [DropdownMenuItem(value: '低', child: Text('低')), DropdownMenuItem(value: '中等', child: Text('中等')), DropdownMenuItem(value: '高', child: Text('高'))],
            onChanged: (v) => setDlg(() => intensity = v!),
          )),
        ]),
        TextField(controller: weeksC, decoration: const InputDecoration(labelText: '周期（周）'), keyboardType: TextInputType.number),
        TextField(controller: kmC, decoration: const InputDecoration(labelText: '目标 km（0 表示无）'), keyboardType: TextInputType.number),
        TextField(controller: descC, decoration: const InputDecoration(labelText: '描述'), maxLines: 2),
        TextField(controller: noteC, decoration: const InputDecoration(labelText: '备注'), maxLines: 2),
      ])),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('取消')),
        FilledButton(onPressed: () async {
          final title = titleC.text.trim();
          if (title.isEmpty) { _showError('模板名称不能为空'); return; }
          try {
            await Api.adminAddPlanTemplate(widget.token, {
              'title': title, 'description': descC.text, 'note': noteC.text,
              'goal_type': goalType, 'intensity': intensity,
              'weeks': int.tryParse(weeksC.text) ?? 4,
              'target_km': double.tryParse(kmC.text) ?? 0,
              'goal_data': {},
            });
            if (!mounted) return;
            _showError('已添加');
            Navigator.pop(ctx);
            _refreshCurrentTab();
          } on ApiException catch (e) { _showError(e.message); }
        }, child: const Text('保存')),
      ],
      ),
    ));
  }

  Future<void> _deleteTemplate(PlanTemplate t) async {
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: const Text('删除模板'), content: Text('确定删除模板「${t.title}」吗？'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(_, false), child: const Text('取消')),
        FilledButton(onPressed: () => Navigator.pop(_, true), style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('删除')),
      ],
    ));
    if (ok != true) return;
    try { await Api.adminDeletePlanTemplate(widget.token, t.id); _showError('已删除'); _refreshCurrentTab(); }
    on ApiException catch (e) { _showError(e.message); }
  }

  // ============================================================
  // 通用搜索+新增头部
  // ============================================================
  Widget _buildTabHeader({
    required String hint, required String value, required ValueChanged<String> onChanged,
    String? buttonLabel, VoidCallback? onPressed,
  }) {
    return Padding(padding: const EdgeInsets.fromLTRB(12, 8, 12, 4), child: Row(children: [
      Expanded(child: TextField(
        decoration: InputDecoration(hintText: hint, prefixIcon: const Icon(Icons.search), border: const OutlineInputBorder()),
        onChanged: onChanged,
      )),
      if (buttonLabel != null) ...[
        const SizedBox(width: 8),
        FilledButton.icon(onPressed: onPressed, icon: const Icon(Icons.add), label: Text(buttonLabel)),
      ],
    ]));
  }

  // ============================================================
  // Tab 9：全员沟通（管理员发布全员消息，用户可回复）
  // ============================================================
  Widget _buildBroadcastsTab() {
    final list = _tabData[9] as List<Broadcast>?;
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 6, 12, 6),
        child: Row(children: [
          Expanded(
            child: Text(
              list == null ? '全员沟通' : '全员沟通（${list.length} 条）',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
          FilledButton.icon(
            onPressed: _broadcastDialog,
            icon: const Icon(Icons.campaign, size: 18),
            label: const Text('发布消息'),
          ),
        ]),
      ),
      Expanded(
        child: list == null
            ? const Center(child: CircularProgressIndicator())
            : (list.isEmpty
                ? const Center(child: Text('暂无消息，点右上角发布第一条全员消息'))
                : ListView.builder(
                    padding: const EdgeInsets.all(8),
                    itemCount: list.length,
                    itemBuilder: (_, i) {
                      final b = list[i];
                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(children: [
                                Expanded(
                                  child: Text(b.title, style: const TextStyle(fontWeight: FontWeight.bold)),
                                ),
                                Text(b.createdAt, style: const TextStyle(fontSize: 11, color: Colors.grey)),
                              ]),
                              const SizedBox(height: 4),
                              Text(
                                b.content,
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 13, color: Colors.black87),
                              ),
                              const SizedBox(height: 8),
                              Row(children: [
                                Icon(Icons.reply, size: 14, color: Colors.grey),
                                const SizedBox(width: 4),
                                Text('${b.replyCount} 条回复', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                                const Spacer(),
                                TextButton.icon(
                                  onPressed: () => _viewReplies(b),
                                  icon: const Icon(Icons.chat_bubble_outline, size: 16),
                                  label: const Text('查看回复'),
                                ),
                                IconButton(
                                  tooltip: '删除',
                                  icon: const Icon(Icons.delete, color: Colors.red, size: 18),
                                  onPressed: () => _deleteBroadcast(b),
                                ),
                              ]),
                            ],
                          ),
                        ),
                      );
                    })),
      ),
    ]);
  }

  // 发布全员消息弹窗：内容默认填充当前 APP 更新说明（每次发新版时可一键通知全员）
  Future<void> _broadcastDialog() async {
    final title = TextEditingController();
    final content = TextEditingController();
    bool saving = false;

    // 打开弹窗时异步拉取 APP 更新说明，作为默认内容
    Api.appVersion().then((v) {
      final notes = (v['notes'] ?? '').toString();
      if (notes.isNotEmpty && content.text.isEmpty) {
        content.text = notes;
      }
    }).catchError((_) {});

    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: const Text('发布全员消息'),
          content: SizedBox(
            width: double.maxFinite,
            child: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                TextField(
                  controller: title,
                  decoration: const InputDecoration(labelText: '标题（必填，1-60字）'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: content,
                  maxLines: 8,
                  decoration: const InputDecoration(
                    labelText: '内容（必填，已默认填入本次更新说明，可修改）',
                    border: OutlineInputBorder(),
                  ),
                ),
              ]),
            ),
          ),
          actions: [
            TextButton(
              onPressed: saving ? null : () => Navigator.pop(ctx),
              child: const Text('取消'),
            ),
            FilledButton(
              onPressed: saving
                  ? null
                  : () async {
                      if (title.text.trim().isEmpty) {
                        _showError('请填写标题');
                        return;
                      }
                      setDlg(() => saving = true);
                      try {
                        await Api.adminCreateBroadcast(
                          widget.token,
                          title: title.text.trim(),
                          content: content.text.trim(),
                        );
                        if (!ctx.mounted) return;
                        Navigator.pop(ctx);
                        _showError('已发布，全员通知已推送');
                        _tabLoaded[9] = false;
                        _refreshCurrentTab();
                      } on ApiException catch (e) {
                        setDlg(() => saving = false);
                        _showError(e.message);
                      }
                    },
              child: Text(saving ? '发布中...' : '发布'),
            ),
          ],
        ),
      ),
    );
    title.dispose();
    content.dispose();
  }

  // 查看某条消息的回复列表
  Future<void> _viewReplies(Broadcast b) async {
    List<BroadcastReply> replies = [];
    String? err;
    try {
      replies = await Api.adminBroadcastReplies(widget.token, b.id);
    } on ApiException catch (e) {
      err = e.message;
    }
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('「${b.title}」的回复（${replies.length}）'),
        content: SizedBox(
          width: double.maxFinite,
          height: 360,
          child: err != null
              ? Center(child: Text(err, style: const TextStyle(color: Colors.red)))
              : (replies.isEmpty
                  ? const Center(child: Text('暂无回复'))
                  : ListView.builder(
                      itemCount: replies.length,
                      itemBuilder: (_, i) {
                        final r = replies[i];
                        return ListTile(
                          leading: CircleAvatar(
                            radius: 16,
                            child: Text(r.userNickname.isNotEmpty ? r.userNickname.characters.first : '?'),
                          ),
                          title: Text(r.userNickname),
                          subtitle: Text(r.content),
                          trailing: Text(r.createdAt, style: const TextStyle(fontSize: 10, color: Colors.grey)),
                        );
                      })),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('关闭')),
        ],
      ),
    );
  }

  Future<void> _deleteBroadcast(Broadcast b) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('删除消息'),
        content: Text('确定删除「${b.title}」吗？回复和全员通知也会一并清除。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(_, false), child: const Text('取消')),
          FilledButton(
            onPressed: () => Navigator.pop(_, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('删除'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await Api.adminDeleteBroadcast(widget.token, b.id);
      _showError('已删除');
      _tabLoaded[9] = false;
      _refreshCurrentTab();
    } on ApiException catch (e) {
      _showError(e.message);
    }
  }
}
