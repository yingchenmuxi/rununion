# 青跑团 QingRun

面向 10–20 岁青少年长跑群体的公益型长跑生态平台。

## 现在是什么

这是一个 **可点击的原型**，不是已经上线的产品。

- 手机端：Expo / React Native，一套代码可跑 Android、iOS 和网页。
- 管理后台：React + Vite，分社团后台和平台总后台。社长审批成员、发公告、建挑战、看记录；平台管理员看全国社团、用户、内容、记录和举报。
- 数据：活动与报名在手机端和社团后台之间共用本地 Mock API（进程内存）；其余页面仍是前端示例数据；尚未接入真实 PocketBase 表。

已完成的手机端流程：

- 登录：演示账号进入首页。
- 入团：输入邀请码，填写昵称、年级、用户名和密码，进入“待社长审批”。
- 审批演示：待审批页可一键模拟通过；正式版必须由社长在后台审批。
- 五个主页面：首页、跑团、开跑、成长、我的。
- 跑步记录三通道：GPS 前台记录、截屏后人工确认、GPX/TCX/CSV 文件导入；手动补记和计时补距离作为兜底。保存后首页本周/本月跑量、最近记录和成长页同步更新。
- 跑步知识库：9 篇本地精选，支持关键词搜索、8 个主题筛选、收藏、文章详情和关联阅读；首页精选卡与“我的”页收藏篇数联动。内容为演示稿，不是医疗建议。
- 活动报名：4 场演示活动，首页 / 跑团页 / 活动列表 / 详情 / 我的活动共用报名状态；支持待确认、已报名、已参加、未到、已取消和重新报名。待确认不显示具体集合点，后台审核和签到结果会同步过来。

已完成的社团后台：

- 登录、概览、成员、邀请码、公告、活动、挑战、记录与导出。
- 概览可直接通过/拒绝待审批成员。
- 支持生成邀请码、发布公告、创建挑战、导出社团可见记录 CSV。
- 活动管理：发布活动与草稿、筛选待确认、补登记监护人同意、通过/拒绝报名、结束活动；报名名单与监护人信息在社团后台内可见。
- 赛后签到：已结束活动逐条标记已参加/未到、撤销签到、看出勤进度和未到人数；签到不改变报名人数，结果同步到手机端“我的活动”。

已完成的平台总后台：

- 登录后进入独立工作区，包含总览、学校与社团、社团详情、全部用户、用户详情、内容与活动、跑步记录、审核与举报、系统与权限。
- 支持社团审核/暂停、用户暂停/恢复、内容上下线、记录更正、举报处理和平台账号管理。
- 所有管理操作写入内存审计日志；主要列表支持搜索、筛选和每页 10 条分页。

## 演示账号

手机端：

    用户名：demo
    密码：qingrun123
    邀请码：KANGFU-2026

社团后台：

    账号：admin@qingrun.local
    密码：Qingrun-Dev-2026

平台总后台：

    账号：ops@qingrun.local
    密码：Qingrun-Dev-2026

这些账号只用于本地演示，不能用于正式环境。

## 快速运行

需要 Node.js 20+（本项目在 Node 22 上验证）。

先在项目根启动共享活动数据（手机端和社团后台都要用）：

    node mock-api/server.mjs

它监听 <http://127.0.0.1:8090>，活动接口是 `/api/*`，同时能静态托管 `mobile/dist`。

手机端网页（另开终端）：

    cd mobile
    npm install
    npm run web

社团后台（再开一个终端）：

    cd admin
    npm install
    npm run dev

然后打开 <http://127.0.0.1:5173>，使用上面的后台演示账号登录。

首次安装依赖可能较慢，不要同时开多个 `npm install`。

## 静态导出与本地预览

    cd mobile
    npm run web:export
    npm run preview:web

