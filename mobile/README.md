# 青跑团 mobile

青跑团手机端，Expo SDK 58 + React Native + Expo Router。一套代码可跑 Android、iOS 和 Web。

当前是**可点击原型**：使用内存演示数据，不接真实后端，不录入真实未成年人信息。记录支持 GPS 前台计距离、截屏人工确认、GPX/TCX/CSV 文件导入；不保存轨迹、不上传地图。

## 运行

```bash
npm install
npm run web
```

静态导出与本地预览：

```bash
npm run web:export
npm run preview:web
```

预览地址为 <http://127.0.0.1:8090>。预览服务器带 SPA fallback，直接访问 `/school`、`/run`、`/growth`、`/profile` 不会 404。

真机预览：安装 Expo Go，电脑和手机连同一 Wi-Fi，在 mobile 目录运行 `npm start`，扫描二维码。局域网不通时用 `npx expo start --tunnel`。

## 演示账号

- 用户名：`demo`
- 密码：`qingrun123`
- 邀请码：`KANGFU-2026`
- 社团：康福外国语学校长跑社（北京）

登录页和邀请码页都有“填入演示账号 / 邀请码”按钮。

## 页面

| 页面 | 路径 | 说明 |
| --- | --- | --- |
| 登录 / 邀请码 | 未登录时自动显示 | 登录、两步入团、待审批演示 |
| 首页 | `/` | 本周跑量、最近记录、跑团、活动、成长卡 |
| 跑团 | `/school` | 社团信息、同城跑团、活动报名 |
| 开跑 | `/run` | 计时器 + GPS、截图确认、文件导入、手动补记、跑前热身 |
| 成长 | `/growth` | 本月成长、近四周、个人最好、团队榜 |
| 我的 | `/profile` | 个人资料、服务入口、隐私开关 |

## 目录

```
src/
├─ app/                 页面与 Expo Router 路由
├─ components/          共享 UI、底栏
├─ constants/           颜色、间距、演示数据
├─ features/
│  ├─ auth/             登录、邀请码、待审批
│  └─ runs/             共享记录、GPS 距离、文件解析、导入卡片
└─ ...
```

`RunProvider` 在 `src/app/_layout.tsx` 中包住页面树。首页、开跑、成长、我的读取同一份记录。

## 检查命令

```bash
npm run typecheck
node scripts/probe-direct.mjs
node scripts/shot-tabs.mjs
node scripts/e2e-auth.mjs
node verify-run-sync.mjs
node verify-three-channels.mjs
```

- `probe-direct`：检查五个直链是否渲染、是否有 console 错误。
- `shot-tabs`：按 390×844 截五页图。
- `e2e-auth`：登录、邀请码、待审批、通过、退出登录。
- `verify-run-sync`：手动记录、计时记录、首页 / 成长 / 我的同步，并截取本轮证据图。
- `verify-three-channels`：模拟 GPS、选择真实截图、导入 CSV，检查三通道保存和同步；GPX/TCX 解析器另有单元测试。

## 边界

- 记录只在内存中，刷新恢复演示数据。
- GPS 只在前台累计距离，不保存轨迹；真实设备上的精度、耗电和锁屏行为尚未验证。
- 截图通道不自动 OCR，保存前必须人工确认数字；文件通道暂不支持 FIT。
- 手机端与后台的数据互不相通。
- 个人最好、徽章、团队榜、跑团本周里程仍为静态演示数据。

详细说明见 [开跑记录与成长同步 v0.2（三通道）](../docs/10-开跑记录与成长同步-v0.1.md)。
