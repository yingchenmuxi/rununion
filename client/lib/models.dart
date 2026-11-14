// ============================================================
// 数据模型：把后端返回的 JSON 数据转成方便使用的 Dart 对象
// 一共 4 个模型：用户、登录结果、跑步记录、社团成员汇总
// ============================================================

// 用户信息
class User {
  final int id;
  final String nickname;
  final String gender; // '男' 或 '女'
  final String role; // 'member' = 社员 / 'president' = 社长 / 'admin' = 管理员
  final String avatar; // emoji 头像，空字符串 = 用昵称第一个字
  final int? schoolId; // 所在学校编号；null = 无社团用户（社长申请审核中）
  final int? clubId; // 所在社团编号；null = 无社团用户

  User({
    required this.id,
    required this.nickname,
    required this.gender,
    required this.role,
    this.avatar = '',
    this.schoolId,
    this.clubId,
  });

  // 从后端返回的 JSON 构造用户对象
  factory User.fromJson(Map<String, dynamic> j) => User(
        id: (j['id'] as num).toInt(),
        nickname: j['nickname'] as String,
        gender: (j['gender'] ?? '男') as String,
        role: (j['role'] ?? 'member') as String,
        avatar: (j['avatar'] ?? '') as String,
        schoolId: (j['school_id'] as num?)?.toInt(),
        clubId: (j['club_id'] as num?)?.toInt(),
      );

  // 是不是社长（页面上根据这个决定显示什么）
  bool get isPresident => role == 'president';

  // 是否是超级管理员
  bool get isAdmin => role == 'admin';

  // 是否已经加入社团（无社团用户 = 社长申请审核中，社团 tab 显示申请进度）
  bool get hasClub => clubId != null;

  // 转成 JSON（保存到手机本地时用）
  Map<String, dynamic> toJson() => {
        'id': id,
        'nickname': nickname,
        'gender': gender,
        'role': role,
        'avatar': avatar,
        'school_id': schoolId,
        'club_id': clubId,
      };

  // 复制一个新对象，只改个别字段（修改资料后用）
  User copyWith({String? nickname, String? avatar}) => User(
        id: id,
        nickname: nickname ?? this.nickname,
        gender: gender,
        role: role,
        avatar: avatar ?? this.avatar,
        schoolId: schoolId,
        clubId: clubId,
      );
}

// 一条社长申请（社团 tab 展示申请进度 + 管理员后台审批列表用）
class Application {
  final int id;
  final String schoolName; // 申请的学校名称
  final String clubName; // 申请的社团名称（默认"长跑社"）
  final String province;
  final String city;
  final String note; // 申请留言
  final String status; // 'pending' 待审批 / 'approved' 已通过 / 'rejected' 已驳回
  final String rejectReason; // 驳回原因（仅 rejected 时有值）
  final String createdAt;
  final String handledAt;
  // 以下两个字段仅管理员列表接口返回（申请人信息）
  final String nickname;
  final String phone;
  final int userId;

  Application({
    required this.id,
    required this.schoolName,
    required this.clubName,
    this.province = '',
    this.city = '',
    this.note = '',
    required this.status,
    this.rejectReason = '',
    this.createdAt = '',
    this.handledAt = '',
    this.nickname = '',
    this.phone = '',
    this.userId = 0,
  });

  factory Application.fromJson(Map<String, dynamic> j) => Application(
        id: (j['id'] as num).toInt(),
        schoolName: (j['school_name'] ?? '') as String,
        clubName: (j['club_name'] ?? '长跑社') as String,
        province: (j['province'] ?? '') as String,
        city: (j['city'] ?? '') as String,
        note: (j['note'] ?? '') as String,
        status: (j['status'] ?? 'pending') as String,
        rejectReason: (j['reject_reason'] ?? '') as String,
        createdAt: (j['created_at'] ?? '') as String,
        handledAt: (j['handled_at'] ?? '') as String,
        nickname: (j['nickname'] ?? '') as String,
        phone: (j['phone'] ?? '') as String,
        userId: (j['user_id'] as num?)?.toInt() ?? 0,
      );

  bool get isPending => status == 'pending';
  bool get isApproved => status == 'approved';
  bool get isRejected => status == 'rejected';

  // 状态的中文显示
  String get statusText {
    switch (status) {
      case 'approved':
        return '已通过';
      case 'rejected':
        return '已驳回';
      default:
        return '待审批';
    }
  }
}

// 一条社团成员申请（入社 / 退社）
// type = join 申请加入；type = leave 申请退出
class MembershipRequest {
  final int id;
  final int userId;
  final int clubId;
  final String type;
  final String reason; // 申请理由 / 退社原因
  final String status; // pending / approved / rejected / canceled
  final String rejectReason;
  final String createdAt;
  final String handledAt;
  final String clubName;
  final String schoolName;
  // 以下字段仅在社长/管理员审批列表里返回（申请人信息）
  final String nickname;
  final String phone;
  final String gender;
  final String avatar;

  MembershipRequest({
    required this.id,
    this.userId = 0,
    required this.clubId,
    required this.type,
    this.reason = '',
    required this.status,
    this.rejectReason = '',
    this.createdAt = '',
    this.handledAt = '',
    this.clubName = '',
    this.schoolName = '',
    this.nickname = '',
    this.phone = '',
    this.gender = '男',
    this.avatar = '',
  });

  factory MembershipRequest.fromJson(Map<String, dynamic> j) => MembershipRequest(
        id: (j['id'] as num).toInt(),
        userId: (j['user_id'] as num?)?.toInt() ?? 0,
        clubId: (j['club_id'] as num?)?.toInt() ?? 0,
        type: (j['type'] ?? 'join') as String,
        reason: (j['reason'] ?? '') as String,
        status: (j['status'] ?? 'pending') as String,
        rejectReason: (j['reject_reason'] ?? '') as String,
        createdAt: (j['created_at'] ?? '') as String,
        handledAt: (j['handled_at'] ?? '') as String,
        clubName: (j['club_name'] ?? '') as String,
        schoolName: (j['school_name'] ?? '') as String,
        nickname: (j['nickname'] ?? '') as String,
        phone: (j['phone'] ?? '') as String,
        gender: (j['gender'] ?? '男') as String,
        avatar: (j['avatar'] ?? '') as String,
      );

