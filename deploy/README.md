# 部署到服务器（PWA + 社团后台）

这套部署包把手机端网页（PWA）和社团后台放到一台服务器上：

- 手机端：`https://你的域名/`，可“添加到主屏幕”，像 App 一样打开。
- 社团后台：默认只监听服务器本机 `8081`，通过 SSH 隧道访问，不直接暴露公网。
- 共享 API：由同一个 Caddy 反向代理到 `api:8090`，手机端和后台都走同源 `/api`。

> 这是演示部署，不是生产系统。Mock API 没有登录鉴权，数据在内存里，重启就回种子；不要录入真实未成年人信息，也不要把后台直接裸奔到公网。

## 1. 本地先验一遍

在项目根 `E:\QPTapp` 执行：

```bash
cd mobile
npm run web:deploy

cd ../admin
VITE_ACTIVITY_API=/api npm run build

cd ..
node deploy/preview.mjs
```

另开一个终端：

```bash
node deploy/verify-deploy.mjs
node deploy/verify-browser.mjs
```

- `web:deploy`：导出 Expo Web，并注入 manifest、Service Worker、PWA 图标和启动脚本。
- `VITE_ACTIVITY_API=/api`：让后台请求同源 `/api`，不要写死 `127.0.0.1:8090`。
- `preview.mjs`：本地生产态预览，手机端 `8080`、后台 `8081`，`/api` 代理到 `8090`。
- `verify-deploy.mjs`：7 项静态/代理检查。
- `verify-browser.mjs`：用无头 Edge 登录手机端和后台，检查 PWA、Service Worker、同源 API 和控制台异常，共 19 项。

本地预览前要先启动共享 Mock API：

```bash
node mock-api/server.mjs
```

## 2. 服务器准备

需要：

- 一台能装 Docker 的 Linux 服务器（2 核 2G 起）。
- 一个域名，DNS 的 A/AAAA 记录指向服务器。
- 防火墙放行 `80` 和 `443`。
- 如果服务器在中国大陆，域名解析到 80/443 前需要完成 ICP 备案；没有备案可先用香港/海外服务器或 IP 测试。

安装 Docker Engine 和 Compose 插件后，确认：

```bash
docker --version
docker compose version
```

## 3. 上传并启动（推荐：版本发布包）

每次发版，在项目根生成一个自包含目录：

```bash
node scripts/make-server-release.mjs v0.1.0
```

生成 `releases/qingrun-server-v0.1.0/`。里面已经有手机端静态文件、后台静态文件、Mock API、Caddyfile、compose 和启动脚本；服务器不需要 Node、npm，也不需要重新构建。

本地可以先验证发布包：

```bash
MOBILE_DIR=releases/qingrun-server-v0.1.0/web \
ADMIN_DIR=releases/qingrun-server-v0.1.0/admin \
PORT=8082 ADMIN_PORT=8083 node deploy/preview.mjs
```

复制整个目录到服务器：

```bash
scp -r releases/qingrun-server-v0.1.0 用户@服务器:/opt/qingrun/
```

服务器上：

```bash
cd /opt/qingrun/qingrun-server-v0.1.0
cp .env.example .env
vi .env
sh start.sh
```

最小配置：

```dotenv
SITE_ADDRESS=run.example.com
ADMIN_BIND=127.0.0.1
```

- `SITE_ADDRESS` 填域名时，Caddy 会自动申请并续期 HTTPS 证书。
- 只测试 IP 时可写 `SITE_ADDRESS=http://服务器IP`，这时是 HTTP。
- `ADMIN_BIND=127.0.0.1` 表示后台只绑本机；不要随便改成 `0.0.0.0`。

首次启动会拉取 `node:22-alpine` 和 `caddy:2.8-alpine`，不会编译源码。看到两个服务都为 `running`、`api` 为 `healthy` 后，打开 `https://run.example.com/`。

如果只是开发调试，不想生成发布包，也可以把整个项目传到服务器，按原来的方式直接构建：

```bash
cd /opt/qingrun/deploy
docker compose up -d --build
```

## 4. 手机上怎么用

### Android / Chrome

1. 用 Chrome 打开域名。
2. 菜单里选“安装应用”或“添加到主屏幕”。
3. 从桌面图标打开，会以独立窗口运行。

### iPhone / Safari

1. 用 Safari 打开域名。
2. 点底部分享按钮。
3. 选“添加到主屏幕”。

注意：这是网页/PWA，不是 App Store 安装包。Android 以后可以额外提供 APK 直链；iPhone 不能直接下载 IPA，只能 TestFlight、App Store 或 PWA。

## 5. 后台怎么进

