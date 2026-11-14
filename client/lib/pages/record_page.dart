// ============================================================
// 模块二：运动记录与上传页
// 功能：
//   1) 顶部录入表单：日期 / 距离 / 用时，支持"立即上传"和"先存本地"
//   2) 截图识别：从 Keep 等跑步 App 截图自动提取距离/用时，预填表单
//   3) 待上传区：显示本地暂存的记录，可单条上传、也可一键全部上传
//   4) 已上传区：显示云端的所有跑步记录（下拉刷新），点记录可补详细数据
// ============================================================
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api.dart';
import '../local_store.dart';
import '../models.dart';
import 'run_detail_page.dart';

class RecordPage extends StatefulWidget {
  final String token;
  final User user;

  const RecordPage({super.key, required this.token, required this.user});

  @override
  State<RecordPage> createState() => _RecordPageState();
}

class _RecordPageState extends State<RecordPage> {
  // 录入表单
  final _formKey = GlobalKey<FormState>();
  final _dateCtrl = TextEditingController();
  final _distanceCtrl = TextEditingController();
  final _minuteCtrl = TextEditingController();
  final _secondCtrl = TextEditingController();
  DateTime _date = DateTime.now();

  // 数据
  List<RunRecord> _runs = []; // 云端已上传的
  List<PendingRun> _pending = []; // 本地暂存的
  bool _loadingRuns = true;
  String? _error;
  bool _uploading = false;
  bool _ocrLoading = false; // 截图识别中

  // 已上传记录的月份筛选：'' = 全部，'2026-10' = 只看该月
  String _monthKey = '';

  @override
  void initState() {
    super.initState();
    _dateCtrl.text = _formatDate(_date);
    _refreshAll();
  }

  @override
  void dispose() {
    _dateCtrl.dispose();
    _distanceCtrl.dispose();
    _minuteCtrl.dispose();
    _secondCtrl.dispose();
    super.dispose();
  }

  String _formatDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  // 已上传记录的总公里数（"已上传"标题右侧汇总用）
  double get _totalKm => _runs.fold(0.0, (sum, r) => sum + r.distanceKm);

  // 有记录的月份列表（倒序，用于筛选下拉）
  List<String> get _monthOptions {
    final set = <String>{};
    for (final r in _runs) {
      if (r.runDate.length >= 7) set.add(r.runDate.substring(0, 7));
    }
    final list = set.toList()..sort((a, b) => b.compareTo(a));
    return list;
  }

  // 当前筛选条件下要显示的记录
  List<RunRecord> get _visibleRuns =>
      _monthKey.isEmpty ? _runs : _runs.where((r) => r.runDate.startsWith(_monthKey)).toList();

  // 本月（或所选月）汇总：次数、公里、平均配速
  String get _monthSummary {
    final list = _visibleRuns;
    if (list.isEmpty) return '暂无记录';
    final km = list.fold(0.0, (s, r) => s + r.distanceKm);
    final sec = list.fold(0, (s, r) => s + r.durationSeconds);
    final paceSec = km <= 0 ? 0 : (sec / km).round();
    final paceText = paceSec <= 0
        ? '--'
        : '${paceSec ~/ 60}\'${(paceSec % 60).toString().padLeft(2, '0')}"';
    return '${list.length} 次 · ${km.toStringAsFixed(2)} 公里 · 平均配速 $paceText/km';
  }

  // 同时拉云端记录 + 本地暂存
  Future<void> _refreshAll() async {
    await Future.wait([_loadRuns(), _loadPending()]);
  }

  Future<void> _loadRuns() async {
    setState(() {
      _loadingRuns = true;
      _error = null;
    });
    try {
      final list = await Api.myRuns(widget.token);
      if (!mounted) return;
      setState(() {
        _runs = list;
        _loadingRuns = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loadingRuns = false;
      });
    }
  }