  bool get isPending => status == 'pending';
  bool get isJoin => type == 'join';

  // 类型中文名
  String get typeText => isJoin ? '申请入社' : '申请退社';

  // 状态中文名
  String get statusText {
    switch (status) {
      case 'approved':
        return '已通过';
      case 'rejected':
        return '已驳回';
      case 'canceled':
        return '已撤回';
      default:
        return '待审批';
    }
  }
}

// 我的社团申请进度：最近一条入社申请 + 最近一条退社申请
class MyMembership {
  final MembershipRequest? join;
  final MembershipRequest? leave;

  MyMembership({this.join, this.leave});

  factory MyMembership.fromJson(Map<String, dynamic> j) => MyMembership(
        join: j['join'] == null
            ? null
            : MembershipRequest.fromJson(j['join'] as Map<String, dynamic>),
        leave: j['leave'] == null
            ? null
            : MembershipRequest.fromJson(j['leave'] as Map<String, dynamic>),
      );
}

// 站内通知（消息中心用）
// type: announcement 公告 / task 任务 / event 约跑 /
//       join 入社结果 / leave 退社结果 / president 社长申请结果 / system 系统
class AppNotification {
  final int id;
  final String type;
  final String title;
  final String content;
  final int? clubId;
  final bool isRead;
  final String createdAt;

  AppNotification({
    required this.id,
    this.type = 'system',
    required this.title,
    this.content = '',
    this.clubId,
    this.isRead = false,
    this.createdAt = '',
  });

  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
        id: (j['id'] as num).toInt(),
        type: (j['type'] ?? 'system') as String,
        title: (j['title'] ?? '') as String,
        content: (j['content'] ?? '') as String,
        clubId: (j['club_id'] as num?)?.toInt(),
        isRead: ((j['is_read'] as num?)?.toInt() ?? 0) == 1,
        createdAt: (j['created_at'] ?? '') as String,
      );
}

// 登录（或注册）成功的结果：通行证 + 用户信息
class LoginResult {
  final String token; // 后端发的"通行证"，之后每次请求都要带上
  final User user;

  LoginResult({required this.token, required this.user});
}

// 学校信息（社员注册时从下拉列表选择）
class School {
  final int id;
  final String name; // 学校名称
  final String province; // 所在省
  final String city; // 所在市

  School({
    required this.id,
    required this.name,
    required this.province,
    required this.city,
  });

  factory School.fromJson(Map<String, dynamic> j) => School(
        id: (j['id'] as num).toInt(),
        name: j['name'] as String,
        province: (j['province'] ?? '') as String,
        city: (j['city'] ?? '') as String,
      );

  // 下拉列表里显示的文字，例如"广东省 广州市 - 华师附中"
  String get displayName {
    if (province.isEmpty && city.isEmpty) return name;
    return '$province $city - $name';
  }
}

// 一条跑步记录
class RunRecord {
  final int id;
  final String runDate; // 跑步日期，格式 YYYY-MM-DD
  final double distanceKm; // 距离（公里）
  final int durationSeconds; // 用时（秒）

  RunRecord({
    required this.id,
    required this.runDate,
    required this.distanceKm,
    required this.durationSeconds,
  });

  factory RunRecord.fromJson(Map<String, dynamic> j) => RunRecord(
        id: (j['id'] as num).toInt(),
        runDate: j['run_date'] as String,
        distanceKm: (j['distance_km'] as num).toDouble(),
        durationSeconds: (j['duration_seconds'] as num).toInt(),
      );

  // 把用时显示成"分:秒"，例如 150 秒 -> 2:30
  String get durationText {
    final m = durationSeconds ~/ 60;
    final s = durationSeconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  // 配速 = 每公里用时，例如 26'40"/km
  String get paceText {
    if (distanceKm <= 0) return '-';
    final secPerKm = durationSeconds / distanceKm;
    final m = secPerKm ~/ 60;
    final s = (secPerKm % 60).truncate();
    return "$m'${s.toString().padLeft(2, '0')}\"/km";
  }
}

// 社团总览里"一个社员"的汇总：他的所有记录 + 统计
class MemberSummary {
  final int userId;
  final String nickname;
  final String gender; // '男' 或 '女'
  final double totalKm; // 总公里数
  final int runCount; // 总次数
  final List<RunRecord> records; // 他提交的所有记录

  MemberSummary({
    required this.userId,
    required this.nickname,
    required this.gender,
    required this.totalKm,
    required this.runCount,
    required this.records,
  });

