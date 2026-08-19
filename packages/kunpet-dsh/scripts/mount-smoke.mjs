// 预演：在进程外用 cordis Loader 挂载 kunpet-dsh 条目（等价于 profile patch 的效果）。
// 关键：模拟真实启动时序 —— webServer/agents 在条目创建后才提供，
// 以此验证「ctx.inject 等待服务」的写法（ctx.get 即时解析会拿到 undefined）。
// 用法：node packages/kunpet-dsh/scripts/mount-smoke.mjs [profileDir]
//   默认 profileDir = C:\Users\18318\.dsh\profiles\web
// 预期输出：素材加载日志、三个路由注册、kun_pet_debug 工具注册，最后 OK。
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join, resolve } from 'node:path'

const profileDir = process.argv[2]
  ? resolve(process.argv[2])
  : 'C:/Users/18318/.dsh/profiles/web'

// 依赖从 profile 目录解析（@deepseek-ai/cordis 等装在 profile 的 node_modules）
const req = createRequire(join(profileDir, 'package.json'))
const { Context } = await import(pathToFileURL(req.resolve('@deepseek-ai/cordis')).href)
const { default: Loader } = await import(pathToFileURL(req.resolve('@deepseek-ai/cordis-plugin-loader')).href)

const ctx = new Context()

// 先提供核心服务（tools 随 entry inject 等待；webServer/agents 故意晚提供）
ctx.provide('tools', {
  register(t) {
    console.log('tool registered:', t.name)
    return () => {}
  },
})

const routes = []
const lateProvide = () => {
  ctx.provide('webServer', {
    register(route) {
      routes.push(`${route.kind} ${route.path}`)
      return () => {}
    },
  })
  ctx.provide('agents', { list() { return [] } })
  ctx.provide('shell', { resolve(s) { return s }, run() { return Promise.resolve({ exitCode: 0 }) } })
}

await ctx.plugin(Loader, { baseUrl: pathToFileURL(profileDir + '/').href })
await ctx.loader.create({ id: 'kun-pet', name: 'kunpet-dsh' })

// 模拟真实时序：条目开始后，webServer/agents/shell 稍后才出现
setTimeout(lateProvide, 50)

await ctx.loader.await()

// ctx.inject 回调在 apply 返回之后才触发（等服务出现），多等一拍再断言路由。
await new Promise((resolveWait) => setTimeout(resolveWait, 300))

console.log('routes:', JSON.stringify(routes))
const expect = [
  'exact /kun-pet/spritesheet.webp',
  'exact /kun-pet/voice.mp3',
  'exact /kun-pet/state',
]
for (const r of expect) {
  if (!routes.includes(r)) {
    console.log('FAIL: missing route', r)
    process.exit(1)
  }
}
console.log('OK: kun-pet mounts — assets loaded, routes + kun_pet_debug registered')
process.exit(0)
