# 向 DSH 插件市场（dshmarket）上架 kunpet-dsh

> dshmarket 只是市场应用，插件目录来自 curated 的
> [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 注册表
> （[awesome-dsh-plugin.com](https://awesome-dsh-plugin.com)）。
> 上架 = 去该仓库提一个 PR 加一条目，网站与市场自动收录（通常一天内）。

## 前置条件（建议先完成）

- [ ] `kunpet-dsh` 的 npm 最新版已发布（README/LICENSE/署名随 1.0.1 带上）：
      `cd packages/kunpet-dsh && npm version patch && npm publish`
- [ ] GitHub 仓库 `Yang-wudi/dsh-kun-like-pet` 已包含最新代码（含 `packages/kunpet-dsh/` 与署名说明）
- [ ] 打开 [contributing.md](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)
      确认当前模板（Fork → 改哪个文件 → PR 标题格式），以下内容按仓库最新结构调整

## 注册表条目（按 dshmarket 的 RegistryPlugin schema）

把下面这条加进 awesome-dsh-plugin 的插件列表（字段来自 dshmarket 的类型定义
`RegistryPlugin`：name / owner / url / category / description / npm / stars / install / added，
见本机 `~/.dsh/profiles/web/node_modules/dshmarket/lib/types/registry.d.ts`）：

```json
{
  "name": "kunpet-dsh",
  "owner": "Yang-wudi",
  "url": "https://github.com/Yang-wudi/dsh-kun-like-pet",
  "category": "fun",
  "description": {
    "zh": "Kun Like 桌宠：住在 DSH Web 界面右下角的坤坤，随 Agent 工作状态切换动作（搬砖/思考/等待/出错/空闲），任务完成时挥手跳跃并全机播放「你干嘛~哎哟」。正式 profile 插件，重启仍在、所有会话共享。",
    "en": "A Kun-Like desktop pet living in the corner of the DSH Web UI. Switches animations with agent state (working/thinking/waiting/failed/idle) and plays a voice line on task completion. A self-contained profile plugin: survives restarts, shared across all sessions."
  },
  "npm": "kunpet-dsh",
  "install": "dsh plugin --profile web add kunpet-dsh",
  "added": "2026-08-19"
}
```

### 注意

- **`category`** 必须是注册表已有的分类 id（示例写 `fun`，PR 前在仓库里搜确认；
  若没有合适分类，可在 PR 里一并新增并同时更新 `categories` 的多语言映射）。
- **`stars`** 可留空（`null`）或按仓库实际星标数填写；市场显示用，非必填。
- **`install`** 字段为市场一键安装展示用；由于有 `npm` 字段，实际安装走 npm tarball 路径
  （注册表会校验 npm 包与仓库地址一致，防抢注——我们的 `package.json` `repository`
  已指向 `Yang-wudi/dsh-kun-like-pet`，正好一致）。

## PR 模板

标题：

```
Add kunpet-dsh (Desktop Pet)
```

描述：

```markdown
## What

Add [kunpet-dsh](https://www.npmjs.com/package/kunpet-dsh) — a Kun-Like desktop
pet plugin for DeepSeek Harness, derived from liyupi/dsh-kun-like-pet.

- npm: https://www.npmjs.com/package/kunpet-dsh
- repo: https://github.com/Yang-wudi/dsh-kun-like-pet
- install: `dsh plugin --profile web add kunpet-dsh`

## Why

- 9-state sprite animations (Codex pet contract, 8×9 @ 192×208)
- Host-level profile plugin: survives DSH restarts, visible in every session page
- System-wide completion voice (Windows MCI / macOS afplay / Linux ffplay)
- Self-contained: assets embedded, no path configuration needed

## Screenshots

<!-- 贴 1-2 张桌宠截图（右下角待机 / 工作中），GitHub 仓库 docs/ 下已有
     screenshot-working.png / screenshot-wave.png 可复用 -->
```

## 提交流程

1. Fork `awesome-dsh-plugin/awesome-dsh-plugin`；
2. 按 contributing.md 在插件列表文件加入上面的条目；
3. commit 后开 PR（标题见上）；
4. 等维护者合并（README 说明通常一天内）→ 打开 DSH **设置 → 插件市场** 搜索 `kunpet-dsh` 验证；
5. 若合并后市场未出现：市场每次请求实时拉取注册表（无本地缓存），刷新/重开市场页即可。

## 参考链接

- 市场应用：https://github.com/dsh-market/dsh-market （**不要**在这里提插件条目 PR）
- 注册表：https://github.com/awesome-dsh-plugin/awesome-dsh-plugin
- 提交指南：https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md
- 条目 schema：dshmarket `lib/types/registry.d.ts`（本机 `~/.dsh/profiles/web/node_modules/dshmarket/lib/types/registry.d.ts`）
