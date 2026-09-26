'use client'

import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Link from 'next/link'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { createFrameCap } from './frameCap'
import { useIsMobile, usePrefersReducedMotion } from './hooks'

const MODEL_URL = '/models/bear.glb'
const BACKDROP = '#dcd8cf'
const FLOOR = '#cbc6bb'
const CELL = 0.25
const FOV = 32
const CLIPS = ['Idle', 'Walk']
const SPEEDS = [1, 0.5, 0.25]
const VIEWS = {
  three: { label: '3/4', az: Math.PI / 4, polar: 1.2 },
  front: { label: 'front', az: 0, polar: 1.4 },
  side: { label: 'side', az: Math.PI / 2, polar: 1.45 },
  back: { label: 'back', az: Math.PI, polar: 1.3 },
}
const DEFAULT_FIT = { center: new THREE.Vector3(0, 0.6, 0), radius: 1.1 }

function CappedFrameloop() {
  const advance = useThree(s => s.advance)

  useEffect(() => {
    const cap = createFrameCap()
    let start = null
    let raf = requestAnimationFrame(function tick(now) {
      raf = requestAnimationFrame(tick)
      if (start === null) start = now
      if (cap.tick(now)) advance((now - start) / 1000)
    })
    return () => cancelAnimationFrame(raf)
  }, [advance])

  return null
}

function findClip(clips, name) {
  const lower = name.toLowerCase()
  return (
    clips.find(c => c.name === name) ||
    clips.find(c => c.name.toLowerCase().includes(lower)) ||
    null
  )
}

function fitDistance(radius, fov, aspect) {
  const v = THREE.MathUtils.degToRad(fov)
  const h = 2 * Math.atan(Math.tan(v / 2) * aspect)
  return (radius / Math.sin(Math.min(v, h) / 2)) * 1.25
}

function disposeGltf(gltf) {
  const seen = new Set()
  const drop = r => {
    if (!r || seen.has(r)) return
    seen.add(r)
    r.dispose()
  }
  gltf.scene.traverse(o => {
    drop(o.geometry)
    o.skeleton?.dispose()
    for (const m of [o.material].flat()) {
      if (!m) continue
      for (const v of Object.values(m)) if (v?.isTexture) drop(v)
      drop(m)
    }
  })
}

class ModelBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    this.props.onError(error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

function BearModel({ url, clip, playing, speed, showBones, onReady }) {
  const gltf = useGLTF(url)

  const model = useMemo(() => {
    const root = cloneSkinned(gltf.scene)
    const bones = new Set()
    let tris = 0
    root.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
        o.frustumCulled = false
        const g = o.geometry
        tris += (g.index ? g.index.count : g.attributes.position.count) / 3
      }
      if (o.isSkinnedMesh) o.skeleton.bones.forEach(b => bones.add(b))
    })
    root.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const extras = gltf.scene.userData || {}
    const walk = findClip(gltf.animations, 'Walk')
    const walkSpeed =
      Number(extras.walkSpeed) ||
      (walk && Number(extras.strideLength)
        ? Number(extras.strideLength) / walk.duration
        : 0)
    return {
      root,
      info: {
        size,
        minY: box.min.y,
        center,
        radius: Math.max(size.length() / 2, 0.2),
        tris: Math.round(tris),
        bones: bones.size,
        clips: gltf.animations.map(c => ({
          name: c.name,
          duration: c.duration,
        })),
        found: Object.fromEntries(
          CLIPS.map(n => [n, !!findClip(gltf.animations, n)]),
        ),
        walkSpeed,
      },
    }
  }, [gltf])

  useEffect(() => () => disposeGltf(gltf), [gltf])
  useEffect(
    () => () => model.root.traverse(o => o.isSkinnedMesh && o.skeleton.dispose()),
    [model],
  )

  const helper = useMemo(
    () => (model.info.bones ? new THREE.SkeletonHelper(model.root) : null),
    [model],
  )
  useEffect(() => () => helper?.dispose(), [helper])

  const mixer = useRef(null)
  const actions = useRef({})
  const current = useRef(null)
  const playingRef = useRef(playing)
  useEffect(() => {
    playingRef.current = playing
  }, [playing])

  useEffect(() => {
    const m = new THREE.AnimationMixer(model.root)
    const map = {}
    for (const name of CLIPS) {
      const c = findClip(gltf.animations, name)
      if (c) map[name] = m.clipAction(c)
    }
    mixer.current = m
    actions.current = map
    return () => {
      m.stopAllAction()
      m.uncacheRoot(model.root)
      mixer.current = null
      actions.current = {}
      current.current = null
    }
  }, [model, gltf.animations])

  useEffect(() => {
    const m = mixer.current
    const next = actions.current[clip]
    const prev = current.current
    if (!m || !next || next === prev) return
    next.reset().play()
    if (prev) {
      if (playingRef.current) next.crossFadeFrom(prev, 0.3, true)
      else prev.stop()
    }
    current.current = next
    m.update(0)
  }, [clip, model])

  useEffect(() => {
    onReady(model.info)
  }, [model, onReady])

  useFrame((_, delta) => {
    mixer.current?.update(playing ? Math.min(delta, 0.1) * speed : 0)
  })

  return (
    <>
      <primitive object={model.root} />
      {showBones && helper && <primitive object={helper} />}
    </>
  )
}