然后打开 <http://127.0.0.1:8090>。  
`preview:web` 会同时启动 Mock API 和静态文件服务，带 SPA fallback，直接访问 `/school`、`/run`、`/growth`、`/profile`、`/knowledge`、`/knowledge/knee`、`/activities`、`/my-activities`、`/activity/act-001` 不会 404。

## 手机预览

1. 手机安装 Expo Go。
2. 电脑和手机连同一个 Wi-Fi。
3. 在 mobile 目录运行：

       npm start

4. 用 Expo Go 扫描终端二维码。
5. 如果局域网连不上，运行：

       npx expo start --tunnel

Expo Go 需要支持项目的 SDK 版本（当前 Expo SDK 58）。如果商店版本不兼容，后续改用 development build 或本地 Android 构建。

## 检查命令

手机端：

    cd mobile
    npm run typecheck
    node scripts/probe-direct.mjs
    node scripts/shot-tabs.mjs
    node scripts/e2e-auth.mjs
    node verify-run-sync.mjs
    node verify-three-channels.mjs
    node verify-knowledge.mjs
    node verify-activities.mjs

后台：

    cd admin
    npm run typecheck
    npm run build
    node inspect-admin.mjs
    node test-flows.mjs
    node verify-platform.mjs
    node verify-platform-actions.mjs
    node verify-platform-paging2.mjs
    node verify-platform-responsive.mjs
    node verify-activities-admin.mjs
    node verify-checkin-admin.mjs

- `typecheck`：TypeScript 类型检查。
- `probe-direct`：用无头 Edge 检查五个直链是否渲染、是否有 console 错误。
- `shot-tabs`：按 390×844 截五页图到 mobile/shots/。
- `e2e-auth`：跑登录、邀请码、待审批、通过、退出登录的浏览器流程。
- `verify-run-sync`：跑手动记录、计时记录，以及首页 / 成长 / 我的同步，并截取本轮证据图。
- `verify-three-channels`：模拟 GPS、选择真实截图、导入 CSV，检查三通道保存和首页 / 成长同步；GPX/TCX 解析器另有单元测试。
- `verify-knowledge`：检查知识库列表、搜索、空状态、主题筛选、收藏、详情、关联阅读和“我的”页收藏篇数，并截取证据图。
- `verify-activities`：跑 64 项共享/跨端检查：首页、列表四筛选、详情、我的活动、取消、后台改未到后手机端同步、撤销签到、重置；截取 17 张 390×844 证据图。运行前需要 8090 的 Mock API。
- `inspect-admin`：截后台各页到 admin/shots/。
- `test-flows`：跑社团后台审批、邀请码、公告、挑战、导出等主要流程。
- `verify-platform`：登录平台总后台并截九页图，检查 console 和横向溢出。
- `verify-platform-actions`：跑平台记录更正、举报处理、账号新增/停用和审计日志。
- `verify-platform-paging2`：检查用户、内容、记录和日志列表的搜索与分页。
- `verify-platform-responsive`：在 1280/1024 宽度检查主要平台页面的溢出与表内滚动。
- `verify-activities-admin`：跑社团后台活动发布、草稿发布、监护人同意、报名通过/拒绝、结束活动和同日同时冲突，并截取 17 张 1440×1000 证据图。
- `verify-checkin-admin`：跑已结束活动的签到、未到筛选、撤销重标、全部核对完和报名中无签到按钮，截取 12 张 1440×1000 证据图。

## 同步到 GitHub

镜像仓库：<https://github.com/yingchenmuxi/rununion>

每次改完，在项目根执行：

    node scripts/publish-rununion.mjs "说明这次改了什么"

它会复制项目到 `E:\_src\rununion`（跳过 node_modules、构建产物、本地 server、日志和环境文件），有变化就提交，然后只推送 develop（main 保持原样）。只复制、不提交时用 `node scripts/sync-rununion.mjs`。