  factory MemberSummary.fromJson(Map<String, dynamic> j) => MemberSummary(
        userId: (j['user_id'] as num).toInt(),
        nickname: j['nickname'] as String,
        gender: (j['gender'] ?? '男') as String,
        totalKm: (j['total_km'] as num).toDouble(),
        runCount: (j['run_count'] as num).toInt(),
        records: (j['records'] as List)
            .map((e) => RunRecord.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

// ============================================================
// 管理员后台相关模型
// ============================================================

// 系统概览：总用户数、总跑步次数、总公里、学校数、社团数、计划数、活动数、文章数、待审批申请数
class AdminOverview {
  final int totalUsers;
  final int totalRuns;
  final double totalKm;
  final int totalSchools;
  final int totalClubs;
  final int totalPlans;
  final int totalEvents;
  final int totalArticles;
  final int pendingApplications; // 待审批的社长申请数（提醒管理员尽快处理）

  AdminOverview({
    required this.totalUsers,
    required this.totalRuns,
    required this.totalKm,
    required this.totalSchools,
    required this.totalClubs,
    required this.totalPlans,
    required this.totalEvents,
    required this.totalArticles,
    this.pendingApplications = 0,
  });

  factory AdminOverview.fromJson(Map<String, dynamic> j) => AdminOverview(
        totalUsers: (j['totalUsers'] as num).toInt(),
        totalRuns: (j['totalRuns'] as num).toInt(),
        totalKm: (j['totalKm'] as num).toDouble(),
        totalSchools: (j['totalSchools'] as num).toInt(),
        totalClubs: (j['totalClubs'] as num?)?.toInt() ?? 0,
        totalPlans: (j['totalPlans'] as num?)?.toInt() ?? 0,
        totalEvents: (j['totalEvents'] as num?)?.toInt() ?? 0,
        totalArticles: (j['totalArticles'] as num?)?.toInt() ?? 0,
        pendingApplications: (j['pendingApplications'] as num?)?.toInt() ?? 0,
      );
}

// ============================================================
// 数据看板（N10）：管理员后台「数据看板」页签的数据模型
// ============================================================

// 折线图数据点：日期 + 数值（新增用户 / 活跃用户趋势通用）
class DashboardPoint {
  final String date; // YYYY-MM-DD
  final double value;

  DashboardPoint({required this.date, required this.value});

  factory DashboardPoint.fromJson(Map<String, dynamic> j, String valueKey) =>
      DashboardPoint(
        date: j['date'] as String? ?? j['week_start'] as String? ?? '',
        value: (j[valueKey] as num?)?.toDouble() ?? 0,
      );
}

// 社团对比条目
class DashboardClubItem {
  final int clubId;
  final String clubName;
  final String schoolName;
  final int members;
  final double km;

  DashboardClubItem({
    required this.clubId,
    required this.clubName,
    required this.schoolName,
    required this.members,
    required this.km,
  });

  factory DashboardClubItem.fromJson(Map<String, dynamic> j) => DashboardClubItem(
        clubId: (j['club_id'] as num).toInt(),
        clubName: j['club_name'] as String? ?? '',
        schoolName: j['school_name'] as String? ?? '',
        members: (j['members'] as num?)?.toInt() ?? 0,
        km: (j['km'] as num?)?.toDouble() ?? 0,
      );
}

// 分布条目（角色分布 / 计划状态分布通用）：标签 + 数量
class DashboardSlice {
  final String label;
  final int count;

  DashboardSlice({required this.label, required this.count});

  factory DashboardSlice.fromJson(Map<String, dynamic> j, String labelKey) =>
      DashboardSlice(
        label: j[labelKey] as String? ?? '',
        count: (j['count'] as num?)?.toInt() ?? 0,
      );
}

// 数据看板整体
class AdminDashboard {
  final List<DashboardPoint> newUsersTrend;    // 近 30 天新增用户
  final List<DashboardPoint> activeUsersTrend; // 近 30 天活跃用户
  final List<DashboardPoint> weeklyKmTrend;    // 近 12 周跑量
  final List<DashboardClubItem> clubComparison; // 社团跑量 TOP10
  final List<DashboardSlice> roleDistribution; // 角色分布
  final List<DashboardSlice> planStatusDistribution; // 计划状态分布
  final int todayNewUsers;
  final int todayRuns;
  final int weekActiveUsers;
  final double avgKmPerUser;

  AdminDashboard({
    required this.newUsersTrend,
    required this.activeUsersTrend,
    required this.weeklyKmTrend,
    required this.clubComparison,
    required this.roleDistribution,
    required this.planStatusDistribution,
    required this.todayNewUsers,
    required this.todayRuns,
    required this.weekActiveUsers,
    required this.avgKmPerUser,
  });

  factory AdminDashboard.fromJson(Map<String, dynamic> j) {
    final extra = j['extra'] as Map<String, dynamic>? ?? {};
    return AdminDashboard(
      newUsersTrend: [
        for (final e in (j['new_users_trend'] as List? ?? []))
          DashboardPoint.fromJson(e as Map<String, dynamic>, 'count'),
      ],
      activeUsersTrend: [
        for (final e in (j['active_users_trend'] as List? ?? []))
          DashboardPoint.fromJson(e as Map<String, dynamic>, 'count'),
      ],
      weeklyKmTrend: [
        for (final e in (j['weekly_km_trend'] as List? ?? []))
          DashboardPoint.fromJson(e as Map<String, dynamic>, 'km'),
      ],
      clubComparison: [
        for (final e in (j['club_comparison'] as List? ?? []))
          DashboardClubItem.fromJson(e as Map<String, dynamic>),
      ],
      roleDistribution: [
        for (final e in (j['role_distribution'] as List? ?? []))
          DashboardSlice.fromJson(e as Map<String, dynamic>, 'role'),
      ],
      planStatusDistribution: [
        for (final e in (j['plan_status_distribution'] as List? ?? []))
          DashboardSlice.fromJson(e as Map<String, dynamic>, 'status'),
      ],
      todayNewUsers: (extra['today_new_users'] as num?)?.toInt() ?? 0,
      todayRuns: (extra['today_runs'] as num?)?.toInt() ?? 0,
      weekActiveUsers: (extra['week_active_users'] as num?)?.toInt() ?? 0,
      avgKmPerUser: (extra['avg_km_per_user'] as num?)?.toDouble() ?? 0,
    );
  }
}

// 管理员看到的一条用户信息
class AdminUser {
  final int id;
  final String phone;
  final String nickname;
  final String gender;
  final String role;
  final int? schoolId; // null = 无社团用户
  final int? clubId; // null = 无社团用户
  final String schoolName;
  final String clubName;
  final String avatar;
  final String createdAt;
  final String deletedAt; // 非空 = 在回收站里（软删除）
  final int runCount;
  final double totalKm;

  AdminUser({
    required this.id,
    required this.phone,
    required this.nickname,
    required this.gender,
    required this.role,
    this.schoolId,
    this.clubId,
    required this.schoolName,
    required this.clubName,
    required this.avatar,
    required this.createdAt,
    this.deletedAt = '',
    required this.runCount,
    required this.totalKm,
  });

  factory AdminUser.fromJson(Map<String, dynamic> j) => AdminUser(
        id: (j['id'] as num).toInt(),
        phone: (j['phone'] ?? '') as String,
        nickname: (j['nickname'] ?? '') as String,
        gender: (j['gender'] ?? '男') as String,
        role: (j['role'] ?? 'member') as String,
        schoolId: (j['school_id'] as num?)?.toInt(),
        clubId: (j['club_id'] as num?)?.toInt(),
        schoolName: (j['school_name'] ?? '') as String,
        clubName: (j['club_name'] ?? '') as String,
        avatar: (j['avatar'] ?? '') as String,
        createdAt: (j['created_at'] ?? '') as String,
        deletedAt: (j['deleted_at'] ?? '') as String,
        runCount: (j['run_count'] as num?)?.toInt() ?? 0,
        totalKm: (j['total_km'] as num?)?.toDouble() ?? 0,
      );

  // 是否在回收站（已被软删除）
  bool get isDeleted => deletedAt.isNotEmpty;

  // 角色显示用中文
  String get roleText {
    switch (role) {
      case 'admin':
        return '管理员';
      case 'president':
        return '社长';
      default:
        return '社员';
    }
  }
}

// 管理员看到的一条跑步记录
class AdminRun {
  final int id;
  final String runDate;
  final double distanceKm;
  final int durationSeconds;
  final String nickname;
  final String phone;
  final String schoolName;
  final String clubName;

  AdminRun({
    required this.id,
    required this.runDate,
    required this.distanceKm,
    required this.durationSeconds,
    required this.nickname,
    required this.phone,
    required this.schoolName,
    required this.clubName,
  });

  factory AdminRun.fromJson(Map<String, dynamic> j) => AdminRun(
        id: (j['id'] as num).toInt(),
        runDate: j['run_date'] as String,
        distanceKm: (j['distance_km'] as num).toDouble(),
        durationSeconds: (j['duration_seconds'] as num).toInt(),
        nickname: (j['nickname'] ?? '') as String,
        phone: (j['phone'] ?? '') as String,
        schoolName: (j['school_name'] ?? '') as String,
        clubName: (j['club_name'] ?? '') as String,
      );

  String get durationText {
    final m = durationSeconds ~/ 60;
    final s = durationSeconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  String get paceText {
    if (distanceKm <= 0) return '-';
    final secPerKm = durationSeconds / distanceKm;
    final m = secPerKm ~/ 60;
    final s = (secPerKm % 60).truncate();
    return "$m'${s.toString().padLeft(2, '0')}\"/km";
  }
}

// 管理员看到的一条训练计划
class AdminPlan {
  final int id;
  final int userId;
  final String ownerNickname;
  final String ownerPhone;
  final String clubName;
  final String title;
  final String goalType; // volume/speed/habit/race/weight
  final double targetKm;
  final int weeks;
  final String startDate;
  final String intensity;
  final String note;
  final String createdAt;

  AdminPlan({
    required this.id,
    required this.userId,
    required this.ownerNickname,
    required this.ownerPhone,
    required this.clubName,
    required this.title,
    required this.goalType,
    required this.targetKm,
    required this.weeks,
    required this.startDate,
    required this.intensity,
    required this.note,
    required this.createdAt,
  });

  factory AdminPlan.fromJson(Map<String, dynamic> j) => AdminPlan(
        id: (j['id'] as num).toInt(),
        userId: (j['user_id'] as num).toInt(),
        ownerNickname: (j['owner_nickname'] ?? '') as String,
        ownerPhone: (j['owner_phone'] ?? '') as String,
        clubName: (j['club_name'] ?? '') as String,
        title: (j['title'] ?? '') as String,
        goalType: (j['goal_type'] ?? 'volume') as String,
        targetKm: (j['target_km'] as num?)?.toDouble() ?? 0,
        weeks: (j['weeks'] as num?)?.toInt() ?? 0,
        startDate: (j['start_date'] ?? '') as String,
        intensity: (j['intensity'] ?? '中等') as String,
        note: (j['note'] ?? '') as String,
        createdAt: (j['created_at'] ?? '') as String,
      );

  String get goalTypeText {
    switch (goalType) {
      case 'volume': return '跑量目标';
      case 'speed': return '速度目标';
      case 'habit': return '习惯养成';
      case 'race': return '赛事备赛';
      case 'weight': return '体重目标';
      default: return goalType;
    }
  }
}

// 管理员看到的一条学校
class AdminSchool {
  final int id;
  final String name;
  final String province;
  final String city;
  final String createdAt;
  final int clubCount;
  final int userCount;

  AdminSchool({
    required this.id,
    required this.name,
    required this.province,
    required this.city,
    required this.createdAt,
    required this.clubCount,
    required this.userCount,
  });

  factory AdminSchool.fromJson(Map<String, dynamic> j) => AdminSchool(
        id: (j['id'] as num).toInt(),
        name: (j['name'] ?? '') as String,
        province: (j['province'] ?? '') as String,
        city: (j['city'] ?? '') as String,
        createdAt: (j['created_at'] ?? '') as String,
        clubCount: (j['club_count'] as num?)?.toInt() ?? 0,
        userCount: (j['user_count'] as num?)?.toInt() ?? 0,
      );
}

// 管理员看到的一条社团
class AdminClub {
  final int id;
  final int schoolId;
  final String name;
  final String schoolName;
  final String intro;
  final String trainingTime;
  final String trainingPlace;
  final String contact;
  final int memberCount;
  final int eventCount;
  final int? presidentId; // 当前社长用户 id；null = 该社团还没有社长
  final String presidentNickname; // 社长昵称（列表上优先展示）

  AdminClub({
    required this.id,
    required this.schoolId,
    required this.name,
    required this.schoolName,
    required this.intro,
    required this.trainingTime,
    required this.trainingPlace,
    required this.contact,
    required this.memberCount,
    required this.eventCount,
    this.presidentId,
    this.presidentNickname = '',
  });

  factory AdminClub.fromJson(Map<String, dynamic> j) => AdminClub(
        id: (j['id'] as num).toInt(),
        schoolId: (j['school_id'] as num).toInt(),
        name: (j['name'] ?? '') as String,
        schoolName: (j['school_name'] ?? '') as String,
        intro: (j['intro'] ?? '') as String,
        trainingTime: (j['training_time'] ?? '') as String,
        trainingPlace: (j['training_place'] ?? '') as String,
        contact: (j['contact'] ?? '') as String,
        memberCount: (j['member_count'] as num?)?.toInt() ?? 0,
        eventCount: (j['event_count'] as num?)?.toInt() ?? 0,
        presidentId: (j['president_id'] as num?)?.toInt(),
        presidentNickname: (j['president_nickname'] ?? '') as String,
      );
}

// 管理员看到的一条公告
class AdminAnnouncement {
  final int id;
  final int clubId;
  final String title;
  final String content;
  final String clubName;
  final String authorNickname;
  final String createdAt;

  AdminAnnouncement({
    required this.id,
    required this.clubId,
    required this.title,
    required this.content,
    required this.clubName,
    required this.authorNickname,
    required this.createdAt,
  });

  factory AdminAnnouncement.fromJson(Map<String, dynamic> j) => AdminAnnouncement(
        id: (j['id'] as num).toInt(),
        clubId: (j['club_id'] as num?)?.toInt() ?? 0,
        title: (j['title'] ?? '') as String,
        content: (j['content'] ?? '') as String,
        clubName: (j['club_name'] ?? '') as String,
        authorNickname: (j['author_nickname'] ?? '') as String,
        createdAt: (j['created_at'] ?? '') as String,
      );
}

// 管理员看到的一条任务
class AdminTask {
  final int id;
  final int clubId;
  final String title;
  final String content;
  final String deadline;
  final String clubName;
  final String authorNickname;
  final String createdAt;

  AdminTask({
    required this.id,
    required this.clubId,
    required this.title,
    required this.content,
    required this.deadline,
    required this.clubName,
    required this.authorNickname,
    required this.createdAt,
  });

  factory AdminTask.fromJson(Map<String, dynamic> j) => AdminTask(
        id: (j['id'] as num).toInt(),
        clubId: (j['club_id'] as num?)?.toInt() ?? 0,
        title: (j['title'] ?? '') as String,
        content: (j['content'] ?? '') as String,
        deadline: (j['deadline'] ?? '') as String,
        clubName: (j['club_name'] ?? '') as String,
        authorNickname: (j['author_nickname'] ?? '') as String,
        createdAt: (j['created_at'] ?? '') as String,
      );
}

// 管理员看到的一条约跑活动
class AdminEvent {
  final int id;
  final int clubId;
  final String title;
  final String eventDate;
  final String eventTime;
  final String place;
  final String note;
  final String clubName;
  final String authorNickname;
  final int signupCount;
  final int maxParticipants; // 人数上限，0=不限（N6）
  final int checkinCount;    // 已签到人数（N6）

  AdminEvent({
    required this.id,
    required this.clubId,
    required this.title,
    required this.eventDate,
    required this.eventTime,
    required this.place,
    required this.note,
    required this.clubName,
    required this.authorNickname,
    required this.signupCount,
    this.maxParticipants = 0,
    this.checkinCount = 0,
  });

  factory AdminEvent.fromJson(Map<String, dynamic> j) => AdminEvent(
        id: (j['id'] as num).toInt(),
        clubId: (j['club_id'] as num?)?.toInt() ?? 0,
        title: (j['title'] ?? '') as String,
        eventDate: (j['event_date'] ?? '') as String,
        eventTime: (j['event_time'] ?? '') as String,
        place: (j['place'] ?? '') as String,
        note: (j['note'] ?? '') as String,
        clubName: (j['club_name'] ?? '') as String,
        authorNickname: (j['author_nickname'] ?? '') as String,
        signupCount: (j['signup_count'] as num?)?.toInt() ?? 0,
        maxParticipants: (j['max_participants'] as num?)?.toInt() ?? 0,
        checkinCount: (j['checkin_count'] as num?)?.toInt() ?? 0,
      );
}

// ============================================================
// 6 大功能模块新增模型
// ============================================================

// 一篇跑步知识文章
class Article {
  final int id;
  final String category; // 分类：跑前准备 / 动作标准 / 伤病预防 / 训练计划 / 装备选择 / 营养恢复
  final String title;
  final String summary; // 摘要（列表卡片显示）
  final String content; // 完整内容
  final String tags; // 标签，逗号分隔（用于搜索）
  final String imageUrl; // 封面图 URL，可为空
  final String attachmentUrl; // 附件 URL（PDF/文档），可为空
  final String createdAt;

  Article({
    required this.id,
    required this.category,
    required this.title,
    required this.summary,
    required this.content,
    required this.tags,
    required this.imageUrl,
    required this.attachmentUrl,
    required this.createdAt,
  });

  factory Article.fromJson(Map<String, dynamic> j) => Article(
        id: (j['id'] as num).toInt(),
        category: (j['category'] ?? '基础知识') as String,
        title: j['title'] as String,
        summary: (j['summary'] ?? '') as String,
        content: j['content'] as String,
        tags: (j['tags'] ?? '') as String,
        imageUrl: (j['image_url'] ?? '') as String,
        attachmentUrl: (j['attachment_url'] ?? '') as String,
        createdAt: (j['created_at'] ?? '') as String,
      );

  // 估算阅读时长（中文按 400 字/分钟）
  int get readingMinutes {
    final chars = content.length;
    return (chars / 400).ceil().clamp(1, 99);
  }

  // 标签列表
  List<String> get tagList =>
      tags.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
}

// 一条跑步计划
class Plan {
  final int id;
  final String title; // 计划名称
  final double targetKm; // 目标跑量（km）；speed=目标距离；weight=0
  final int weeks; // 周期（周）
  final String startDate; // 开始日期 YYYY-MM-DD
  final String intensity; // 强度：低 / 中等 / 高
  final String note; // 备注
  final String goalType; // volume 跑量 / speed 速度 / habit 习惯 / race 赛事 / weight 体重
  final Map<String, dynamic> goalData; // 类型专属参数（周课表、目标成绩等）
  final String status; // pending 未开始 / active 进行中 / achieved 已达成 / expired 已逾期
  final int percent; // 进度百分比 0-100
  final String statLine; // 一句话进度（后端算好）
  final String endDate; // 计划最后一天
  final Map<String, dynamic> extra; // 附加数据（连胜、倒计时、体重曲线等）
  // N3：课表打卡记录，格式 "week_no-day"（例："3-1" = 第3周周一）
  final List<String> checkins;

  Plan({
    required this.id,
    required this.title,
    required this.targetKm,
    required this.weeks,
    required this.startDate,
    required this.intensity,
    required this.note,
    required this.goalType,
    required this.goalData,
    required this.status,
    required this.percent,
    required this.statLine,
    required this.endDate,
    required this.extra,
    this.checkins = const [],
  });

  factory Plan.fromJson(Map<String, dynamic> j) => Plan(
        id: (j['id'] as num).toInt(),
        title: j['title'] as String,
        targetKm: (j['target_km'] as num?)?.toDouble() ?? 0,
        weeks: (j['weeks'] as num).toInt(),
        startDate: j['start_date'] as String,
        intensity: (j['intensity'] ?? '中等') as String,
        note: (j['note'] ?? '') as String,
        goalType: (j['goal_type'] ?? 'volume') as String,
        goalData: (j['goal_data'] ?? {}) as Map<String, dynamic>,
        status: (j['status'] ?? 'active') as String,
        percent: (j['percent'] ?? 0) as int,
        statLine: (j['stat_line'] ?? '') as String,
        endDate: (j['end_date'] ?? '') as String,
        extra: (j['extra'] ?? {}) as Map<String, dynamic>,
        checkins: ((j['checkins'] ?? []) as List).map((e) => e.toString()).toList(),
      );
}

// 计划模板（一键套用）
class PlanTemplate {
  final int id;
  final String title;
  final String description;
  final String goalType;
  final Map<String, dynamic> goalData;
  final int weeks;
  final double targetKm;
  final String intensity;
  final String note;

  PlanTemplate({
    required this.id,
    required this.title,
    required this.description,
    required this.goalType,
    required this.goalData,
    required this.weeks,
    required this.targetKm,
    required this.intensity,
    required this.note,
  });

  factory PlanTemplate.fromJson(Map<String, dynamic> j) => PlanTemplate(
        id: (j['id'] as num).toInt(),
        title: j['title'] as String,
        description: (j['description'] ?? '') as String,
        goalType: (j['goal_type'] ?? 'volume') as String,
        goalData: (j['goal_data'] ?? {}) as Map<String, dynamic>,
        weeks: (j['weeks'] as num?)?.toInt() ?? 4,
        targetKm: (j['target_km'] as num?)?.toDouble() ?? 0,
        intensity: (j['intensity'] ?? '中等') as String,
        note: (j['note'] ?? '') as String,
      );
}

// 一条体重记录
class WeightLog {
  final String logDate; // YYYY-MM-DD
  final double weightKg;

  WeightLog({required this.logDate, required this.weightKg});

  factory WeightLog.fromJson(Map<String, dynamic> j) => WeightLog(
        logDate: j['log_date'] as String,
        weightKg: (j['weight_kg'] as num).toDouble(),
      );
}

// 一条社团公告
class Announcement {
  final int id;
  final String title;
  final String content;
  final String createdAt;
  final String authorNickname;
  final String authorAvatar;

  Announcement({
    required this.id,
    required this.title,
    required this.content,
    required this.createdAt,
    required this.authorNickname,
    required this.authorAvatar,
  });

  factory Announcement.fromJson(Map<String, dynamic> j) => Announcement(
        id: (j['id'] as num).toInt(),
        title: j['title'] as String,
        content: j['content'] as String,
        createdAt: (j['created_at'] ?? '') as String,
        authorNickname: (j['author_nickname'] ?? '') as String,
        authorAvatar: (j['author_avatar'] ?? '') as String,
      );
}

// 一条社团任务
class ClubTask {
  final int id;
  final String title;
  final String content;
  final String deadline; // 截止日期，可空
  final String createdAt;
  final String authorNickname;
  final String authorAvatar;

  ClubTask({
    required this.id,
    required this.title,
    required this.content,
    required this.deadline,
    required this.createdAt,
    required this.authorNickname,
    required this.authorAvatar,
  });

  factory ClubTask.fromJson(Map<String, dynamic> j) => ClubTask(
        id: (j['id'] as num).toInt(),
        title: j['title'] as String,
        content: j['content'] as String,
        deadline: (j['deadline'] ?? '') as String,
        createdAt: (j['created_at'] ?? '') as String,
        authorNickname: (j['author_nickname'] ?? '') as String,
        authorAvatar: (j['author_avatar'] ?? '') as String,
      );
}

// 一个社团成员（用于成员互动页）
// 普通社员只会拿到名单字段；社长/管理员额外拿到跑量与计划状态字段
class ClubMember {
  final int id;
  final String nickname;
  final String gender;
  final String role;
  final String avatar;
  final int runCount;
  final double totalKm;
  // ---------- 以下字段仅社长/管理员可见 ----------
  final double weekKm; // 本周跑量
  final String lastRunDate; // 最近一次跑步日期
  final int? daysSinceLast; // 距今天数（null=从没跑过）
  final String planState; // no_plan 无计划 / active 进行中 / expired 逾期未达成
  final String planTitle; // 当前展示的代表计划名称
  final int progress; // 代表计划进度 0-100
  final int expiredDays; // 逾期天数（planState=expired 时有意义）
  final int achievedCount; // 累计已达成计划数（激励徽章）

  ClubMember({
    required this.id,
    required this.nickname,
    required this.gender,
    required this.role,
    required this.avatar,
    required this.runCount,
    required this.totalKm,
    this.weekKm = 0,
    this.lastRunDate = '',
    this.daysSinceLast,
    this.planState = 'no_plan',
    this.planTitle = '',
    this.progress = 0,
    this.expiredDays = 0,
    this.achievedCount = 0,
  });

  factory ClubMember.fromJson(Map<String, dynamic> j) => ClubMember(
        id: (j['id'] as num).toInt(),
        nickname: j['nickname'] as String,
        gender: (j['gender'] ?? '男') as String,
        role: (j['role'] ?? 'member') as String,
        avatar: (j['avatar'] ?? '') as String,
        runCount: ((j['run_count'] ?? 0) as num).toInt(),
        totalKm: ((j['total_km'] ?? 0) as num).toDouble(),
        weekKm: ((j['week_km'] ?? 0) as num).toDouble(),
        lastRunDate: (j['last_run_date'] ?? '') as String,
        daysSinceLast: j['days_since_last'] == null ? null : (j['days_since_last'] as num).toInt(),
        planState: (j['plan_state'] ?? 'no_plan') as String,
        planTitle: (j['plan_title'] ?? '') as String,
        progress: ((j['progress'] ?? 0) as num).toInt(),
        expiredDays: ((j['expired_days'] ?? 0) as num).toInt(),
        achievedCount: ((j['achieved_count'] ?? 0) as num).toInt(),
      );

  String get roleText {
    switch (role) {
      case 'admin':
        return '管理员';
      case 'president':
        return '社长';
      default:
        return '社员';
    }
  }
}

// 社团名片（简介 / 训练时间 / 训练地点 / 联系方式）
class ClubProfile {
  final String name;
  final String schoolName;
  final String intro;
  final String trainingTime;
  final String trainingPlace;
  final String contact;
  final int memberCount;

  ClubProfile({
    required this.name,
    required this.schoolName,
    required this.intro,
    required this.trainingTime,
    required this.trainingPlace,
    required this.contact,
    required this.memberCount,
  });

  factory ClubProfile.fromJson(Map<String, dynamic> j) => ClubProfile(
        name: (j['name'] ?? '') as String,
        schoolName: (j['school_name'] ?? '') as String,
        intro: (j['intro'] ?? '') as String,
        trainingTime: (j['training_time'] ?? '') as String,
        trainingPlace: (j['training_place'] ?? '') as String,
        contact: (j['contact'] ?? '') as String,
        memberCount: ((j['member_count'] ?? 0) as num).toInt(),
      );
}

// 一场约跑活动
class ClubEvent {
  final int id;
  final int userId; // 发起人 id
  final String title;
  final String eventDate; // YYYY-MM-DD
  final String eventTime; // HH:MM，可空
  final String place;
  final String note;
  final String authorNickname;
  final String authorAvatar;
  final int signupCount;
  final bool signed; // 我是否已报名
  final int maxParticipants; // 人数上限，0 = 不限（N6）
  final int checkinCount;    // 已签到人数（N6）
  final bool checked;        // 我是否已被签到（N6）

  ClubEvent({
    required this.id,
    required this.userId,
    required this.title,
    required this.eventDate,
    required this.eventTime,
    required this.place,
    required this.note,
    required this.authorNickname,
    required this.authorAvatar,
    required this.signupCount,
    required this.signed,
    this.maxParticipants = 0,
    this.checkinCount = 0,
    this.checked = false,
  });

  factory ClubEvent.fromJson(Map<String, dynamic> j) => ClubEvent(
        id: (j['id'] as num).toInt(),
        userId: ((j['user_id'] ?? 0) as num).toInt(),
        title: (j['title'] ?? '') as String,
        eventDate: (j['event_date'] ?? '') as String,
        eventTime: (j['event_time'] ?? '') as String,
        place: (j['place'] ?? '') as String,
        note: (j['note'] ?? '') as String,
        authorNickname: (j['author_nickname'] ?? '') as String,
        authorAvatar: (j['author_avatar'] ?? '') as String,
        signupCount: ((j['signup_count'] ?? 0) as num).toInt(),
        signed: j['signed'] == true || j['signed'] == 1,
        maxParticipants: ((j['max_participants'] ?? 0) as num).toInt(),
        checkinCount: ((j['checkin_count'] ?? 0) as num).toInt(),
        checked: j['checked'] == true || j['checked'] == 1,
      );

  // 日期 + 时间显示
  String get timeText => eventTime.isEmpty ? eventDate : '$eventDate $eventTime';

  // 是否已结束（日期早于今天）
  bool get isPast {
    final now = DateTime.now();
    final today = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    return eventDate.compareTo(today) < 0;
  }

  // 是否报名已满（未设上限时永不视为已满）
  bool get isFull => maxParticipants > 0 && signupCount >= maxParticipants;
}

// 活动签到名单里的一行（N6：仅发起人/社长/管理员可见）
class EventCheckinRow {
  final int userId;
  final String nickname;
  final String avatar;
  final bool checked; // 是否已签到

  EventCheckinRow({
    required this.userId,
    required this.nickname,
    required this.avatar,
    required this.checked,
  });

  factory EventCheckinRow.fromJson(Map<String, dynamic> j) => EventCheckinRow(
        userId: ((j['id'] ?? 0) as num).toInt(),
        nickname: (j['nickname'] ?? '') as String,
        avatar: (j['avatar'] ?? '') as String,
        checked: j['checked'] == true || j['checked'] == 1,
      );
}

// 排行榜上的一条记录
// 不同榜单的 value 含义不同：
//   total / week  → 累计公里数
//   pb1000/5000/21097 → 用时（秒）
class LeaderboardEntry {
  final int userId;
  final String nickname;
  final String gender;
  final String avatar;
  final double value; // 公里数 / 用时秒 / 连续天数 / 增长公里数
  final int runCount; // 跑量类榜：跑步次数；其他榜：无用
  final String runDate; // PB/最长距离榜：达成那天的日期；打卡榜：最近打卡日期
  final String detail; // 附加说明（进步之星："本周 8.5 km · 上周 5.0 km"；社团榜："长跑社 · 12 名成员"）
  final bool isMine; // 社团榜：这条是不是我所在的社团

  LeaderboardEntry({
    required this.userId,
    required this.nickname,
    required this.gender,
    required this.avatar,
    required this.value,
    this.runCount = 0,
    this.runDate = '',
    this.detail = '',
    this.isMine = false,
  });

  factory LeaderboardEntry.fromJson(Map<String, dynamic> j) => LeaderboardEntry(
        userId: (j['user_id'] as num).toInt(),
        nickname: j['nickname'] as String,
        gender: (j['gender'] ?? '男') as String,
        avatar: (j['avatar'] ?? '') as String,
        value: (j['value'] as num).toDouble(),
        runCount: ((j['run_count'] ?? 0) as num).toInt(),
        runDate: (j['run_date'] ?? '') as String,
        detail: (j['detail'] ?? '') as String,
        isMine: j['is_mine'] == true || j['is_mine'] == 1,
      );
}

// 我的统计数据（个人中心顶部用）
class MyStats {
  final int runCount;
  final double totalKm;
  final int? pb1000; // 秒，null = 还没记录
  final int? pb3000;
  final int? pb5000;
  final int? pb10000;
  final int? pb21097;
  final int? pb42195;
  final List<RunRecord> runs; // 按时间升序，画趋势图用

  MyStats({
    required this.runCount,
    required this.totalKm,
    required this.pb1000,
    required this.pb3000,
    required this.pb5000,
    required this.pb10000,
    required this.pb21097,
    required this.pb42195,
    required this.runs,
  });

  factory MyStats.fromJson(Map<String, dynamic> j) => MyStats(
        runCount: (j['run_count'] as num).toInt(),
        totalKm: (j['total_km'] as num).toDouble(),
        pb1000: j['pb_1000'] == null ? null : (j['pb_1000'] as num).toInt(),
        pb3000: j['pb_3000'] == null ? null : (j['pb_3000'] as num).toInt(),
        pb5000: j['pb_5000'] == null ? null : (j['pb_5000'] as num).toInt(),
        pb10000: j['pb_10000'] == null ? null : (j['pb_10000'] as num).toInt(),
        pb21097: j['pb_21097'] == null ? null : (j['pb_21097'] as num).toInt(),
        pb42195: j['pb_42195'] == null ? null : (j['pb_42195'] as num).toInt(),
        runs: (j['runs'] as List)
            .map((e) => RunRecord.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

// 一条"本地暂存、还没上传"的跑步记录（记录页离线队列用）
class PendingRun {
  final String runDate;
  final double distanceKm;
  final int durationSeconds;
  final int savedAt; // 保存时的时间戳（毫秒），用于显示

  PendingRun({
    required this.runDate,
    required this.distanceKm,
    required this.durationSeconds,
    required this.savedAt,
  });

  factory PendingRun.fromJson(Map<String, dynamic> j) => PendingRun(
        runDate: j['run_date'] as String,
        distanceKm: (j['distance_km'] as num).toDouble(),
        durationSeconds: (j['duration_seconds'] as num).toInt(),
        savedAt: (j['saved_at'] as num).toInt(),
      );

  Map<String, dynamic> toJson() => {
        'run_date': runDate,
        'distance_km': distanceKm,
        'duration_seconds': durationSeconds,
        'saved_at': savedAt,
      };

  String get durationText {
    final m = durationSeconds ~/ 60;
    final s = durationSeconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }
}

// 一条跑步记录的详细数据（心率/触地时间/垂直振幅/步幅/步频）
// 所有指标都可空——填几个算几个
class RunDetail {
  final int id;
  final int runId; // 关联的跑步记录 id
  final int? heartRate; // 心率（次/分）
  final int? groundContactMs; // 触地时间（毫秒）
  final double? verticalOscillationCm; // 垂直振幅（厘米）
  final double? strideLengthCm; // 步幅（厘米）
  final int? cadenceSpm; // 步频（步/分钟）
  final String updatedAt;

  RunDetail({
    required this.id,
    required this.runId,
    this.heartRate,
    this.groundContactMs,
    this.verticalOscillationCm,
    this.strideLengthCm,
    this.cadenceSpm,
    required this.updatedAt,
  });

  factory RunDetail.fromJson(Map<String, dynamic> j) => RunDetail(
        id: (j['id'] as num).toInt(),
        runId: (j['run_id'] as num).toInt(),
        heartRate: j['heart_rate'] == null ? null : (j['heart_rate'] as num).toInt(),
        groundContactMs: j['ground_contact_ms'] == null ? null : (j['ground_contact_ms'] as num).toInt(),
        verticalOscillationCm: j['vertical_oscillation_cm'] == null ? null : (j['vertical_oscillation_cm'] as num).toDouble(),
        strideLengthCm: j['stride_length_cm'] == null ? null : (j['stride_length_cm'] as num).toDouble(),
        cadenceSpm: j['cadence_spm'] == null ? null : (j['cadence_spm'] as num).toInt(),
        updatedAt: (j['updated_at'] ?? '') as String,
      );

  // 有没有任何一项数据
  bool get hasAny =>
      heartRate != null ||
      groundContactMs != null ||
      verticalOscillationCm != null ||
      strideLengthCm != null ||
      cadenceSpm != null;
}

// 可加入的社团（无社团用户在社团页浏览 / 报名加入时用）
class OpenClub {
  final int id;
  final String name;
  final String schoolName;
  final String intro;
  final String trainingTime;
  final String trainingPlace;
  final String contact;
  final int memberCount;

  OpenClub({
    required this.id,
    required this.name,
    this.schoolName = '',
    this.intro = '',
    this.trainingTime = '',
    this.trainingPlace = '',
    this.contact = '',
    this.memberCount = 0,
  });

  factory OpenClub.fromJson(Map<String, dynamic> j) => OpenClub(
        id: (j['id'] as num).toInt(),
        name: (j['name'] ?? '') as String,
        schoolName: (j['school_name'] ?? '') as String,
        intro: (j['intro'] ?? '') as String,
        trainingTime: (j['training_time'] ?? '') as String,
        trainingPlace: (j['training_place'] ?? '') as String,
        contact: (j['contact'] ?? '') as String,
        memberCount: (j['member_count'] as num?)?.toInt() ?? 0,
      );
}

// ============================================================
// 全员沟通（广播）：管理员发的全员消息 + 用户回复
// ============================================================

// 一条全员消息
class Broadcast {
  final int id;
  final String title;
  final String content;
  final String createdAt;
  final String adminNickname; // 发布管理员昵称
  final int replyCount; // 回复数

  Broadcast({
    required this.id,
    required this.title,
    required this.content,
    required this.createdAt,
    this.adminNickname = '',
    this.replyCount = 0,
  });

  factory Broadcast.fromJson(Map<String, dynamic> j) => Broadcast(
        id: (j['id'] as num).toInt(),
        title: (j['title'] ?? '') as String,
        content: (j['content'] ?? '') as String,
        createdAt: (j['created_at'] ?? '') as String,
        adminNickname: (j['admin_nickname'] ?? '') as String,
        replyCount: (j['reply_count'] as num?)?.toInt() ?? 0,
      );
}

// 一条消息的回复
class BroadcastReply {
  final int id;
  final String content;
  final String createdAt;
  final String userNickname;
  final String userAvatar;

  BroadcastReply({
    required this.id,
    required this.content,
    required this.createdAt,
    this.userNickname = '',
    this.userAvatar = '',
  });

  factory BroadcastReply.fromJson(Map<String, dynamic> j) => BroadcastReply(
        id: (j['id'] as num).toInt(),
        content: (j['content'] ?? '') as String,
        createdAt: (j['created_at'] ?? '') as String,
        userNickname: (j['user_nickname'] ?? '') as String,
        userAvatar: (j['user_avatar'] ?? '') as String,
      );
}
