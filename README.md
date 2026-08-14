# 🐤 Kun Like 桌宠

> DeepSeek Harness（DSH）桌面宠物插件 —— 一只住在 Web 界面右下角的小坤宠。
> 它会盯着 Agent 干活：你搓代码时它努力搬砖，你思考时它托腮，等你回复时它翘首以盼，任务完成时它挥手跳跃、大喊 **「你干嘛~哎哟」** 🏀

![Kun Like 桌宠 · 工作中](docs/screenshot-working.png)

![Kun Like 桌宠 · 挥手](docs/screenshot-wave.png)

## ✨ 特性

- **9 种状态动画**：完全沿用 Codex 桌宠精灵图契约（8 列 × 9 行、每格 192×208），素材零重绘
- **实时感知 Agent 状态**：轮询 `agents` 服务感知每个 Agent 的 running/idle 状态，配合 `tools/execute`、`approval/request`、`agent/request-error` 事件推导工作 / 思考 / 等待 / 出错 / 空闲五种模式
- **任务完成全机可闻**：宿主进程用系统命令播放「你干嘛~哎哟」，任何窗口、任何会话完成任务都会响，与浏览器静音无关
- **可互动**：拖动桌宠到处跑（跑步动画方向跟随），点击它会挥手打招呼
- **内置调试工具**：`kun_pet_debug` 可随时查看状态机内部计数与轮询健康度

## 🎮 状态 → 动作映射

| Agent 工作状态 | 桌宠动作 | 气泡文案 |
| --- | --- | --- |
| 工作中（有工具在执行） | 专注干活（第 7 行） | 努力工作中… |
| 回合中但空闲 | 思考循环（第 8 行） | 思考中… |
| 等待用户回复 / 审批 | 期待等待（第 6 行） | 在等你回复哦~ |
| 出错 | 难过低落（第 5 行） | 呜…出错了 (._.) |
| 空闲 | 呼吸待机（第 0 行） | 休息中~ 有事叫我 |
| **任务完成** | 挥手 + 跳跃庆祝（第 3/4 行交替）＋ 系统音「你干嘛~哎哟」 | 完成啦！你干嘛~哎哟 |
| 拖动 | 跑步（第 1/2 行，方向跟随） | 呜哇~ 别拽我！ |
| 点击 | 挥手（2.4s 反应） | 诶嘿~ |

## 🚀 安装

### 方式一：DSH 动态插件（推荐，已实测）

桌宠以 **DSH 动态插件** 形式开发并运行验证（`cordis_define`）。在 DSH 会话里让 Agent 执行，或手动调用 `cordis_define` 工具：

1. 克隆本仓库：

   ```bash
   git clone https://github.com/liyupi/dsh-kun-like-pet.git
   ```

2. 修改 `src/host.js` 顶部 `CONFIG` 中的素材路径：

   ```js
   const CONFIG = {
     spritePath: '/你的/路径/dsh-kun-like-pet/assets/spritesheet.webp',
     voicePath:  '/你的/路径/dsh-kun-like-pet/assets/voice.mp3',
     // macOS 默认用 afplay；Windows / Linux 请改成对应播放命令
     playCommand: (path) => "afplay '" + path.replace(/'/g, "'\\''") + "'",
   }
   ```

3. 生成一键安装载荷并粘贴给 `cordis_define` 工具：

   ```bash
   node scripts/build-kunpet-package.mjs -   # 输出 JSON 载荷
   ```

   载荷结构（`kind: "new"` 创建新插件；后续更新用 `kind: "existing"` + `pluginId`）：

   ```json
   {
     "plugin": { "kind": "new", "idPrefix": "kunpet" },
     "name": "Kun Like 桌宠",
     "purpose": "在 Web 界面右下角显示 Kun Like 桌宠，随 Agent 工作状态切换动作，任务完成时播放「你干嘛~哎哟」语音。",
     "code": { "host": "<src/host.js 内容>", "client": "<src/client.js 内容>" }
   }
   ```

4. 用 `cordis_run` 激活，Web 界面右下角即出现桌宠。

### 方式二：直接预览动画（无需 DSH）

打开 `demo/index.html`（建议起个静态服务器，如 `npx serve .` 或 `python3 -m http.server`），即可查看全部 9 种动画并拖动互动。

## ⚙️ 配置

所有可调项集中在 `src/host.js` 顶部 `CONFIG`：

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `spritePath` | `~/.codex/pets/kun-like/spritesheet.webp` | 精灵图路径 |
| `voicePath` | `~/Downloads/你干嘛哎呦.mp3` | 完成音路径 |
| `playCommand` | `afplay '…'` | 系统级播放命令（Windows：`powershell -c (New-Object Media.SoundPlayer '…').PlaySync()`；Linux：`ffplay -nodisp -autoexit '…'`） |
| `pollMs` | `500` | Agent 状态轮询间隔 |
| `celebrateMs` | `4800` | 庆祝动画时长 |
| `failedMs` | `2600` | 失败动画时长 |

## 📁 项目结构

```
dsh-kun-like-pet/
├── src/
│   ├── host.js        # 插件 Host 半：状态机、素材路由、系统音、pet-state RPC、kun_pet_debug 工具
│   └── client.js      # 插件 Client 半：shell.overlay 注入、9 种动画渲染、拖动/点击互动
├── assets/
│   ├── spritesheet.webp   # 8×9 精灵图（1536×1872，Codex 桌宠契约）
│   └── voice.mp3          # 「你干嘛~哎哟」完成音
├── demo/index.html    # 独立动画演示页（无需 DSH）
├── docs/
│   ├── SPRITESHEET-CONTRACT.md   # 精灵图契约与动画行速查
│   └── screenshots…
├── scripts/
│   ├── build-kunpet-package.mjs  # 生成 cordis_define 安装载荷
│   └── validate.mjs              # 仓库完整性校验
├── CHANGELOG.md       # v1 → v5 迭代记录（含事件隔离根因分析）
└── kunpet.package.json    # 由 build 脚本生成的一键安装载荷
```

校验：`node scripts/validate.mjs`

## ❓ 常见问题

**为什么桌宠只在某一个窗口里？**
动态插件是会话级绑定：桌宠界面只注入到激活它的会话页面。但 v5 起完成音由宿主进程系统级播放，**任何窗口、任何会话完成任务本机都会响**。若要让桌宠形象出现在所有窗口，需将插件升级为宿主组合级插件包（欢迎 PR）。

**为什么不用事件监听而要轮询？**
开发过程中用 `internal/dispatch` 探针实证发现：部分部署里 `agent/status`、`agent/turn-stopping` 等 Agent 状态事件不流经动态插件所在总线（831 次事件观测中 status 类事件为 0），事件监听永远等不到「任务完成」。轮询 `agents` 服务是最可靠的跨部署方案。详见 [CHANGELOG](CHANGELOG.md) v3/v4。

## ⚠️ 素材版权声明

- `assets/voice.mp3` 为网络公开的二创梗语音片段（含公众人物声音），版权归原作者所有，**仅供个人学习交流使用**，请勿用于商业用途；如需商用请自行替换为无版权素材。
- `assets/spritesheet.webp` 为粉丝二创像素形象，沿用 Codex 桌宠素材契约制作。
- 若您是权利人且不希望相关内容被展示，请联系删除。

## 📄 License

代码以 [MIT License](LICENSE) 开源。素材文件（`assets/`）仅限个人学习交流，遵循上一条声明。
