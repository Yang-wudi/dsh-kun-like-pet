// =============================================================================
// Kun Like 桌宠 · DSH 正式插件包（Client 半）
// 手写 lazy-CJS 协议（window.__ModuleLoader__.load），零构建、零依赖：
// 只 require('react')，其余全部用浏览器原生 API。
//
// 职责：
//   1. 注入 shell.overlay 插槽，在 Web 界面右下角渲染桌宠（每个页面都有）
//   2. 按 8 列 × 9 行的精灵图契约播放 9 种状态动画
//   3. 支持拖动（跑步动画）、点击（挥手互动 + 浏览器端播放语音）
//   4. 每 400ms 轮询 /kun-pet/state 同步宿主端状态机
//
// 说明：任务完成的声音由 Host 端系统级播放（lib/index.js），
//       客户端只在「点击互动」时用浏览器 Audio 播放，避免双响。
// =============================================================================
window.__ModuleLoader__.load({
  id: 'kunpet-dsh',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    var React = require('react')

    var CW = 192
    var CH = 208
    var SCALE = 0.85
    var W = CW * SCALE
    var H = CH * SCALE

    // 8 列 × 9 行精灵图契约：每行一种状态动画（帧时长单位 ms）
    var ROWS = {
      idle: { row: 0, count: 6, frames: [280, 110, 110, 140, 140, 320] },
      runRight: { row: 1, count: 8, frames: [120, 120, 120, 120, 120, 120, 120, 220] },
      runLeft: { row: 2, count: 8, frames: [120, 120, 120, 120, 120, 120, 120, 220] },
      wave: { row: 3, count: 4, frames: [140, 140, 140, 280] },
      jump: { row: 4, count: 5, frames: [140, 140, 140, 140, 280] },
      failed: { row: 5, count: 8, frames: [140, 140, 140, 140, 140, 140, 140, 240] },
      waiting: { row: 6, count: 6, frames: [150, 150, 150, 150, 150, 260] },
      working: { row: 7, count: 6, frames: [120, 120, 120, 120, 120, 220] },
      review: { row: 8, count: 6, frames: [150, 150, 150, 150, 150, 280] },
    }

    var MODE_ANIM = {
      idle: 'idle',
      working: 'working',
      review: 'review',
      waiting: 'waiting',
      failed: 'failed',
      celebrating: 'wave',
    }

    var BUBBLES = {
      idle: '休息中~ 有事叫我',
      working: '努力工作中…',
      review: '思考中…',
      waiting: '在等你回复哦~',
      failed: '呜…出错了 (._.)',
      celebrating: '完成啦！你干嘛~哎哟',
      dragging: '呜哇~ 别拽我！',
      poke: '诶嘿~',
    }

    var styleTag = null
    function ensureStyle() {
      if (styleTag) return styleTag
      styleTag = document.createElement('style')
      styleTag.textContent =
        '.kun-pet-bubble{' +
        'position:absolute;left:50%;bottom:100%;margin-bottom:12px;' +
        'transform:translateX(-50%);background:rgba(255,255,255,0.96);' +
        'color:#333333;border:1px solid rgba(0,0,0,0.08);border-radius:12px;' +
        'padding:6px 12px;font-size:13px;' +
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;" +
        'white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,0.14);' +
        'pointer-events:none;z-index:2;' +
        '}' +
        '.kun-pet-bubble::after{' +
        "content:'';position:absolute;top:100%;left:50%;" +
        'transform:translateX(-50%);border:7px solid transparent;' +
        'border-top-color:rgba(255,255,255,0.96);' +
        '}'
      document.head.appendChild(styleTag)
      return styleTag
    }

    function KunPet() {
      var stState = React.useState({ mode: 'idle', seq: -1, spriteUrl: null, voiceUrl: null })
      var st = stState[0]
      var setSt = stState[1]
      var frameState = React.useState(0)
      var frame = frameState[0]
      var setFrame = frameState[1]
      var posState = React.useState(null)
      var pos = posState[0]
      var setPos = posState[1]
      var draggingState = React.useState(false)
      var dragging = draggingState[0]
      var setDragging = draggingState[1]
      var dragDirState = React.useState('runRight')
      var dragDir = dragDirState[0]
      var setDragDir = dragDirState[1]
      var reactionState = React.useState(null)
      var reaction = reactionState[0]
      var setReaction = reactionState[1]
      var celebrateAnimState = React.useState('wave')
      var celebrateAnim = celebrateAnimState[0]
      var setCelebrateAnim = celebrateAnimState[1]

      var dragDataRef = React.useRef(null)
      var reactionTimerRef = React.useRef(null)
      var lastCelebrateSeqRef = React.useRef(-1)
      var celebrateFlipRef = React.useRef(0)
      var audioRef = React.useRef(null)
      var viewportRef = React.useRef(null)

      // ---- poll host state every 400ms ----
      React.useEffect(function () {
        var alive = true
        var timer = null
        var sync = function () {
          fetch('/kun-pet/state', { cache: 'no-store' })
            .then(function (res) {
              if (!res.ok) throw new Error(String(res.status))
              return res.json()
            })
            .then(function (s) {
              if (!alive || !s) return
              setSt(function (prev) {
                var seq = typeof s.seq === 'number' ? s.seq : 0
                if (prev.seq === seq && prev.spriteUrl === s.spriteUrl && prev.voiceUrl === s.voiceUrl) return prev
                return {
                  mode: String(s.mode || 'idle'),
                  seq: seq,
                  spriteUrl: s.spriteUrl || null,
                  voiceUrl: s.voiceUrl || null,
                }
              })
            })
            .catch(function () {})
            .then(function () {
              if (alive) timer = setTimeout(sync, 400)
            })
        }
        sync()
        return function () {
          alive = false
          if (timer) clearTimeout(timer)
        }
      }, [])

      // ---- celebration animation alternates wave/jump per seq ----
      React.useEffect(function () {
        if (st.mode !== 'celebrating' || st.seq === lastCelebrateSeqRef.current) return
        lastCelebrateSeqRef.current = st.seq
        celebrateFlipRef.current = celebrateFlipRef.current + 1
        setCelebrateAnim(celebrateFlipRef.current % 2 === 0 ? 'jump' : 'wave')
      }, [st.mode, st.seq])

      React.useEffect(function () {
        return function () {
          if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current)
        }
      }, [])

      // ---- derive animation + bubble ----
      var anim
      var bubble
      if (dragging) {
        anim = dragDir
        bubble = BUBBLES.dragging
      } else if (reaction) {
        anim = reaction
        bubble = BUBBLES.poke
      } else if (st.mode === 'celebrating') {
        anim = celebrateAnim
        bubble = BUBBLES.celebrating
      } else {
        anim = MODE_ANIM[st.mode] || 'idle'
        bubble = BUBBLES[st.mode] || BUBBLES.idle
      }
      var spec = ROWS[anim] || ROWS.idle

      // ---- frame animation ----
      React.useEffect(function () {
        setFrame(0)
        var alive = true
        var timer = null
        var step = function (i) {
          if (!alive) return
          setFrame(i)
          var delay = spec.frames[i] || 150
          timer = setTimeout(function () {
            step((i + 1) % spec.count)
          }, delay)
        }
        step(0)
        return function () {
          alive = false
          if (timer) clearTimeout(timer)
        }
      }, [anim])

      // ---- interaction ----
      var playVoice = function () {
        var el = audioRef.current
        if (!el || !st.voiceUrl) return
        try {
          el.currentTime = 0
          var p = el.play()
          if (p && typeof p.catch === 'function') p.catch(function () {})
        } catch (err) {
          // autoplay may be blocked until the first user gesture
        }
      }

      var doReaction = function (animName, ms) {
        setReaction(animName)
        if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current)
        reactionTimerRef.current = setTimeout(function () {
          reactionTimerRef.current = null
          setReaction(null)
        }, ms)
      }

      var viewportSize = function () {
        var el = viewportRef.current
        if (el) {
          var r = el.getBoundingClientRect()
          if (r.width > 0 && r.height > 0) return { w: r.width, h: r.height }
        }
        return { w: 1400, h: 900 }
      }

      var onPointerDown = function (e) {
        if (typeof e.button === 'number' && e.button !== 0) return
        var el = e.currentTarget
        try { el.setPointerCapture(e.pointerId) } catch (err) { /* ignore */ }
        var rect = el.getBoundingClientRect()
        dragDataRef.current = {
          x: e.clientX,
          y: e.clientY,
          left: rect.left,
          top: rect.top,
          moved: false,
        }
        setDragging(true)
      }

      var onPointerMove = function (e) {
        var d = dragDataRef.current
        if (!d) return
        var dx = e.clientX - d.x
        var dy = e.clientY - d.y
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true
        if (dx > 4) setDragDir('runRight')
        else if (dx < -4) setDragDir('runLeft')
        var vp = viewportSize()
        var left = Math.min(Math.max(d.left + dx, -W * 0.7), vp.w - W * 0.3)
        var top = Math.min(Math.max(d.top + dy, -H * 0.5), vp.h - H * 0.5)
        setPos({ left: left, top: top })
      }

      var onPointerEnd = function () {
        var d = dragDataRef.current
        dragDataRef.current = null
        setDragging(false)
        if (d && !d.moved) {
          doReaction('wave', 2400)
          playVoice()
        }
      }

      var col = frame % spec.count
      var bgX = -(col * W)
      var bgY = -(spec.row * H)

      var wrapStyle = {
        position: 'fixed',
        width: W,
        height: H,
        zIndex: 1000,
        pointerEvents: 'auto',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
      }
      if (pos) {
        wrapStyle.left = pos.left
        wrapStyle.top = pos.top
      } else {
        wrapStyle.right = 20
        wrapStyle.bottom = 20
      }

      var spriteStyle = {
        position: 'absolute',
        left: 0,
        top: 0,
        width: W,
        height: H,
        backgroundImage: st.spriteUrl ? 'url("' + st.spriteUrl + '")' : 'none',
        backgroundSize: (W * 8) + 'px ' + (H * 9) + 'px',
        backgroundPosition: bgX + 'px ' + bgY + 'px',
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        cursor: dragging ? 'grabbing' : 'grab',
      }

      var children = []
      if (st.spriteUrl) {
        children.push(React.createElement('div', { key: 'sprite', style: spriteStyle }))
      } else {
        children.push(React.createElement('div', {
          key: 'emoji',
          style: {
            position: 'absolute', left: 0, top: 0, width: W, height: H,
            fontSize: 110, lineHeight: 1.6, textAlign: 'center',
          },
        }, '🐤'))
      }
      children.push(React.createElement('div', { key: 'bubble', className: 'kun-pet-bubble' }, bubble))
      children.push(React.createElement('div', {
        key: 'viewport',
        ref: viewportRef,
        style: {
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          pointerEvents: 'none', visibility: 'hidden',
        },
      }))
      if (st.voiceUrl) {
        children.push(React.createElement('audio', {
          key: 'voice',
          src: st.voiceUrl,
          preload: 'auto',
          ref: audioRef,
        }))
      }

      return React.createElement('div', {
        onPointerDown: onPointerDown,
        onPointerMove: onPointerMove,
        onPointerUp: onPointerEnd,
        onPointerCancel: onPointerEnd,
        style: wrapStyle,
        title: 'Kun Like 桌宠 · 拖动移动 · 点击互动',
      }, children)
    }

    function apply(ctx) {
      // slots 必须声明为 inject 才能以 ctx.slots 访问（client 端 ctx.get 解析不到，
      // 与 dshmarket 的 inject: ["slots", ...] + ctx.slots 写法保持一致）。
      var slots = ctx.slots
      if (!slots) {
        console.error('[kun-pet] slots service unavailable; pet disabled')
        return
      }
      ensureStyle()
      slots.inject('shell.overlay', function () {
        return slots.register(
          { name: 'shell.overlay', id: 'kun-pet', order: 100, label: 'Kun Like 桌宠' },
          function () { return React.createElement(KunPet) },
        )
      })
      if (typeof ctx.effect === 'function') {
        ctx.effect(function () {
          return function () {
            if (styleTag && styleTag.parentNode) styleTag.parentNode.removeChild(styleTag)
            styleTag = null
          }
        }, 'kun-pet: styles')
      }
    }

    exports.name = 'kun-pet'
    exports.inject = ['slots']
    exports.apply = apply
    return module.exports
  },
})
