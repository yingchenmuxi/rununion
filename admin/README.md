# 青跑团 · 管理后台（V0.1）

这是电脑网页后台，不是手机 App 里的页面。现在同一个前端里有**社团后台**和**平台总后台**两个工作区，登录时按账号角色进入。

## 当前状态

- 社团后台：登录、概览、成员、邀请码、公告、活动、挑战、记录与导出。
- 平台总后台：总览、学校与社团、社团详情、全部用户、用户详情、内容与活动、跑步记录、审核与举报、系统与权限。
- 数据：前端示例数据，刷新页面会恢复初始状态。
- 社团账号：`admin@qingrun.local` / `Qingrun-Dev-2026` → `/`
- 平台账号：`ops@qingrun.local` / `Qingrun-Dev-2026` → `/platform`
- 已通过：`npm run typecheck`、`npm run build`、1440×1000 平台九页截图检查、社团活动发布与报名审核全流程、社团赛后签到与出勤全流程、社团/平台主要交互流程、1280/1024 响应式检查。
- 还没接：PocketBase 真实表、真实登录、邮件邀请、审计日志落库、手机端 API。

## 启动

当前后台使用前端示例数据，不依赖 PocketBase，可以直接启动：

```bat
cd /d E:\QPTapp\admin
npm run dev
```

浏览器打开 <http://127.0.0.1:5173>。

以后接真实数据时，再启动 PocketBase：

```bat
cd /d E:\QPTapp
server\pocketbase.exe serve --http 127.0.0.1:8091 --dir server\pb_data --dev
```

## 社团后台页面

| 页面 | 能做什么 |
| --- | --- |
| 概览 | 看待审批数、在团人数、本周活跃、本周里程；直接通过/拒绝申请 |
| 成员 | 按状态筛选、搜索、通过/拒绝、重置临时密码、移出成员 |
| 邀请码 | 生成邀请码、复制、停用；限制次数和有效期 |
| 公告 | 新建草稿、发布、撤回、删除、置顶 |
| 活动 | 发布新活动、待确认筛选、补登记监护人同意、通过/拒绝报名、结束活动、发布草稿；结束后逐条签到/标未到、撤销签到、查看出勤统计 |
| 挑战 | 新建挑战、查看社团平均进度、结束挑战 |
| 记录与导出 | 按成员/备注/日期筛选社团可见记录，导出 CSV |

社团后台只有一个“社团负责人”角色；社长、团长只是称呼。

## 平台总后台页面

| 页面 | 能做什么 |
| --- | --- |
| 总览 | 待审核社团、待处理举报、7 天平台里程、城市覆盖 |
| 学校与社团 | 搜索/筛选社团，查看详情，通过、暂停、恢复 |
| 社团详情 | 资料、成员、记录、内容、设置与合规状态 |
| 全部用户 | 跨社团查询用户、监护人同意、风险标记、状态 |
| 用户详情 | 资料、安全状态、记录、相关举报、暂停/恢复 |
| 内容与活动 | 审核、通过、下线、发布公告与活动 |
| 跑步记录 | 查看全部记录、按权限更正、查看操作日志 |
| 审核与举报 | 高风险优先，填写处理说明，处理或驳回 |
| 系统与权限 | 新增/停用管理员、查看审计日志 |

第一版“超级管理员”和“运营管理员”同权限，方便小团队协作；后续再拆审核、客服、只读等角色。平台能看到全量资料，但列表不展示手机号、精确位置和私密记录正文。

## 列表与分页

平台用户、内容、记录、社团和审计日志共用每页 10 条的分页：

- 搜索或切换筛选时回到第 1 页。
- 只有一页时隐藏分页条。
- 页码超出总页数时自动收回。
- 分页不改变统计卡片和页脚总数。

## 检查命令

```bat
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
```

截图目录：`admin/shots/`（社团后台）、`admin/shots/activities/`（活动发布与报名审核）、`admin/shots/checkin/`（赛后签到与出勤）和 `admin/shots/platform/`（平台总后台）。

## 代码结构

```text
admin/src/
  config.ts                 全局配置、社团与平台侧栏导航
  types/models.ts           数据模型
  data/                     数据层（repository 接口 + mock 实现）
  features/                 社团页面、platform/ 平台页面、auth/ 登录
  components/ui/            按钮、卡片、弹窗、Toast 等共享组件
  components/layout/        社团后台与平台后台框架
  styles/index.css          统一样式与响应式规则
```

以后接 PocketBase 时，优先只替换 `admin/src/data/index.ts` 里的 repository，不把 API 代码写进页面。

## 安全提醒

- 这是本地开发版，不要直接暴露到公网。
- 演示账号和 PocketBase 超级管理员密码只用于本地，上线前必须更换。
- 社团后台只显示社团可见记录；私密记录不进入社团导出。
- 平台记录更正只用于纠错和审计，会保留原始值与操作人。
