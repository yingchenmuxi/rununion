// ============================================================
// 社长注册页（申请制）：
// 手机号 + 性别 + 昵称 + 密码 + 省/市（选填）+ 学校/社团名称 + 申请留言（选填）
// 流程说明：
//   1. 提交后账号立即创建，但处于"无社团"状态（可以正常登录使用除社团外的功能）；
//   2. 系统自动向管理员提交一条社长申请；
//   3. 管理员在后台审批通过后，该账号自动成为新学校新社团的社长；
//   4. 审批结果可在登录后的"社团"页查看进度。
// ============================================================
import 'package:flutter/material.dart';

import '../api.dart';
import 'login_page.dart';

class PresidentRegisterPage extends StatefulWidget {
  const PresidentRegisterPage({super.key});

  @override
  State<PresidentRegisterPage> createState() => _PresidentRegisterPageState();
}

class _PresidentRegisterPageState extends State<PresidentRegisterPage> {
  final _phoneCtrl = TextEditingController();
  final _nicknameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  final _provinceCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _schoolNameCtrl = TextEditingController();
  final _clubNameCtrl = TextEditingController();
  final _noteCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  String _gender = '男'; // 性别默认选"男"，页面上可切换
  bool _loading = false;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _nicknameCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    _provinceCtrl.dispose();
    _cityCtrl.dispose();
    _schoolNameCtrl.dispose();
    _clubNameCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  // 点击"提交申请"按钮
  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false) || _loading) return;
    setState(() => _loading = true);
    try {
      final phone = _phoneCtrl.text.trim();
      await Api.registerPresident(
        phone,
        _nicknameCtrl.text.trim(),
        _gender,
        _passwordCtrl.text,
        _provinceCtrl.text.trim(),
        _cityCtrl.text.trim(),
        _schoolNameCtrl.text.trim(),
        clubName: _clubNameCtrl.text.trim(),
        note: _noteCtrl.text.trim(),
      );
      if (!mounted) return;
      // 弹"申请已提交"提示框，点"去登录"后跳到登录页（手机号已自动填好）
      await showDialog(
        context: context,
        barrierDismissible: false, // 必须点按钮，防止误触退回注册页
        builder: (_) => AlertDialog(
          icon: const Icon(Icons.check_circle, color: Colors.green, size: 48),
          title: const Text('申请已提交'),
          content: Text(
            '账号：$phone\n申请学校：${_schoolNameCtrl.text.trim()}\n\n'
            '你的社长申请已提交给管理员审批。\n'
            '审批通过前，你可以先登录使用跑步记录、知识、计划等功能；'
            '审批进度在登录后的「社团」页查看。',
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('去登录'),
            ),
          ],
        ),
      );
      if (!mounted) return;
      // 清掉注册页，去登录页
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => LoginPage(initialPhone: phone)),
        (route) => false,
      );
    } on ApiException catch (e) {
      _showError(e.message);
    } catch (e) {
      // 兜底：其他类型的异常也显示出来，不再静默失败
      _showError('注册出错: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('申请成为社长')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(32),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              // 顶部说明卡片：告诉用户这是申请制
              Card(
                color: Theme.of(context).colorScheme.primaryContainer,
                child: const Padding(
                  padding: EdgeInsets.all(12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.info_outline),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '提交后由管理员审批，通过即成为社长。\n'
                          '审批前可正常登录使用其他功能。',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              // 手机号 = 登录账号，不能重复
              TextFormField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                maxLength: 11,
                decoration: const InputDecoration(
                  labelText: '手机号（用来登录）',
                  counterText: '',
                  prefixIcon: Icon(Icons.phone_iphone),
                  border: OutlineInputBorder(),
                ),
                validator: (v) {
                  final s = v?.trim() ?? '';
                  if (s.isEmpty) return '请输入手机号';
                  if (!RegExp(r'^1\d{10}$').hasMatch(s)) {
                    return '手机号格式不正确（1 开头的 11 位数字）';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              // 性别选择：男 / 女 两个按钮
              Row(
                children: [
                  const Icon(Icons.face_outlined, color: Colors.grey),
                  const SizedBox(width: 12),
                  const Text('性别'),
                  const SizedBox(width: 16),
                  Expanded(
                    child: SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: '男', label: Text('男'), icon: Icon(Icons.male)),
                        ButtonSegment(value: '女', label: Text('女'), icon: Icon(Icons.female)),
                      ],
                      selected: {_gender},
                      onSelectionChanged: (s) => setState(() => _gender = s.first),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              // 昵称：显示用，可以重复
              TextFormField(
                controller: _nicknameCtrl,
                decoration: const InputDecoration(
                  labelText: '昵称（显示用，可重复）',
                  prefixIcon: Icon(Icons.person_outline),
                  border: OutlineInputBorder(),
                ),
                validator: (v) =>
                    (v == null || v.trim().length < 2) ? '昵称至少 2 个字' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _passwordCtrl,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: '密码（至少 6 位）',
                  prefixIcon: Icon(Icons.lock_outline),
                  border: OutlineInputBorder(),
                ),
                validator: (v) =>
                    (v == null || v.length < 6) ? '密码至少 6 位' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _confirmCtrl,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: '再输入一遍密码',
                  prefixIcon: Icon(Icons.lock_outline),
                  border: OutlineInputBorder(),
                ),
                validator: (v) =>
                    (v != _passwordCtrl.text) ? '两次输入的密码不一致' : null,
              ),
              const SizedBox(height: 24),
              const Divider(),
              const SizedBox(height: 8),
              // 以下为社长申请信息
              TextFormField(
                controller: _schoolNameCtrl,
                decoration: const InputDecoration(
                  labelText: '学校/社团名称（必填）',
                  hintText: '例如 华师附中',
                  prefixIcon: Icon(Icons.school_outlined),
                  border: OutlineInputBorder(),
                ),
                validator: (v) =>
                    (v == null || v.trim().length < 2) ? '学校名称至少 2 个字' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _clubNameCtrl,
                decoration: const InputDecoration(
                  labelText: '社团名称（选填，默认"长跑社"）',
                  hintText: '例如 追风跑团',
                  prefixIcon: Icon(Icons.groups_outlined),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _provinceCtrl,
                decoration: const InputDecoration(
                  labelText: '所在省（选填）',
                  hintText: '例如 广东省',
                  prefixIcon: Icon(Icons.location_on_outlined),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _cityCtrl,
                decoration: const InputDecoration(
                  labelText: '所在市（选填）',
                  hintText: '例如 广州市',
                  prefixIcon: Icon(Icons.location_city_outlined),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _noteCtrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: '申请留言（选填）',
                  hintText: '向管理员介绍一下你和社团的情况，有助于审批通过',
                  prefixIcon: Icon(Icons.edit_note),
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  onPressed: _loading ? null : _submit,
                  child: Text(_loading ? '提交中...' : '提交社长申请'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
