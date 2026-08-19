# 🐤 kunpet-dsh

> Kun Like 桌宠 · DeepSeek Harness (DSH) 桌面宠物插件 —— 一只住在 Web 界面右下角的小坤宠。
> 它盯着 Agent 干活：你搓代码它努力搬砖，你思考它托腮，等你回复它翘首以盼，任务完成时它挥手跳跃、大喊 **「你干嘛~哎哟」** 🏀

A Kun-Like desktop pet for DeepSeek Harness: lives in the bottom-right corner of the Web UI, reacts to agent activity, and plays a voice line when a task completes.

> 🙏 This package is a **derivative of [liyupi/dsh-kun-like-pet](https://github.com/liyupi/dsh-kun-like-pet)** (original author liyupi, MIT). It repackages the pet as a self-contained DSH profile plugin and fixes Windows MP3 playback. Source: [github.com/Yang-wudi/dsh-kun-like-pet](https://github.com/Yang-wudi/dsh-kun-like-pet).

## ✨ Features

- **9 种状态动画**：完全沿用 Codex 桌宠精灵图契约（8 列 × 9 行、每格 192×208），素材零重绘
- **所有会话共享**：作为 profile 插件挂载到宿主组合，每个会话页面右下角都有桌宠
- **重启仍在**：随 DSH 启动自动装载，无需 cordis 会话、无需授权
- **任务完成全机可闻**：宿主进程用系统命令播放「你干嘛~哎哟」（Windows/Mac/Linux 自动选择播放命令）
- **可互动**：拖动桌宠满屏跑（跑步动画跟方向），点击它挥手打招呼
- **调试工具**：每个会话都有 `kun_pet_debug`，随时查看状态机内部计数

## 📦 Install

```bash
dsh plugin --profile web add kunpet-dsh
```

Then **restart DSH**. The pet appears in the bottom-right corner of every session page.

Local install from source:

```bash
git clone https://github.com/Yang-wudi/dsh-kun-like-pet.git
dsh plugin --profile web add -w <clone-path>/packages/kunpet-dsh
# restart DSH
```

> On Windows, pass the plain directory path (no `file:` prefix) when the target is on another drive.

## 🔧 Config

The plugin is self-contained (assets embedded). To override assets or behavior, add config to the loader entry in your profile's `cordis.patch.yml`:

```yaml
- id: kun-pet
  config:
    spritePath: /your/path/spritesheet.webp
    voicePath:  /your/path/voice.mp3
```

All options live in `lib/index.js` `DEFAULTS` (`pollMs`, `celebrateMs`, `failedMs`, `playCommand`…).

## 🔍 Verify

```bash
curl http://127.0.0.1:3080/kun-pet/state
```

Should return JSON like `{"mode":"idle","seq":…,"spriteUrl":"/kun-pet/spritesheet.webp",…}`. `/kun-pet/spritesheet.webp` should return `image/webp`.

## ⚠️ Assets copyright

`assets/voice.mp3` is a meme voice clip (contains a public figure's voice) and `assets/spritesheet.webp` is fan-made pixel art — **personal study use only**. Replace the files under `assets/` with your own if you plan commercial use or redistribution.

## 📄 License

Code: [MIT](https://github.com/Yang-wudi/dsh-kun-like-pet/blob/main/LICENSE). Assets: personal study use only, per the notice above.