  Future<void> _loadPending() async {
    final list = await LocalStore.getPendingRuns();
    if (!mounted) return;
    setState(() => _pending = list);
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() {
        _date = picked;
        _dateCtrl.text = _formatDate(picked);
      });
    }
  }

  // 立即上传到云端
  Future<void> _submitNow() async {
    if (!(_formKey.currentState?.validate() ?? false) || _uploading) return;
    final distance = double.parse(_distanceCtrl.text.trim());
    final minutes = int.parse(_minuteCtrl.text.trim());
    final seconds = int.parse(_secondCtrl.text.trim());

    setState(() => _uploading = true);
    try {
      await Api.addRun(widget.token, _formatDate(_date), distance, minutes * 60 + seconds);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('上传成功')));
      _clearForm();
      _loadRuns();
    } on ApiException catch (e) {
      if (!mounted) return;
      // 连不上后端 → 提示要不要先存本地
      if (e.message.contains('连接服务器')) {
        _offerSaveLocal(distance, minutes * 60 + seconds);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  // 提示用户：上传失败，要不要先存本地？
  Future<void> _offerSaveLocal(double distance, int durationSeconds) async {
    final save = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('连不上服务器'),
        content: const Text('要先把这条记录保存在手机本地，等网络好了再上传吗？'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('不用了')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('存本地')),
        ],
      ),
    );
    if (save == true) {
      await _saveLocal(distance, durationSeconds);
    }
  }

  // 保存到本地暂存队列
  Future<void> _saveLocal(double distance, int durationSeconds) async {
    await LocalStore.addPendingRun(PendingRun(
      runDate: _formatDate(_date),
      distanceKm: distance,
      durationSeconds: durationSeconds,
      savedAt: DateTime.now().millisecondsSinceEpoch,
    ));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('已存到本地，稍后可在下方一键上传')));
    _clearForm();
    _loadPending();
  }

  // 主动点"先存本地"
  Future<void> _saveLocalFromForm() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final distance = double.parse(_distanceCtrl.text.trim());
    final minutes = int.parse(_minuteCtrl.text.trim());
    final seconds = int.parse(_secondCtrl.text.trim());
    await _saveLocal(distance, minutes * 60 + seconds);
  }

  void _clearForm() {
    _distanceCtrl.clear();
    _minuteCtrl.clear();
    _secondCtrl.clear();
  }

  // 截图识别：选一张 Keep 跑步记录截图，后端 OCR 提取距离/用时后自动填入表单
  // 设计：识别结果只预填，用户核对后再点"立即上传"，识别错了直接改
  Future<void> _pickAndRecognize() async {
    if (_ocrLoading) return;
    // 先提醒：OCR 可能出错，请核对
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('截图识别提醒'),
        content: const Text('截图识别可能出错，请务必核对识别结果后再上传。\n\n建议：如果 App 支持导出 GPX 文件，用「导入GPX」更准。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('继续识别')),
        ],
      ),
    );
    if (ok != true) return;

    final picker = ImagePicker();
    // 从相册选截图（Keep 跑完会自动存截图，或用户手动截屏）
    final XFile? file = await picker.pickImage(source: ImageSource.gallery);
    if (file == null) return; // 用户取消选择

    setState(() => _ocrLoading = true);
    try {
      // 读取图片字节，转成 base64 data URL 发给后端
      final bytes = await file.readAsBytes();
      final mime = file.mimeType ?? 'image/jpeg';
      final base64 = base64Encode(bytes);
      final dataUrl = 'data:$mime;base64,$base64';

      final result = await Api.ocrKeepRun(widget.token, dataUrl);
      if (!mounted) return;

      // 把识别到的数字填进表单
      final distance = result['distanceKm'];
      final duration = result['durationSeconds'];
      if (distance != null) {
        _distanceCtrl.text = (distance as num).toStringAsFixed(2);
      }
      if (duration != null) {
        final total = (duration as num).toInt();
        _minuteCtrl.text = '${total ~/ 60}';
        _secondCtrl.text = '${total % 60}';
      }

      // 提示用户核对
      if (distance != null || duration != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('已填入，请核对后再上传')),
        );
      } else {
        // 没识别出来，把原始文字展示给用户，方便排查
        final raw = result['rawText'] ?? '';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('没认出数字，请手动填写。原始识别：\n$raw'),
            duration: const Duration(seconds: 6),
          ),
        );
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('识别失败：$e')));
    } finally {
      if (mounted) setState(() => _ocrLoading = false);
    }
  }

  // 一键上传所有本地暂存
  Future<void> _uploadAllPending() async {
    if (_pending.isEmpty || _uploading) return;
    setState(() => _uploading = true);

    int success = 0;
    int failed = 0;
    // 逐条上传，成功的从本地删掉；失败的留在队列
    for (int i = _pending.length - 1; i >= 0; i--) {
      final p = _pending[i];
      try {
        await Api.addRun(widget.token, p.runDate, p.distanceKm, p.durationSeconds);
        await LocalStore.removePendingRunAt(i);
        success++;
      } catch (_) {
        failed++;
      }
    }

    if (!mounted) return;
    setState(() => _uploading = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('上传完成：成功 $success 条${failed > 0 ? '，失败 $failed 条' : ''}')),
    );
    _refreshAll();
  }

  // 删除一条本地暂存
  Future<void> _deletePendingAt(int index) async {
    await LocalStore.removePendingRunAt(index);
    _loadPending();
  }

  // 删除自己的一条已上传记录（填错数据时用来自行纠正，不用找管理员）
  Future<void> _deleteRun(RunRecord r) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('删除这条记录'),
        content: Text(
          '确定要删除 ${r.runDate} 的这条记录吗？\n'
          '${r.distanceKm.toStringAsFixed(2)} 公里 · 用时 ${r.durationText}\n\n'
          '删除后无法恢复，可以重新填一条。',
        ),
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
    if (ok != true) return;
    try {
      await Api.deleteRun(widget.token, r.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('已删除')));
      _loadRuns();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  // 编辑自己的一条已上传记录：日期 / 距离 / 用时都能改
  // 填错日期、少记里程时用，不用删掉重填
  Future<void> _editRun(RunRecord r) async {
    DateTime date = DateTime.tryParse(r.runDate) ?? DateTime.now();
    final distC = TextEditingController(text: r.distanceKm.toStringAsFixed(2));
    final minC = TextEditingController(text: '${r.durationSeconds ~/ 60}');
    final secC = TextEditingController(text: '${r.durationSeconds % 60}');
    bool saving = false;

    await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: const Text('编辑记录'),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              // 日期点一下弹日历，避免手动输入格式出错
              InkWell(
                onTap: () async {
                  final picked = await showDatePicker(
                    context: ctx,
                    initialDate: date,
                    firstDate: DateTime(2020),
                    lastDate: DateTime.now(),
                  );
                  if (picked != null) setDlg(() => date = picked);
                },
                child: InputDecorator(
                  decoration: const InputDecoration(
                    labelText: '跑步日期',
                    suffixIcon: Icon(Icons.calendar_month),
                    border: OutlineInputBorder(),
                  ),
                  child: Text(_formatDate(date)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: distC,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: '距离（公里）', suffixText: 'km', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: TextField(
                  controller: minC,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: '分', border: OutlineInputBorder()),
                )),
                const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Text(':')),
                Expanded(child: TextField(
                  controller: secC,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: '秒', border: OutlineInputBorder()),
                )),
              ]),
            ]),
          ),
          actions: [
            TextButton(onPressed: saving ? null : () => Navigator.pop(ctx, false), child: const Text('取消')),
            FilledButton(
              onPressed: saving
                  ? null
                  : () async {
                      final d = double.tryParse(distC.text.trim());
                      final m = int.tryParse(minC.text.trim());
                      final s = int.tryParse(secC.text.trim());
                      if (d == null || d <= 0) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('距离要大于 0')));
                        return;
                      }
                      if (m == null || m < 0 || s == null || s < 0 || s > 59) {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('用时填写不正确')));
                        return;
                      }
                      // 按钮置灰，防止连续点击重复提交
                      setDlg(() => saving = true);
                      try {
                        await Api.updateRun(widget.token, r.id,
                            runDate: _formatDate(date), distanceKm: d, durationSeconds: m * 60 + s);
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('已保存修改')));
                        Navigator.pop(ctx, true);
                        _loadRuns();
                      } on ApiException catch (e) {
                        if (!mounted) return;
                        setDlg(() => saving = false);
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
                      }
                    },
              child: Text(saving ? '保存中...' : '保存'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _refreshAll,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ========== 1) 录入表单 ==========
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('记一笔', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    // 截图识别：快速录入，但可能出错
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _ocrLoading ? null : _pickAndRecognize,
                        icon: _ocrLoading
                            ? const SizedBox(
                                width: 18, height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.photo_camera_back),
                        label: Text(_ocrLoading ? '识别中...' : '截图识别（可能出错）'),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _dateCtrl,
                      readOnly: true,
                      decoration: const InputDecoration(
                        labelText: '跑步日期',
                        suffixIcon: Icon(Icons.calendar_month),
                        border: OutlineInputBorder(),
                      ),
                      onTap: _pickDate,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _distanceCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(
                        labelText: '距离（公里）',
                        hintText: '例如 5.2',
                        suffixText: 'km',
                        border: OutlineInputBorder(),
                      ),
                      validator: (v) {
                        final d = double.tryParse(v ?? '');
                        if (d == null || d <= 0) return '请输入大于 0 的数字';
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _minuteCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: '分',
                              suffixText: 'min',
                              border: OutlineInputBorder(),
                            ),
                            validator: (v) {
                              final n = int.tryParse(v ?? '');
                              if (n == null || n < 0) return '无效';
                              return null;
                            },
                          ),
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 8, vertical: 16),
                          child: Text(':', style: TextStyle(fontSize: 20)),
                        ),
                        Expanded(
                          child: TextFormField(
                            controller: _secondCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: '秒',
                              suffixText: 'sec',
                              border: OutlineInputBorder(),
                            ),
                            validator: (v) {
                              final n = int.tryParse(v ?? '');
                              if (n == null || n < 0 || n > 59) return '0-59';
                              return null;
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: _uploading ? null : _submitNow,
                            icon: const Icon(Icons.cloud_upload),
                            label: Text(_uploading ? '上传中...' : '立即上传'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _uploading ? null : _saveLocalFromForm,
                            icon: const Icon(Icons.save_outlined),
                            label: const Text('先存本地'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // ========== 2) 待上传（本地暂存） ==========
          if (_pending.isNotEmpty) ...[
            Row(
              children: [
                const Icon(Icons.cloud_off, color: Colors.orange),
                const SizedBox(width: 8),
                Text('待上传（${_pending.length}）',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const Spacer(),
                TextButton.icon(
                  onPressed: _uploading ? null : _uploadAllPending,
                  icon: const Icon(Icons.cloud_upload, size: 18),
                  label: const Text('一键上传'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            for (int i = 0; i < _pending.length; i++)
              Card(
                color: Colors.orange.shade50,
                margin: const EdgeInsets.only(bottom: 6),
                child: ListTile(
                  dense: true,
                  leading: const Icon(Icons.schedule, color: Colors.orange),
                  title: Text('${_pending[i].runDate}   ${_pending[i].distanceKm.toStringAsFixed(2)} 公里'),
                  subtitle: Text('用时 ${_pending[i].durationText}'),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete_outline, color: Colors.red),
                    onPressed: () => _deletePendingAt(i),
                  ),
                ),
              ),
            const SizedBox(height: 16),
          ],

          // ========== 3) 已上传记录 ==========
          Row(
            children: [
              const Icon(Icons.cloud_done, color: Colors.green),
              const SizedBox(width: 8),
              const Text('已上传', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const Spacer(),
              // 汇总：只在加载完成且有记录时显示，一眼看到累计量
              if (!_loadingRuns && _error == null && _runs.isNotEmpty)
                Text(
                  '累计 ${_runs.length} 次 · ${_totalKm.toStringAsFixed(2)} 公里',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
            ],
          ),
          const SizedBox(height: 8),

          // 月份筛选 + 该月汇总（看本月跑了多少、平均配速多少）
          if (!_loadingRuns && _error == null && _runs.isNotEmpty) ...[
            Row(children: [
              const Text('月份：'),
              DropdownButton<String>(
                value: _monthKey,
                underline: const SizedBox.shrink(),
                items: [
                  const DropdownMenuItem(value: '', child: Text('全部月份')),
                  ..._monthOptions.map((m) => DropdownMenuItem(value: m, child: Text(m))),
                ],
                onChanged: (v) => setState(() => _monthKey = v ?? ''),
              ),
            ]),
            Card(
              color: Colors.green.shade50,
              margin: const EdgeInsets.only(bottom: 8),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Row(children: [
                  const Icon(Icons.summarize, size: 18, color: Colors.green),
                  const SizedBox(width: 8),
                  Expanded(child: Text(
                    _monthKey.isEmpty ? '全部记录：$_monthSummary' : '$_monthKey 汇总：$_monthSummary',
                    style: const TextStyle(fontSize: 12),
                  )),
                ]),
              ),
            ),
          ],

          if (_loadingRuns)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            Center(
              child: Column(
                children: [
                  Text(_error!, textAlign: TextAlign.center),
                  const SizedBox(height: 8),
                  TextButton(onPressed: _loadRuns, child: const Text('重试')),
                ],
              ),
            )
          else if (_runs.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: Text('还没有上传过记录')),
            )
          else if (_visibleRuns.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Center(child: Text('$_monthKey 没有跑步记录')),
            )
          else
            for (final r in _visibleRuns)
              Card(
                margin: const EdgeInsets.only(bottom: 6),
                child: ListTile(
                  dense: true,
                  leading: const Icon(Icons.directions_run, color: Colors.green),
                  title: Text('${r.runDate}   ${r.distanceKm.toStringAsFixed(2)} 公里'),
                  subtitle: Text('用时 ${r.durationText} · 配速 ${r.paceText}'),
                  // 点进去可以补详细数据（心率/触地时间/垂直振幅/步幅/步频）
                  onTap: () async {
                    final changed = await Navigator.push<bool>(
                      context,
                      MaterialPageRoute(
                        builder: (_) => RunDetailPage(token: widget.token, run: r),
                      ),
                    );
                    if (changed == true) _loadRuns();
                  },
                  // 填错日期/里程时可以自己改，也可以删掉重填
                  trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                    IconButton(
                      icon: const Icon(Icons.edit_outlined, color: Colors.blue, size: 20),
                      tooltip: '编辑这条记录',
                      onPressed: () => _editRun(r),
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
                      tooltip: '删除这条记录',
                      onPressed: () => _deleteRun(r),
                    ),
                  ]),
                ),
              ),
        ],
      ),
    );
  }
}
