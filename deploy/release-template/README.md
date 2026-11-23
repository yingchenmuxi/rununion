# 青跑团 · 服务器部署包 {{VERSION}}

这是已经构建好的服务器发布包，不需要在服务器上安装 Node、npm 或重新构建。服务器只需要 Docker Engine 和 Compose 插件。

- 版本：{{VERSION}}
- 构建时间：{{BUILT_AT}}
- 源码提交：{{GIT_COMMIT}}
- 文件校验：SHA256SUMS.txt

## 1. 复制到服务器

```bash
scp -r {{VERSION}} 用户@服务器:/opt/qingrun/
```

如果服务器上已有旧版本，不要把新版本覆盖到正在运行的目录。把新目录放到旁边，例如 /opt/qingrun/，旧目录原样保留，作为回滚备份。

## 2. 配置

```bash
cd /opt/qingrun/{{VERSION}}
cp .env.example .env
vi .env
```

- SITE_ADDRESS：填域名，例如 qingrun.example.com；Caddy 会自动申请 HTTPS。只测试可填 http://服务器IP。
- ADMIN_BIND：后台端口绑定，默认 127.0.0.1，只允许服务器本机访问。不要直接改成 0.0.0.0 暴露公网。

## 3. 启动

```bash
sh start.sh
```

也可以手动执行：

```bash
docker compose up -d
docker compose ps
```

第一次启动会拉取 node:22-alpine 和 caddy:2.8-alpine 两个镜像，需要服务器能访问镜像仓库。启动后可以用下面的命令检查：

```bash
curl http://127.0.0.1/api/health
```

## 4. 访问

- 手机端：打开 .env 中的 SITE_ADDRESS，Android Chrome / iPhone Safari 都可以“添加到主屏幕”。
- 后台：后台只监听服务器本机 8081。在电脑上建立 SSH 隧道：

```bash
ssh -L 8081:127.0.0.1:8081 用户@服务器
```

然后在本机浏览器打开 http://127.0.0.1:8081。演示账号：admin@qingrun.local / Qingrun-Dev-2026。

## 5. 版本备份与回滚

每次发版都是一个独立目录，目录名带版本号，不要修改已经发布目录里的文件。

- 新版本：复制新目录到服务器，旧目录保留。
- 切换：在旧目录执行 docker compose down，在新目录执行 docker compose up -d。
- 回滚：在新目录执行 docker compose down，回到旧目录执行 docker compose up -d。
- HTTPS 证书保存在命名卷 qingrun_caddy_data 中，跨版本保留；不要执行 docker compose down -v。
- 发布目录里的 SHA256SUMS.txt 可以在服务器上校验：

```bash
sha256sum -c SHA256SUMS.txt
```

## 6. 数据与安全边界

当前 API 是 Mock 演示服务：没有登录鉴权，数据在进程内存里，重启后会回到种子数据。它适合内部演示和小范围试用，不要直接当作正式生产环境。

正式上线前至少要补：账号与权限、持久化数据库、登录限流、备份策略、隐私与未成年人信息合规、域名备案（如在中国大陆服务器）。

## 7. 常见问题

- 80/443 被占用：先停掉服务器上原有的 Nginx/Apache，或者修改 compose 端口。
- Caddy 申请证书失败：确认域名已解析到服务器、80/443 已放行、SITE_ADDRESS 没有写错。
- 静态文件 403：如果服务器启用了 SELinux，给挂载目录加 :z，或调整目录权限。
- 查看日志：docker compose logs -f web 或 docker compose logs -f api。
- 重置演示数据：后台右上角“重置演示数据”，或 curl -X POST http://127.0.0.1/api/reset。
