# 更新日志

本插件最初以 DSH 动态插件形式（`cordis_define`）迭代开发，历经 5 个版本；v6 起同时提供正式 profile 插件包并发布到 npm：

## v6.2（1.0.1 → 1.0.2）📦 npm 包完善

- 包内新增 `README.md`（npm 页面文档）与 `LICENSE`（保留上游 MIT 署名 + fork 改动声明）。
- `package.json` 增加 `author`（Yang-Wudi）、`contributors`（liyupi）、`repository`（指向派生仓库）、`publishConfig`（固定发布到官方 registry）。
- 根 README/包 README 补充「来源与致谢」：声明派生自 liyupi/dsh-kun-like-pet。
- 整理 dshmarket 上架文档（`docs/dshmarket-submission.md`）：条目为 `data/plugins/<owner>__<repo>.yml` YAML 格式，附硬性要求清单与 README 重生成步骤。

## v6.1（1.0.0）🔧 自包含可分享化

- 素材（精灵图 + 完成音）内嵌进包（`packages/kunpet-dsh/assets/`），`lib/index.js` 用 `new URL(..., import.meta.url)` 相对解析——**不再依赖任何本机绝对路径**。
- 播放命令按平台自动选择：Windows MCI/winmm、macOS `afplay`、Linux `ffplay`。
- 发布到 npm（`kunpet-dsh`），别人一条命令安装：`dsh plugin --profile web add kunpet-dsh`。

## v6（正式 profile 插件包）📦 重启仍在、所有会话共享

- 新增 `packages/kunpet-dsh`：以 **profile 插件** 形式挂载到 web profile（`dsh.profile.bundles` + `dsh.bundle.patch`），由 loader 在宿主组合中装载。
- **重启仍在**：插件随 profile 组合在 DSH 启动时挂载，不再依赖会话内 `cordis_define`/`cordis_run`，无需授权、无需每次重启重装。
- **所有会话共享**：host 半挂在 host 层，能观察组合下所有 Agent（"enclosing scope observes every descendant"）；client 半进浏览器启动图（`window.__DSH_BOOT__`），每个页面右下角都有桌宠；任何会话完成任务都会触发系统级「你干嘛~哎哟」。
- 关键改造：
  - host 半从动态沙箱（`harness.handle`/`harness.defineTool`）改为正式 ESM 插件（`ctx.tools.register` + `webServer` 路由），状态同步由 `host.call` RPC 改为 HTTP 轮询 `/kun-pet/state`。
  - client 半改为手写 lazy-CJS 协议（`window.__ModuleLoader__.load`），零构建、仅 `require('react')`，CSS 用 `<style>` 注入。
  - 素材用 `readFileSync` 启动时加载；配置仍集中在 `lib/index.js` 顶部 `DEFAULTS`。
- 安装：`dsh plugin --profile web add -w <仓库>/packages/kunpet-dsh`（详情见 README「方式三」）。

## v5（系统级完成音）— 动态插件当前版本 ✅

- 任务完成的声音改为由 **DSH 宿主进程** 直接调用系统命令播放（macOS `afplay`），与浏览器窗口无关：任何窗口、任何会话的任务完成，本机都会响起「你干嘛~哎哟」。
- 庆祝条件放宽为「任意 Agent 干净结束回合（running→idle），且无其他 Agent 在跑、无等待用户输入」。
- 防重复：庆祝进行中不会二次发声；点击宠物的互动声音仍由浏览器播放。

## v4（轮询驱动状态机）🔧 重大修复

- 三轮探针定位到根因：这套部署里 `agent/status`、`agent/turn-stopping` 等 Agent 状态事件的分发路径与动态插件所在总线隔离，**靠事件监听永远等不到「任务完成」**（`internal/dispatch` 探针观测到 831 次事件，唯独没有 status 类事件）。
- 改为**直接轮询 `agents` 服务**（每 500ms 读取所有活跃 Agent 的 `status` 字段），用 running→idle 转换判定任务完成并庆祝。
- `worked/errored` 标记按 Agent 归属（`tools/execute` 的 `exec.agent` + `agent/request-error` 的 payload.agent）。

## v3（internal/dispatch 探针）🔍

- 加入 `internal/dispatch` 通用观察探针，统计流经总线的事件，实证定位了事件隔离问题。
- `tools/execute`、`approval/request` 等瀑布事件保持直接监听（它们本来就能送达）。

## v2（按 Agent 归属工作标记）🐛

- 修复：原状态机在每次 `agent/status: running` 时重置 `worked = false`，而 Agent 一个回合内会多次 idle⇄running 翻转，最后一轮唤醒把工具调用留下的标记冲掉，导致 `turn-stopping` 时永远不庆祝。
- 修复：工作标记全局共享，会被后台子 Agent 的回合误消费。
- 新增 `kun_pet_debug` 调试工具，可随时查看状态机内部计数。

## v1（首个可用版本）🎉

- 把本地 Codex 目录下 Kun Like 素材（8×9 精灵图，完全按 Codex 桌宠契约）移植为 DSH 动态插件。
- Host 半：`fs` 读素材、`webServer` 注册路由、监听 Agent 状态事件。
- Client 半：注入 `shell.overlay` 插槽，右下角渲染 9 种状态动画，可拖动、可点击互动。
