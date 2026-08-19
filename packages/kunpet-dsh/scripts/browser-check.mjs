// 无头浏览器诊断：加载 DSH Web GUI，抓取控制台日志/异常，并检查桌宠 DOM。
// 用法：node packages/kunpet-dsh/scripts/browser-check.mjs [url] [waitMs]
// 零依赖：Node 22 全局 WebSocket + fetch，CDP over HTTP + WS。
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const URL = process.argv[2] || 'http://127.0.0.1:3080/'
const WAIT_MS = Number(process.argv[3] || 15000)
const PORT = 9333

const userData = mkdtempSync(join(tmpdir(), 'kunpet-cdp-'))
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${userData}`,
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--window-size=1400,900',
  'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function findTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page
    } catch { /* chrome still starting */ }
    await sleep(250)
  }
  throw new Error('no CDP page target')
}

const target = await findTarget()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  ws.onopen = resolve
  ws.onerror = reject
})

let msgId = 0
const pending = new Map()
const consoleLines = []
const exceptions = []
const logEvents = []

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id) {
    const p = pending.get(msg.id)
    if (p) {
      pending.delete(msg.id)
      msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result)
    }
    return
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = (msg.params.args || [])
      .map((a) => (a.value !== undefined ? JSON.stringify(a.value) : a.description || a.type))
      .join(' ')
    consoleLines.push(`[${msg.params.type}] ${text}`)
  } else if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails
    const desc = d.exception?.description || d.text || JSON.stringify(d)
    exceptions.push(desc)
  } else if (msg.method === 'Log.entryAdded') {
    logEvents.push(`[${msg.params.entry.level}] ${msg.params.entry.text}`)
  }
}

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++msgId
  pending.set(id, { resolve, reject })
  ws.send(JSON.stringify({ id, method, params }))
})

await send('Runtime.enable')
await send('Log.enable')
await send('Page.enable')
await send('Page.navigate', { url: URL })
console.log(`navigated to ${URL}, waiting ${WAIT_MS}ms…`)
await sleep(WAIT_MS)

const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  return r.result ? r.result.value : undefined
}

console.log('\n========== DOM / state checks ==========')
console.log('pet wrapper ([title*=Kun Like]):', await evalJs(`(() => {
  const el = document.querySelector('[title*="Kun Like"]')
  if (!el) return 'NOT FOUND'
  const st = el.getBoundingClientRect()
  const bg = el.querySelector('[style*="background"]')
  return { found: true, rect: { x: st.x, y: st.y, w: st.width, h: st.height }, bgImage: !!bg }
})()`))
console.log('bubble (.kun-pet-bubble):', await evalJs(`document.querySelectorAll('.kun-pet-bubble').length`))
console.log('overlay slots occupants:', await evalJs(`(() => {
  const root = document.getElementById('root')
  const all = root ? [...root.querySelectorAll('*')].filter((e) => e.style && e.style.zIndex === '1000').map((e) => e.outerHTML.slice(0, 120)) : []
  return all
})()`))
console.log('module loader present:', await evalJs(`typeof window.__ModuleLoader__`))
console.log('kunpet factory registered:', await evalJs(`!!(window.__ModuleLoader__ && window.__ModuleLoader__._factories) ? 'n/a' : 'loader has no _factories (internal)'`))
console.log('boot graph has kunpet-dsh:', await evalJs(`!!(window.__DSH_BOOT__ && window.__DSH_BOOT__.entries.some((e) => e.id === 'kunpet-dsh'))`))
console.log('style tags with data-plugin:', await evalJs(`[...document.querySelectorAll('style[data-plugin]')].map((s) => s.getAttribute('data-plugin')).join(', ')`))

console.log('\n========== console (first 60) ==========')
for (const l of consoleLines.slice(0, 60)) console.log(l)
console.log(`\n========== exceptions (${exceptions.length}) ==========`)
for (const e of exceptions.slice(0, 20)) console.log(e)
console.log(`\n========== log entries (first 20) ==========`)
for (const l of logEvents.slice(0, 20)) console.log(l)

ws.close()
chrome.kill()
process.exit(0)
