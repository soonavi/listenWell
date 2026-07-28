import React, { useCallback, useEffect, useRef } from 'react'

import {
  project, dotRadius, artRadius, coverCrop, toneColor, depthAlpha, pickNode, focusRotation, PITCH_LIMIT,
} from '@/utils/listeningSphere'

const TAU = Math.PI * 2
const DRAG_SPEED = 0.006
const IDLE_SPIN = 0.0015
const INERTIA_DECAY = 0.94
const TAP_SLOP = 6
const AMBIENT_LABELS = 5
/** Long enough to read as a turn, short enough that it never feels like a wait. */
const FOCUS_MS = 520
/**
 * How far selecting leans in. Deliberately slight: the neighbours of the node
 * you picked are most of what the reading means, and they have to stay in
 * frame. This is a step towards the globe, not a dive into it.
 */
const FOCUS_ZOOM = 1.4

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

/**
 * A camera move, in the terms the draw loop interpolates: where it started,
 * where it is going, and how long it has to get there. Reduced motion asks for
 * no time at all, and the loop settles it on the very next frame.
 */
function cameraMove(view, rotX, rotY, zoom, duration) {
  return {
    fromX: view.rotX,
    fromY: view.rotY,
    fromZoom: view.zoom,
    toX: rotX,
    toY: rotY,
    toZoom: zoom,
    start: performance.now(),
    duration,
  }
}

/**
 * A scrim under text that has to stay readable whatever it lands on.
 *
 * Perspective lets a dot on the near side project further out than the pole
 * behind it, so "MOST PLAYED" and the selected label can't rely on empty space
 * being there.
 */
function scrim(ctx, box) {
  ctx.fillStyle = 'rgba(12, 12, 14, 0.74)'
  ctx.beginPath()
  const w = box.x2 - box.x1
  const h = box.y2 - box.y1
  if (ctx.roundRect) ctx.roundRect(box.x1, box.y1, w, h, 5)
  else ctx.rect(box.x1, box.y1, w, h)
  ctx.fill()
}

/** Trim a label to the width the canvas can actually spare. */
function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let trimmed = text
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1)
  }
  return `${trimmed}…`
}

/**
 * The listening sphere: play counts as a globe you can turn.
 *
 * Drawn on a canvas rather than built from DOM nodes — a few hundred dots
 * redrawn every frame is one draw loop here and a few hundred style writes
 * there, and only one of those stays smooth on a phone. The trade is that the
 * canvas is opaque to assistive tech, so the same data is rendered alongside it
 * as a real list of buttons (visually hidden, fully focusable), and the log
 * view is the same numbers again in plain text.
 */
