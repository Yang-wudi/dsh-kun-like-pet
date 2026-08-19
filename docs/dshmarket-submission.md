# 向 DSH 插件市场（dshmarket）上架 kunpet-dsh

> dshmarket 只是市场应用，插件目录来自 curated 的
> [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 注册表
> （[awesome-dsh-plugin.com](https://awesome-dsh-plugin.com)）。
> 上架 = 去该仓库提一个 PR 加一条目，网站与市场自动收录（通常一天内）。

## 先核对硬性要求（CI 自动检查，不满足会被打回）

- [ ] **仓库创建满 1 天** —— ✅ 本仓库 2026-08-14 创建，已达标
- [ ] **仓库提交数 ≥ 10** —— ⚠️ **当前只有 5 个**，未达标。CI 会自动检查，这是为过滤「PR 前几分钟才建好」的仓库。
      把功能做完、多提交几次真实改动即可，重新提交不受影响（不要用假提交凑数）。
- [ ] **仓库 `package.json` 声明了 `dsh.bundle` manifest** —— ✅ `packages/kunpet-dsh/package.json` 有
      `"dsh": { "bundle": { "patch": "./cordis.patch.yml" }, "client": {...} }`
      （注意：只有 `dsh.client` 没有 `dsh.bundle` 是最常见的被拒原因，我们两者都有）
- [ ] **仓库添加 `dsh-plugin` topic** —— 在 GitHub 仓库页 **Settings → Topics** 里加上 `dsh-plugin`
      （见 https://github.com/topics/dsh-plugin）
- [ ] 有真实可用代码（非占位/纯 README 仓库）—— ✅
- [ ] 描述只讲功能、不带营销词、必须属实（会对照代码核对）—— ✅
- [ ] `kunpet-dsh` npm 最新版已发布（README/LICENSE/署名随 1.0.1 带上）：
      `cd packages/kunpet-dsh && npm version patch && npm publish`

> 维护者会实际阅读目标仓库再合并；分类选得不够准不会打回（维护者会直接改），
> 但描述夸大是主要的打回原因。

## 条目文件（重点：是 YAML，不是 JSON）

README 由脚本生成、**禁止手工编辑**；列表数据在 `data/plugins/`，**一个插件一个 YAML 文件**。

在 fork 出来的 awesome-dsh-plugin 仓库里**新建一个文件**：
`data/plugins/Yang-wudi__dsh-kun-like-pet--packages-kunpet-dsh.yml`
（文件名 = `<owner>__<repo>--<子包路径>`；**必须指向声明了 `dsh.bundle` 的 package.json 所在路径**——
我们的 manifest 在 `packages/kunpet-dsh/` 子包，所以 url/name 用 monorepo 子包形式，否则
Submission gate 会报 "the root declares no dsh.bundle — would install nothing"），内容：

```yaml
url: https://github.com/Yang-wudi/dsh-kun-like-pet/tree/main/packages/kunpet-dsh
name: Yang-wudi/dsh-kun-like-pet#kunpet-dsh
category: fun
description:
  en: A Kun-Like desktop pet living in the corner of the DSH web UI; switches animations with agent state and plays a voice line on task completion.
  zh: 住在 DSH Web 界面右下角的坤坤桌宠：随 Agent 状态切换动作，任务完成时播放「你干嘛~哎哟」。
```

要点：

- **只有 `description.en` 是必填的**；`zh` 可留空让维护者补，但我们已经写好；
- 描述里含「: 」（冒号+空格）必须加引号——我们这条没有，无需引号；
- `category` 取值（当前列表）：`ui` `usage` `theme` `model` `session` `memory` `tools`
  `browser` `vision` `voice` `docs` `skill` `workflow` `git` `notify` `dev` `security`
  `remote` `market` `fun` —— 桌宠选 `fun`（或 `ui`）都算贴切，维护者会微调；
- 参考现成条目（例如 `data/plugins/01Virex__dsh-status-rotator.yml`）对照格式。
- ⚠️ Submission gate 还会检查**插件仓库在 GitHub 的创建时间 ≥ 1 天**（不是本地首次提交时间）——
  新仓库要等满 24h 再触发 CI，官方说明"重提不受影响"。

## 然后重新生成两个 README（必须，与 YAML 一起提交）

```sh
npm ci
node scripts/generate-readme.mjs
```

这会重新生成 `README.md` 与 `README.zh.md`。**提交时只改自己的条目 + 重新生成的 README**，
不要手工编辑 README（行号会移位，容易误改邻居条目）。

## PR

标题：

```
Add Yang-wudi/dsh-kun-like-pet (Desktop Pet)
```

描述（可选，附上更好）：

```markdown
## What

Add [kunpet-dsh](https://www.npmjs.com/package/kunpet-dsh) — a Kun-Like desktop
pet for DeepSeek Harness (derived from liyupi/dsh-kun-like-pet, with the
original MIT notice preserved).

- npm: https://www.npmjs.com/package/kunpet-dsh
- repo: https://github.com/Yang-wudi/dsh-kun-like-pet
- install: `dsh plugin --profile web add kunpet-dsh`

## Why

- 9-state sprite animations (Codex pet contract, 8×9 @ 192×208)
- Host-level profile plugin: survives DSH restarts, visible in every session page
- System-wide completion voice (Windows MCI / macOS afplay / Linux ffplay)
- Self-contained: assets embedded, no path configuration

## Screenshots

<!-- 可复用仓库 docs/ 下的 screenshot-working.png / screenshot-wave.png -->
```

## 提交流程

1. Fork `awesome-dsh-plugin/awesome-dsh-plugin`；
2. 新建 `data/plugins/Yang-wudi__dsh-kun-like-pet.yml`（上面内容）；
3. `npm ci && node scripts/generate-readme.mjs` 重新生成两个 README；
4. 提交这三个文件（1 个 YAML + 2 个 README），开 PR；
5. 等维护者合并（通常一天内）→ 打开 DSH **设置 → 插件市场** 搜索 `kunpet-dsh` 验证
   （市场每次请求实时拉取注册表，无缓存，刷新即可）。

## 参考链接

- 市场应用：https://github.com/dsh-market/dsh-market （**不要**在这里提插件条目 PR）
- 注册表：https://github.com/awesome-dsh-plugin/awesome-dsh-plugin
- 提交指南：https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md
- 市场条目 schema（展示用，非提交格式）：本机
  `~/.dsh/profiles/web/node_modules/dshmarket/lib/types/registry.d.ts`
