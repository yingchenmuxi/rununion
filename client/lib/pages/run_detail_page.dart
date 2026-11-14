// ============================================================
// 跑步记录详情页：查看和补充详细数据（心率/触地时间/垂直振幅/步幅/步频）
// 从记录页点一条已上传记录进入
// 功能：
//   1) 显示该次跑步的基础信息（日期/距离/用时/配速）
//   2) 显示已保存的详细数据
//   3) 手动输入详细数据（5 个指标全部可选）
//   4) 截图识别详细数据（Keep 手表页/跑姿分析截图）
// ============================================================
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api.dart';
import '../models.dart';

class RunDetailPage extends StatefulWidget {
  final String token;
  final RunRecord run;

  const RunDetailPage({super.key, required this.token, required this.run});

  @override
  State<RunDetailPage> createState() => _RunDetailPageState();
}

class _RunDetailPageState extends State<RunDetailPage> {
  RunDetail? _detail;
  bool _loading = true;
  bool _saving = false;
  bool _ocrLoading = false;
  bool _changed = false; // 数据有没有被改过（返回时通知记录页刷新）

  // 5 个输入框的控制器
  final _heartRateCtrl = TextEditingController();
  final _groundContactCtrl = TextEditingController();
  final _verticalOscCtrl = TextEditingController();
  final _strideLengthCtrl = TextEditingController();
  final _cadenceCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  @override
  void dispose() {
    _heartRateCtrl.dispose();
    _groundContactCtrl.dispose();
    _verticalOscCtrl.dispose();
    _strideLengthCtrl.dispose();
    _cadenceCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadDetail() async {
    setState(() => _loading = true);
    try {
      final d = await Api.getRunDetail(widget.token, widget.run.id);
      if (!mounted) return;
      setState(() {
        _detail = d;
        _loading = false;
      });
      // 把已有数据填进输入框
      if (d != null) {
        if (d.heartRate != null) _heartRateCtrl.text = '${d.heartRate}';
        if (d.groundContactMs != null) _groundContactCtrl.text = '${d.groundContactMs}';
        if (d.verticalOscillationCm != null) _verticalOscCtrl.text = '${d.verticalOscillationCm}';
        if (d.strideLengthCm != null) _strideLengthCtrl.text = '${d.strideLengthCm}';
        if (d.cadenceSpm != null) _cadenceCtrl.text = '${d.cadenceSpm}';
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  // 手动保存详细数据
  Future<void> _save() async {
    // 解析输入（空字符串 = 不填）
    int? heartRate = _parseInt(_heartRateCtrl.text);
    int? groundContact = _parseInt(_groundContactCtrl.text);
    double? verticalOsc = _parseDouble(_verticalOscCtrl.text);
    double? strideLength = _parseDouble(_strideLengthCtrl.text);
    int? cadence = _parseInt(_cadenceCtrl.text);

    // 至少填一项
    if (heartRate == null && groundContact == null && verticalOsc == null && strideLength == null && cadence == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('请至少填写一项详细数据')));
      return;
    }

    setState(() => _saving = true);
    try {
      final d = await Api.saveRunDetail(
        widget.token,
        widget.run.id,
        heartRate: heartRate,
        groundContactMs: groundContact,
        verticalOscillationCm: verticalOsc,
        strideLengthCm: strideLength,
        cadenceSpm: cadence,
      );
      if (!mounted) return;
      setState(() {
        _detail = d;
        _saving = false;
        _changed = true;
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('已保存详细数据')));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  // 截图识别详细数据：支持一次选多张截图（不同 App / 不同页面各截一张）
  // 合并规则：同一指标以「第一张识别到的」为准，后面的图不会覆盖前面已识别的值
  Future<void> _pickAndRecognize() async {
    if (_ocrLoading) return;
    // 先提醒：OCR 可能出错，请核对后再保存
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('截图识别提醒'),
        content: const Text('截图识别可能出错，请务必核对识别结果后再保存。\n\n可一次选多张截图（例如心率一张、跑姿数据一张），系统会自动合并识别结果。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('继续识别')),
        ],
      ),
    );
    if (ok != true) return;

    final picker = ImagePicker();
    // 多选：从相册一次选多张截图
    List<XFile> files;
    try {
      files = await picker.pickMultiImage();
    } catch (_) {
      return; // 用户取消选择
    }
    if (files.isEmpty) return;

    setState(() => _ocrLoading = true);
    try {
      // 逐张识别并合并：只填还没识别到的字段
      final merged = <String, dynamic>{};
      for (final file in files) {
        final bytes = await file.readAsBytes();
        final mime = file.mimeType ?? 'image/jpeg';
        final dataUrl = 'data:$mime;base64,${base64Encode(bytes)}';
        final result = await Api.ocrKeepDetail(widget.token, dataUrl);
        for (final key in const ['heartRate', 'groundContactMs', 'verticalOscillationCm', 'strideLengthCm', 'cadenceSpm']) {
          if (merged[key] == null && result[key] != null) merged[key] = result[key];
        }
      }
      if (!mounted) return;

      // 把合并后的识别结果填进输入框
      final heartRate = merged['heartRate'];
      final groundContact = merged['groundContactMs'];
      final verticalOsc = merged['verticalOscillationCm'];
      final strideLength = merged['strideLengthCm'];
      final cadence = merged['cadenceSpm'];

      if (heartRate != null) _heartRateCtrl.text = '$heartRate';
      if (groundContact != null) _groundContactCtrl.text = '$groundContact';
      if (verticalOsc != null) _verticalOscCtrl.text = '$verticalOsc';
      if (strideLength != null) _strideLengthCtrl.text = '$strideLength';
      if (cadence != null) _cadenceCtrl.text = '$cadence';

      final hasAny = heartRate != null || groundContact != null || verticalOsc != null || strideLength != null || cadence != null;
      if (hasAny) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('已从 ${files.length} 张截图识别并填入，请核对后再保存')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('没认出数字，请手动填写'),
            duration: Duration(seconds: 4),
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

  // 删除详细数据
  Future<void> _deleteDetail() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('删除详细数据'),
        content: const Text('确定要删除这条记录的详细数据吗？基础记录（距离/用时）不会删。'),
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
      await Api.deleteRunDetail(widget.token, widget.run.id);
      if (!mounted) return;
      setState(() {
        _detail = null;
        _changed = true;
      });
      // 清空输入框
      _heartRateCtrl.clear();
      _groundContactCtrl.clear();
      _verticalOscCtrl.clear();
      _strideLengthCtrl.clear();
      _cadenceCtrl.clear();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('已删除详细数据')));
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  int? _parseInt(String s) {
    final t = s.trim();
    if (t.isEmpty) return null;
    return int.tryParse(t);
  }

  double? _parseDouble(String s) {
    final t = s.trim();
    if (t.isEmpty) return null;
    return double.tryParse(t);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) Navigator.pop(context, _changed);
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('详细数据'),
          actions: [
            if (_detail != null && _detail!.hasAny)
              IconButton(
                icon: const Icon(Icons.delete_outline),
                tooltip: '删除详细数据',
                onPressed: _deleteDetail,
              ),
          ],
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // ========== 1) 基础信息卡片 ==========
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('基础信息', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 12),
                          _infoRow('日期', widget.run.runDate),
                          _infoRow('距离', '${widget.run.distanceKm.toStringAsFixed(2)} 公里'),
                          _infoRow('用时', widget.run.durationText),
                          _infoRow('配速', widget.run.paceText),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // ========== 2) 截图识别按钮 ==========
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _ocrLoading ? null : _pickAndRecognize,
                      icon: _ocrLoading
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.photo_library),
                      label: Text(_ocrLoading ? '识别中...' : '截图识别（可多选，可能出错）'),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // ========== 3) 详细数据输入 ==========
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('详细数据（全部可选）', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 8),
                          Text(
                            '这些数据来自 Keep 等 App 的手表页或跑姿分析，填几个算几个',
                            style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                          ),
                          const SizedBox(height: 16),
                          _inputField('心率', '次/分', _heartRateCtrl, '例如 152', TextInputType.number),
                          const SizedBox(height: 12),
                          _inputField('触地时间', '毫秒', _groundContactCtrl, '例如 220', TextInputType.number),
                          const SizedBox(height: 12),
                          _inputField('垂直振幅', '厘米', _verticalOscCtrl, '例如 8.5', const TextInputType.numberWithOptions(decimal: true)),
                          const SizedBox(height: 12),
                          _inputField('步幅', '厘米', _strideLengthCtrl, '例如 120', const TextInputType.numberWithOptions(decimal: true)),
                          const SizedBox(height: 12),
                          _inputField('步频', '步/分钟', _cadenceCtrl, '例如 180', TextInputType.number),
                          const SizedBox(height: 20),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton.icon(
                              onPressed: _saving ? null : _save,
                              icon: const Icon(Icons.save),
                              label: Text(_saving ? '保存中...' : '保存详细数据'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // ========== 4) 已保存的详细数据展示 ==========
                  if (_detail != null && _detail!.hasAny) ...[
                    const SizedBox(height: 16),
                    Card(
                      color: Colors.green.shade50,
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('已保存的详细数据', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 12),
                            if (_detail!.heartRate != null) _detailRow('心率', '${_detail!.heartRate} 次/分'),
                            if (_detail!.groundContactMs != null) _detailRow('触地时间', '${_detail!.groundContactMs} 毫秒'),
                            if (_detail!.verticalOscillationCm != null) _detailRow('垂直振幅', '${_detail!.verticalOscillationCm} 厘米'),
                            if (_detail!.strideLengthCm != null) _detailRow('步幅', '${_detail!.strideLengthCm} 厘米'),
                            if (_detail!.cadenceSpm != null) _detailRow('步频', '${_detail!.cadenceSpm} 步/分钟'),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(width: 60, child: Text(label, style: TextStyle(color: Colors.grey.shade600))),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(width: 80, child: Text(label, style: TextStyle(color: Colors.grey.shade700))),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _inputField(String label, String unit, TextEditingController ctrl, String hint, TextInputType keyboardType) {
    return TextFormField(
      controller: ctrl,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        suffixText: unit,
        border: const OutlineInputBorder(),
      ),
    );
  }
}
