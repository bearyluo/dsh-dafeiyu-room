# 配置与连接

插件 `cordis.patch.yml` 中的配置示例：

```yaml
- insert:
    - id: dsh-dafeiyu-room
      name: dsh-dafeiyu-room
      config:
        enabled: true
        viewerPort: 8796
        idleMinutes: 2
        cooldownMinutes: 10
        maxDailyDecisions: 12
```

安装时宿主会管理自己的插件配置。请在对应插件的既有 `config` 中修改，不要用这个片段覆盖整个宿主配置。`viewerPort` 只监听 `127.0.0.1`；城市和时区使用 DSH 插件设置页。`maxDailyDecisions: 0` 可停止空闲自主唤醒，原聊天和模型主动工具仍可使用。

查看本机画面：`http://127.0.0.1:8796/plugins/dsh-dafeiyu-room/`。

## 手机中继

默认中继端口为 8797。完整入口由命令动态打印，凭证保存在当前用户 `.dsh/storages/dsh-dafeiyu-room/viewer-access.json`，不包含 DSH 模型密钥。请保留终端运行。

```sh
dsh-room-viewer --lan --apk /path/to/dafeiyu-room-android-0.6.4-preview.1.apk
```

可选：`--host` 指定本机私有 IPv4；`--port` 指定中继端口；`--config` 指定凭证文件；`--source http://127.0.0.1:8796/plugins/dsh-dafeiyu-room/state` 指定本机源。`--rotate-key` 会产生新凭证，旧配对失效，应先正常停止旧服务。

## 手机打不开安装页

1. 手机和电脑连接相同内网，避开不允许访问 LAN 的访客 Wi-Fi。
2. 在电脑上打开中继打印的页面，确认中继已启动；这只能证明本机访问，仍需手机实测。
3. 多网卡或 VPN 环境使用 `--host` 指定电脑实际 LAN 地址。电脑地址变化后重新配对。
4. 如被 Windows 防火墙拦截，仅为当前 Node 可执行程序、本地端口和所需内网范围放行。程序位于目录链接内时，核对实际磁盘路径。中继不会自动更改系统防火墙或路由器。

## 页面打开但显示离线休息

- 确认 DSH 已运行、插件已重载、本机观察端口可打开，并在原聊天选择主会话。
- “主会话离线”表示拿到了状态但未连接主 Agent；“连接已断开”表示拿不到有效状态。
- 离线睡姿是本地展示；没有向模型发送睡觉命令，也不会补算睡眠收益或完成任务。

## 安卓权限与升级

在应用中开启系统“显示在其他应用上层”，再点击“开启悬浮小屋”。Android 13 以上可选择通知权限；浮窗使用可见前台服务，不申请无障碍或屏幕读取权限。部分 ROM 的后台限制需用户自行在系统设置中处理，本预览版尚未覆盖所有机型。

官方预览 APK 延续本地开发签名。自行构建可能使用不同签名，不能直接覆盖；如需卸载重装，先在自己的设备私下保留连接，勿公开上传。关闭应用首页预览或收起浮窗会销毁对应 WebView，屏幕关闭时浮窗收起。

## 可选公网实验入口

源码保留 `dsh-room-public-viewer`，需要用户单独运行、安装所选隧道组件并理解第三方流量路径。默认 LAN 流程不会启动它。临时域名会变化或过期；不承诺免费服务可达性或在线率。公网部署应使用有效 HTTPS 与适当的访问控制，完整配对链接应视作只读凭证。
