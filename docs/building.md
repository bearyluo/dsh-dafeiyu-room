# 本地构建与验证

## 宿主插件

Node.js 24.9+，从仓库根目录执行：

```sh
npm ci --ignore-scripts
npm test
npm pack --ignore-scripts --pack-destination dist
```

先自行创建 `dist` 目录。宿主包包含 src、lib、web、bin、许可与用户文档；不包含 node_modules、安卓源码/构建目录、验收脚本或私人状态。安卓源码在 Git 仓库中单独提供。

## 安卓伴侣

构建器当前适用于 Windows，需要 Python 3、JDK 17、Android platform 35、Windows Build Tools 35.0.0。请通过官方工具准备并按其要求完成 SDK 设置；脚本本身不下载 SDK 或接受许可。

```powershell
py android/build.py --jdk "C:/path/jdk-17" --tools "C:/path/Android/sdk/build-tools/35.0.0" --platform "C:/path/Android/sdk/platforms/android-35" --out "dist/dafeiyu-room-android-0.6.4-preview.1.apk"
```

构建器用 aapt2、javac、D8、zipalign 和 apksigner 打包并验证 APK。首次在 `android/build/local-development.jks` 创建本地开发签名，该目录被 Git 忽略。可用 `--keystore` 指向已有的同类本地开发 key 来保持测试包升级连续性；当前构建器按开发签名约定使用密码 `android`，不适用于正式商店密钥管理。

本地生成的私钥、SDK、日志、凭证和 APK 不应提交到 Git。CI 在干净环境产生独立的临时开发签名，只供构建检查；它不等同于 Releases 中维护者沿用的签名。

独立 JVM 检查不需要启动安卓设备：

```powershell
javac -encoding UTF-8 -d android/build/test-classes android/src/io/dafeiyu/room/RoomConnection.java android/src/io/dafeiyu/room/CameraAssets.java android/test/RoomConnectionTest.java android/test/CameraAssetsTest.java
java -cp android/build/test-classes io.dafeiyu.room.RoomConnectionTest
java -cp android/build/test-classes io.dafeiyu.room.CameraAssetsTest
```

CI 在 Windows/Linux 运行宿主测试，并在 Windows 构建/校验安卓包。构建与单元测试不能代替手机的权限、拖动、旋转、息屏和后台实际测试。

## 开发依赖的安全固定

本仓库固定 `zod: 4.6.6` 的 root override，修复 SDK 开发依赖树原先的 [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)，保持 DSH SDK `0.2.1-rc.5` 不变；变更后重新运行全部宿主集成测试。`npm audit --audit-level=high` 用于检查当前仓库锁文件。

Root override 只在本仓库作为根项目安装依赖时生效。插件装入 DSH 后，共享 SDK 和它自己的依赖由宿主管理，本插件不会修改宿主 lockfile 或强制升级其 SDK；宿主的依赖安全更新仍需跟进上游。