## 目录

    QPTapp/
    ├─ docs/                     产品、流程、后台与登录文档
    ├─ mock-api/                 手机端与社团后台共享的本地活动 Mock API
    ├─ mobile/                   Expo 应用
    │  ├─ src/app/               页面与路由
    │  ├─ src/features/auth/     登录、入团、待审批
    │  ├─ src/features/runs/     共享记录、GPS 距离与文件解析
    │  ├─ src/features/knowledge/ 本地文章与收藏状态
    │  ├─ src/features/activities/ 活动数据、共享报名状态
    │  ├─ src/components/        共享 UI 与底栏
    │  ├─ src/constants/         颜色、间距、演示数据
    │  ├─ scripts/               截图、直链检查、认证流程、本地预览服务器
    │  └─ shots/                 手机页面截图
    ├─ admin/                    社团后台 + 平台总后台
    │  ├─ src/features/          社团页面、platform/ 平台页面、auth/ 登录
    │  ├─ src/data/              repository 接口 + 示例数据实现
    │  └─ shots/                 后台页面截图
    ├─ server/                   PocketBase 可执行文件与本地数据
    ├─ scripts/                  GitHub 镜像与发布脚本
    └─ README.md

## 文档

- [项目蓝图 v0.1](docs/00-青跑团-项目蓝图-v0.1.md)
- [方向修正 v0.2](docs/01-方向修正-v0.2.md)
- [初始开发信息 v1.0](docs/02-青跑团-初始开发信息-v1.0.md)
- [功能设计 v0.1](docs/03-青跑团-功能设计-v0.1.md)
- [页面流程与线框 v0.1](docs/04-青跑团-页面流程与线框-v0.1.md)
- [管理员后台方案 v0.1](docs/05-青跑团-管理员后台方案-v0.1.md)
- [管理员后台线框 v0.1](docs/06-青跑团-管理员后台线框-v0.1.md)
- [管理后台运行与验收 v0.1](docs/07-管理后台运行与验收-v0.1.md)
- [手机端登录与入团 v0.1](docs/08-手机端登录与入团-v0.1.md)
- [双后台与平台总后台 v0.1](docs/09-双后台与平台总后台-v0.1.md)
- [开跑记录与成长同步 v0.2（三通道）](docs/10-开跑记录与成长同步-v0.1.md)
- [手机端跑步知识库 v0.1](docs/11-手机端跑步知识库-v0.1.md)
- [手机端活动报名与我的活动 v0.1](docs/12-手机端活动报名与我的活动-v0.1.md)
- [社团后台活动发布与报名审核 v0.1](docs/13-社团后台活动发布与报名审核-v0.1.md)
- [社团后台赛后签到与出勤 v0.1](docs/14-赛后签到与出勤-v0.1.md)
- [活动出勤跨端闭环 v0.1](docs/15-活动出勤跨端闭环-v0.1.md)

## 重要说明

- 这是演示原型，不要录入真实未成年人信息。
- 手机端入团申请仍不写入后台；平台总后台与活动系统仍是两套演示数据。所有演示数据都不落数据库。
- 活动、报名、审核、签到已经通过 `mock-api` 在手机端和社团后台之间共享；刷新保留，重启 Mock API 或点“重置演示数据”回种子。
- 后台通过/拒绝/签到不会发真实通知，待确认状态也不会通知团长或监护人；手机端需要刷新或重新进入页面才能看到变化。
- 签到是团长手工记录，不是到场验证，不能作为真实活动的唯一出勤凭证。
- 演示版只在前台采集 GPS 距离，不保存轨迹、不上传地图；截图和轨迹文件也只在本机处理。真实设备验证和正式隐私评估尚未完成。
- 知识库内容是为演示写的项目稿，没有作者署名、外部来源或医学审核，不能当作正式科普或医疗建议。
- 不做 AI 问答、不做支付、不直接收现金；AI 检索要等审核语料和引用规范确定后再接。
- 正式试点前需要：学校书面同意、监护人同意、隐私政策、境内服务器、活动安全方案。
- 上线前请找属地律师/网信/教育/民政部门确认合规要求。