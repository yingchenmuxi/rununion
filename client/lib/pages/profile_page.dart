// ============================================================
// 模块六：个人中心页
// 功能：
//   1) 顶部个人卡片：头像（emoji）+ 昵称 + 角色，点击可修改
//   2) 燃脂消耗卡：有体重目标计划的用户可见，今日/本周/累计跑步消耗
//   3) 每日静息心率卡：记录/补记某天静息心率
//   4) 我的 PB：1000米 / 3000米 / 5000米 / 万米 / 半马 / 全马（与排行榜口径一致）
//   5) 数据变化曲线：配速 / 周跑量 / 静息心率 / 体重 四个指标切换（自绘折线图）
//   6) 退出登录按钮
// ============================================================
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api.dart';
import '../local_store.dart';
import '../models.dart';
import '../widgets/user_avatar.dart';
import 'login_page.dart';

class ProfilePage extends StatefulWidget {
  final String token;
  final User user;
  // 修改资料后回调给主页，更新主页里的 user
  final ValueChanged<User>? onUserChanged;

  const ProfilePage({
    super.key,
    required this.token,
    required this.user,
    this.onUserChanged,
  });

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  MyStats? _stats;
  String? _error;
  late User _user;

  // 静息心率记录（升序）：{log_date, heart_rate}
  List<Map<String, dynamic>>? _heartRates;
  // 体重记录（升序）
  List<WeightLog>? _weights;
  // 燃脂消耗汇总：is_burner / today / week / total / weight_kg
  Map<String, dynamic>? _calories;
  // 累计已达成计划数（计划荣誉徽章）
  int _achievedPlans = 0;
  // 数据曲线当前展示的指标：pace 配速 / weekly 周跑量 / heart 静息心率 / weight 体重
  String _chartMetric = 'pace';

  // 可选 emoji 头像列表
  static const List<String> _avatarOptions = [
    '🏃', '🏃‍♂️', '🏃‍♀️', '💨', '⚡', '🔥',
    '💪', '🦁', '🐯', '🦅', '🐎', '🌟',
    '🎯', '🏆', '🥇', '🎖️',
  ];

