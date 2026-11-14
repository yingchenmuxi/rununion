// ============================================================
// 本地存储模块：把登录状态保存到手机本地（shared_preferences）
// 这样 APP 关掉再打开，不用重新登录
// ============================================================
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

class LocalStore {
  static const _kToken = 'token'; // 保存"通行证"用的键名
  static const _kUser = 'user'; // 保存用户信息用的键名
  static const _kPendingRuns = 'pending_runs'; // 本地暂存、待上传的跑步记录队列

  // 登录成功后调用：保存 token 和用户信息
  static Future<void> saveLogin(String token, User user) async {
    final sp = await SharedPreferences.getInstance();
    await sp.setString(_kToken, token);
    await sp.setString(_kUser, jsonEncode(user.toJson()));
  }

  // 只更新本地保存的用户信息（加入社团、改资料后调用）
  static Future<void> saveUser(User user) async {
    final sp = await SharedPreferences.getInstance();
    await sp.setString(_kUser, jsonEncode(user.toJson()));
  }

  // 读取保存的 token（没登录过返回 null）
  static Future<String?> getToken() async {
    final sp = await SharedPreferences.getInstance();
    return sp.getString(_kToken);
  }

  // 读取保存的用户信息（没登录过返回 null）
  static Future<User?> getUser() async {
    final sp = await SharedPreferences.getInstance();
    final s = sp.getString(_kUser);
    if (s == null) return null;
    try {
      return User.fromJson(jsonDecode(s) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  // 退出登录：清空本地保存的数据
  static Future<void> clear() async {
    final sp = await SharedPreferences.getInstance();
    await sp.remove(_kToken);
    await sp.remove(_kUser);
  }

  // ============ 本地暂存（离线时的跑步记录先存手机，等联网再上传） ============

  // 读取所有待上传记录
  static Future<List<PendingRun>> getPendingRuns() async {
    final sp = await SharedPreferences.getInstance();
    final s = sp.getString(_kPendingRuns);
    if (s == null || s.isEmpty) return [];
    try {
      final list = jsonDecode(s) as List<dynamic>;
      return list
          .map((e) => PendingRun.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  // 把整条队列写回本地（内部用）
  static Future<void> _savePendingRuns(List<PendingRun> list) async {
    final sp = await SharedPreferences.getInstance();
    await sp.setString(
      _kPendingRuns,
      jsonEncode(list.map((e) => e.toJson()).toList()),
    );
  }

  // 添加一条待上传记录到队尾
  static Future<void> addPendingRun(PendingRun run) async {
    final list = await getPendingRuns();
    list.add(run);
    await _savePendingRuns(list);
  }

  // 删除队列里指定位置的那条（上传成功后调用）
  static Future<void> removePendingRunAt(int index) async {
    final list = await getPendingRuns();
    if (index < 0 || index >= list.length) return;
    list.removeAt(index);
    await _savePendingRuns(list);
  }

  // 清空整个队列（全部上传成功后调用）
  static Future<void> clearPendingRuns() async {
    final sp = await SharedPreferences.getInstance();
    await sp.remove(_kPendingRuns);
  }
}
