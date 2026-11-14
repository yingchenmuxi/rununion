// ============================================================
// APP 入口：
// 1. 启动 APP
// 2. 启动页检查本地保存的登录状态 -> 有效直接进主页，否则进登录页
// ============================================================
import 'package:flutter/material.dart';

import 'api.dart';
import 'local_store.dart';
import 'models.dart';
import 'pages/home_page.dart';
import 'pages/login_page.dart';

void main() {
  // 全局错误显示：正式版 APP 里任何页面出错都显示"页面出错+原因"，
  // 不再是灰色/红色一片，方便把错误文字截图反馈
  ErrorWidget.builder = (details) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            '页面出错，请截图反馈：\n\n${details.exception}',
            style: const TextStyle(color: Colors.red, fontSize: 14),
            textAlign: TextAlign.center,
          ),
        ),
      );
  runApp(const RunningClubApp());
}

// 整个 APP 的外壳：主题、首页
class RunningClubApp extends StatelessWidget {
  const RunningClubApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '长跑社',
      debugShowCheckedModeBanner: false, // 去掉右上角 DEBUG 红条
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: Colors.green, // 跑步主题色：绿色
      ),
      home: const LaunchPage(),
    );
  }
}

// 启动页：显示一个图标，同时检查登录状态，检查完自动跳转
class LaunchPage extends StatefulWidget {
  const LaunchPage({super.key});

  @override
  State<LaunchPage> createState() => _LaunchPageState();
}

class _LaunchPageState extends State<LaunchPage> {
  // 启动后：读取本地登录状态，自动进入主页或登录页
  @override
  void initState() {
    super.initState();
    _checkLogin();
  }

  Future<void> _checkLogin() async {
    // 读取本地保存的登录状态；读失败就当没登录（防止 SharedPreferences 异常卡在启动页）
    String? token;
    User? saved;
    try {
      token = await LocalStore.getToken();
      saved = await LocalStore.getUser();
    } catch (_) {
      token = null;
      saved = null;
    }

    if (!mounted) return;
    final navigator = Navigator.of(context);

    // 没登录过：去登录页
    if (token == null || saved == null) {
      navigator.pushReplacement(MaterialPageRoute(builder: (_) => const LoginPage()));
      return;
    }

    // 取出非空的本地登录态（Dart 闭包内不能直接用可空变量，这里先转成确定非空）
    final String myToken = token;
    final User myUser = saved;

    // 本地有登录状态：直接用缓存的用户信息进主页（不阻塞等待网络）。
    // 这样即使后端暂时没启动、或网络抖动，也照样免登录进主页。
    navigator.pushReplacement(
      MaterialPageRoute(builder: (_) => HomePage(user: myUser, token: myToken)),
    );

    // 后台再校验一次 token：只有服务端明确返回"登录已过期"(401)才踢回登录页；
    // 连不上服务器等其他错误不处理，留在主页让页面自己提示重试。
    try {
      await Api.me(myToken);
    } on ApiException catch (e) {
      if (e.authExpired) {
        await LocalStore.clear();
        navigator.pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const LoginPage()),
          (route) => false,
        );
      }
    } catch (_) {
      // 未知异常忽略，留在主页
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.directions_run, size: 72, color: Colors.green),
            SizedBox(height: 16),
            Text('长跑社', style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
            SizedBox(height: 24),
            CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}