function ListeningSphere({ nodes = [], selectedKey = null, onSelect, showArt = false, modeLabel = 'entries' }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const nodesRef = useRef(nodes)
  const selectedRef = useRef(selectedKey)
  const reducedMotionRef = useRef(false)
  const onSelectRef = useRef(onSelect)
  const showArtRef = useRef(showArt)
  // Decoded covers, keyed by their URL so two nodes sharing one — every track
  // on the same record — decode it once between them.
  const coversRef = useRef(new Map())

  const viewRef = useRef({
    rotX: -0.22,
    rotY: 0.5,
    velX: 0,
    velY: 0,
    zoom: 1,
    dragging: false,
    moved: 0,
    lastX: 0,
    lastY: 0,
    pointers: new Map(),
    pinch: 0,
    hoverKey: null,
    // The camera move currently running, if any, and the zoom to hand back
    // when the selection that started it is let go.
    focus: null,
    restZoom: null,
    points: [],
    width: 0,
    height: 0,
    dpr: 1,
    // Set whenever something the drawing depends on changes. A still globe
    // with a reading selected would otherwise repaint an identical frame
    // sixty times a second for as long as the page is open.
    dirty: true,
  })

  const markDirty = () => { viewRef.current.dirty = true }

  useEffect(() => { nodesRef.current = nodes; markDirty() }, [nodes])
  // Selecting turns the globe until the node you picked is facing you, and
  // leans in slightly. Before, the sphere simply stopped dead wherever it had
  // drifted to — and the reading you asked for was as likely as not on the far
  // side, so the whole thing read as a stall rather than an answer.
  //
  // It hangs off selectedKey rather than off the tap, so the hidden buttons
  // below and any selection made from outside the canvas move the camera the
  // same way. A keyboard user has even less idea where the node went.
  useEffect(() => {
    selectedRef.current = selectedKey
    markDirty()

    const view = viewRef.current
    const duration = reducedMotionRef.current ? 0 : FOCUS_MS

    if (selectedKey === null) {
      // Letting go hands back the zoom the view arrived with. The rotation
      // stays exactly where it is: finishing with a reading is no reason to
      // move the globe, and the idle drift picks it up from there.
      view.focus = view.restZoom === null ? null : cameraMove(view, view.rotX, view.rotY, view.restZoom, duration)
      view.restZoom = null
      return
    }

    // A key with nothing behind it has nowhere to aim; the parent drops a
    // stranded selection during render, so this frame is the only one it lasts.
    const node = nodesRef.current.find((entry) => entry.key === selectedKey)
    if (!node) return

    // Only the first focus records where the camera was. Picking a second node
    // while already focused would otherwise store the leaned-in zoom as the one
    // to return to, and there would be no way back out.
    if (view.restZoom === null) view.restZoom = view.zoom
    const { rotX, rotY } = focusRotation(node, view.rotY)
    // Never zoom out to get here: a user who has already pinched in closer
    // asked for that, and being yanked back is worse than not leaning in.
    const zoom = clamp(Math.max(view.zoom, FOCUS_ZOOM), 0.6, 3)
    view.focus = cameraMove(view, rotX, rotY, zoom, duration)
  }, [selectedKey])
  useEffect(() => { showArtRef.current = showArt; markDirty() }, [showArt])
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  // Decode the covers this mode needs, once each, and repaint as they land.
  //
  // No crossOrigin is set: a signed Supabase URL that answers without the CORS
  // header would fail to load at all with it, and a cover that doesn't appear
  // is a worse outcome than a tainted canvas. Nothing here reads pixels back.
  useEffect(() => {
    if (!showArt) return
    const cache = coversRef.current
    let live = true
    for (const node of nodes) {
      if (!node.coverUrl || cache.has(node.coverUrl)) continue
      const image = new Image()
      cache.set(node.coverUrl, image)
      image.decoding = 'async'
      image.onload = () => { if (live) markDirty() }
      // A cover that won't load leaves the node as a plain dot, which is the
      // same thing an untagged node does. Nothing to report.
      image.onerror = () => { cache.delete(node.coverUrl) }
      image.src = node.coverUrl
    }
    return () => { live = false }
  }, [nodes, showArt])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionRef.current = query.matches
    const onChange = (event) => { reducedMotionRef.current = event.matches }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const view = viewRef.current
    if (!canvas || view.width === 0 || view.height === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = view
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const cx = width / 2
    const cy = height / 2
    const radius = Math.min(width, height) * 0.36 * view.zoom
    const camera = { rotX: view.rotX, rotY: view.rotY, radius, cx, cy }

    // Ambient violet bloom behind the globe. Depth is glow, not shadow.
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.7)
    bloom.addColorStop(0, 'rgba(139, 92, 246, 0.10)')
    bloom.addColorStop(1, 'rgba(139, 92, 246, 0)')
    ctx.fillStyle = bloom
    ctx.fillRect(0, 0, width, height)

    // Wireframe: the silhouette plus three latitudes, sampled through the same
    // projection as the dots so the cage turns with them.
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.055)'
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, TAU)
    ctx.stroke()

    for (const lat of [0, Math.PI / 4, -Math.PI / 4]) {
      const ringY = Math.sin(lat)
      const ringR = Math.cos(lat)
      ctx.beginPath()
      for (let i = 0; i <= 72; i += 1) {
        const angle = (i / 72) * TAU
        const point = project({ x: Math.cos(angle) * ringR, y: ringY, z: Math.sin(angle) * ringR }, camera)
        if (i === 0) ctx.moveTo(point.sx, point.sy)
        else ctx.lineTo(point.sx, point.sy)
      }
      ctx.strokeStyle = `rgba(255, 255, 255, ${lat === 0 ? 0.07 : 0.04})`
      ctx.stroke()
    }

    // Project every node, then paint back to front so near ones overlap far.
    const art = showArtRef.current
    const sizeOf = art ? artRadius : dotRadius
    const points = nodesRef.current.map((node) => {
      const projected = project(node, camera)
      return {
        node,
        sx: projected.sx,
        sy: projected.sy,
        z: projected.z,
        r: Math.max(1.2, sizeOf(node.weight, radius) * projected.scale),
      }
    })
    points.sort((a, b) => a.z - b.z)
    view.points = points

    for (const point of points) {
      const isSelected = point.node.key === selectedRef.current
      const isHovered = point.node.key === view.hoverKey
      const alpha = depthAlpha(point.z)
      const cover = art && point.node.coverUrl ? coversRef.current.get(point.node.coverUrl) : null
      const drawable = cover && cover.complete && cover.naturalWidth > 0

      if (isSelected || isHovered) {
        ctx.beginPath()
        ctx.arc(point.sx, point.sy, point.r + (isSelected ? 9 : 6), 0, TAU)
        ctx.fillStyle = toneColor(point.node.tone, 0.18 * alpha)
        ctx.fill()
      }

      if (drawable) {
        // The cover fills the same circle the dot would have, so size still
        // reads as the play count. Rank keeps its colour as the rim, since
        // the artwork has taken the fill.
        const crop = coverCrop(cover.naturalWidth, cover.naturalHeight)
        ctx.save()
        ctx.beginPath()
        ctx.arc(point.sx, point.sy, point.r, 0, TAU)
        ctx.clip()
        ctx.globalAlpha = alpha
        ctx.drawImage(
          cover,
          crop.sx, crop.sy, crop.side, crop.side,
          point.sx - point.r, point.sy - point.r, point.r * 2, point.r * 2,
        )
        ctx.restore()

        ctx.beginPath()
        ctx.arc(point.sx, point.sy, point.r, 0, TAU)
        ctx.lineWidth = Math.max(1, point.r * 0.11)
        ctx.strokeStyle = toneColor(point.node.tone, alpha * (isSelected || isHovered ? 1 : 0.85))
        ctx.stroke()
      } else {
        // No cover, or none yet decoded: the plain dot, at the same size.
        ctx.beginPath()
        ctx.arc(point.sx, point.sy, point.r, 0, TAU)
        ctx.fillStyle = toneColor(point.node.tone, alpha * (isSelected || isHovered ? 1 : 0.82))
        ctx.fill()
      }

      if (isSelected) {
        ctx.beginPath()
        ctx.arc(point.sx, point.sy, point.r + (drawable ? 2.5 : 0), 0, TAU)
        ctx.lineWidth = 1.5
        ctx.strokeStyle = `rgba(243, 244, 246, ${alpha})`
        ctx.stroke()
      }
    }

    // Text is the one thing here that cannot overlap and still be read, so
    // every string claims a box and later strings give way to earlier ones.
    const claimed = []
    const collides = (box) => claimed.some((other) => !(
      box.x2 < other.x1 || box.x1 > other.x2 || box.y2 < other.y1 || box.y1 > other.y2
    ))

    // Poles carry the legend, so the axis explains itself however you turn it.
    // They clear the widest possible dot, because rank 1 always sits on one.
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '600 9px Orbitron, system-ui, sans-serif'
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0.16em'
    const poleGap = sizeOf(1, radius) * 1.5 + 16
    for (const [pole, text] of [[1, 'MOST PLAYED'], [-1, 'LEAST PLAYED']]) {
      const projected = project({ x: 0, y: pole, z: 0 }, camera)
      const ty = projected.sy - pole * poleGap
      const half = ctx.measureText(text).width / 2
      const box = { x1: projected.sx - half - 5, x2: projected.sx + half + 5, y1: ty - 8, y2: ty + 8 }
      scrim(ctx, box)
      ctx.fillStyle = `rgba(107, 114, 128, ${0.35 + 0.45 * depthAlpha(projected.z)})`
      ctx.fillText(text, projected.sx, ty)
      claimed.push(box)
    }
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px'

    // Labels: whatever is selected or hovered first — those are always drawn —
    // then the highest-ranked few facing the viewer, each skipped if it would
    // land on text already placed. Labelling every dot would bury the globe.
    const priority = [...points].sort((a, b) => {
      const rank = (point) => (
        point.node.key === selectedRef.current || point.node.key === view.hoverKey ? -1 : point.node.rank
      )
      return rank(a) - rank(b)
    })

    ctx.textBaseline = 'middle'
    let ambient = 0
    for (const point of priority) {
      const detailed = point.node.key === selectedRef.current || point.node.key === view.hoverKey
      if (!detailed) {
        if (ambient >= AMBIENT_LABELS) break
        if (point.z <= 0.15) continue
      }
      const alpha = Math.max(0.4, depthAlpha(point.z))

      ctx.font = '500 12px "Space Grotesk", system-ui, sans-serif'
      const gap = point.r + 7
      const room = Math.max(60, width / 2 - 16)
      const label = fitText(ctx, point.node.label, room)
      const detail = `${point.node.count} play${point.node.count === 1 ? '' : 's'} · #${point.node.rank}`
      const labelWidth = ctx.measureText(label).width
      // Flip the label to the inside when it would run off the right edge.
      const flip = point.sx + gap + labelWidth > width - 8
      const tx = flip ? point.sx - gap : point.sx + gap
      const left = flip ? tx - labelWidth : tx
      const box = {
        x1: left - 4,
        x2: left + labelWidth + 4,
        y1: point.sy - (detailed ? 15 : 8),
        y2: point.sy + (detailed ? 15 : 8),
      }
      if (!detailed && collides(box)) continue

      // The reading you asked for is never allowed to be hard to read. With
      // covers on, every label needs the same backing: the space behind it is
      // opaque artwork rather than the near-empty void the dots sit in.
      if (detailed) scrim(ctx, { ...box, x2: Math.max(box.x2, left + ctx.measureText(detail).width + 4) })
      else if (art) scrim(ctx, box)

      ctx.textAlign = flip ? 'right' : 'left'
      ctx.fillStyle = `rgba(243, 244, 246, ${alpha})`
      ctx.fillText(label, tx, detailed ? point.sy - 6 : point.sy)

      if (detailed) {
        ctx.font = '400 10px "Space Grotesk", system-ui, sans-serif'
        ctx.fillStyle = `rgba(156, 163, 175, ${alpha})`
        ctx.fillText(detail, tx, point.sy + 7)
      } else {
        ambient += 1
      }
      claimed.push(box)
    }
    ctx.textAlign = 'left'
  }, [])

  // Size the backing store to the device pixel ratio, or the globe draws soft.
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const measure = () => {
      const rect = wrap.getBoundingClientRect()
      const view = viewRef.current
      view.dpr = Math.min(2, window.devicePixelRatio || 1)
      view.width = Math.max(1, Math.round(rect.width))
      view.height = Math.max(1, Math.round(rect.height))
      canvas.width = Math.round(view.width * view.dpr)
      canvas.height = Math.round(view.height * view.dpr)
      canvas.style.width = `${view.width}px`
      canvas.style.height = `${view.height}px`
      view.dirty = false
      draw()
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [draw])

  useEffect(() => {
    let frame = 0
    const tick = () => {
      const view = viewRef.current
      const focus = view.focus
      if (focus) {
        // A focus move owns the camera for as long as it runs — inertia and
        // idle drift write the same three numbers, and a tween sharing them
        // with a decaying fling arrives somewhere neither of them intended.
        const t = focus.duration > 0 ? Math.min(1, (performance.now() - focus.start) / focus.duration) : 1
        // Eased out: leaves briskly, arrives gently. Linear reads mechanical,
        // and this is meant to look like the globe turning to face you.
        const eased = 1 - (1 - t) ** 3
        view.rotX = focus.fromX + (focus.toX - focus.fromX) * eased
        view.rotY = focus.fromY + (focus.toY - focus.fromY) * eased
        view.zoom = focus.fromZoom + (focus.toZoom - focus.fromZoom) * eased
        view.velX = 0
        view.velY = 0
        view.dirty = true
        if (t >= 1) view.focus = null
      } else if (!view.dragging) {
        if (view.velX !== 0 || view.velY !== 0) {
          view.rotY += view.velY
          view.rotX = clamp(view.rotX + view.velX, -PITCH_LIMIT, PITCH_LIMIT)
          view.velX *= INERTIA_DECAY
          view.velY *= INERTIA_DECAY
          if (Math.abs(view.velX) < 1e-4) view.velX = 0
          if (Math.abs(view.velY) < 1e-4) view.velY = 0
          view.dirty = true
        } else if (!reducedMotionRef.current && !selectedRef.current) {
          // Idle drift, so the globe reads as an object rather than a diagram.
          // It stops the moment a reading is selected — the instrument holds
          // still while you look at it.
          view.rotY += IDLE_SPIN
          view.dirty = true
        }
      }
      if (view.dirty) {
        view.dirty = false
        draw()
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [draw])

  // Wheel has to be a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (event) => {
      event.preventDefault()
      const view = viewRef.current
      view.focus = null
      // Setting the distance by hand replaces the one to return to. Otherwise
      // letting the reading go would undo a zoom the user chose deliberately,
      // which is the same yank the focus itself is careful not to perform.
      view.restZoom = null
      view.zoom = clamp(view.zoom * (event.deltaY > 0 ? 0.92 : 1.08), 0.6, 3)
      view.dirty = true
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  const localPoint = (event) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const pinchSpan = (view) => {
    const [a, b] = [...view.pointers.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  const handlePointerDown = (event) => {
    const view = viewRef.current
    // A hand on the globe outranks a focus move, which abandons wherever it
    // had got to rather than fighting the drag or snapping to its target. A
    // pinch starts with a pointer down as well, so that is covered here too.
    view.focus = null
    canvasRef.current.setPointerCapture(event.pointerId)
    view.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (view.pointers.size === 1) {
      view.dragging = true
      view.moved = 0
      view.lastX = event.clientX
      view.lastY = event.clientY
      view.velX = 0
      view.velY = 0
    } else if (view.pointers.size === 2) {
      view.dragging = false
      view.pinch = pinchSpan(view)
    }
  }

  const handlePointerMove = (event) => {
    const view = viewRef.current
    if (view.pointers.has(event.pointerId)) {
      view.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    }

    if (view.pointers.size === 2) {
      const span = pinchSpan(view)
      if (view.pinch > 0 && span > 0) {
        view.restZoom = null
        view.zoom = clamp(view.zoom * (span / view.pinch), 0.6, 3)
      }
      view.pinch = span
      view.dirty = true
      return
    }

    if (view.dragging) {
      const dx = event.clientX - view.lastX
      const dy = event.clientY - view.lastY
      view.lastX = event.clientX
      view.lastY = event.clientY
      view.moved += Math.abs(dx) + Math.abs(dy)
      view.rotY += dx * DRAG_SPEED
      view.rotX = clamp(view.rotX + dy * DRAG_SPEED, -PITCH_LIMIT, PITCH_LIMIT)
      view.dirty = true
      if (!reducedMotionRef.current) {
        view.velY = dx * DRAG_SPEED
        view.velX = dy * DRAG_SPEED
      }
      return
    }

    const { x, y } = localPoint(event)
    const hit = pickNode(view.points, x, y, 8)
    const key = hit ? hit.node.key : null
    if (key !== view.hoverKey) {
      view.hoverKey = key
      view.dirty = true
      canvasRef.current.style.cursor = key ? 'pointer' : 'grab'
    }
  }

  const handlePointerUp = (event) => {
    const view = viewRef.current
    const wasDragging = view.dragging
    const moved = view.moved
    view.pointers.delete(event.pointerId)
    if (view.pointers.size === 0) {
      view.dragging = false
      view.pinch = 0
    }
    // A press that barely moved is a tap, not a turn. Tapping bare space
    // clears the selection and lets the globe drift again.
    if (wasDragging && moved < TAP_SLOP) {
      const { x, y } = localPoint(event)
      const hit = pickNode(view.points, x, y, 10)
      onSelectRef.current?.(hit ? hit.node : null)
    }
  }

  const handleKeyDown = (event) => {
    const view = viewRef.current
    const step = 0.18
    if (event.key === 'ArrowLeft') view.rotY -= step
    else if (event.key === 'ArrowRight') view.rotY += step
    else if (event.key === 'ArrowUp') view.rotX = clamp(view.rotX - step, -PITCH_LIMIT, PITCH_LIMIT)
    else if (event.key === 'ArrowDown') view.rotX = clamp(view.rotX + step, -PITCH_LIMIT, PITCH_LIMIT)
    else if (event.key === '+' || event.key === '=') { view.zoom = clamp(view.zoom * 1.12, 0.6, 3); view.restZoom = null }
    else if (event.key === '-') { view.zoom = clamp(view.zoom * 0.89, 0.6, 3); view.restZoom = null }
    else if (event.key === 'Escape') onSelectRef.current?.(null)
    else return
    // Turning or zooming by hand cancels a focus move the same way a drag
    // does. Escape is the exception: it clears the selection, and the release
    // that follows is what hands the zoom back.
    if (event.key !== 'Escape') view.focus = null
    view.dirty = true
    event.preventDefault()
  }

  return (
    <div ref={wrapRef} className="relative w-full h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="img"
        aria-label={`${nodes.length} ${modeLabel} plotted by play count. Arrow keys turn the sphere; the list below selects entries.`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        className="block touch-none outline-none cursor-grab focus-visible:ring-2 focus-visible:ring-violet-500/60 rounded-2xl"
      />

      {/* The canvas is a picture as far as assistive tech is concerned, so the
          same nodes exist here as real, focusable buttons. */}
      <ul className="sr-only">
        {nodes.map((node) => (
          <li key={node.key}>
            <button type="button" onClick={() => onSelect?.(node)}>
              {`#${node.rank} ${node.label}${node.sublabel ? `, ${node.sublabel}` : ''}, ${node.count} play${node.count === 1 ? '' : 's'}`}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ListeningSphere