function Floor({ scroll, playing, speed }) {
  const grid = useRef()
  const travel = useRef(0)

  useFrame((_, delta) => {
    if (!grid.current) return
    if (scroll > 0 && playing)
      travel.current += Math.min(delta, 0.1) * speed * scroll
    grid.current.position.z = -(travel.current % CELL)
  })

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[40, 64]} />
        <meshStandardMaterial color={FLOOR} roughness={0.95} />
      </mesh>
      <gridHelper
        ref={grid}
        args={[16, 16 / CELL, '#a8a296', '#bdb8ad']}
        position-y={0.002}
      />
    </group>
  )
}

function Lights({ mobile }) {
  return (
    <>
      <hemisphereLight args={['#f4f1ea', '#8c8578', 1.4]} />
      <directionalLight
        position={[3.5, 6, 4]}
        intensity={2.4}
        color='#fff6e8'
        castShadow
        shadow-mapSize={[mobile ? 1024 : 2048, mobile ? 1024 : 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={3}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
      />
      <directionalLight
        position={[-3.5, 3.5, -4.5]}
        intensity={1.3}
        color='#dfe7f2'
      />
    </>
  )
}

function StudioCamera({ fit, view, viewKey, instant }) {
  const controls = useRef()
  const tween = useRef(null)
  const first = useRef(true)
  const aspect = useThree(s => s.size.width / Math.max(1, s.size.height))
  const distance = useMemo(
    () => fitDistance(fit.radius, FOV, aspect),
    [fit, aspect],
  )

  useEffect(() => {
    const v = VIEWS[view]
    tween.current = {
      az: v.az,
      polar: v.polar,
      radius: distance,
      target: fit.center.clone().setY(fit.center.y - fit.radius * 0.12),
      from: null,
      t: first.current || instant ? 1 : 0,
    }
    first.current = false
  }, [view, viewKey, fit, distance, instant])

  useFrame(({ camera }, delta) => {
    const tw = tween.current
    const c = controls.current
    if (!tw || !c) return
    if (!tw.from) {
      const s = new THREE.Spherical().setFromVector3(
        new THREE.Vector3().subVectors(camera.position, c.target),
      )
      tw.from = {
        az: s.theta,
        polar: s.phi,
        radius: s.radius,
        target: c.target.clone(),
      }
    }
    tw.t = Math.min(1, tw.t + delta / 0.7)
    const e = tw.t * tw.t * (3 - 2 * tw.t)
    const dAz = Math.atan2(
      Math.sin(tw.az - tw.from.az),
      Math.cos(tw.az - tw.from.az),
    )
    const s = new THREE.Spherical(
      THREE.MathUtils.lerp(tw.from.radius, tw.radius, e),
      THREE.MathUtils.lerp(tw.from.polar, tw.polar, e),
      tw.from.az + dAz * e,
    )
    c.target.lerpVectors(tw.from.target, tw.target, e)
    camera.position.setFromSpherical(s).add(c.target)
    c.update()
    if (tw.t >= 1) tween.current = null
  })

  return (
    <>
      <fog
        attach='fog'
        args={[
          BACKDROP,
          distance * 2.2 + fit.radius,
          distance * 2.2 + fit.radius * 12,
        ]}
      />
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.12}
        enablePan={false}
        minDistance={fit.radius * 1.15}
        maxDistance={distance * 2.2}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2 - 0.03}
      />
    </>
  )
}

