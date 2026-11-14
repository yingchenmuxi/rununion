// ============================================================
// 登录页：输入手机号和密码登录，登录成功进入主页
// ============================================================
import 'package:flutter/material.dart';

import '../api.dart';
import '../local_store.dart';
import 'home_page.dart';
import 'president_register_page.dart';
import 'register_page.dart';

class LoginPage extends StatefulWidget {
  final String? initialPhone; // 从注册页跳过来时，自动填上刚注册的手机号

  const LoginPage({super.key, this.initialPhone});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _phoneCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    // 注册成功跳过来时，把手机号预填进输入框
    if (widget.initialPhone != null) {
      _phoneCtrl.text = widget.initialPhone!;
    }
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  // 点击"登录"按钮
  Future<void> _doLogin() async {
    if (!(_formKey.currentState?.validate() ?? false) || _loading) return;
    setState(() => _loading = true);
    try {
      final result = await Api.login(_phoneCtrl.text.trim(), _passwordCtrl.text);
      // 保存登录状态到手机本地，下次打开不用重新登录
      await LocalStore.saveLogin(result.token, result.user);
      if (!mounted) return;
      // 进入主页，并清掉登录页（按返回键不会退回登录页）
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => HomePage(user: result.user, token: result.token),
        ),
      );
    } on ApiException catch (e) {
      _showError(e.message);
    } catch (e) {
      // 兜底：其他类型的异常也显示出来，不再静默失败
      _showError('登录出错: $e');
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
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.directions_run, size: 72, color: Colors.green),
                const SizedBox(height: 8),
                const Text('长跑社', style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
                const SizedBox(height: 32),
                TextFormField(
                  controller: _phoneCtrl,
                  keyboardType: TextInputType.phone, // 弹数字键盘
                  maxLength: 11, // 最多 11 位
                  decoration: const InputDecoration(
                    labelText: '手机号',
                    counterText: '', // 去掉右下角的 0/11 计数
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
                TextFormField(
                  controller: _passwordCtrl,
                  obscureText: true, // 密码打点显示
                  decoration: const InputDecoration(
                    labelText: '密码',
                    prefixIcon: Icon(Icons.lock_outline),
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) =>
                      (v == null || v.length < 6) ? '密码至少 6 位' : null,
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: FilledButton(
                    onPressed: _loading ? null : _doLogin,
                    child: Text(_loading ? '登录中...' : '登录'),
                  ),
                ),
                const SizedBox(height: 8),
                // 两个注册入口：社员注册 / 社长注册
                TextButton(
                  onPressed: () {
                    // 跳到社员注册页
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const RegisterPage()),
                    );
                  },
                  child: const Text('没有账号？社员注册'),
                ),
                TextButton(
                  onPressed: () {
                    // 跳到社长注册页（需要邀请码并创建学校）
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const PresidentRegisterPage()),
                    );
                  },
                  child: const Text('我是社长，注册学校'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
