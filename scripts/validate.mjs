// Kun Like 桌宠 · 仓库完整性校验
// 用法：node scripts/validate.mjs
// 检查：素材存在且格式正确、插件源码结构正确、精灵图尺寸符合 8×9 契约、
//       profile 插件包（packages/kunpet-dsh）结构完整且自包含
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let failed = 0
const ok = (cond, msg) => {
  console.log((cond ? '  ✔ ' : '  ✘ ') + msg)
  if (!cond) failed++
}

// 1. 素材文件
const spritePath = join(root, 'assets', 'spritesheet.webp')
const voicePath = join(root, 'assets', 'voice.mp3')
ok(existsSync(spritePath), 'assets/spritesheet.webp 存在')
ok(existsSync(voicePath), 'assets/voice.mp3 存在')

if (existsSync(spritePath)) {
  const buf = readFileSync(spritePath)
  // WebP RIFF 头 + VP8X 特征
  const isWebp = buf.length > 32 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP'
  ok(isWebp, 'spritesheet.webp 是合法 WebP（RIFF/WEBP 头）')
  if (isWebp) {
    const vp8x = buf.indexOf(Buffer.from('VP8X'))
    if (vp8x > 0 && buf.length > vp8x + 10) {
      const w = buf.readUIntLE(vp8x + 4, 3) + 1
      const h = buf.readUIntLE(vp8x + 7, 3) + 1
      ok(w === 1536 && h === 1872, `spritesheet.webp 尺寸为 1536×1872（实测 ${w}×${h}，契约要求 8 列 × 9 行、每格 192×208）`)
    }
  }
}
if (existsSync(voicePath)) {
  const buf = readFileSync(voicePath)
  const isMp3 = buf.length > 3 && (buf.slice(0, 3).toString('ascii') === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0))
  ok(isMp3, 'voice.mp3 是合法 MP3（ID3/MPEG 头）')
  ok(buf.length > 16 * 1024, `voice.mp3 大小合理（${buf.length} bytes）`)
}

// 2. 插件源码：动态插件格式，函数体以 return { 开头，且包含 apply(ctx)
for (const [name, mustContain] of [
  ['src/host.js', ['inject:', 'apply(ctx)', 'kun_pet_debug', 'pet-state', 'agentsService']],
  ['src/client.js', ['inject:', 'apply(ctx)', 'shell.overlay', 'ROWS', 'KunPet']],
]) {
  const p = join(root, name)
  ok(existsSync(p), `${name} 存在`)
  if (existsSync(p)) {
    const src = readFileSync(p, 'utf-8')
    ok(/\n\s*return\s*\{/.test(src), `${name} 是动态插件格式（函数体顶层 return { … }）`)
    for (const token of mustContain) {
      ok(src.includes(token), `${name} 包含关键片段 ${token}`)
    }
  }
}

// 3. profile 插件包（packages/kunpet-dsh）：结构完整且自包含
const pkgDir = join(root, 'packages', 'kunpet-dsh')
const pkgJsonPath = join(pkgDir, 'package.json')
ok(existsSync(pkgJsonPath), 'packages/kunpet-dsh/package.json 存在')
if (existsSync(pkgJsonPath)) {
  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
  ok(pkg.dsh?.bundle?.patch === './cordis.patch.yml', 'package.json 声明 dsh.bundle.patch（可安装）')
  ok(pkg.dsh?.client?.platform === 'web', 'package.json 声明 dsh.client.platform = web')
  ok(typeof pkg.exports?.['./client'] === 'string', 'package.json 导出 ./client 客户端产物')
  ok(pkg.publishConfig?.registry === 'https://registry.npmjs.org', 'package.json 配置 publishConfig 发布到官方 registry')
  ok(pkg.version === '1.0.2', `package.json 版本与 npm 发布同步（${pkg.version}）`)
}

for (const [rel, mustContain] of [
  ['lib/index.js', ['export function apply(ctx', "ctx.inject(['webServer'", "'/kun-pet/state'", 'kun_pet_debug', 'danger-full-access']],
  ['client/client.js', ['__ModuleLoader__.load', "id: 'kunpet-dsh'", 'shell.overlay', 'require(\'react\')']],
  ['cordis.patch.yml', ['kunpet-dsh']],
]) {
  const p = join(pkgDir, rel)
  ok(existsSync(p), `packages/kunpet-dsh/${rel} 存在`)
  if (existsSync(p)) {
    const src = readFileSync(p, 'utf-8')
    for (const token of mustContain) {
      ok(src.includes(token), `packages/kunpet-dsh/${rel} 包含 ${token}`)
    }
  }
}

for (const [rel, label] of [
  ['assets/spritesheet.webp', '精灵图'],
  ['assets/voice.mp3', '完成音'],
]) {
  const p = join(pkgDir, rel)
  ok(existsSync(p) && readFileSync(p).length > 0, `packages/kunpet-dsh/${rel}（${label}）存在且非空`)
}

// 自包含：lib/index.js 不得硬编码本机绝对路径（D:/ 或 C:\）
const hostSrc = existsSync(join(pkgDir, 'lib', 'index.js')) ? readFileSync(join(pkgDir, 'lib', 'index.js'), 'utf-8') : ''
ok(!/D:\/|C:\\\\|C:\//.test(hostSrc), 'lib/index.js 无硬编码绝对路径（素材自包含）')

console.log(failed === 0 ? '\n✅ 校验通过' : `\n❌ ${failed} 项校验失败`)
process.exit(failed === 0 ? 0 : 1)
