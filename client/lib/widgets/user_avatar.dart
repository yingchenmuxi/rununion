// ============================================================
// 共享头像组件：
// - 如果头像字段是图片 URL（/uploads/xxx 或 http(s)://...），显示图片
// - 如果是 emoji 字符串，显示 emoji
// - 否则用昵称第一个字 + 按性别配色
// 用法：UserAvatar(avatar: u.avatar, nickname: u.nickname, gender: u.gender)
// ============================================================
import 'package:flutter/material.dart';

import '../config.dart';

class UserAvatar extends StatelessWidget {
  final String avatar; // 图片 URL / emoji / 空字符串（空 = 用昵称）
  final String nickname;
  final String gender; // '男' / '女'
  final double size; // 直径，默认 40

  const UserAvatar({
    super.key,
    required this.avatar,
    required this.nickname,
    this.gender = '男',
    this.size = 40,
  });

  // 判断头像是否是图片地址（相对路径 /uploads/... 或绝对 http(s) URL）
  bool get _isImage {
    final a = avatar.trim();
    return a.startsWith('/uploads/') || a.startsWith('http://') || a.startsWith('https://');
  }

  // 把相对路径拼成完整 URL（绝对 URL 直接返回）
  String get _imageUrl {
    final a = avatar.trim();
    if (a.startsWith('http')) return a;
    return '$kBaseUrl$a';
  }

  @override
  Widget build(BuildContext context) {
    final bgColor = gender == '女' ? Colors.pink.shade100 : Colors.green.shade100;

    // 图片头像：圆形裁剪，加载失败时降级为文字头像
    if (_isImage) {
      return CircleAvatar(
        radius: size / 2,
        backgroundColor: bgColor,
        backgroundImage: NetworkImage(_imageUrl),
        onBackgroundImageError: (_, __) {},
        child: ClipOval(
          child: Image.network(
            _imageUrl,
            width: size,
            height: size,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Center(
              child: Text(
                nickname.isNotEmpty ? nickname.characters.first : '?',
                style: TextStyle(fontSize: size * 0.4),
              ),
            ),
          ),
        ),
      );
    }

    // emoji 或文字头像
    return CircleAvatar(
      radius: size / 2,
      backgroundColor: bgColor,
      child: avatar.isNotEmpty
          ? Text(avatar, style: TextStyle(fontSize: size * 0.55))
          : Text(
              nickname.isNotEmpty ? nickname.characters.first : '?',
              style: TextStyle(fontSize: size * 0.4),
            ),
    );
  }
}
