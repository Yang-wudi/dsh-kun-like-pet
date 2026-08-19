# 状态机与事件流

Kun Like 桌宠的核心是 Host 半（`packages/kunpet-dsh/lib/index.js`）里的一个**轮询驱动状态机**：
它不依赖 Agent 状态事件，而是每 500ms 直接读 `agents` 服务，配合工具执行瀑布事件推导出
桌宠应该展示的"模式"（mode），再通过 `/kun-pet/state` HTTP 接口暴露给浏览器端渲染。

## 模式 → 动画

| 模式 (mode) | 客户端动画 | 气泡文案 | 触发条件 |
| --- | --- | --- | --- |
| `idle` | 呼吸待机（第 0 行） | 休息中~ 有事叫我 | 无 Agent 在跑、无等待、无工具在飞 |
| `working` | 专注干活（第 7 行） | 努力工作中… | 有 Agent 在跑 **且** `toolsInFlight > 0` 或最近 2.5s 内执行过工具 |
| `review` | 思考循环（第 8 行） | 思考中… | 有 Agent 在跑但没有工具活动 |
| `waiting` | 期待等待（第 6 行） | 在等你回复哦~ | `waitingCount > 0`（有审批/提问挂起） |
| `failed` | 难过低落（第 5 行） | 呜…出错了 (._.) | `agent/request-error` 事件，持续 `failedMs` |
| `celebrating` | 挥手/跳跃交替（第 3/4 行）+ 系统音 | 完成啦！你干嘛~哎哟 | 任意 Agent 干净结束回合（见下） |

`seq` 在每次模式切换时 +1，客户端用它区分"同一模式的不同次庆祝"。

## 事件来源

状态机消费三类信号：

1. **轮询 `agents.list()`**（每 500ms）—— 每个 Agent 的 `status` 字段（`'running' | 'idle'`）。
   这是"任务完成"的唯一判定来源：**running → idle 转换**。
   （历史原因：早期版本依赖 `agent/status` 等事件，实测这套部署里事件不流经插件总线，
   详见 CHANGELOG v3/v4。）
2. **`tools/execute` 瀑布事件** —— 有工具执行时 `toolsInFlight++`、`recentTool=true`；
   结算时递减。`ask_user_question` 额外计入 `waitingCount`。
3. **`approval/request` 瀑布事件** —— 审批挂起时 `waitingCount++`，结束递减。
4. **`agent/request-error` 瀑布事件** —— 模型请求失败时给对应 Agent 打 `errored` 标记
   并显示 `failed` 模式。

> Host 半挂在宿主组合（root 作用域），Cordis 作用域分发的规则是
> "enclosing scope 的监听者能收到所有 descendant scope 的事件"，所以能观察**所有会话**的
> Agent——任何会话完成任务都会触发庆祝。

## 庆祝（celebrate）触发条件

在轮询里，当某 Agent `prev === 'running' && status === 'idle'` 时，同时满足：

- 当前没有其他 Agent 在跑（`runningNow.size === 0`）；
- 没有等待中的审批/提问（`waitingCount === 0`）；
- 该 Agent 本轮没有 `errored` 标记（有则显示 `failed` 而非庆祝）；

即触发 `celebrate()`：置 `celebrating`、切 `celebrating` 模式、调用系统命令播放
「你干嘛~哎哟」（持续 `celebrateMs`，期间二次完成只延长、不双响）。

## 播放命令（playCommand）

| 平台 | 命令 |
| --- | --- |
| Windows | MCI（`winmm.dll`）经 PowerShell `Add-Type` 内联声明，`play ... wait` 同步播放 |
| macOS | `afplay '<path>'` |
| Linux | `ffplay -nodisp -autoexit '<path>'` |

> ⚠️ Windows 不能使用 `System.Media.SoundPlayer`——它只支持 WAV，不支持 MP3。
> 另外该命令通过 `shell.run` 执行时显式请求 `danger-full-access`：
> 若部署的 workspaceRoot 含系统 `%TEMP%`（例如 DSH 从用户主目录启动），
> workspace-write 沙箱的 ACL runner 会因 "temp root must be outside the workspace"
> 拒绝启动，导致命令无法执行（见 CHANGELOG 与 `lib/index.js` 注释）。

## 诊断接口

`GET /kun-pet/state` 返回：

```json
{
  "mode": "working",
  "seq": 2,
  "spriteUrl": "/kun-pet/spritesheet.webp",
  "voiceUrl": "/kun-pet/voice.mp3",
  "celebrateCount": 1,
  "transitionsSeen": 1,
  "pollCount": 177,
  "lastPlayError": null
}
```

- `pollCount` 持续增长 = 轮询健康；
- `transitionsSeen` / `celebrateCount` = 状态机触发情况；
- `lastPlayError` = 最近一次播放失败原因（排查完成音问题的第一入口）。

会话内还有 `kun_pet_debug` 工具可查看全部内部计数（`raw.execute/approval/requestError`、
`toolsInFlight`、`waitingCount` 等）。

## 文件地图

| 文件 | 职责 |
| --- | --- |
| `packages/kunpet-dsh/lib/index.js` | Host 半：状态机、素材路由、系统音、`/kun-pet/state`、`kun_pet_debug` |
| `packages/kunpet-dsh/client/client.js` | Client 半：手写 lazy-CJS 包，轮询 `/kun-pet/state` 渲染 9 种动画 |
| `packages/kunpet-dsh/scripts/mount-smoke.mjs` | 不重启验证插件可挂载（含"服务晚提供"时序） |
| `packages/kunpet-dsh/scripts/play-test.mjs` | 端到端验证播放命令 |
| `src/host.js` / `src/client.js` | 动态插件（cordis_define）版本，逻辑同源 |