  @override
  void initState() {
    super.initState();
    _user = widget.user;
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    // 主数据：统计（PB/记录），失败时整页报错
    try {
      final s = await Api.myStats(widget.token);
      if (!mounted) return;
      setState(() => _stats = s);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _stats = null;
      });
    }
    // 辅助数据：心率/体重/燃脂消耗，失败不影响页面其他部分
    Api.myHeartRates(widget.token).then((v) {
      if (mounted) setState(() => _heartRates = v);
    }).catchError((_) {});
    Api.myWeights(widget.token).then((v) {
      if (mounted) setState(() => _weights = v);
    }).catchError((_) {});
    Api.myCalories(widget.token).then((v) {
      if (mounted) setState(() => _calories = v);
    }).catchError((_) {});
    // 计划荣誉：统计已达成（status=achieved）的计划数量
    Api.myPlans(widget.token).then((plans) {
      if (!mounted) return;
      setState(() => _achievedPlans = plans.where((p) => p.status == 'achieved').length);
    }).catchError((_) {});
  }

  String _formatSeconds(int? seconds) {
    if (seconds == null) return '暂无';
    if (seconds >= 3600) {
      final h = seconds ~/ 3600;
      final m = (seconds % 3600) ~/ 60;
      final s = seconds % 60;
      return '$h:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
    }
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  // 修改昵称
  Future<void> _editNickname() async {
    final ctrl = TextEditingController(text: _user.nickname);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('修改昵称'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: '新昵称',
            hintText: '至少 2 个字',
            border: OutlineInputBorder(),
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
      final updated = await Api.updateMe(widget.token, nickname: ctrl.text.trim());
      // 同步更新本地存储 + 当前页面 + 通知主页
      await LocalStore.saveLogin(widget.token, updated);
      if (!mounted) return;
      setState(() => _user = updated);
      widget.onUserChanged?.call(updated);
      _toast('昵称已更新');
    } on ApiException catch (e) {
      if (!mounted) return;
      _toast(e.message);
    }
  }

  // 选头像：支持上传照片（相册/拍照）或选 emoji
  Future<void> _pickAvatar() async {
    final picked = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('选头像'),
        content: SizedBox(
          width: double.maxFinite,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            // 上传照片入口
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _uploadAvatar(ImageSource.gallery, ctx),
                  icon: const Icon(Icons.photo_library, size: 18),
                  label: const Text('从相册选'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _uploadAvatar(ImageSource.camera, ctx),
                  icon: const Icon(Icons.camera_alt, size: 18),
                  label: const Text('拍照'),
                ),
              ),
            ]),
            const Divider(height: 24),
            // emoji 网格
            SizedBox(
              height: 220,
              child: GridView.count(
                shrinkWrap: true,
                crossAxisCount: 4,
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                children: [
                  // 第一项：清除自定义头像（用昵称第一个字）
                  InkWell(
                    onTap: () => Navigator.pop(ctx, ''),
                    child: Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey.shade300),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Center(child: Icon(Icons.clear)),
                    ),
                  ),
                  for (final emoji in _avatarOptions)
                    InkWell(
                      onTap: () => Navigator.pop(ctx, emoji),
                      child: Container(
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: _user.avatar == emoji ? Colors.green : Colors.grey.shade300,
                            width: _user.avatar == emoji ? 2 : 1,
                          ),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Center(child: Text(emoji, style: const TextStyle(fontSize: 28))),
                      ),
                    ),
                ],
              ),
            ),
          ]),
        ),
      ),
    );
    if (picked == null) return;

    try {
      final updated = await Api.updateMe(widget.token, avatar: picked);
      await LocalStore.saveLogin(widget.token, updated);
      if (!mounted) return;
      setState(() => _user = updated);
      widget.onUserChanged?.call(updated);
      _toast('头像已更新');
    } on ApiException catch (e) {
      if (!mounted) return;
      _toast(e.message);
    }
  }

  // 上传照片作为头像：选图 → base64 → /api/upload → 保存 avatar URL
  Future<void> _uploadAvatar(ImageSource source, BuildContext dialogCtx) async {
    Navigator.pop(dialogCtx); // 先关选头像弹窗
    try {
      final picker = ImagePicker();
      final XFile? file = await picker.pickImage(
        source: source,
        imageQuality: 85,
        maxWidth: 512,
        maxHeight: 512,
      );
      if (file == null) return;

      if (!mounted) return;
      _toast('正在上传...');
      final bytes = await file.readAsBytes();
      final dataUrl = 'data:image/jpeg;base64,${base64Encode(bytes)}';
      final url = await Api.uploadFile(widget.token, dataUrl);

      final updated = await Api.updateMe(widget.token, avatar: url);
      await LocalStore.saveLogin(widget.token, updated);
      if (!mounted) return;
      setState(() => _user = updated);
      widget.onUserChanged?.call(updated);
      _toast('头像已更新');
    } on ApiException catch (e) {
      if (!mounted) return;
      _toast(e.message);
    } catch (e) {
      if (!mounted) return;
      _toast('上传失败，请重试');
    }
  }

  // 日期格式化：DateTime → YYYY-MM-DD
  String _fmtDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  // 记录/修改某天的静息心率（同一天重复保存 = 覆盖）
  Future<void> _recordHeartRate() async {
    final hrCtrl = TextEditingController();
    DateTime date = DateTime.now();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setD) => AlertDialog(
          title: const Text('记录静息心率'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // 日期选择（默认今天，可补记之前的）
              TextField(
                controller: TextEditingController(text: _fmtDate(date)),
                readOnly: true,
                decoration: const InputDecoration(labelText: '日期', border: OutlineInputBorder()),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: ctx,
                    initialDate: date,
                    firstDate: DateTime(2020),
                    lastDate: DateTime.now(),
                  );
                  if (picked != null) setD(() => date = picked);
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: hrCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: '静息心率（次/分）',
                  hintText: '早晨醒来平躺时测量最准',
                  border: OutlineInputBorder(),
                ),
              ),
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
    final hr = int.tryParse(hrCtrl.text.trim());
    if (hr == null || hr < 30 || hr > 220) {
      _toast('心率需是 30-220 之间的整数');
      return;
    }
    try {
      await Api.saveHeartRate(widget.token, _fmtDate(date), hr);
      if (!mounted) return;
      _toast('静息心率已保存');
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      _toast(e.message);
    }
  }

  // 退出登录
  Future<void> _logout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('退出登录'),
        content: const Text('确定要退出当前账号吗？'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('退出'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await LocalStore.clear();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginPage()),
      (_) => false,
    );
  }

  void _toast(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  String get _roleText {
    if (_user.isAdmin) return '管理员';
    if (_user.isPresident) return '社长';
    return '社员';
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ========== 1) 个人卡片 ==========
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  InkWell(
                    onTap: _pickAvatar,
                    borderRadius: BorderRadius.circular(40),
                    child: Stack(
                      children: [
                        UserAvatar(
                          avatar: _user.avatar,
                          nickname: _user.nickname,
                          gender: _user.gender,
                          size: 64,
                        ),
                        Positioned(
                          right: 0,
                          bottom: 0,
                          child: Container(
                            decoration: const BoxDecoration(
                              color: Colors.green,
                              shape: BoxShape.circle,
                            ),
                            padding: const EdgeInsets.all(3),
                            child: const Icon(Icons.edit, size: 12, color: Colors.white),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              _user.nickname,
                              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: _user.isAdmin
                                    ? Colors.red.shade50
                                    : _user.isPresident
                                        ? Colors.blue.shade50
                                        : Colors.grey.shade200,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                _roleText,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: _user.isAdmin
                                      ? Colors.red
                                      : _user.isPresident
                                          ? Colors.blue
                                          : Colors.grey.shade700,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '性别 ${_user.gender}',
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.edit_outlined),
                    onPressed: _editNickname,
                    tooltip: '修改昵称',
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // ========== 1.5) 计划荣誉（完成计划累积金色徽章） ==========
          Card(
            color: const Color(0xFFFFF8E1),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  const Text('🏅', style: TextStyle(fontSize: 26)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('计划荣誉',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 2),
                        Text(
                          _achievedPlans > 0
                              ? '已达成 $_achievedPlans 个训练计划，继续保持！'
                              : '完成一个训练计划，就能获得一枚金色徽章',
                          style: TextStyle(fontSize: 12, color: Colors.brown.shade600),
                        ),
                      ],
                    ),
                  ),
                  if (_achievedPlans > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF3CD),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFD4A017)),
                      ),
                      child: Text(
                        '× $_achievedPlans',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF9A6B00),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // ========== 2) 燃脂消耗卡（仅有体重目标计划的用户可见） ==========
          if (_calories?['is_burner'] == true) _buildCaloriesCard(),

          // ========== 3) 每日静息心率卡 ==========
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.favorite, color: Colors.red, size: 20),
                      const SizedBox(width: 6),
                      const Text('每日静息心率',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      const Spacer(),
                      FilledButton.tonalIcon(
                        onPressed: _recordHeartRate,
                        icon: const Icon(Icons.add, size: 16),
                        label: const Text('记录'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  _buildTodayHeartRate(),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // ========== 4) PB 卡片 ==========
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('我的 PB（个人最好成绩）',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  if (_error != null)
                    Text(_error!, style: const TextStyle(color: Colors.red))
                  else if (_stats == null)
                    const Center(child: Padding(
                      padding: EdgeInsets.all(16),
                      child: CircularProgressIndicator(),
                    ))
                  else ...[
                    Row(
                      children: [
                        _pbTile('1000 米', _formatSeconds(_stats!.pb1000), Colors.green),
                        _pbTile('3000 米', _formatSeconds(_stats!.pb3000), Colors.teal),
                        _pbTile('5000 米', _formatSeconds(_stats!.pb5000), Colors.blue),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        _pbTile('万米', _formatSeconds(_stats!.pb10000), Colors.purple),
                        _pbTile('半马', _formatSeconds(_stats!.pb21097), Colors.orange),
                        _pbTile('全马', _formatSeconds(_stats!.pb42195), Colors.red),
                      ],
                    ),
                  ],
                  if (_stats != null) ...[
                    const Divider(height: 24),
                    Text(
                      '累计 ${_stats!.runCount} 次 · 共 ${_stats!.totalKm.toStringAsFixed(2)} 公里',
                      style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // ========== 5) 数据变化曲线（配速 / 周跑量 / 静息心率 / 体重） ==========
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('数据变化曲线',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  // 指标切换
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'pace', label: Text('配速')),
                      ButtonSegment(value: 'weekly', label: Text('周跑量')),
                      ButtonSegment(value: 'heart', label: Text('心率')),
                      ButtonSegment(value: 'weight', label: Text('体重')),
                    ],
                    selected: {_chartMetric},
                    onSelectionChanged: (s) => setState(() => _chartMetric = s.first),
                  ),
                  const SizedBox(height: 12),
                  _buildChartArea(),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // ========== 6) 退出登录 ==========
          OutlinedButton.icon(
            onPressed: _logout,
            icon: const Icon(Icons.logout, color: Colors.red),
            label: const Text('退出登录', style: TextStyle(color: Colors.red)),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Colors.red),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _pbTile(String label, String value, Color color) {
    return Expanded(
      child: Column(
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  // ---------- 燃脂消耗卡：今日 / 本周 / 累计 跑步消耗（仅燃脂用户显示） ----------
  Widget _buildCaloriesCard() {
    final c = _calories!;
    final today = c['today'] as Map<String, dynamic>;
    final week = c['week'] as Map<String, dynamic>;
    final total = c['total'] as Map<String, dynamic>;
    final weightKg = (c['weight_kg'] as num?)?.toDouble() ?? 60;
    Widget kcalTile(String label, Map<String, dynamic> v) {
      return Expanded(
        child: Column(
          children: [
            Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            const SizedBox(height: 4),
            Text('${(v['kcal'] as num).toInt()}',
                style: const TextStyle(
                    fontSize: 20, fontWeight: FontWeight.bold, color: Colors.deepOrange)),
            Text('千卡 · ${(v['km'] as num).toStringAsFixed(1)} km',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
          ],
        ),
      );
    }

    return Card(
      color: Colors.orange.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.local_fire_department, color: Colors.deepOrange, size: 20),
                SizedBox(width: 6),
                Text('跑步消耗', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                kcalTile('今日', today),
                kcalTile('本周', week),
                kcalTile('累计', total),
              ],
            ),
            const SizedBox(height: 8),
            Text('按体重 ${weightKg.toStringAsFixed(0)} kg 估算：每跑 1 公里 ≈ 体重 × 1 千卡',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
          ],
        ),
      ),
    );
  }

  // ---------- 今日静息心率展示 ----------
  Widget _buildTodayHeartRate() {
    final list = _heartRates;
    if (list == null) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 8),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    final todayStr = _fmtDate(DateTime.now());
    int? todayHr;
    for (final r in list) {
      if (r['log_date'] == todayStr) todayHr = (r['heart_rate'] as num).toInt();
    }
    if (todayHr != null) {
      return Row(
        children: [
          Text('$todayHr',
              style: const TextStyle(
                  fontSize: 28, fontWeight: FontWeight.bold, color: Colors.red)),
          const SizedBox(width: 6),
          Text('次/分 · 今日已记录', style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
        ],
      );
    }
    if (list.isEmpty) {
      return Text('还没有静息心率记录。坚持记录可以看到心肺能力提升（静息心率下降）。',
          style: TextStyle(fontSize: 13, color: Colors.grey.shade600));
    }
    final latest = list.last;
    return Text(
      '今天还没记录。最近一次：${latest['log_date']} · ${latest['heart_rate']} 次/分',
      style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
    );
  }

  // ---------- 曲线绘制区：按当前指标取数并画图 ----------
  Widget _buildChartArea() {
    final data = _currentChartData();
    if (data == null) {
      return const SizedBox(
        height: 180,
        child: Center(child: CircularProgressIndicator()),
      );
    }
    final (values, color, invertY, hint) = data;
    if (values.length < 2) {
      return SizedBox(
        height: 180,
        child: Center(
          child: Text(hint, style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 180,
          child: CustomPaint(
            painter: _LineChartPainter(values, color, invertY: invertY),
            child: Container(),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '最新：${_latestText()} · 共 ${values.length} 个数据点',
          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
        ),
      ],
    );
  }

  // 当前指标的最新值文本
  String _latestText() {
    final data = _currentChartData();
    if (data == null || data.$1.isEmpty) return '-';
    final v = data.$1.last;
    return switch (_chartMetric) {
      'pace' => _paceText(v),
      'weekly' => '${v.toStringAsFixed(1)} km/周',
      'heart' => '${v.toInt()} 次/分',
      _ => '${v.toStringAsFixed(1)} kg',
    };
  }

  // 配速（秒/公里）→ 5'30"
  String _paceText(double secPerKm) {
    final m = secPerKm ~/ 60;
    final s = (secPerKm % 60).truncate().toString().padLeft(2, '0');
    return "$m'$s\"/km";
  }

  // 按周汇总跑量：返回按时间升序的每周总公里数
  List<double> _weeklyKmSeries() {
    final runs = _stats?.runs ?? const <RunRecord>[];
    // key = 该周周一的毫秒数，保证按周聚合且可排序
    final byWeek = <int, double>{};
    for (final r in runs) {
      final d = DateTime.tryParse(r.runDate);
      if (d == null) continue;
      final monday = DateTime(d.year, d.month, d.day).subtract(Duration(days: d.weekday - 1));
      final key = monday.millisecondsSinceEpoch;
      byWeek[key] = (byWeek[key] ?? 0) + r.distanceKm;
    }
    final keys = byWeek.keys.toList()..sort();
    return [for (final k in keys) byWeek[k]!];
  }

  // 当前指标的数据：(数值序列, 颜色, 是否Y轴翻转, 数据不足提示)；null = 还在加载
  // invertY=true 表示"值越小越靠上"（配速：越快越高）
  (List<double>, Color, bool, String)? _currentChartData() {
    switch (_chartMetric) {
      case 'weekly':
        final s = _stats;
        if (s == null) return null;
        return (_weeklyKmSeries(), Colors.blue, false, '至少需要 2 周的跑步记录才能画周跑量曲线');
      case 'heart':
        final list = _heartRates;
        if (list == null) return null;
        return (
          [for (final r in list) (r['heart_rate'] as num).toDouble()],
          Colors.red,
          false,
          '至少记录 2 天静息心率才能画曲线，点上方"记录"按钮开始',
        );
      case 'weight':
        final list = _weights;
        if (list == null) return null;
        return (
          [for (final w in list) w.weightKg],
          Colors.purple,
          false,
          '至少记录 2 次体重才能画曲线（在体重目标计划的详情页里记录）',
        );
      default: // pace 配速
        final s = _stats;
        if (s == null) return null;
        return (
          [
            for (final r in s.runs)
              if (r.distanceKm > 0) r.durationSeconds / r.distanceKm,
          ],
          Colors.green,
          true,
          '至少需要 2 条跑步记录才能画配速曲线',
        );
    }
  }
}

// ============================================================
// 通用自绘折线图：X 轴 = 数据顺序，Y 轴 = 数值
// invertY = true 时 Y 轴翻转（值越小点越高），用于配速"越快越高"
// ============================================================
class _LineChartPainter extends CustomPainter {
  final List<double> values;
  final Color color;
  final bool invertY;

  _LineChartPainter(this.values, this.color, {this.invertY = false});

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;

    final minV = values.reduce(math.min);
    final maxV = values.reduce(math.max);
    // 留 10% 边距，避免点顶到边
    final range = (maxV - minV).clamp(1e-9, double.infinity);
    final padding = range * 0.1;
    final yMin = minV - padding;
    final yMax = maxV + padding;

    // 网格线画笔
    final gridPaint = Paint()
      ..color = Colors.grey.shade200
      ..strokeWidth = 1;
    // 折线画笔
    final linePaint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke
      ..strokeJoin = StrokeJoin.round;
    // 数据点画笔
    final dotPaint = Paint()..color = color;

    // 画横向网格线（4 条）
    for (int i = 0; i <= 4; i++) {
      final y = size.height * i / 4;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    // 计算所有点的位置
    final points = <Offset>[];
    for (int i = 0; i < values.length; i++) {
      final x = size.width * i / (values.length - 1);
      var ratio = (values[i] - yMin) / (yMax - yMin);
      if (invertY) ratio = 1 - ratio; // 翻转：值越小越靠上
      final y = size.height * (1 - ratio);
      points.add(Offset(x, y));
    }

    // 画折线
    final path = Path()..moveTo(points[0].dx, points[0].dy);
    for (int i = 1; i < points.length; i++) {
      path.lineTo(points[i].dx, points[i].dy);
    }
    canvas.drawPath(path, linePaint);

    // 画数据点
    for (final p in points) {
      canvas.drawCircle(p, 3, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _LineChartPainter old) =>
      old.values != values || old.color != color || old.invertY != invertY;
}