后台默认只在服务器本机 `8081`，用 SSH 隧道：

```bash
ssh -L 8081:127.0.0.1:8081 用户名@服务器IP
```

保持 SSH 窗口不要关，然后在电脑浏览器打开：

```text
http://127.0.0.1:8081
```

演示账号：

```text
社团后台：admin@qingrun.local / Qingrun-Dev-2026
平台后台：ops@qingrun.local / Qingrun-Dev-2026
```

如果确实要公网访问后台，先把 `ADMIN_BIND` 改成 `0.0.0.0`，并在 `deploy/Caddyfile` 的 `:8081` 站点加一层 Basic Auth 或接到 VPN/零信任网关；演示登录本身不能当正式鉴权。

## 6. 数据与重置

- 所有数据在 Mock API 进程内存里，`docker compose restart api` 或重建容器都会回到种子数据。
- 手机端“我的 → 重置演示数据”和后台“重置演示数据”都会调用 `POST /api/reset`。
- 公开演示时，任何访问者都能调用这个接口重置数据；只把链接发给可信的人，正式版必须加鉴权。

## 7. 版本备份与更新

每个版本生成一个独立目录，目录生成后不再修改；旧版本就是回滚备份。

发下一版：

```bash
node scripts/make-server-release.mjs v0.1.1
```

脚本会生成 `releases/qingrun-server-v0.1.1/`，并更新 `releases/LATEST.txt` 和 `releases/index.json`。`releases/qingrun-server-v0.1.0/` 不会被覆盖。

服务器更新时保留旧目录：

```bash
cd /opt/qingrun/qingrun-server-v0.1.0
docker compose down

cd /opt/qingrun/qingrun-server-v0.1.1
cp ../qingrun-server-v0.1.0/.env .env
sh start.sh
```

回滚同理：停新版本，回到旧目录 `docker compose up -d`。HTTPS 证书在命名卷 `qingrun_caddy_data` 里，跨版本保留；不要执行 `docker compose down -v`。

发布目录只保留在本机 `releases/`，不塞进 Git 仓库；Git 里保留生成脚本 `scripts/make-server-release.mjs` 和模板 `deploy/release-template/`，随时可以重建发布包。发布包的 `SHA256SUMS.txt` 可在服务器上执行 `sha256sum -c SHA256SUMS.txt` 校验。

静态资源文件名带 hash，可以长期缓存；`index.html`、`sw.js`、`manifest.webmanifest` 不缓存。修改 Service Worker 缓存内容时，记得同步改 `mobile/pwa/sw.js` 里的 `qingrun-shell-v1` 版本号。

## 8. 常见问题

**80/443 被占用**：先停掉服务器上已有的 Nginx/Apache，或改 `docker-compose.yml` 的端口映射；Caddy 需要直接监听 80/443 才能自动签证书。

**证书申请失败**：检查 DNS 是否已经指向这台服务器、80/443 是否放行、域名是否已备案；Cloudflare 代理开启时 HTTP-01 可能失败，可先改成 DNS only。

**后台打开空白**：确认后台是用 `VITE_ACTIVITY_API=/api npm run build` 构建的，并且访问的是 `8081` 根路径，不是 `/admin/` 子路径。

**手机端能开但接口 502**：`docker compose logs api` 看 API 是否启动；`docker compose exec web wget -qO- http://api:8090/api/health` 检查容器网络。

**手机端一直停在登录页**：演示登录状态只存在当前页面内存里，刷新会退出；这是当前原型的限制，不是部署坏了。

## 9. 上线前必须补的

- 登录、鉴权、权限和操作审计；现在后台登录是前端演示账号。
- 数据库和备份；现在重启就丢数据。
- HTTPS 之外的隐私政策、监护人同意、学校书面同意、活动安全方案。
- 真实推送/短信、图片对象存储、限流和风控。
- 中国大陆正式运营的 ICP/APP 备案与未成年人个人信息合规评估。

## 文件说明

```text
deploy/
├─ Caddyfile              手机端静态站 + /api 反代 + 8081 后台站
├─ Dockerfile.api         Mock API 镜像
├─ Dockerfile.web         手机端/后台构建 + Caddy 运行镜像
├─ docker-compose.yml     api + web 两个服务
├─ .env.example           SITE_ADDRESS / ADMIN_BIND
├─ preview.mjs            本地生产态预览（8080/8081）
├─ verify-deploy.mjs      静态与代理冒烟
├─ verify-browser.mjs     无头浏览器登录与 PWA 冒烟
└─ release-template/      版本发布包的 compose/启动脚本/README 模板

scripts/
└─ make-server-release.mjs  生成 releases/qingrun-server-vX.Y.Z/
```
