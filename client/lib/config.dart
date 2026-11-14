// ============================================================
// 全局配置：后端服务器地址
//
// 本项目有【两种客户端】，共用同一个后端，所以数据天然互通：
//
// 【Web 网页版】给苹果手机（iPhone / iPad）用。
//   网页本身就是这台后端电脑发出去的，所以自动拿"当前网页的地址"当后端地址：
//   iPhone 打开 http://10.192.184.107:3000/ ，接口就自动指向同一个地址。
//   好处：换电脑、换 WiFi、IP 变了都不用重新编译，地址永远跟着网页走。
//
// 【安卓 APP】给安卓手机用，是独立安装的，没有"网页地址"这个概念，
//   必须写死后端的局域网 IP。电脑 IP 变了就要改下面 _androidBaseUrl 再重新打包。
//
// 怎么查电脑 IP：在电脑上执行 ipconfig，看"IPv4 地址"，形如 192.168.1.100
// ============================================================
import 'package:flutter/foundation.dart' show kIsWeb;

// 安卓 APP 专用的后端地址（云服务器域名）
// 服务器上已把 80 端口转发到后端 3000，所以这里不用写 :3000
// 好处：以后换服务器 / 换 IP 都不用重新打包 APK，域名不变就一直能用
const String _androidBaseUrl = 'http://rununion.club';

// 实际使用的后端地址：
//   Web  → Uri.base.origin：当前网页的"协议+域名+端口"，例如 http://10.192.184.107:3000
//   安卓 → 上面写死的局域网地址
// 用 kIsWeb 判断平台。注意：不能用 dart:io 的 Platform，它在 Web 端根本不存在，会导致编译失败。
final String kBaseUrl = kIsWeb ? Uri.base.origin : _androidBaseUrl;

// 当前 APP 的版本号（发布新版本时，要和 pubspec.yaml 的 version 一起改大）
// 启动时会拿它和后端 /api/app-version 返回的最新版本对比，旧了就以弹窗提示更新
const String kAppVersion = '1.0.2';
