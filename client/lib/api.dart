// ============================================================
// 网络层：所有和后端服务器的 HTTP 请求都集中在这一个文件
// 后端地址在 config.dart 里配置，以后换地址只改那一个地方
// ============================================================
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'config.dart';
import 'models.dart';

// 网络请求超时时间（秒）：连不上后端时最多等这么久就报错，不会一直转圈圈
const Duration _timeout = Duration(seconds: 10);

// 业务异常：把后端返回的错误提示（中文）抛给页面显示
class ApiException implements Exception {
  final String message;
  // 是不是"登录失效"（401）。启动页用它判断：只有登录真失效才踢回登录页，
  // 连不上服务器等其他错误不踢，避免每次打开都要重新登录。
  final bool authExpired;
  ApiException(this.message, {this.authExpired = false});

  @override
  String toString() => message; // 直接显示中文提示，不带"Exception:"前缀
}

class Api {
  // 把后端返回的相对路径（/uploads/xxx.jpg）拼成完整 URL 供 Image.network 使用
  // 如果传入已经是 http(s) 开头的完整 URL，原样返回
  static String fullUrl(String path) {
    if (path.isEmpty) return path;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return '$kBaseUrl$path';
  }

  // 构造请求头：带 token 就是告诉后端"我是谁"
  static Map<String, String> _headers(String? token) => {
        'Content-Type': 'application/json; charset=utf-8',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  // 统一发送 POST 请求；连不上后端时统一转成中文异常
  static Future<dynamic> _post(String path, Map<String, dynamic> body, String? token) async {
    final http.Response resp;
    try {
      resp = await http.post(
        Uri.parse('$kBaseUrl$path'),
        headers: _headers(token),
        body: jsonEncode(body),
      ).timeout(_timeout);
    } catch (_) {
      throw ApiException('连接服务器失败，请确认后端已启动、地址配置正确');
    }
    return _parse(resp);
  }

  // 统一发送 GET 请求
  static Future<dynamic> _get(String path, String? token) async {
    final http.Response resp;
    try {
      resp = await http.get(Uri.parse('$kBaseUrl$path'), headers: _headers(token))
          .timeout(_timeout);
    } catch (_) {
      throw ApiException('连接服务器失败，请确认后端已启动、地址配置正确');
    }
    return _parse(resp);
  }

  // 统一发送 DELETE 请求
  static Future<dynamic> _delete(String path, String? token) async {
    final http.Response resp;
    try {
      resp = await http.delete(Uri.parse('$kBaseUrl$path'), headers: _headers(token))
          .timeout(_timeout);
    } catch (_) {
      throw ApiException('连接服务器失败，请确认后端已启动、地址配置正确');
    }
    return _parse(resp);
  }

  // 统一解析后端返回：出错（状态码 400+）时抛出后端给的中文错误信息
  static Future<dynamic> _parse(http.Response resp) async {
    final data = jsonDecode(utf8.decode(resp.bodyBytes));
    if (resp.statusCode >= 400) {
      final msg = (data is Map && data['error'] != null)
          ? data['error'].toString()
          : '请求失败 (${resp.statusCode})';
      // 401 表示"未登录 / 登录已过期"，单独打标记，方便启动页判断要不要踢回登录
      throw ApiException(msg, authExpired: resp.statusCode == 401);
    }
    return data;
  }

  // ---------------- 以下是页面直接调用的接口 ----------------

  // 社长注册（申请制）：基础信息 + 学校/社团名称 + 申请留言
  // 注册成功后账号是"无社团"状态，等管理员在后台批准申请后自动成为社长
  static Future<LoginResult> registerPresident(
    String phone,
    String nickname,
    String gender,
    String password,
    String province,
    String city,
    String schoolName, {
    String clubName = '',
    String note = '',
  }) async {
    final data = await _post('/api/register/president', {
      'phone': phone,
      'nickname': nickname,
      'gender': gender,
      'password': password,
      'province': province,
      'city': city,
      'schoolName': schoolName,
      'clubName': clubName,
      'note': note,
    }, null) as Map<String, dynamic>;
    return LoginResult(
      token: data['token'] as String,
      user: User.fromJson(data['user'] as Map<String, dynamic>),
    );
  }

  // 社员注册：基础信息 + 选择要申请的社团
  // clubId 传 null 表示"暂不加入社团"，注册后是无社团用户；
  // 传了 clubId 则自动提交一条入社申请，等该社团社长审批通过后才真正加入
  static Future<LoginResult> registerMember(
    String phone,
    String nickname,
    String gender,
    String password,
    int? clubId, {
    String reason = '',
  }) async {
    final data = await _post('/api/register/member', {
      'phone': phone,
      'nickname': nickname,
      'gender': gender,
      'password': password,
      'clubId': clubId,
      'reason': reason,
    }, null) as Map<String, dynamic>;
    return LoginResult(
      token: data['token'] as String,
      user: User.fromJson(data['user'] as Map<String, dynamic>),
    );
  }

  // 拉取学校列表（保留给旧页面用，不需要登录）
  static Future<List<School>> listSchools() async {
    final data = await _get('/api/schools', null) as List<dynamic>;
    return data.map((e) => School.fromJson(e as Map<String, dynamic>)).toList();
  }

  // 拉取全部社团（注册页选择入社目标用，不需要登录）
  static Future<List<OpenClub>> listPublicClubs() async {
    final data = await _get('/api/clubs/public', null) as List<dynamic>;
    return data.map((e) => OpenClub.fromJson(e as Map<String, dynamic>)).toList();
  }

  // 检查 APP 是否有新版本（不需要登录）
  // 返回 { version: '1.0.1', notes: '更新说明', download_url: '/app-release.apk' }
  static Future<Map<String, dynamic>> appVersion() async {
    return await _get('/api/app-version', null) as Map<String, dynamic>;
  }

  // 登录：手机号 + 密码，返回 token 和用户信息
  static Future<LoginResult> login(String phone, String password) async {
    final data = await _post('/api/login', {
      'phone': phone,
      'password': password,
    }, null) as Map<String, dynamic>;
    return LoginResult(
      token: data['token'] as String,
      user: User.fromJson(data['user'] as Map<String, dynamic>),
    );
  }

  // 用 token 换当前用户信息（APP 启动时校验保存的登录状态是否还有效）
  static Future<User> me(String token) async {
    final data = await _get('/api/me', token) as Map<String, dynamic>;
    return User.fromJson(data);
  }

  // 提交一条跑步记录
  static Future<void> addRun(String token, String runDate, double distanceKm, int durationSeconds) async {
    await _post('/api/runs', {
      'run_date': runDate,
      'distance_km': distanceKm,
      'duration_seconds': durationSeconds,
    }, token);
  }

  // 查我自己的所有跑步记录
  static Future<List<RunRecord>> myRuns(String token) async {
    final data = await _get('/api/runs', token) as List<dynamic>;
    return data.map((e) => RunRecord.fromJson(e as Map<String, dynamic>)).toList();
  }

  // 删除我自己的一条跑步记录（只能删自己的；填错数据时用来自行纠正）
  static Future<void> deleteRun(String token, int runId) async {
    await _delete('/api/runs/$runId', token);
  }

  // 修改我自己的一条跑步记录（只能改自己的；日期/距离/用时都可改）
  static Future<void> updateRun(
    String token,
    int runId, {
    String? runDate,
    double? distanceKm,
    int? durationSeconds,
  }) async {
    final body = <String, dynamic>{};
    if (runDate != null) body['run_date'] = runDate;
    if (distanceKm != null) body['distance_km'] = distanceKm;
    if (durationSeconds != null) body['duration_seconds'] = durationSeconds;
    await _put('/api/runs/$runId', body, token);
  }

  // ---------- 社长申请（无社团用户专用）----------

  // 登录后补交社长申请（注册时没申请、或申请被驳回后重新申请）
  static Future<void> applyPresident(
    String token, {
    required String schoolName,
    String clubName = '',
    String province = '',
    String city = '',
    String note = '',
  }) async {
    await _post('/api/apply/president', {
      'schoolName': schoolName,
      'clubName': clubName,
      'province': province,
      'city': city,
      'note': note,
    }, token);
  }

  // 查我最近一条社长申请（社团 tab 展示申请进度用；没有申请过返回 null）
  static Future<Application?> myApplication(String token) async {
    final data = await _get('/api/apply/my', token);
    if (data == null) return null;
    return Application.fromJson(data as Map<String, dynamic>);
  }

  // ---------- 社长删除自己的社团 ----------
  // 删除后全社成员（含自己）都变成无社团用户，社团内容一并清空，
  // 本人会被强制退出登录（角色已从社长变回社员，需要重新登录刷新身份）
  static Future<void> deleteMyClub(String token) async {
    await _delete('/api/club', token);
  }

  // N3: 社长转让社长身份给自己社团另一个普通成员
  // 后端会全社团踢下线，前端后续应引导重新登录
  static Future<void> transferMyClubPresident(String token, int userId) async {
    await _post('/api/club/transfer-president', {'user_id': userId}, token);
  }

  // ---------- 无社团用户：申请加入社团 ----------

  // 所有可加入的社团（无社团用户的"申请入社"列表用）
  static Future<List<OpenClub>> listOpenClubs(String token) async {
    final data = await _get('/api/clubs/available', token) as List<dynamic>;
    return data.map((e) => OpenClub.fromJson(e as Map<String, dynamic>)).toList();
  }

  // 提交入社申请（需该社团社长或管理员审批通过后才真正加入）
  static Future<String> requestJoinClub(String token, int clubId, {String reason = ''}) async {
    final data = await _post('/api/clubs/join', {
      'clubId': clubId,
      'reason': reason,
    }, token) as Map<String, dynamic>;
    return (data['message'] ?? '申请已提交') as String;
  }

  // 提交退社申请（需社长或管理员审批）
  static Future<String> requestLeaveClub(String token, {String reason = ''}) async {
    final data = await _post('/api/clubs/leave', {'reason': reason}, token) as Map<String, dynamic>;
    return (data['message'] ?? '退社申请已提交') as String;
  }

  // 查询我的入社/退社申请进度
  static Future<MyMembership> myMembership(String token) async {
    final data = await _get('/api/membership/my', token) as Map<String, dynamic>;
    return MyMembership.fromJson(data);
  }

  // 撤回自己待审批的社团申请
  static Future<void> cancelMembershipRequest(String token, int id) async {
    await _post('/api/membership/requests/$id/cancel', {}, token);
  }

  // 待审批的入社/退社申请列表（社长只看本社团；管理员可传 clubId 过滤）
  static Future<List<MembershipRequest>> listMembershipRequests(String token, {int? clubId}) async {
    final qs = clubId == null ? '' : '?clubId=$clubId';
    final data = await _get('/api/membership/requests$qs', token) as List<dynamic>;
    return data.map((e) => MembershipRequest.fromJson(e as Map<String, dynamic>)).toList();
  }

  // 同意入社/退社申请
  static Future<void> approveMembershipRequest(String token, int id) async {
    await _post('/api/membership/requests/$id/approve', {}, token);
  }

  // 驳回入社/退社申请
  static Future<void> rejectMembershipRequest(String token, int id, {String reason = ''}) async {
    await _post('/api/membership/requests/$id/reject', {'reason': reason}, token);
  }

  // 识别 Keep 跑步记录截图，返回提取出的距离/用时/配速（用于预填表单）
  // imageBase64: "data:image/jpeg;base64,xxxxx" 格式
  static Future<Map<String, dynamic>> ocrKeepRun(String token, String imageBase64) async {
    final data = await _post('/api/ocr/keep-run', {'image': imageBase64}, token);
    return data as Map<String, dynamic>;
  }

  // 识别 Keep 详细数据截图（心率/触地时间/垂直振幅/步幅/步频）
  static Future<Map<String, dynamic>> ocrKeepDetail(String token, String imageBase64) async {
    final data = await _post('/api/ocr/keep-detail', {'image': imageBase64}, token);
    return data as Map<String, dynamic>;
  }

  // 查某条跑步记录的详细数据
  static Future<RunDetail?> getRunDetail(String token, int runId) async {
    final data = await _get('/api/runs/$runId/detail', token);
    if (data == null) return null;
    return RunDetail.fromJson(data as Map<String, dynamic>);
  }

  // 保存/更新某条跑步记录的详细数据（传几个存几个）
  static Future<RunDetail> saveRunDetail(String token, int runId, {
    int? heartRate,
    int? groundContactMs,
    double? verticalOscillationCm,
    double? strideLengthCm,
    int? cadenceSpm,
  }) async {
    final body = <String, dynamic>{};
    if (heartRate != null) body['heart_rate'] = heartRate;
    if (groundContactMs != null) body['ground_contact_ms'] = groundContactMs;
    if (verticalOscillationCm != null) body['vertical_oscillation_cm'] = verticalOscillationCm;
    if (strideLengthCm != null) body['stride_length_cm'] = strideLengthCm;
    if (cadenceSpm != null) body['cadence_spm'] = cadenceSpm;
    final data = await _put('/api/runs/$runId/detail', body, token);
    return RunDetail.fromJson(data as Map<String, dynamic>);
  }

  // 删除某条跑步记录的详细数据
  static Future<void> deleteRunDetail(String token, int runId) async {
    await _delete('/api/runs/$runId/detail', token);
  }

  // 导入 GPX 文件，解析出距离/用时/配速/心率/步频/步幅（数据 100% 准）
  static Future<Map<String, dynamic>> importGpx(String token, String gpxContent) async {
    final data = await _post('/api/import/gpx', {'gpx': gpxContent}, token);
    return data as Map<String, dynamic>;
  }

  // 社团总览（社长专用）：全社每个人的记录和汇总
  static Future<List<MemberSummary>> clubOverview(String token) async {
    final data = await _get('/api/club/overview', token) as Map<String, dynamic>;
    return (data['members'] as List<dynamic>)
        .map((e) => MemberSummary.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ============================================================
  // 管理员后台接口（只有 admin 角色能调用成功）
  // ============================================================

  // 系统概览：总用户数、总跑步次数、总公里、学校数
  static Future<AdminOverview> adminOverview(String token) async {
    final data = await _get('/api/admin/overview', token) as Map<String, dynamic>;
    return AdminOverview.fromJson(data);
  }

  // 数据看板（N10）：趋势 / 分布 / 对比 统计数据
  static Future<AdminDashboard> adminDashboard(String token) async {
    final data = await _get('/api/admin/dashboard', token) as Map<String, dynamic>;
    return AdminDashboard.fromJson(data);
  }

  // 所有用户列表（q=昵称/手机号关键词，role=角色筛选，clubId=按社团筛选，deleted=true 查回收站）
  static Future<({List<AdminUser> list, bool hasMore})> adminUsers(
    String token, {
    String q = '',
    String role = '',
    int? clubId,
    bool deleted = false,
    int page = 1,
  }) async {
    final params = <String>['page=$page', 'page_size=50'];
    if (q.isNotEmpty) params.add('q=${Uri.encodeComponent(q)}');
    if (role.isNotEmpty) params.add('role=${Uri.encodeComponent(role)}');
    if (clubId != null) params.add('club_id=$clubId');
    if (deleted) params.add('deleted=1');
    final qs = params.isEmpty ? '' : '?${params.join('&')}';
    final data = await _get('/api/admin/users$qs', token) as Map<String, dynamic>;
    final items = (data['list'] as List?) ?? [];
    return (
      list: items.map((e) => AdminUser.fromJson((e as Map).cast<String, dynamic>())).toList(),
      hasMore: data['has_more'] == true,
    );
  }

  // 所有跑步记录（带分页）
  static Future<({List<AdminRun> list, bool hasMore})> adminRuns(String token, {int page = 1}) async {
    final data = await _get('/api/admin/runs?page=$page&page_size=50', token) as Map<String, dynamic>;
    final items = (data['list'] as List?) ?? [];
    return (
      list: items.map((e) => AdminRun.fromJson((e as Map).cast<String, dynamic>())).toList(),
      hasMore: data['has_more'] == true,
    );
  }

  // 删除一个用户（软删除：进回收站，数据保留，可恢复）
  static Future<void> adminDeleteUser(String token, int userId) async {
    await _delete('/api/admin/users/$userId', token);
  }

  // 从回收站恢复一个用户（恢复原社团；原社团不存在则恢复为无社团用户）
  static Future<void> adminRestoreUser(String token, int userId) async {
    await _post('/api/admin/users/$userId/restore', {}, token);
  }

  // 彻底删除一个用户（仅回收站里的用户可操作，数据全部清除，不可恢复）
  static Future<void> adminPermanentDeleteUser(String token, int userId) async {
    await _delete('/api/admin/users/$userId/permanent', token);
  }

  // ---------- 社长申请审批 ----------

  // 所有社长申请列表（待审批排最前）
  static Future<List<Application>> adminApplications(String token) async {
    final data = await _get('/api/admin/applications', token) as List<dynamic>;
    return data.map((e) => Application.fromJson(e as Map<String, dynamic>)).toList();
  }

  // 批准申请：自动建学校（如不存在）+ 建社团 + 任命申请人为社长
  static Future<void> adminApproveApplication(String token, int id) async {
    await _post('/api/admin/applications/$id/approve', {}, token);
  }

  // 驳回申请（必须填驳回原因，会展示给申请人看）
  static Future<void> adminRejectApplication(String token, int id, String reason) async {
    await _post('/api/admin/applications/$id/reject', {'reason': reason}, token);
  }

  // 任命社团内某个成员为新社长（原社长自动降为社员）
  static Future<void> adminSetPresident(String token, int clubId, int userId) async {
    await _post('/api/admin/clubs/$clubId/president', {'user_id': userId}, token);
  }

  // 删除一条跑步记录
  static Future<void> adminDeleteRun(String token, int runId) async {
    await _delete('/api/admin/runs/$runId', token);
  }

  // 管理员新增计划模板（body 按后端 admin.js 的字段来传）
  static Future<void> adminAddPlanTemplate(String token, Map<String, dynamic> body) async {
    await _post('/api/admin/plan-templates', body, token);
  }

  // 管理员删除计划模板
  static Future<void> adminDeletePlanTemplate(String token, int id) async {
    await _delete('/api/admin/plan-templates/$id', token);
  }

  // ---------- 用户管理扩展 ----------

  // 新增用户
  static Future<void> adminCreateUser(String token, Map<String, dynamic> body) async {
    await _post('/api/admin/users', body, token);
  }

  // 修改用户信息
  static Future<void> adminUpdateUser(String token, int id, Map<String, dynamic> body) async {
    await _put('/api/admin/users/$id', body, token);
  }

  // 重置用户密码
  static Future<void> adminResetPassword(String token, int id, String password) async {
    await _post('/api/admin/users/$id/reset-password', {'password': password}, token);
  }

  // ---------- N13 批量操作 ----------
  // 三个接口都返回 {message, failed: [...]}，failed 里是逐行失败明细

  // 批量导入用户（开学导入新生）
  static Future<Map<String, dynamic>> adminBatchImportUsers(
      String token, List<Map<String, dynamic>> users,
      {int? schoolId, int? clubId}) async {
    final res = await _post('/api/admin/users/batch-import',
        {'users': users, 'school_id': schoolId, 'club_id': clubId}, token);
    return (res as Map).cast<String, dynamic>();
  }

  // 批量转社团（clubId 传 null = 移出社团）
  static Future<Map<String, dynamic>> adminBatchTransferClub(
      String token, List<int> userIds, int? clubId) async {
    final res = await _post('/api/admin/users/batch-transfer',
        {'user_ids': userIds, 'club_id': clubId}, token);
    return (res as Map).cast<String, dynamic>();
  }

  // 批量调整角色
  static Future<Map<String, dynamic>> adminBatchChangeRole(
      String token, List<int> userIds, String role) async {
    final res = await _post('/api/admin/users/batch-role',
        {'user_ids': userIds, 'role': role}, token);
    return (res as Map).cast<String, dynamic>();
  }

  // ---------- 跑步记录扩展 ----------

  // 修改跑步记录
  static Future<void> adminUpdateRun(String token, int id, Map<String, dynamic> body) async {
    await _put('/api/admin/runs/$id', body, token);
  }

  // ---------- 训练计划管理 ----------

  // 所有计划
  static Future<({List<AdminPlan> list, bool hasMore})> adminPlans(String token, {int page = 1}) async {
    final data = await _get('/api/admin/plans?page=$page&page_size=50', token) as Map<String, dynamic>;
    final items = (data['list'] as List?) ?? [];
    return (
      list: items.map((e) => AdminPlan.fromJson((e as Map).cast<String, dynamic>())).toList(),
      hasMore: data['has_more'] == true,
    );
  }

  // 修改计划
  static Future<void> adminUpdatePlan(String token, int id, Map<String, dynamic> body) async {
    await _put('/api/admin/plans/$id', body, token);
  }

  // 删除计划
  static Future<void> adminDeletePlan(String token, int id) async {
    await _delete('/api/admin/plans/$id', token);
  }

  // ---------- 学校管理 ----------

  static Future<List<AdminSchool>> adminSchools(String token) async {
    final data = await _get('/api/admin/schools', token) as List<dynamic>;
    return data.map((e) => AdminSchool.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> adminCreateSchool(String token, Map<String, dynamic> body) async {
    await _post('/api/admin/schools', body, token);
  }

  static Future<void> adminUpdateSchool(String token, int id, Map<String, dynamic> body) async {
    await _put('/api/admin/schools/$id', body, token);
  }

  static Future<void> adminDeleteSchool(String token, int id) async {
    await _delete('/api/admin/schools/$id', token);
  }

  // ---------- 社团管理 ----------

  static Future<List<AdminClub>> adminClubs(String token) async {
    final data = await _get('/api/admin/clubs', token) as List<dynamic>;
    return data.map((e) => AdminClub.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> adminCreateClub(String token, Map<String, dynamic> body) async {
    await _post('/api/admin/clubs', body, token);
  }

  static Future<void> adminUpdateClub(String token, int id, Map<String, dynamic> body) async {
    await _put('/api/admin/clubs/$id', body, token);
  }

  static Future<void> adminDeleteClub(String token, int id) async {
    await _delete('/api/admin/clubs/$id', token);
  }

  // ---------- 社团内容管理（公告 / 任务 / 活动）----------

  static Future<List<AdminAnnouncement>> adminAnnouncements(String token) async {
    final data = await _get('/api/admin/announcements', token) as List<dynamic>;
    return data.map((e) => AdminAnnouncement.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> adminDeleteAnnouncement(String token, int id) async {
    await _delete('/api/admin/announcements/$id', token);
  }

  static Future<List<AdminTask>> adminTasks(String token) async {
    final data = await _get('/api/admin/tasks', token) as List<dynamic>;
    return data.map((e) => AdminTask.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> adminDeleteTask(String token, int id) async {
    await _delete('/api/admin/tasks/$id', token);
  }

  static Future<List<AdminEvent>> adminEvents(String token) async {
    final data = await _get('/api/admin/events', token) as List<dynamic>;
    return data.map((e) => AdminEvent.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> adminDeleteEvent(String token, int id) async {
    await _delete('/api/admin/events/$id', token);
  }

  // 管理员编辑公告 / 任务 / 活动（后台代改内容用）
  static Future<void> adminUpdateAnnouncement(
    String token,
    int id, {
    required String title,
    required String content,
  }) async {
    await _put('/api/admin/announcements/$id', {'title': title, 'content': content}, token);
  }

  static Future<void> adminUpdateTask(
    String token,
    int id, {
    required String title,
    required String content,
    String deadline = '',
  }) async {
    await _put('/api/admin/tasks/$id',
        {'title': title, 'content': content, 'deadline': deadline}, token);
  }

  static Future<void> adminUpdateEvent(
    String token,
    int id, {
    required String title,
    required String eventDate,
    String eventTime = '',
    String place = '',
    String note = '',
    int maxParticipants = 0, // 人数上限，0=不限（N6）
  }) async {
    await _put('/api/admin/events/$id', {
      'title': title,
      'event_date': eventDate,
      'event_time': eventTime,
      'place': place,
      'note': note,
      'max_participants': maxParticipants,
    }, token);
  }

  // 统一发送 PUT 请求（修改资料用）
  static Future<dynamic> _put(String path, Map<String, dynamic> body, String? token) async {
    final http.Response resp;
    try {
      resp = await http.put(
        Uri.parse('$kBaseUrl$path'),
        headers: _headers(token),
        body: jsonEncode(body),
      ).timeout(_timeout);
    } catch (_) {
      throw ApiException('连接服务器失败，请确认后端已启动、地址配置正确');
    }
    return _parse(resp);
  }

  // ============================================================
  // 6 大功能模块接口
  // ============================================================

  // ---------- 1. 跑步知识 ----------

  // 查所有知识文章（登录就能看）
  // q: 搜索关键词；category: 分类筛选（"全部"表示不筛）
  static Future<({List<Article> list, bool hasMore})> listArticles(
    String token, {String q = '', String category = '', int page = 1}) async {
    final params = <String>['page=$page', 'page_size=30'];
    if (q.isNotEmpty) params.add('q=${Uri.encodeComponent(q)}');
    if (category.isNotEmpty && category != '全部') {
      params.add('category=${Uri.encodeComponent(category)}');
    }
    final qs = params.isEmpty ? '' : '?${params.join('&')}';
    final data = await _get('/api/articles$qs', token) as Map<String, dynamic>;
    final items = (data['list'] as List?) ?? [];
    return (
      list: items.map((e) => Article.fromJson((e as Map).cast<String, dynamic>())).toList(),
      hasMore: data['has_more'] == true,
    );
  }

  // 查所有知识分类（顶部筛选条用）
  static Future<List<String>> listArticleCategories(String token) async {
    final data = await _get('/api/articles/categories', token) as List<dynamic>;
    return data.map((e) => e.toString()).toList();
  }

  // 管理员发布知识文章（支持封面图 / 附件 / 标签）
  static Future<void> addArticle(
    String token, {
    required String category,
    required String title,
    required String summary,
    required String content,
    String tags = '',
    String imageUrl = '',
    String attachmentUrl = '',
  }) async {
    await _post('/api/articles', {
      'category': category,
      'title': title,
      'summary': summary,
      'content': content,
      'tags': tags,
      'image_url': imageUrl,
      'attachment_url': attachmentUrl,
    }, token);
  }

  // 管理员删除知识文章
  static Future<void> deleteArticle(String token, int id) async {
    await _delete('/api/articles/$id', token);
  }

  // 管理员编辑知识文章
  static Future<void> updateArticle(
    String token,
    int id, {
    required String category,
    required String title,
    required String summary,
    required String content,
    String tags = '',
    String imageUrl = '',
    String attachmentUrl = '',
  }) async {
    await _put('/api/articles/$id', {
      'category': category,
      'title': title,
      'summary': summary,
      'content': content,
      'tags': tags,
      'image_url': imageUrl,
      'attachment_url': attachmentUrl,
    }, token);
  }

  // ---------- 消息中心 ----------

  // 我的通知列表（只看最近 50 条，onlyUnread=true 时只看未读）
  static Future<List<AppNotification>> listNotifications(String token, {bool onlyUnread = false}) async {
    final path = onlyUnread ? '/api/notifications?onlyUnread=1' : '/api/notifications';
    final data = await _get(path, token) as List<dynamic>;
    return data.map((e) => AppNotification.fromJson(e as Map<String, dynamic>)).toList();
  }

  // 未读通知数量（首页铃铛角标）
  static Future<int> notificationUnreadCount(String token) async {
    final data = await _get('/api/notifications/unread-count', token) as Map<String, dynamic>;
    return ((data['count'] as num?)?.toInt()) ?? 0;
  }

  // 标记一条已读
  static Future<void> markNotificationRead(String token, int id) async {
    await _post('/api/notifications/$id/read', {}, token);
  }

  // 全部标记为已读
  static Future<void> markAllNotificationsRead(String token) async {
    await _post('/api/notifications/read-all', {}, token);
  }

  // ---------- 全员沟通（广播） ----------

  // 所有用户查看全员消息列表
  static Future<List<Broadcast>> listBroadcasts(String token) async {
    final data = await _get('/api/broadcasts', token) as List<dynamic>;
    return data.map((e) => Broadcast.fromJson(e as Map<String, dynamic>)).toList();
  }

  // 用户回复某条全员消息
  static Future<void> replyBroadcast(String token, int id, String content) async {
    await _post('/api/broadcasts/$id/reply', {'content': content}, token);
  }

  // 管理员：已发布的全员消息列表
  static Future<List<Broadcast>> adminListBroadcasts(String token) async {
    final data = await _get('/api/admin/broadcasts', token) as List<dynamic>;
    return data.map((e) => Broadcast.fromJson(e as Map<String, dynamic>)).toList();
  }

  // 管理员：发布一条全员消息
  static Future<void> adminCreateBroadcast(
    String token, {
    required String title,
    required String content,
  }) async {
    await _post('/api/admin/broadcasts', {'title': title, 'content': content}, token);
  }

  // 管理员：查看某条消息的所有回复
  static Future<List<BroadcastReply>> adminBroadcastReplies(String token, int id) async {
    final data = await _get('/api/admin/broadcasts/$id/replies', token) as List<dynamic>;
    return data.map((e) => BroadcastReply.fromJson(e as Map<String, dynamic>)).toList();
  }

  // 管理员：删除一条全员消息
  static Future<void> adminDeleteBroadcast(String token, int id) async {
    await _delete('/api/admin/broadcasts/$id', token);
  }

  // ---------- 文件上传 ----------

  // 上传 base64 编码的图片/附件，返回 /uploads/xxx 形式的相对 URL
  // dataUrl 形如 "data:image/jpeg;base64,xxxxx"
  static Future<String> uploadFile(String token, String dataUrl) async {
    final res = await _post('/api/upload', {'data': dataUrl}, token);
    return (res as Map<String, dynamic>)['url'] as String;
  }

  // ---------- 2. 跑步计划 ----------

  static Future<List<Plan>> myPlans(String token) async {
    final data = await _get('/api/plans', token) as List<dynamic>;
    return data.map((e) => Plan.fromJson(e as Map<String, dynamic>)).toList();
  }

  // 新建计划：goalType 决定类型，goalData 装该类型的专属参数
  static Future<void> addPlan(
    String token, {
    required String title,
    required double targetKm,
    required int weeks,
    required String startDate,
    required String intensity,
    String note = '',
    String goalType = 'volume',
    Map<String, dynamic> goalData = const {},
  }) async {
    await _post('/api/plans', {
      'title': title,
      'target_km': targetKm,
      'weeks': weeks,
      'start_date': startDate,
      'intensity': intensity,
      'note': note,
      'goal_type': goalType,
      'goal_data': goalData,
    }, token);
  }

  static Future<void> deletePlan(String token, int id) async {
    await _delete('/api/plans/$id', token);
  }

  // N3 课表打卡：切换某周某天的打卡状态，返回 { checked: true/false }
  static Future<bool> togglePlanCheckin(
      String token, int planId, int weekNo, int day) async {
    final res = await _post('/api/plans/$planId/checkins/toggle',
        {'week_no': weekNo, 'day': day}, token);
    return (res as Map<String, dynamic>)['checked'] == true;
  }

  // 修改计划：本人 / 管理员 / 本社社长（社长可改本社社员的计划）
  static Future<void> updatePlan(
    String token,
    int id, {
    required String title,
    required double targetKm,
    required int weeks,
    required String startDate,
    required String intensity,
    String note = '',
    required String goalType,
    Map<String, dynamic> goalData = const {},
  }) async {
    await _put('/api/plans/$id', {
      'title': title,
      'target_km': targetKm,
      'weeks': weeks,
      'start_date': startDate,
      'intensity': intensity,
      'note': note,
      'goal_type': goalType,
      'goal_data': goalData,
    }, token);
  }

  // 计划模板列表（一键套用）
  static Future<List<PlanTemplate>> planTemplates(String token) async {
    final data = await _get('/api/plan-templates', token) as List<dynamic>;
    return data.map((e) => PlanTemplate.fromJson(e as Map<String, dynamic>)).toList();
  }

  // 我的体重记录（升序）
  static Future<List<WeightLog>> myWeights(String token) async {
    final data = await _get('/api/weights', token) as List<dynamic>;
    return data.map((e) => WeightLog.fromJson(e as Map<String, dynamic>)).toList();
  }

  // 记录体重（同一天重复记录 = 覆盖）
  static Future<void> addWeight(String token, String logDate, double weightKg) async {
    await _post('/api/weights', {'log_date': logDate, 'weight_kg': weightKg}, token);
  }

  // ---------- 3. 社团公告 / 任务 / 成员 ----------

  static Future<List<Announcement>> clubAnnouncements(String token) async {
    final data = await _get('/api/club/announcements', token) as List<dynamic>;
    return data.map((e) => Announcement.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> addAnnouncement(String token, String title, String content) async {
    await _post('/api/club/announcements', {'title': title, 'content': content}, token);
  }

  static Future<void> deleteAnnouncement(String token, int id) async {
    await _delete('/api/club/announcements/$id', token);
  }

  static Future<List<ClubTask>> clubTasks(String token) async {
    final data = await _get('/api/club/tasks', token) as List<dynamic>;
    return data.map((e) => ClubTask.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> addClubTask(String token, String title, String content, String deadline) async {
    await _post('/api/club/tasks', {
      'title': title,
      'content': content,
      'deadline': deadline,
    }, token);
  }

  static Future<void> deleteClubTask(String token, int id) async {
    await _delete('/api/club/tasks/$id', token);
  }

  static Future<List<ClubMember>> clubMembers(String token) async {
    final data = await _get('/api/club/members', token) as List<dynamic>;
    return data.map((e) => ClubMember.fromJson(e as Map<String, dynamic>)).toList();
  }

  // 社团名片（所有成员可看）
  static Future<ClubProfile> clubProfile(String token) async {
    final data = await _get('/api/club/profile', token) as Map<String, dynamic>;
    return ClubProfile.fromJson(data);
  }

  // 修改社团名片（社长 / 管理员）
  static Future<void> updateClubProfile(
    String token, {
    required String intro,
    required String trainingTime,
    required String trainingPlace,
    required String contact,
  }) async {
    await _put('/api/club/profile', {
      'intro': intro,
      'training_time': trainingTime,
      'training_place': trainingPlace,
      'contact': contact,
    }, token);
  }

  // 约跑活动列表
  static Future<List<ClubEvent>> clubEvents(String token) async {
    final data = await _get('/api/club/events', token) as List<dynamic>;
    return data.map((e) => ClubEvent.fromJson(e as Map<String, dynamic>)).toList();
  }

  // 发起约跑活动（所有社员都可以）
  // maxParticipants：人数上限，0 表示不限（N6）
  static Future<void> addClubEvent(
    String token, {
    required String title,
    required String eventDate,
    String eventTime = '',
    String place = '',
    String note = '',
    int maxParticipants = 0,
  }) async {
    await _post('/api/club/events', {
      'title': title,
      'event_date': eventDate,
      'event_time': eventTime,
      'place': place,
      'note': note,
      'max_participants': maxParticipants,
    }, token);
  }

  // 删除约跑活动（发起人 / 社长 / 管理员）
  static Future<void> deleteClubEvent(String token, int id) async {
    await _delete('/api/club/events/$id', token);
  }

  // 报名 / 取消报名（返回最新报名状态和人数；满员时后端返回错误）
  static Future<Map<String, dynamic>> toggleEventSignup(String token, int id) async {
    final data = await _post('/api/club/events/$id/signup', {}, token);
    return data as Map<String, dynamic>;
  }

  // 活动签到：对已报名成员打勾 / 取消打勾（仅发起人 / 社长 / 管理员）
  // 返回 { checked: 最新签到状态, checkin_count: 已签到人数 }
  static Future<Map<String, dynamic>> toggleEventCheckin(String token, int eventId, int userId) async {
    final data = await _post('/api/club/events/$eventId/checkin', {'user_id': userId}, token);
    return data as Map<String, dynamic>;
  }

  // 活动签到名单：全部已报名成员 + 是否已签到（仅发起人 / 社长 / 管理员）
  static Future<List<EventCheckinRow>> eventCheckins(String token, int eventId) async {
    final data = await _get('/api/club/events/$eventId/checkins', token) as List<dynamic>;
    return data.map((e) => EventCheckinRow.fromJson((e as Map).cast<String, dynamic>())).toList();
  }

  // ---------- 4. 排行榜 ----------

  // type: week | month | total | club | progress | streak | longest | pb1000 | pb3000 | pb5000 | pb10000 | pb21097 | pb42195
  // scope: club（社团内）| all（总体）
  static Future<List<LeaderboardEntry>> leaderboard(String token, String type, {String scope = 'club'}) async {
    final data = await _get('/api/leaderboard?type=$type&scope=$scope', token) as List<dynamic>;
    return data.map((e) => LeaderboardEntry.fromJson(e as Map<String, dynamic>)).toList();
  }

  // ---------- 5. 个人中心 ----------

  // 修改昵称 / 头像（传 null 表示不修改这个字段）
  static Future<User> updateMe(String token, {String? nickname, String? avatar}) async {
    final body = <String, dynamic>{};
    if (nickname != null) body['nickname'] = nickname;
    if (avatar != null) body['avatar'] = avatar;
    final data = await _put('/api/me', body, token) as Map<String, dynamic>;
    return User.fromJson(data['user'] as Map<String, dynamic>);
  }

  // 我的统计数据：总公里 / 总次数 / PB / 全部记录（画趋势图）
  static Future<MyStats> myStats(String token) async {
    final data = await _get('/api/me/stats', token) as Map<String, dynamic>;
    return MyStats.fromJson(data);
  }

  // ---------- 教练功能（社长看社员 / 静息心率 / 燃脂消耗） ----------

  // 社长查看社员详情：跑步记录 / PB / 训练计划（仅社长/管理员本社成员）
  static Future<Map<String, dynamic>> clubMemberDetail(String token, int memberId) async {
    return await _get('/api/club/members/$memberId/detail', token) as Map<String, dynamic>;
  }

  // 为社员制定计划：for_user_id 指定目标社员（仅社长/管理员本社成员）
  static Future<int> addPlanForUser(String token, {
    required int forUserId,
    required String title,
    required double targetKm,
    required int weeks,
    required String startDate,
    required String intensity,
    String note = '',
    required String goalType,
    Map<String, dynamic> goalData = const {},
  }) async {
    final data = await _post('/api/plans', {
      'for_user_id': forUserId,
      'title': title,
      'target_km': targetKm,
      'weeks': weeks,
      'start_date': startDate,
      'intensity': intensity,
      'note': note,
      'goal_type': goalType,
      'goal_data': goalData,
    }, token) as Map<String, dynamic>;
    return (data['id'] as num).toInt();
  }

  // 记/改某天的静息心率（同一天重复记录 = 覆盖）
  static Future<void> saveHeartRate(String token, String logDate, int heartRate) async {
    await _post('/api/heart-rate', {'log_date': logDate, 'heart_rate': heartRate}, token);
  }

  // 查我的全部静息心率记录（按日期升序，画曲线用）
  static Future<List<Map<String, dynamic>>> myHeartRates(String token) async {
    final data = await _get('/api/heart-rates', token) as List;
    return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  // 燃脂消耗汇总：是否燃脂用户 / 每日 / 每周 / 总 跑步消耗
  static Future<Map<String, dynamic>> myCalories(String token) async {
    return await _get('/api/calories', token) as Map<String, dynamic>;
  }
}