function Pill({ active, disabled, onClick, children, title }) {
  return (
    <button
      type='button'
      title={title}
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1 font-mono text-[11px] transition-colors disabled:opacity-35 ${
        active
          ? 'bg-stone-100 text-stone-900'
          : 'text-stone-300 hover:bg-white/10 hover:text-stone-50'
      }`}
    >
      {children}
    </button>
  )
}

function Group({ children }) {
  return (
    <div className='flex items-center gap-0.5 rounded-full border border-white/10 bg-[#1b1a16]/85 p-1 backdrop-blur-sm'>
      {children}
    </div>
  )
}

function fmt(n) {
  return n.toFixed(2)
}

function Stats({ info }) {
  if (!info) return null
  const missing = CLIPS.filter(n => !info.found[n])
  return (
    <div className='pointer-events-auto max-w-full rounded-2xl border border-white/10 bg-[#1b1a16]/85 px-3 py-2 font-mono text-[10px] leading-relaxed text-stone-300 backdrop-blur-sm'>
      <div>
        h {fmt(info.size.y)} · l {fmt(info.size.z)} · w {fmt(info.size.x)} · min
        y {fmt(info.minY)}
      </div>
      <div>
        {info.tris.toLocaleString()} tris · {info.bones} bones
        {info.walkSpeed > 0 && <> · walk {fmt(info.walkSpeed)} u/s</>}
      </div>
      <div className='truncate'>
        {info.clips.length
          ? info.clips
              .map(c => `${c.name} ${c.duration.toFixed(2)}s`)
              .join(' · ')
          : 'no clips'}
      </div>
      {missing.length > 0 && (
        <div className='text-amber-300'>missing clip: {missing.join(', ')}</div>
      )}
    </div>
  )
}

function StatusCard({ status, error, onReload }) {
  if (status === 'ready') return null
  const text = {
    checking: 'looking for bear.glb…',
    loading: 'loading bear…',
    missing: 'no model yet at /public/models/bear.glb',
    error: `could not load bear.glb${error ? ` — ${error}` : ''}`,
  }[status]
  const retry = status === 'missing' || status === 'error'
  return (
    <div className='pointer-events-none absolute inset-0 flex items-center justify-center p-6'>
      <div className='pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-white/10 bg-[#1b1a16]/85 px-5 py-4 text-center font-mono text-xs text-stone-300 backdrop-blur-sm'>
        <p>{text}</p>
        {retry && (
          <button
            type='button'
            onClick={onReload}
            className='rounded-full border border-white/15 px-3 py-1 text-[11px] text-stone-100 hover:bg-white/10'
          >
            check again
          </button>
        )}
      </div>
    </div>
  )
}

export default function BearStudy() {
  const mobile = useIsMobile()
  const reducedMotion = usePrefersReducedMotion()
  const [nonce, setNonce] = useState(0)
  const [status, setStatus] = useState('checking')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [clip, setClip] = useState('Idle')
  const [playOverride, setPlayOverride] = useState(null)
  const [speedIndex, setSpeedIndex] = useState(0)
  const [view, setView] = useState('three')
  const [viewKey, setViewKey] = useState(0)
  const [showBones, setShowBones] = useState(false)

  const url = `${MODEL_URL}?v=${nonce}`
  const playing = playOverride ?? !reducedMotion
  const speed = SPEEDS[speedIndex]

  useEffect(() => {
    let alive = true
    fetch(url, { method: 'HEAD', cache: 'no-store' })
      .then(r => alive && setStatus(r.ok ? 'loading' : 'missing'))
      .catch(() => alive && setStatus('missing'))
    return () => {
      alive = false
    }
  }, [url])

  useEffect(() => () => useGLTF.clear(url), [url])

  const reload = useCallback(() => {
    setInfo(null)
    setError(null)
    setStatus('checking')
    setNonce(n => n + 1)
  }, [])

  const onReady = useCallback(next => {
    setInfo(next)
    setStatus('ready')
  }, [])

  const onError = useCallback(e => {
    setError(e?.message ? String(e.message).slice(0, 140) : null)
    setStatus('error')
  }, [])

  const fit = useMemo(
    () =>
      info ? { center: info.center.clone(), radius: info.radius } : DEFAULT_FIT,
    [info],
  )

  const pickView = id => {
    setView(id)
    setViewKey(k => k + 1)
  }

  const showModel = status === 'loading' || status === 'ready'
  const ready = status === 'ready'

  return (
    <main
      className='fixed inset-0 overflow-hidden'
      style={{ background: BACKDROP }}
    >
      <Canvas
        frameloop='never'
        dpr={[1, mobile ? 1.75 : 2]}
        shadows={{ enabled: true, type: THREE.PCFShadowMap }}
        camera={{ position: [3, 1.6, 3], fov: FOV, near: 0.05, far: 200 }}
        gl={{
          antialias: true,
          toneMapping: THREE.NeutralToneMapping,
          toneMappingExposure: 1,
        }}
        style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
      >
        <color attach='background' args={[BACKDROP]} />
        <Lights mobile={mobile} />
        <Floor
          scroll={clip === 'Walk' ? info?.walkSpeed || 0 : 0}
          playing={playing}
          speed={speed}
        />
        {showModel && (
          <ModelBoundary key={url} onError={onError}>
            <Suspense fallback={null}>
              <BearModel
                url={url}
                clip={clip}
                playing={playing}
                speed={speed}
                showBones={showBones}
                onReady={onReady}
              />
            </Suspense>
          </ModelBoundary>
        )}
        <StudioCamera
          fit={fit}
          view={view}
          viewKey={viewKey}
          instant={reducedMotion}
        />
        <CappedFrameloop />
      </Canvas>

      <div className='pointer-events-none absolute left-0 right-0 top-0 flex items-center justify-between gap-3 p-4 sm:p-5'>
        <Link
          href='/wallowa'
          className='pointer-events-auto rounded-full border border-white/10 bg-[#1b1a16]/85 px-4 py-1.5 font-mono text-[11px] text-stone-200 backdrop-blur-sm hover:text-white'
        >
          ← back to wallowa
        </Link>
        <span className='rounded-full border border-white/10 bg-[#1b1a16]/85 px-4 py-1.5 font-mono text-[11px] text-stone-400 backdrop-blur-sm'>
          bear study
        </span>
      </div>

      <StatusCard status={status} error={error} onReload={reload} />

      <div className='pointer-events-none absolute bottom-0 left-0 right-0 flex flex-col items-center gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5'>
        <Stats info={info} />
        <div className='pointer-events-auto flex flex-wrap items-center justify-center gap-2'>
          <Group>
            {CLIPS.map(name => (
              <Pill
                key={name}
                active={clip === name}
                disabled={ready && !info?.found[name]}
                onClick={() => setClip(name)}
              >
                {name}
              </Pill>
            ))}
          </Group>
          <Group>
            <Pill
              onClick={() => setPlayOverride(!playing)}
              title={playing ? 'pause' : 'play'}
            >
              {playing ? 'pause' : 'play'}
            </Pill>
            <Pill
              onClick={() => setSpeedIndex(i => (i + 1) % SPEEDS.length)}
              title='playback speed'
            >
              {speed === 1 ? '1×' : speed === 0.5 ? '½×' : '¼×'}
            </Pill>
          </Group>
          <Group>
            {Object.entries(VIEWS).map(([id, v]) => (
              <Pill key={id} active={view === id} onClick={() => pickView(id)}>
                {v.label}
              </Pill>
            ))}
          </Group>
          <Group>
            <Pill
              active={showBones}
              disabled={!info?.bones}
              onClick={() => setShowBones(b => !b)}
            >
              bones
            </Pill>
            <Pill onClick={reload} title='reload bear.glb'>
              reload
            </Pill>
          </Group>
        </div>
      </div>
    </main>
  )
}
