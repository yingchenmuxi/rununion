// ============================================================
// 提交跑步记录页：选日期、填距离和用时，提交成功后返回主页
// ============================================================
import 'package:flutter/material.dart';

import '../api.dart';

class AddRunPage extends StatefulWidget {
  final String token;

  const AddRunPage({super.key, required this.token});

  @override
  State<AddRunPage> createState() => _AddRunPageState();
}

class _AddRunPageState extends State<AddRunPage> {
  final _formKey = GlobalKey<FormState>();
  final _dateCtrl = TextEditingController();
  final _distanceCtrl = TextEditingController();
  final _minuteCtrl = TextEditingController();
  final _secondCtrl = TextEditingController();
  DateTime _date = DateTime.now(); // 默认今天
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _dateCtrl.text = _formatDate(_date);
  }

  @override
  void dispose() {
    _dateCtrl.dispose();
    _distanceCtrl.dispose();
    _minuteCtrl.dispose();
    _secondCtrl.dispose();
    super.dispose();
  }

  // DateTime 转成后端要的 "YYYY-MM-DD" 格式
  String _formatDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  // 弹出日期选择器
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

  // 点击"提交记录"
  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false) || _submitting) return;

    // 表单校验通过后才走到这里，可以直接 parse
    final distance = double.parse(_distanceCtrl.text.trim());
    final minutes = int.parse(_minuteCtrl.text.trim());
    final seconds = int.parse(_secondCtrl.text.trim());

    setState(() => _submitting = true);
    try {
      // 分:秒 统一换成秒数发给后端
      await Api.addRun(widget.token, _formatDate(_date), distance, minutes * 60 + seconds);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('提交成功')));
      // pop(true) 告诉主页"提交成功了"，主页会自动刷新列表
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      _showError(e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('提交跑步记录')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            // 日期：只读输入框，点击弹出日期选择器
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
            const SizedBox(height: 20),
            // 距离（公里），允许小数
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
            const SizedBox(height: 20),
            // 用时：分 + 秒 两个输入框
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
            const SizedBox(height: 32),
            SizedBox(
              height: 48,
              child: FilledButton(
                onPressed: _submitting ? null : _submit,
                child: Text(_submitting ? '提交中...' : '提交记录'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
