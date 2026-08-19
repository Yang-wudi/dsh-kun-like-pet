// 验证插件将生成的 MCI 播放命令（与 lib/index.js 的 DEFAULTS.playCommand 逻辑一致）。
// 直接 spawn powershell -Command，等价于插件里 shell.run(spec) 的执行路径。
import { spawnSync } from 'node:child_process'

const mp3 = 'D:/code/dsh-kun-like-pet/dsh-kun-like-pet/assets/voice.mp3'

// 与插件 playCommand 完全相同的构建逻辑
function buildCommand(path) {
  const safe = path.replace(/\//g, '\\').replace(/'/g, "''")
  const open = 'open "' + safe + '" type mpegvideo alias kunpet'
  return [
    "Add-Type -TypeDefinition 'using System.Runtime.InteropServices;using System.Text;public class KunPetMci{[DllImport(\"winmm.dll\",CharSet=CharSet.Unicode)]public static extern int mciSendString(string c,StringBuilder r,int n,System.IntPtr h);}';",
    "[KunPetMci]::mciSendString('" + open + "',$null,0,[IntPtr]::Zero)|Out-Null;",
    "[KunPetMci]::mciSendString('play kunpet wait',$null,0,[IntPtr]::Zero)|Out-Null;",
    "[KunPetMci]::mciSendString('close kunpet',$null,0,[IntPtr]::Zero)|Out-Null;",
  ].join('')
}

const cmd = buildCommand(mp3)
console.log('command:', cmd.slice(0, 200) + '…')
const t0 = Date.now()
const r = spawnSync('powershell', ['-NoProfile', '-Command', cmd], { stdio: 'inherit', shell: false })
console.log('exit=' + r.status + ' elapsed=' + (Date.now() - t0) + 'ms')
process.exit(r.status ?? 1)
