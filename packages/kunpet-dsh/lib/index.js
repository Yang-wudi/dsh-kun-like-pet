// =============================================================================
// Kun Like 桌宠 · DSH 正式插件包（Host 半）
// 以 profile 插件形式挂载到宿主组合：重启仍在、所有会话共享。
//
// 职责：
//   1. 启动时读取素材（精灵图 + 完成音），注册 webServer 路由：
//        /kun-pet/spritesheet.webp   精灵图
//        /kun-pet/voice.mp3          完成音
//        /kun-pet/state              客户端轮询的状态 JSON
//   2. 轮询 agents 服务，按 Agent 的 running → idle 转换推导桌宠状态
//      （host 层插件能观察组合下所有 agent，任何会话完成任务都会触发）
//   3. 任务完成时用系统命令播放「你干嘛~哎哟」（全窗口/全会话可闻）
//   4. 注册 kun_pet_debug 调试工具（ctx.tools.register）
//
// 挂载方式：kunpet-dsh/cordis.patch.yml（dsh.bundle.patch），
//   由 profile 的 dsh.profile.bundles 列表装载。
// =============================================================================

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const name = 'kun-pet'
export const inject = ['tools']

// ===== 配置区（默认素材来自包内 assets/，自包含可分享；也可通过 loader entry config 覆盖） =====
const DEFAULTS = {
  spritePath: fileURLToPath(new URL('../assets/spritesheet.webp', import.meta.url)),
  voicePath: fileURLToPath(new URL('../assets/voice.mp3', import.meta.url)),
  // 宿主进程系统级播放命令（按平台自动选择，也可整体覆盖）。
  //   macOS: afplay '<path>'
  //   Linux: ffplay -nodisp -autoexit '<path>'
  //   Windows: MCI (winmm.dll) 播放 MP3 —— 注意 System.Media.SoundPlayer 只支持 WAV，
  //            不支持 MP3；MCI 用 `play ... wait` 同步播放到结束。
  playCommand: (path) => {
    if (process.platform === 'darwin') return "afplay '" + path.replace(/'/g, "'\\''") + "'"
    if (process.platform === 'linux') return "ffplay -nodisp -autoexit '" + path.replace(/'/g, "'\\''") + "'"
    const safe = path.replace(/\//g, '\\').replace(/'/g, "''")
    const open = 'open "' + safe + '" type mpegvideo alias kunpet'
    return [
      "Add-Type -TypeDefinition 'using System.Runtime.InteropServices;using System.Text;public class KunPetMci{[DllImport(\"winmm.dll\",CharSet=CharSet.Unicode)]public static extern int mciSendString(string c,StringBuilder r,int n,System.IntPtr h);}';",
      "[KunPetMci]::mciSendString('" + open + "',$null,0,[IntPtr]::Zero)|Out-Null;",
      "[KunPetMci]::mciSendString('play kunpet wait',$null,0,[IntPtr]::Zero)|Out-Null;",
      "[KunPetMci]::mciSendString('close kunpet',$null,0,[IntPtr]::Zero)|Out-Null;",
    ].join('')
  },
  // 状态轮询间隔（毫秒）
  pollMs: 500,
  // 庆祝动画持续时长（毫秒）
  celebrateMs: 4800,
  // 失败动画持续时长（毫秒）
  failedMs: 2600,
}

export function apply(ctx, config = {}) {
  // webServer/shell 在启动时序上晚于本插件提供：ctx.get 是即时解析（此刻还是
  // undefined），必须用 ctx.inject 等待服务出现后再回调（modlens 同款写法）。
  ctx.inject(['webServer', 'agents', 'shell'], (scope) => {
    runPet(ctx, scope.webServer, scope.agents, scope.shell, config)
  })
}

function runPet(ctx, webServer, agents, shell, config) {
  const cfg = { ...DEFAULTS, ...config }
  if (webServer === undefined || agents === undefined) {
    console.error('[kun-pet] webServer or agents service unavailable; pet disabled')
    return
  }

  // ---------- load pet assets once ----------
  let spriteBytes = null
  let voiceBytes = null
  try {
    spriteBytes = readFileSync(cfg.spritePath)
    console.log('[kun-pet] spritesheet loaded:', spriteBytes.length, 'bytes')
  } catch (err) {
    console.error('[kun-pet] failed to load spritesheet:', err)
  }
  try {
    voiceBytes = readFileSync(cfg.voicePath)
    console.log('[kun-pet] voice loaded:', voiceBytes.length, 'bytes')
  } catch (err) {
    console.error('[kun-pet] failed to load voice:', err)
  }

  // ---------- pet state machine (polling-driven) ----------
  let mode = 'idle'
  let seq = 0
  let celebrating = false
  let celebrateTimer = null
  let failTimer = null
  let celebrateCount = 0
  let workMarks = 0
  let errorMarks = 0
  let transitionsSeen = 0
  let pollCount = 0
  let rawExecute = 0
  let rawApproval = 0
  let rawRequestError = 0
  let toolsInFlight = 0
  let recentTool = false
  let recentToolTimer = null
  let waitingCount = 0
  let lastAgentStatuses = []
  let lastPlayError = null

  const turnFlags = new WeakMap() // agent -> { worked, errored }
  const lastStatus = new WeakMap() // agent -> 'idle' | 'running'
  const observedAgents = new Set()
  let flagEntries = 0
  const flagsOf = (agent) => {
    let f = turnFlags.get(agent)
    if (f === undefined) {
      f = { worked: false, errored: false }
      turnFlags.set(agent, f)
      flagEntries++
    }
    return f
  }

  const lastStatusEntries = () => {
    const out = []
    for (const agent of observedAgents) {
      const s = lastStatus.get(agent)
      if (s !== undefined) out.push([agent, s])
    }
    return out
  }

  const currentRunningCount = () => {
    let n = 0
    for (const entry of lastStatusEntries()) {
      if (entry[1] === 'running') n++
    }
    return n
  }

  const setMode = (next) => {
    if (next === mode) return
    if (celebrating && next !== 'celebrating') return
    mode = next
    seq++
  }

  const deriveMode = (runningCount) => {
    if (celebrating) return
    let next
    if (waitingCount > 0) next = 'waiting'
    else if (runningCount > 0) next = (toolsInFlight > 0 || recentTool) ? 'working' : 'review'
    else next = 'idle'
    setMode(next)
  }

  const playSystemVoice = () => {
    if (shell === undefined) {
      lastPlayError = 'shell service unavailable'
      console.error('[kun-pet] shell service unavailable; voice disabled')
      return
    }
    try {
      // 播放命令是插件写死的固定命令（仅播放本地 mp3，无任何用户输入），
      // 直接请求 danger-full-access 跳过沙箱：本机部署的 workspaceRoot 是
      // 用户主目录（含系统 %TEMP%），workspace-write 沙箱的 ACL runner 会因
      // "temp root must be outside the workspace" 拒绝启动，导致命令无法执行。
      const spec = shell.resolve({
        command: cfg.playCommand(cfg.voicePath),
        sandboxPolicy: { mode: 'danger-full-access', workspaceRoot: process.cwd() },
      })
      shell.run(spec).then(
        (res) => {
          lastPlayError = null
          console.log('[kun-pet] voice playback finished, exit:', res && res.exitCode)
        },
        (err) => {
          lastPlayError = String(err && err.message ? err.message : err)
          console.error('[kun-pet] voice playback failed:', lastPlayError)
        },
      )
    } catch (err) {
      lastPlayError = String(err && err.message ? err.message : err)
      console.error('[kun-pet] failed to start voice playback:', err)
    }
  }

  const celebrate = () => {
    if (celebrating) {
      // Extend the ongoing celebration; never double-fire the sound.
      if (celebrateTimer) celebrateTimer()
      celebrateTimer = setTimeout(() => {
        celebrateTimer = null
        celebrating = false
        deriveMode(currentRunningCount())
      }, cfg.celebrateMs)
      return
    }
    celebrateCount++
    celebrating = true
    setMode('celebrating')
    playSystemVoice()
    celebrateTimer = setTimeout(() => {
      celebrateTimer = null
      celebrating = false
      deriveMode(currentRunningCount())
    }, cfg.celebrateMs)
  }

  const showFailed = () => {
    if (celebrating) return
    setMode('failed')
    if (failTimer) failTimer()
    failTimer = setTimeout(() => {
      failTimer = null
      deriveMode(currentRunningCount())
    }, cfg.failedMs)
  }

  const markToolSettled = (wasQuestion) => {
    toolsInFlight = Math.max(0, toolsInFlight - 1)
    if (wasQuestion) {
      waitingCount = Math.max(0, waitingCount - 1)
    }
    if (toolsInFlight === 0) {
      if (recentToolTimer) recentToolTimer()
      recentToolTimer = setTimeout(() => {
        recentToolTimer = null
        recentTool = false
        deriveMode(currentRunningCount())
      }, 2500)
    }
    deriveMode(currentRunningCount())
  }

  // ---------- web routes ----------
  if (spriteBytes !== null) {
    ctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/kun-pet/spritesheet.webp',
      handler: (req, res) => {
        res.writeHead(200, {
          'Content-Type': 'image/webp',
          'Content-Length': String(spriteBytes.length),
          'Cache-Control': 'public, max-age=86400',
        })
        res.end(spriteBytes)
      },
    }), 'kun-pet: spritesheet route')
  }
  if (voiceBytes !== null) {
    ctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/kun-pet/voice.mp3',
      handler: (req, res) => {
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(voiceBytes.length),
          'Cache-Control': 'public, max-age=86400',
        })
        res.end(voiceBytes)
      },
    }), 'kun-pet: voice route')
  }
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/kun-pet/state',
    handler: (req, res) => {
      const body = JSON.stringify({
        mode,
        seq,
        spriteUrl: spriteBytes !== null ? '/kun-pet/spritesheet.webp' : null,
        voiceUrl: voiceBytes !== null ? '/kun-pet/voice.mp3' : null,
        // 诊断字段（排查用）
        celebrateCount,
        transitionsSeen,
        pollCount,
        lastPlayError,
      })
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Length': String(Buffer.byteLength(body)),
      })
      res.end(body)
    },
  }), 'kun-pet: state route')

  // ---------- polling: live agent statuses ----------
  const poll = () => {
    pollCount++
    let list
    try {
      list = agents.list()
    } catch (err) {
      return
    }
    if (!Array.isArray(list)) return
    const runningNow = new Set()
    const statuses = []
    for (const agent of list) {
      let status = 'idle'
      try {
        status = agent && agent.status === 'running' ? 'running' : 'idle'
      } catch (err) {
        status = 'idle'
      }
      statuses.push(status)
      if (status === 'running') runningNow.add(agent)
      const prev = lastStatus.get(agent)
      lastStatus.set(agent, status)
      if (agent && prev === undefined) observedAgents.add(agent)
      if (prev === 'running' && status === 'idle') {
        transitionsSeen++
        if (runningNow.size === 0 && waitingCount === 0) {
          const f = turnFlags.get(agent)
          if (f === undefined || !f.errored) celebrate()
          if (f !== undefined) {
            turnFlags.delete(agent)
            flagEntries--
          }
        }
      }
    }
    lastAgentStatuses = statuses
    deriveMode(runningNow.size)
  }
  const stopPolling = setInterval(poll, cfg.pollMs)
  ctx.effect(() => () => clearInterval(stopPolling), 'kun-pet: polling')

  // ---------- waterfalls (waiting + errors) ----------
  ctx.on('approval/request', (req, next) => {
    rawApproval++
    waitingCount++
    deriveMode(currentRunningCount())
    let p
    try {
      p = Promise.resolve(next())
    } catch (err) {
      waitingCount = Math.max(0, waitingCount - 1)
      deriveMode(currentRunningCount())
      throw err
    }
    p.then(
      () => { waitingCount = Math.max(0, waitingCount - 1); deriveMode(currentRunningCount()) },
      () => { waitingCount = Math.max(0, waitingCount - 1); deriveMode(currentRunningCount()) },
    )
    return p
  })

  ctx.on('tools/execute', (exec, next) => {
    rawExecute++
    let isQuestion = false
    if (exec && exec.agent) {
      flagsOf(exec.agent).worked = true
      workMarks++
    }
    if (exec && typeof exec.name === 'string' && exec.name === 'ask_user_question') {
      isQuestion = true
      waitingCount++
    }
    toolsInFlight++
    recentTool = true
    if (recentToolTimer) {
      recentToolTimer()
      recentToolTimer = null
    }
    deriveMode(currentRunningCount())
    let p
    try {
      p = Promise.resolve(next())
    } catch (err) {
      markToolSettled(isQuestion)
      throw err
    }
    p.then(
      () => markToolSettled(isQuestion),
      () => markToolSettled(isQuestion),
    )
    return p
  })

  ctx.on('agent/request-error', (payload, next) => {
    rawRequestError++
    if (payload && payload.agent) {
      flagsOf(payload.agent).errored = true
      errorMarks++
    }
    showFailed()
    return next()
  })

  // ---------- cleanup ----------
  ctx.effect(() => () => {
    if (celebrateTimer) clearTimeout(celebrateTimer)
    if (failTimer) clearTimeout(failTimer)
    if (recentToolTimer) clearTimeout(recentToolTimer)
  }, 'kun-pet: timers')

  // ---------- debug tool ----------
  try {
    ctx.tools.register({
      name: 'kun_pet_debug',
      description: 'Read the Kun Like desktop-pet state machine internals and polling counters. Use only to diagnose pet behavior.',
      parameters: { type: 'object', properties: {} },
      output: {
        schema: { type: 'object' },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      isConcurrencySafe: () => true,
      execute: async () => ({
        mode,
        seq,
        celebrating,
        celebrateCount,
        workMarks,
        errorMarks,
        transitionsSeen,
        flagEntries,
        waitingCount,
        toolsInFlight,
        recentTool,
        pollCount,
        agentCount: lastAgentStatuses.length,
        lastAgentStatuses,
        lastPlayError,
        raw: {
          execute: rawExecute,
          approval: rawApproval,
          requestError: rawRequestError,
        },
      }),
    })
  } catch (err) {
    console.error('[kun-pet] kun_pet_debug registration skipped:', err)
  }
}
