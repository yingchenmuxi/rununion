// ============================================================
// 社员注册页：
// 手机号 + 性别 + 昵称 + 密码 + 选择社团
// 登录账号 = 手机号（不能重复）；昵称只用来显示，可以重复
// 选择社团后注册即提交"入社申请"，需该社团社长审批通过才真正加入；
// 也可以选"暂不加入社团"，之后在社团页再申请加入，或申请成为社长
// ============================================================
import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import 'login_page.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _phoneCtrl = TextEditingController();
  final _nicknameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  String _gender = '男'; // 性别默认选"男"，页面上可切换
  bool _loading = false;

  // 社团列表相关状态
  List<OpenClub> _clubs = [];
  bool _loadingClubs = true; // 是否还在加载社团列表
  String? _clubLoadError; // 加载社团失败时的提示
  int? _selectedClubId; // 当前选中的社团 id

  @override
  void initState() {
    super.initState();
    _loadClubs();
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _nicknameCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  // 从后端拉取社团列表，供下拉选择
  Future<void> _loadClubs() async {
    setState(() {
      _loadingClubs = true;
      _clubLoadError = null;
    });
    try {
      final list = await Api.listPublicClubs();
      if (!mounted) return;
      setState(() {
        _clubs = list;
        _loadingClubs = false;
        // 默认选"暂不加入社团"，避免没注意就申请了别的社团
        _selectedClubId = null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _clubLoadError = e.message;
        _loadingClubs = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _clubLoadError = '加载社团失败: $e';
        _loadingClubs = false;
      });
    }
  }

  // 点击"注册"按钮
  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false) || _loading) return;
    setState(() => _loading = true);
    try {
      final phone = _phoneCtrl.text.trim();
      await Api.registerMember(
        phone,
        _nicknameCtrl.text.trim(),
        _gender,
        _passwordCtrl.text,
        _selectedClubId, // null = 暂不加入社团
      );
      if (!mounted) return;
      // 选了社团：注册时已自动提交入社申请，需要社长审批
      final applied = _selectedClubId != null;
      // 弹"注册成功"提示框，点"去登录"后跳到登录页（手机号已自动填好）
      await showDialog(
        context: context,
        barrierDismissible: false, // 必须点按钮，防止误触退回注册页
        builder: (_) => AlertDialog(
          icon: const Icon(Icons.check_circle, color: Colors.green, size: 48),
          title: const Text('注册成功'),
          content: Text(
            '账号：$phone\n'
            '${applied ? '入社申请已提交，需社长审批通过后才能加入社团\n' : ''}'
            '请用手机号和密码登录',
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

  // 社团选择区域的显示：加载中 / 加载失败 / 无社团 / 下拉框
  Widget _buildClubField() {
    if (_loadingClubs) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
            SizedBox(width: 12),
            Text('正在加载社团列表...'),
          ],
        ),
      );
    }
    if (_clubLoadError != null) {
      return Column(
        children: [
          Text(_clubLoadError!, textAlign: TextAlign.center),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: _loadClubs, child: const Text('重新加载')),
        ],
      );
    }
    if (_clubs.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Text('暂时还没有社团，可直接注册为无社团用户，之后在社团页申请加入'),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<int>(
          // 0 是"暂不加入社团"的占位值（真实社团 id 从 1 开始）
          initialValue: _selectedClubId ?? 0,
          decoration: const InputDecoration(
            labelText: '选择社团',
            prefixIcon: Icon(Icons.groups_outlined),
            border: OutlineInputBorder(),
          ),
          items: [
            const DropdownMenuItem<int>(value: 0, child: Text('暂不加入社团（之后可在社团页申请）')),
            ..._clubs.map((c) => DropdownMenuItem<int>(
                  value: c.id,
                  child: Text(
                    c.schoolName.isEmpty ? c.name : '${c.schoolName} - ${c.name}',
                    overflow: TextOverflow.ellipsis,
                  ),
                )),
          ],
          onChanged: (v) => setState(() => _selectedClubId = (v == null || v == 0) ? null : v),
        ),
        if (_selectedClubId != null)
          const Padding(
            padding: EdgeInsets.only(top: 8, left: 4),
            child: Text(
              '注册后会向该社团提交入社申请，社长同意后才能加入',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('社员注册')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(32),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
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
              // 社团选择
              _buildClubField(),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  onPressed: _loading ? null : _submit,
                  child: Text(_loading ? '注册中...' : '注册'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}