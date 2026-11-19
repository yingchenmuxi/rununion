# 青跑团 mobile

青跑团手机端，Expo SDK 58 + React Native + Expo Router。一套代码可跑 Android、iOS 和 Web。

当前是**可点击原型**：使用内存演示数据，不接真实后端，不录入真实未成年人信息。记录支持 GPS 前台计距离、截屏人工确认、GPX/TCX/CSV 文件导入；不保存轨迹、不上传地图。另有 9 篇本地跑步知识文章，支持搜索、主题筛选、收藏和关联阅读；4 场演示活动支持报名、待确认、取消和我的活动。

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

预览地址为 <http://127.0.0.1:8090>。预览服务器带 SPA fallback，直接访问 `/school`、`/run`、`/growth`、`/profile`、`/knowledge`、`/knowledge/knee` 不会 404。

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
| 首页 | `/` | 本周跑量、最近记录、跑团、活动、成长卡、本周精选文章 |
| 跑团 | `/school` | 社团信息、同城跑团、近期活动（共享报名状态） |
| 活动列表 | `/activities` | 全部、可报名、已报名、已结束 |
| 活动详情 | `/activity/[id]` | 安排、集合点门控、报名 / 取消 |
| 我的活动 | `/my-activities` | 待参加、已参加 |
| 开跑 | `/run` | 计时器 + GPS、截图确认、文件导入、手动补记、跑前热身 |
| 成长 | `/growth` | 本月成长、近四周、个人最好、团队榜 |
| 跑步知识库 | `/knowledge` | 9 篇本地文章、搜索、主题筛选、收藏 |
| 文章详情 | `/knowledge/[id]` | 正文、可执行清单、注意提示、收藏、关联阅读 |
| 我的 | `/profile` | 个人资料、服务入口、活动入口、隐私开关、收藏篇数 |

## 目录

```
src/
├─ app/                 页面与 Expo Router 路由
├─ components/          共享 UI、底栏
├─ constants/           颜色、间距、演示数据
├─ features/
│  ├─ auth/             登录、邀请码、待审批
│  ├─ runs/             共享记录、GPS 距离、文件解析、导入卡片
│  ├─ knowledge/        本地文章、收藏状态
│  └─ activities/       活动数据、共享报名状态
└─ ...
```

`ActivityProvider`、`KnowledgeProvider` 和 `RunProvider` 在 `src/app/_layout.tsx` 中依次包住页面树。首页、跑团、活动列表、详情和我的活动共用同一份报名；首页、开跑、成长、我的读取同一份记录；知识库列表、详情和我的页共用同一份收藏。

## 检查命令

```bash
npm run typecheck
node scripts/probe-direct.mjs
node scripts/shot-tabs.mjs
node scripts/e2e-auth.mjs
node verify-run-sync.mjs
node verify-three-channels.mjs
node verify-knowledge.mjs
node verify-activities.mjs
```

- `probe-direct`：检查五个直链是否渲染、是否有 console 错误。
- `shot-tabs`：按 390×844 截五页图。
- `e2e-auth`：登录、邀请码、待审批、通过、退出登录。
- `verify-run-sync`：手动记录、计时记录、首页 / 成长 / 我的同步，并截取本轮证据图。
- `verify-three-channels`：模拟 GPS、选择真实截图、导入 CSV，检查三通道保存和同步；GPX/TCX 解析器另有单元测试。
- `verify-knowledge`：检查列表、搜索、空状态、主题筛选、收藏、详情、关联阅读和我的页收藏篇数。
- `verify-activities`：检查首页入口、详情、报名、我的活动、取消、四种筛选、过去/已确认详情和集合点隐私门控。

## 边界

- 记录只在内存中，刷新恢复演示数据。
- 活动、报名与取消只在内存中，刷新恢复 `a2` 已报名、`p1` 已参加；没有真实团长审批、监护人授权、签到或候补。
- GPS 只在前台累计距离，不保存轨迹；真实设备上的精度、耗电和锁屏行为尚未验证。
- 截图通道不自动 OCR，保存前必须人工确认数字；文件通道暂不支持 FIT。
- 手机端与后台的数据互不相通。
- 知识库是 9 篇本地演示稿，没有作者署名、外部来源或医学审核，不能当作正式科普或医疗建议。
- 收藏只在内存中，刷新恢复初始 3 篇；没有阅读历史、分享或评论。
- 个人最好、徽章、团队榜、跑团本周里程仍为静态演示数据。

详细说明见：

- [开跑记录与成长同步 v0.2（三通道）](../docs/10-开跑记录与成长同步-v0.1.md)
- [手机端跑步知识库 v0.1](../docs/11-手机端跑步知识库-v0.1.md)
- [手机端活动报名与我的活动 v0.1](../docs/12-手机端活动报名与我的活动-v0.1.md)
