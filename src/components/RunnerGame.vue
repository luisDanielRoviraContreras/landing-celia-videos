<script setup>
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { ref, onMounted, onBeforeUnmount } from 'vue'

const emit = defineEmits(['close'])

const host = ref(null)        // div que aloja el canvas
const score = ref(0)
const coins = ref(0)
const best = ref(Number(localStorage.getItem('runnerBest') || 0))
const phase = ref('loading') // loading | select | countdown | playing | paused | over
const count = ref(3)
const selectedChar = ref(null)
const models = {} // character, coin, obs_block, obs_high, obs_wall, obs_train
const buildingSet = [] // edificio1..7 (modelos aleatorios de /game)

// ---- constantes ----
// móvil: baja resolución/sombra/partículas para que fluya
const IS_MOBILE = typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820)

const LANES = [-2.3, 0, 2.3]
const GRAVITY = 34
const JUMP_V = 13          // salto más alto (permite subir al techo del tren)
const JUMP_BUFFER = 0.16   // ventana pre-aterrizaje para encadenar saltos
const LATERAL_HOLD = 0.07  // al saltar: sube recto un instante antes de ir al lado (salto inclinado)
const COYOTE = 0.12        // margen para saltar justo tras salir de un borde
const HANG_MAX = 0.45      // flotación máxima en el pico del salto al mantener la tecla
const SLIDE_TIME = 1.0
const CHUNK_LEN = 24
const CHUNK_COUNT = 8
const TRACK_LEN = CHUNK_LEN * CHUNK_COUNT
const SPAWN_Z = -135        // spawn lejano: emergen de la niebla, no aparecen de golpe
const PLAYER_HALF = 0.35   // media profundidad del jugador (colisión Z)
// modelos detallados /game (centrados en origen → rotar y subir a base)
const COIN_SCALE = 0.385
const VALLA_SCALE = 1.0
const VALLA_SEG = 1.9 * VALLA_SCALE   // largo del panel tras rotar 90°
const VALLA_LIFT = 0.85 * VALLA_SCALE
const SCEN_SCALE = 2.4
const SCEN_LIFT = 0.41 * SCEN_SCALE
// tren obstáculo = tren.glb (rotado 90°, se puede uno parar encima)
const OBS_TRAIN_SCALE = 2.2
const TRAIN_TOP = 0.82 * OBS_TRAIN_SCALE          // techo (para pararse encima) ≈ 1.80
const OBS_TRAIN_LIFT = 0.41 * OBS_TRAIN_SCALE     // sube la base al suelo ≈ 0.90
const OBS_TRAIN_HALF = (1.9 * OBS_TRAIN_SCALE) / 2 // media prof Z ≈ 2.09
// muro obstáculo = wall.glb (ladrillo, de frente). Solo mata si pegas su volumen
const WALL_SCALE = 1.5
const WALL_LIFT = 1.0 * WALL_SCALE     // wall.glb centrado (minY -1) → base al suelo
const WALL_TOP = 2.0 * WALL_SCALE      // altura real ≈ 3.0 (no se salta desde el suelo, sí desde un tren)
// rieles de suelo = rails.glb (tiled por carril)
const RAIL_SCALE = 1.2
const RAIL_SEG = 2.0 * RAIL_SCALE
const RAIL_LIFT = 0.05 // pegado al suelo (los durmientes casi tocan el piso)

let renderer, scene, camera, clock
let player, playerParts
let chunks = []
let obstacles = []
let coinsPool = []
let raf = null
let running = false
let dying = false      // reproduciendo animación de muerte
let deathTimer = 0

// animación del personaje (skinned + AnimationMixer)
let mixer = null
let charBase = null
const charClips = {}
const actions = {}
let currentAction = null

// estado jugador
let lane = 1
let targetX = 0
let vy = 0
let grounded = true
let sliding = false
let slideT = 0
let slideHeld = false     // se mantiene deslizando mientras la tecla siga pulsada
let jumpHeld = false      // mantener salto = flota en el pico (misma altura, más distancia)
let hangT = 0             // tiempo de flotación usado en el pico
let jumpBuffer = 0        // pulsación de salto guardada mientras estás en el aire
let lateralHold = 0      // congela el movimiento lateral justo tras saltar (salto inclinado)
let intro = false        // entrada: el personaje corre hacia la escena antes de controlar
let coyoteT = 0          // margen de salto tras salir de un borde
// banda vertical real de la valla 'high' (medida del modelo al cargar)
let HIGH_BOTTOM = 1.0
let HIGH_TOP = 2.6

// mundo
let speed = 13
let spawnAcc = 0
let nextGap = 18
let scoreF = 0
let over = false

let pavementGeo = null
let pavementMat = null
let groundMat = null
let birds = []          // pájaros animados en el cielo
let worldT = 0          // tiempo acumulado para animaciones del cielo
let speedLines = null   // líneas de velocidad (aire)
let streaks = []        // datos por línea
let speedPos = null     // buffer de posiciones de las líneas

// ---------- helpers de construcción ----------
// fondo: degradado del horizonte (tenue) a negro
function backdropTexture() {
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 256
  const g = c.getContext('2d')
  const grd = g.createLinearGradient(0, 0, 0, 256)
  grd.addColorStop(0, '#000000')     // arriba: negro
  grd.addColorStop(0.55, '#050409')
  grd.addColorStop(0.8, '#140e22')   // resplandor ciudad
  grd.addColorStop(1, '#241634')     // horizonte
  g.fillStyle = grd
  g.fillRect(0, 0, 8, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// textura de calles/manzanas para el suelo lateral de la ciudad
function streetTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#15161c'            // asfalto
  g.fillRect(0, 0, 256, 256)
  g.fillStyle = '#1d1e26'            // manzanas
  for (let x = 0; x < 256; x += 128) for (let y = 0; y < 256; y += 128) g.fillRect(x + 12, y + 12, 104, 104)
  g.strokeStyle = '#34363f'          // calles
  g.lineWidth = 16
  for (let p = 0; p <= 256; p += 128) {
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 256); g.stroke()
    g.beginPath(); g.moveTo(0, p); g.lineTo(256, p); g.stroke()
  }
  g.setLineDash([9, 9])              // líneas centrales
  g.strokeStyle = 'rgba(200,180,90,0.22)'
  g.lineWidth = 2
  for (let p = 0; p <= 256; p += 128) {
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 256); g.stroke()
    g.beginPath(); g.moveTo(0, p); g.lineTo(256, p); g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// textura de tierra/gravilla bajo los rieles
function dirtTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')
  // base tierra (apagada)
  g.fillStyle = '#8f6236'
  g.fillRect(0, 0, 256, 256)
  // manchas grandes (variación de tono suave)
  const blobs = [['#82582e', 60], ['#9c6f42', 70], ['#785026', 50]]
  for (const [col, n] of blobs) {
    g.fillStyle = col
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, r = 6 + Math.random() * 22
      g.globalAlpha = 0.14 + Math.random() * 0.18
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
    }
  }
  g.globalAlpha = 1
  // gravilla (puntos finos, bajo contraste)
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * 256, y = Math.random() * 256
    const dark = Math.random() > 0.5
    g.fillStyle = dark ? 'rgba(50,32,14,0.3)' : 'rgba(190,160,110,0.25)'
    const s = Math.random() * 2 + 0.5
    g.fillRect(x, y, s, s)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function skyTexture() {
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 256
  const g = c.getContext('2d')
  const grd = g.createLinearGradient(0, 0, 0, 256)
  grd.addColorStop(0, '#ffd98a')
  grd.addColorStop(0.35, '#ff9ec4')
  grd.addColorStop(0.7, '#c48cff')
  grd.addColorStop(1, '#6a5cff')
  g.fillStyle = grd
  g.fillRect(0, 0, 8, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// geometría de acera: gris en la zona de edificios, se funde a negro a los lados
function makePavementGeo() {
  const geo = new THREE.PlaneGeometry(46, CHUNK_LEN, 46, 1)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const grey = new THREE.Color(0x53565e)
  const black = new THREE.Color(0x000000)
  const col = []
  for (let i = 0; i < pos.count; i++) {
    const x = Math.abs(pos.getX(i))
    const t = x < 13 ? 0 : x > 21 ? 1 : (x - 13) / 8
    const c = grey.clone().lerp(black, t)
    col.push(c.r, c.g, c.b)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  return geo
}

// clona un modelo glb y prepara sombras
function cloneModel(key, cast = true) {
  const m = models[key].clone(true)
  m.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = false } })
  return m
}

// clona un edificio aleatorio, escalado por footprint (conserva proporción), base al suelo
function spawnBuilding() {
  const src = buildingSet[(Math.random() * buildingSet.length) | 0]
  const b = src.clone(true)
  b.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false } })
  b.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(b)
  const size = new THREE.Vector3(); box.getSize(size)
  const foot = Math.max(size.x, size.z) || 1
  let s = (4 + Math.random() * 3) / foot   // footprint 4-7
  if (size.y * s > 26) s = 26 / size.y     // cap altura
  b.scale.setScalar(s)
  b.position.y = -box.min.y * s            // base al suelo
  b.rotation.y = ((Math.random() * 4) | 0) * Math.PI / 2
  return b
}

// (re)genera los edificios de un chunk con modelos aleatorios
function buildBuildings(g) {
  if (g.userData.buildings) g.userData.buildings.forEach((b) => g.remove(b))
  g.userData.buildings = []
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const b = spawnBuilding()
      b.position.x = side * (7.4 + Math.random() * 1.8)
      b.position.z = -CHUNK_LEN / 2 + i * (CHUNK_LEN / 3) + 3
      g.add(b)
      g.userData.buildings.push(b)
    }
  }
}

function makeChunk(z) {
  const g = new THREE.Group()
  g.position.z = z

  // acera de cemento (solo bajo los edificios); se funde a negro a los lados
  const pavement = new THREE.Mesh(pavementGeo, pavementMat)
  pavement.position.y = -0.05
  pavement.receiveShadow = true
  g.add(pavement)

  // suelo de la vía (tierra)
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.5, CHUNK_LEN),
    groundMat
  )
  ground.position.y = -0.25
  ground.receiveShadow = true
  g.add(ground)

  // rieles de suelo (rails.glb) por carril, tiled a lo largo
  const railCount = Math.ceil(CHUNK_LEN / RAIL_SEG)
  for (const lx of LANES) {
    for (let i = 0; i < railCount; i++) {
      const r = cloneModel('rails', false)
      r.scale.setScalar(RAIL_SCALE)
      r.traverse((o) => { if (o.isMesh) o.receiveShadow = true })
      r.position.set(lx, RAIL_LIFT, -CHUNK_LEN / 2 + i * RAIL_SEG + RAIL_SEG / 2)
      g.add(r)
    }
  }

  // vallas laterales (panel detallado, tiled a lo largo del chunk)
  const vallaCount = Math.ceil(CHUNK_LEN / VALLA_SEG)
  for (const side of [-1, 1]) {
    for (let i = 0; i < vallaCount; i++) {
      const v = cloneModel('valla')
      v.scale.setScalar(VALLA_SCALE)
      v.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2 // cara hacia la vía, largo en Z
      v.position.set(side * 4.0, VALLA_LIFT, -CHUNK_LEN / 2 + i * VALLA_SEG + VALLA_SEG / 2)
      g.add(v)
    }
  }

  // farolas (alternando lados)
  for (let i = 0; i < 2; i++) {
    const lamp = cloneModel('lamp', false)
    const side = i % 2 === 0 ? -1 : 1
    lamp.position.set(side * 4.4, 0, -CHUNK_LEN / 2 + 4 + i * (CHUNK_LEN / 2))
    lamp.rotation.y = side > 0 ? Math.PI : 0 // brazo hacia la vía
    g.add(lamp)
  }

  // edificios laterales: los genera dressChunk (modelos aleatorios)

  // cartel neon (1 por chunk, lado aleatorio)
  const sign = cloneModel('sign', false)
  const ss = Math.random() < 0.5 ? -1 : 1
  sign.position.set(ss * 5.2, 0, -CHUNK_LEN / 2 + 6 + Math.random() * 10)
  sign.rotation.y = ss > 0 ? -Math.PI / 2 : Math.PI / 2 // cara hacia la vía
  g.add(sign)

  // tren de escenario (ocasional, vía paralela lejana)
  g.userData.sceneryTrain = null
  const st = cloneModel('train')
  st.scale.setScalar(SCEN_SCALE)
  st.rotation.y = Math.PI / 2 // largo en Z (a lo largo de la vía)
  const ts = Math.random() < 0.5 ? -1 : 1
  st.position.set(ts * 5.4, SCEN_LIFT, 0)
  st.visible = false
  g.add(st)
  g.userData.sceneryTrain = st

  dressChunk(g)
  scene.add(g)
  return g
}

function dressChunk(g) {
  buildBuildings(g) // edificios aleatorios nuevos en cada reciclaje
  // reubica tren de escenario y decide si aparece (~35%)
  const st = g.userData.sceneryTrain
  if (st) {
    const show = Math.random() < 0.4
    st.visible = show
    if (show) {
      const ts = Math.random() < 0.5 ? -1 : 1
      st.position.set(ts * 5.4, SCEN_LIFT, -CHUNK_LEN / 2 + Math.random() * 10)
    }
  }
}

// quita root-motion (traslación de Hips) para que la física del juego controle Y/Z
function stripRootMotion(clip) {
  clip.tracks = clip.tracks.filter((t) => t.name !== 'Hips.position')
  return clip
}

// deja solo el movimiento vertical de Hips (agacharse); quita deriva X/Z
// así el slide se ve pegado al suelo sin desplazarse de carril
function flattenRootXZ(clip) {
  const t = clip.tracks.find((tr) => tr.name === 'Hips.position')
  if (t) {
    const v = t.values
    const x0 = v[0], z0 = v[2]
    for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0 }
  }
  return clip
}

function makePlayer() {
  const g = new THREE.Group()
  const model = charBase
  model.rotation.y = Math.PI // frente hacia -z (corremos alejándonos de la cámara)

  // escala automática a ~1.8 de alto, pies en y=0
  model.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(model)
  const size = new THREE.Vector3()
  box.getSize(size)
  const s = 1.8 / (size.y || 1)
  model.scale.setScalar(s)
  model.position.y = -box.min.y * s

  model.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false }
  })
  g.add(model)
  scene.add(g)

  // mixer + acciones
  mixer = new THREE.AnimationMixer(model)
  actions.run = mixer.clipAction(charClips.run)
  actions.jump = mixer.clipAction(stripRootMotion(charClips.jump))
  actions.slide = mixer.clipAction(flattenRootXZ(charClips.slide))
  actions.death = mixer.clipAction(charClips.death) // con root-motion (sale despedido)
  actions.run.play()
  currentAction = actions.run

  return { g }
}

// transición suave entre animaciones
function fadeTo(name, once = false, fade = 0.15) {
  const next = actions[name]
  if (!next || next === currentAction) return
  next.reset()
  next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity)
  next.clampWhenFinished = once
  next.play()
  if (currentAction) currentAction.crossFadeTo(next, fade, false)
  currentAction = next
}

const OBS_KEY = { block: 'jumpobs', high: 'obs_high', wall: 'wall', train: 'train' }
const OBS_HALF = { block: 0.4, high: 0.35, wall: 0.3, train: OBS_TRAIN_HALF }
const BLOCK_LIFT = 0.55 // obstaculo-saltar centrado (minY -0.55) → base al suelo

function makeObstacle(laneIdx, type, z = SPAWN_Z) {
  const mesh = models[OBS_KEY[type]].clone(true)
  mesh.traverse((o) => { if (o.isMesh) o.castShadow = true })
  mesh.position.x = LANES[laneIdx]
  mesh.position.z = z
  if (type === 'train') {
    mesh.scale.setScalar(OBS_TRAIN_SCALE)
    mesh.rotation.y = Math.PI / 2   // largo a lo largo de la vía (Z)
    mesh.position.y = OBS_TRAIN_LIFT // base al suelo
  } else if (type === 'wall') {
    mesh.scale.setScalar(WALL_SCALE) // valla de frente (cara ancha hacia el jugador)
    mesh.position.y = WALL_LIFT       // base al suelo
  } else if (type === 'block') {
    mesh.position.y = BLOCK_LIFT       // base al suelo
  }
  scene.add(mesh)
  obstacles.push({ mesh, laneIdx, type, halfDepth: OBS_HALF[type], passed: false })
}

// cadena de 1-6 vagones pegados en el mismo carril
function makeTrainChain(laneIdx, zBase = SPAWN_Z) {
  const count = 1 + Math.floor(Math.random() * 6) // 1..6
  const carLen = OBS_TRAIN_HALF * 2
  for (let i = 0; i < count; i++) makeObstacle(laneIdx, 'train', zBase - i * carLen)
}

function makeCoin(laneIdx, z) {
  const m = models.coin.clone(true)
  m.scale.setScalar(COIN_SCALE)
  m.position.set(LANES[laneIdx], 1, z)
  scene.add(m)
  coinsPool.push({ mesh: m, laneIdx, taken: false })
}

// ---------- init ----------
function init() {
  const w = host.value.clientWidth
  const h = host.value.clientHeight
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.5 : 2))
  renderer.setSize(w, h)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  host.value.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  // fondo con degradado a negro; la niebla funde la distancia al horizonte
  scene.background = backdropTexture()
  scene.fog = new THREE.Fog(0x0a0714, 60, 150)
  // acera de cemento con degradado a negro (compartida por todos los chunks)
  pavementMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
  pavementGeo = makePavementGeo()
  // material de tierra compartido, con textura repetida a lo largo de la vía
  const dirtTex = dirtTexture()
  dirtTex.repeat.set(2, CHUNK_LEN / 6)
  groundMat = new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1 })
  curveMaterial(groundMat)
  curveMaterial(pavementMat)

  camera = new THREE.PerspectiveCamera(62, w / h, 0.1, 400)
  camera.position.set(0, 4.6, 8)
  camera.lookAt(0, 1.4, -6)

  const hemi = new THREE.HemisphereLight(0xfff4e0, 0xff9ec4, 1.5)
  scene.add(hemi)
  const dir = new THREE.DirectionalLight(0xffffff, 2.1)
  dir.position.set(-8, 18, 6)
  // target adelante del jugador para que la sombra cubra todo el tramo visible
  dir.target.position.set(0, 0, -10)
  scene.add(dir.target)
  dir.castShadow = true
  dir.shadow.mapSize.set(IS_MOBILE ? 1024 : 2048, IS_MOBILE ? 1024 : 2048)
  dir.shadow.camera.near = 1
  dir.shadow.camera.far = 110
  dir.shadow.camera.left = -22
  dir.shadow.camera.right = 22
  dir.shadow.camera.top = 44
  dir.shadow.camera.bottom = -44
  dir.shadow.bias = -0.0004
  dir.shadow.normalBias = 0.02
  scene.add(dir)

  buildSky()
  buildSpeedLines()

  clock = new THREE.Clock()
  window.addEventListener('resize', onResize)
}

// --- líneas de velocidad ---
function spawnStreak(far) {
  const side = Math.random() > 0.5 ? 1 : -1
  return {
    x: side * (3 + Math.random() * 14),      // fuera del carril central
    y: 0.6 + Math.random() * 11,
    z: far ? -42 - Math.random() * 26 : -42 + Math.random() * 54,
    len: 2.5 + Math.random() * 4.5,
  }
}
function writeStreak(i, s) {
  const o = i * 6
  speedPos[o] = s.x; speedPos[o + 1] = s.y; speedPos[o + 2] = s.z
  speedPos[o + 3] = s.x; speedPos[o + 4] = s.y; speedPos[o + 5] = s.z + s.len
}
function buildSpeedLines() {
  const M = IS_MOBILE ? 45 : 80
  speedPos = new Float32Array(M * 6)
  streaks = []
  for (let i = 0; i < M; i++) {
    const s = spawnStreak()
    streaks.push(s)
    writeStreak(i, s)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(speedPos, 3))
  const mat = new THREE.LineBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0,
    fog: false, depthWrite: false, blending: THREE.AdditiveBlending,
  })
  speedLines = new THREE.LineSegments(geo, mat)
  speedLines.frustumCulled = false
  scene.add(speedLines)
}
function updateSpeedLines(dz) {
  if (!speedLines) return
  // intensidad según velocidad del juego (13 → 30), con base visible desde el inicio
  const norm = Math.max(0, Math.min(1, (speed - 13) / (30 - 13)))
  speedLines.material.opacity = 0.14 + norm * 0.36
  const k = 2.4 // más rápidas que el mundo → sensación de velocidad
  for (let i = 0; i < streaks.length; i++) {
    const s = streaks[i]
    s.z += dz * k
    if (s.z > 12) Object.assign(s, spawnStreak(true))
    writeStreak(i, s)
  }
  speedLines.geometry.attributes.position.needsUpdate = true
}

// --- curvatura de "planeta": la vía se dobla hacia abajo con la distancia ---
const CURVE = 0.0011
function curveMaterial(mat) {
  if (!mat || mat.userData.curved) return
  mat.userData.curved = true
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCurve = { value: CURVE }
    shader.vertexShader = 'uniform float uCurve;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\n  mvPosition.y -= uCurve * mvPosition.z * mvPosition.z;\n  gl_Position = projectionMatrix * mvPosition;'
    )
  }
  mat.needsUpdate = true
}
function curveObject(obj) {
  obj.traverse((o) => {
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(curveMaterial)
  })
}

// sprite suave (círculo con degradado) para nubes/pájaros
function softSprite(draw) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  draw(g)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// estrellas, nubes y pájaros (fog:false para que la niebla no los borre)
function buildSky() {
  // --- estrellas ---
  const N = IS_MOBILE ? 150 : 320
  const pos = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() * 2 - 1) * 90
    pos[i * 3 + 1] = 24 + Math.random() * 55
    pos[i * 3 + 2] = -20 - Math.random() * 150
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff, size: 0.55, sizeAttenuation: true,
    transparent: true, opacity: 0.9, fog: false, depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  scene.add(new THREE.Points(starGeo, starMat))

  // --- nubes ---
  const cloudTex = softSprite((g) => {
    const grd = g.createRadialGradient(32, 32, 4, 32, 32, 32)
    grd.addColorStop(0, 'rgba(210,180,255,0.9)')
    grd.addColorStop(1, 'rgba(210,180,255,0)')
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64)
  })
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex, transparent: true, opacity: 0.22, fog: false, depthWrite: false,
    }))
    s.position.set((Math.random() * 2 - 1) * 70, 30 + Math.random() * 20, -50 - Math.random() * 90)
    const sc = 18 + Math.random() * 22
    s.scale.set(sc, sc * 0.6, 1)
    scene.add(s)
  }

  // --- pájaros ---
  const birdTex = softSprite((g) => {
    g.strokeStyle = '#0c0a12'; g.lineWidth = 6; g.lineCap = 'round'
    g.beginPath(); g.moveTo(8, 40); g.lineTo(32, 24); g.lineTo(56, 40); g.stroke()
  })
  birds = []
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Sprite(new THREE.SpriteMaterial({
      map: birdTex, transparent: true, opacity: 0.85, fog: false, depthWrite: false,
    }))
    const sc = 1.6 + Math.random() * 1.2
    b.scale.set(sc, sc * 0.6, 1)
    b.position.set((Math.random() * 2 - 1) * 40, 16 + Math.random() * 14, -35 - Math.random() * 70)
    scene.add(b)
    birds.push({ sprite: b, speed: 1.2 + Math.random() * 1.6, phase: Math.random() * 6.28, baseY: b.position.y })
  }
}

function updateSky(t) {
  for (const b of birds) {
    b.sprite.position.x -= b.speed * 0.016
    if (b.sprite.position.x < -46) b.sprite.position.x = 46
    b.sprite.position.y = b.baseY + Math.sin(t * 2 + b.phase) * 0.6
  }
}

function makeLoader() {
  const loader = new GLTFLoader()
  const draco = new DRACOLoader()
  draco.setDecoderPath('/draco/')
  loader.setDRACOLoader(draco)
  return loader
}

// personajes seleccionables (mismo rig, distintas animaciones)
const CHARACTERS = {
  1: { name: 'Crimson Vanguard', tag: 'Techwear', accent: '#ff4d4d', img: '/game/p1_cut.png', prefix: '/personaje/Meshy_AI_Crimson_Vanguard_biped_Animation_', jump: 'Jump_Over_Obstacle_2', death: 'Shot_and_Blown_Back' },
  2: { name: 'Operator 03', tag: 'Recon', accent: '#f5c518', img: '/game/p2_cut.png', prefix: '/personaje2/Meshy_AI_Operator_03_biped_Animation_', jump: 'Jump_Over_Obstacle_2', death: 'Knock_Down' },
}
const charList = Object.entries(CHARACTERS).map(([id, c]) => ({ id: Number(id), ...c }))

// carga props + edificios (sin personaje)
function loadProps() {
  const loader = makeLoader()
  const files = {
    coin: '/game/coin_opt.glb',
    jumpobs: '/game/obstaculo-saltar_opt.glb',
    obs_high: '/models/obs_high.glb',
    valla: '/game/valla_opt.glb',
    train: '/game/tren_opt.glb',
    lamp: '/models/lamp.glb',
    sign: '/models/sign.glb',
    rails: '/game/rails.glb',
    wall: '/game/wall_opt.glb',
  }
  const propsP = Object.entries(files).map(([k, url]) =>
    loader.loadAsync(url).then((g) => { models[k] = g.scene })
  )
  const bNums = [1, 2, 4, 6, 7] // edificios (sin el 3 ni el 5)
  const bP = bNums.map((n) =>
    loader.loadAsync(`/game/edificio${n}_opt.glb`).then((g) => { buildingSet.push(g.scene) })
  )
  return Promise.all([...propsP, ...bP])
}

// carga el personaje elegido (run / jump / slide / death)
function loadCharacter(id) {
  const cfg = CHARACTERS[id]
  const loader = makeLoader()
  const cf = {
    run: `${cfg.prefix}Running_withSkin.glb`,
    jump: `${cfg.prefix}${cfg.jump}_withSkin.glb`,
    slide: `${cfg.prefix}slide_right_withSkin.glb`,
    death: `${cfg.prefix}${cfg.death}_withSkin.glb`,
  }
  return Promise.all(Object.entries(cf).map(([k, url]) =>
    loader.loadAsync(url).then((g) => {
      if (k === 'run') charBase = g.scene
      charClips[k] = g.animations[0]
    })
  ))
}

function buildChunks() {
  for (let i = 0; i < CHUNK_COUNT; i++) chunks.push(makeChunk(-i * CHUNK_LEN))
}

function onResize() {
  if (!renderer) return
  const w = host.value.clientWidth
  const h = host.value.clientHeight
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

// ---------- spawn ----------
function spawnPattern(zBase = SPAWN_Z) {
  const free = [0, 1, 2]
  const blocked = new Set()
  const types = ['block', 'high', 'wall', 'train']
  const n = Math.random() < 0.3 ? 2 : 1 // casi siempre 1 obstáculo
  for (let i = 0; i < n && blocked.size < 2; i++) {
    const options = free.filter((l) => !blocked.has(l))
    const l = options[(Math.random() * options.length) | 0]
    const t = types[(Math.random() * types.length) | 0]
    if (t === 'train') makeTrainChain(l, zBase)
    else makeObstacle(l, t, zBase)
    blocked.add(l)
  }
  // monedas en un carril libre
  const openLanes = free.filter((l) => !blocked.has(l))
  if (openLanes.length) {
    const cl = openLanes[(Math.random() * openLanes.length) | 0]
    for (let i = 0; i < 5; i++) makeCoin(cl, zBase - i * 2.2)
  }
}

// ---------- loop ----------
function tick() {
  raf = requestAnimationFrame(tick)
  // secuencia de muerte: reproduce animación, luego muestra game over
  if (dying) {
    const ddt = Math.min(clock.getDelta(), 0.05)
    if (mixer) mixer.update(ddt)
    deathTimer += ddt
    if (deathTimer > 1.5) { dying = false; finishGameOver() }
    renderer.render(scene, camera)
    return
  }
  if (!running) {
    // renderiza el mundo detrás de la pantalla de selección
    if (phase.value === 'select' && renderer) renderer.render(scene, camera)
    return
  }
  const dt = Math.min(clock.getDelta(), 0.05)
  worldT += dt
  updateSky(worldT)

  speed = Math.min(30, speed + dt * 0.4)
  const dz = speed * dt
  updateSpeedLines(dz)

  // entrada: el personaje corre desde detrás hasta su posición; luego das control
  if (intro) {
    player.position.z += (0 - player.position.z) * Math.min(1, dt * 3.2)
    if (player.position.z < 0.2) { player.position.z = 0; intro = false }
  }

  // score
  scoreF += dz * 1.1
  score.value = Math.floor(scoreF)

  // mover chunks
  for (const c of chunks) {
    c.position.z += dz
    if (c.position.z > CHUNK_LEN) {
      c.position.z -= TRACK_LEN
      dressChunk(c)
    }
  }

  // spawn (no genera obstáculos mientras entra el personaje)
  if (!intro) {
    spawnAcc += dz
    if (spawnAcc >= nextGap) {
      spawnAcc = 0
      nextGap = 16 + Math.random() * 10
      spawnPattern()
    }
  }

  // jugador: carril — snap rápido; tras saltar espera un instante (salto inclinado)
  targetX = LANES[lane]
  if (lateralHold > 0) lateralHold -= dt
  if (lateralHold <= 0) {
    player.position.x += (targetX - player.position.x) * Math.min(1, dt * 32)
  }
  player.rotation.z = (targetX - player.position.x) * 0.28

  // mover obstáculos
  for (const o of obstacles) o.mesh.position.z += dz

  // suelo de soporte + choque (el tren es plataforma: se puede caer encima)
  let floorY = 0
  let sideHit = false
  for (const o of obstacles) {
    if (o.laneIdx !== lane) continue
    if (Math.abs(o.mesh.position.z) > o.halfDepth + PLAYER_HALF) continue // sin solape en Z
    if (o.type === 'train') {
      if (player.position.y >= 0.5) floorY = Math.max(floorY, TRAIN_TOP) // en el aire → aterriza encima
      else sideHit = true                                               // a ras de suelo → choca de frente
    } else if (o.type === 'block') {
      if (player.position.y < 0.85) sideHit = true                                   // hay que saltarlo
    } else if (o.type === 'high') {
      // choca solo si el cuerpo solapa la banda real de la valla
      // (deslizar agacha la cabeza; saltar desde un tren te pasa por encima)
      const headTop = player.position.y + (sliding ? 0.8 : 1.7)
      if (player.position.y < HIGH_TOP && headTop > HIGH_BOTTOM) sideHit = true
    } else {
      // muro: solo choca si estás dentro de su volumen; por encima (saltando desde un tren) pasa
      if (player.position.y < WALL_TOP - 0.2) sideHit = true
    }
  }
  if (sideHit && !intro) return gameOver()

  // salto / gravedad con suelo variable
  if (jumpBuffer > 0) jumpBuffer -= dt
  if (coyoteT > 0) coyoteT -= dt
  if (!grounded) {
    // altura fija siempre; mantener salto flota en el pico (más distancia, misma altura)
    let g = GRAVITY
    if (jumpHeld && vy < 1.2 && hangT < HANG_MAX) { g = GRAVITY * 0.15; hangT += dt }
    vy -= g * dt
    player.position.y += vy * dt
    if (player.position.y <= floorY) {
      player.position.y = floorY
      grounded = true
      vy = 0
      // ¿había un salto en cola? encadénalo al instante
      if (jumpBuffer > 0) { jumpBuffer = 0; jump() }
      else if (!sliding) fadeTo('run')
    }
  } else if (floorY > player.position.y + 0.01) {
    player.position.y = floorY            // subió al techo del vagón
  } else if (floorY < player.position.y - 0.01) {
    grounded = false                       // salió del borde → cae
    coyoteT = COYOTE                       // aún puedes saltar un instante
  } else {
    player.position.y = floorY
  }

  // slide (dura al menos SLIDE_TIME; si mantienes la tecla, sigue hasta soltar)
  if (sliding) {
    slideT -= dt
    if (slideT <= 0 && !slideHeld) { sliding = false; if (grounded) fadeTo('run') }
  }

  // animación (skinned)
  if (mixer) mixer.update(dt)

  // limpieza obstáculos que ya pasaron
  for (let i = obstacles.length - 1; i >= 0; i--) {
    if (obstacles[i].mesh.position.z > 12) {
      scene.remove(obstacles[i].mesh)
      obstacles.splice(i, 1)
    }
  }

  // monedas
  for (let i = coinsPool.length - 1; i >= 0; i--) {
    const c = coinsPool[i]
    c.mesh.position.z += dz
    c.mesh.rotation.y += dt * 4
    if (!c.taken && c.laneIdx === lane && Math.abs(c.mesh.position.z) < 1 && Math.abs(player.position.y - 1) < 1.4) {
      c.taken = true
      coins.value++
      scoreF += 15
      scene.remove(c.mesh)
      coinsPool.splice(i, 1)
      continue
    }
    if (c.mesh.position.z > 12) {
      scene.remove(c.mesh)
      coinsPool.splice(i, 1)
    }
  }

  renderer.render(scene, camera)
}

// ---------- acciones ----------
function moveLane(d) {
  if (phase.value !== 'playing' || intro) return
  lane = Math.max(0, Math.min(2, lane + d))
}
function jump() {
  if (phase.value !== 'playing' || intro) return
  // en el aire sin margen de coyote: guarda la pulsación para el aterrizaje
  if (!grounded && coyoteT <= 0) { jumpBuffer = JUMP_BUFFER; return }
  grounded = false
  coyoteT = 0
  vy = JUMP_V
  jumpHeld = true            // mantener la tecla = flota en el pico
  hangT = 0
  lateralHold = LATERAL_HOLD // sube recto antes de desplazarse al lado
  if (sliding) { sliding = false; slideHeld = false }
  fadeTo('jump', true, 0.08) // crossfade rápido: el salto responde al instante
}
function slide(hold = false) {
  if (phase.value !== 'playing' || intro || sliding) return
  if (!grounded) { player.position.y = 0; grounded = true; vy = 0 }
  sliding = true
  slideHeld = hold           // si viene de mantener tecla, sigue hasta soltar
  slideT = SLIDE_TIME
  fadeTo('slide', true)
}

// colisión → reproduce animación de muerte, luego game over
function gameOver() {
  if (dying || over) return
  dying = true
  deathTimer = 0
  running = false
  phase.value = 'dying' // bloquea input; sin overlay durante la animación
  fadeTo('death', true)
}

// tras la animación → muestra la pantalla de game over
function finishGameOver() {
  over = true
  phase.value = 'over'
  if (score.value > best.value) {
    best.value = score.value
    localStorage.setItem('runnerBest', String(best.value))
  }
}

function resetWorld() {
  obstacles.forEach((o) => scene.remove(o.mesh))
  coinsPool.forEach((c) => scene.remove(c.mesh))
  obstacles = []
  coinsPool = []
  lane = 1
  player.position.set(0, 0, 0)
  player.rotation.set(0, 0, 0)
  vy = 0
  grounded = true
  sliding = false
  jumpBuffer = 0
  lateralHold = 0
  coyoteT = 0
  slideHeld = false
  jumpHeld = false
  hangT = 0
  intro = false
  dying = false
  deathTimer = 0
  fadeTo('run')
  speed = 13
  spawnAcc = 0
  nextGap = 18
  scoreF = 0
  score.value = 0
  coins.value = 0
  over = false
}

// elige personaje → carga sus animaciones → crea jugador → arranca
async function selectCharacter(id) {
  if (selectedChar.value) return
  selectedChar.value = id
  phase.value = 'loading'
  try {
    await loadCharacter(id)
  } catch (e) {
    console.error('Error cargando personaje', e)
  }
  playerParts = makePlayer()
  player = playerParts.g
  curveObject(player)
  startCountdown()
}

function startCountdown() {
  phase.value = 'countdown'
  count.value = 3
  const iv = setInterval(() => {
    count.value--
    if (count.value <= 0) {
      clearInterval(iv)
      phase.value = 'playing'
      running = true
      // entrada: aparece detrás de cámara y corre hacia su sitio
      intro = true
      player.position.z = 13
      // primer obstáculo ya presente a media distancia (se ve venir, no aparece de golpe)
      spawnPattern(-68)
      clock.getDelta() // descartar delta acumulado
    }
  }, 700)
}

function restart() {
  resetWorld()
  startCountdown()
}
function togglePause() {
  if (phase.value === 'playing') { phase.value = 'paused'; running = false }
  else if (phase.value === 'paused') { phase.value = 'playing'; running = true; clock.getDelta() }
}
function exit() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  emit('close')
}

// ---------- input ----------
function onKey(e) {
  if (e.repeat) return // ignora auto-repeat: cada pulsación = una acción
  const k = e.key.toLowerCase()
  if (k === 'arrowleft' || k === 'a') moveLane(-1)
  else if (k === 'arrowright' || k === 'd') moveLane(1)
  else if (k === 'arrowup' || k === 'w' || k === ' ') { e.preventDefault(); jump() }
  else if (k === 'arrowdown' || k === 's') slide(true)
  else if (k === 'escape') { if (phase.value === 'playing') togglePause() }
  else if (k === 'p') togglePause()
}
function onKeyUp(e) {
  const k = e.key.toLowerCase()
  if (k === 'arrowup' || k === 'w' || k === ' ') {
    jumpHeld = false // soltar: termina la flotación → cae
  } else if (k === 'arrowdown' || k === 's') {
    slideHeld = false // soltar: termina el slide (respeta el mínimo)
  }
}
let tsx = 0, tsy = 0, tsMoved = false
function onTouchStart(e) {
  const t = e.changedTouches[0]
  tsx = t.clientX; tsy = t.clientY; tsMoved = false
}
function onTouchEnd(e) {
  const t = e.changedTouches[0]
  const dx = t.clientX - tsx
  const dy = t.clientY - tsy
  if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return // tap
  if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1)
  else if (dy < 0) jump()
  else slide()
}

onMounted(async () => {
  document.body.style.overflow = 'hidden'
  init()
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKeyUp)
  try {
    await loadProps()
  } catch (e) {
    console.error('Error cargando modelos', e)
  }
  // curvar todos los materiales de props/edificios (compartidos por los clones)
  Object.values(models).forEach(curveObject)
  buildingSet.forEach(curveObject)
  // banda vertical real de la valla 'high' (se coloca en y=0, sin escala)
  if (models.obs_high) {
    const hb = new THREE.Box3().setFromObject(models.obs_high)
    HIGH_BOTTOM = hb.min.y
    HIGH_TOP = hb.max.y
  }
  buildChunks()
  tick()
  phase.value = 'select' // pantalla de selección de personaje
})

onBeforeUnmount(() => {
  running = false
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('resize', onResize)
  document.body.style.overflow = ''
  renderer?.dispose()
  renderer?.domElement?.remove()
  scene?.traverse((o) => {
    if (o.geometry) o.geometry.dispose()
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose())
      else o.material.dispose()
    }
  })
})
</script>

<template>
  <div class="rg-root">
    <div
      ref="host"
      class="rg-canvas"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    ></div>

    <!-- HUD -->
    <div class="rg-hud">
      <div class="rg-top">
        <button class="rg-btn" @click="togglePause" aria-label="Pausa">
          <span v-if="phase === 'playing'">❚❚</span><span v-else>▶</span>
        </button>
        <div class="rg-stats">
          <div class="rg-score">{{ String(score).padStart(6, '0') }}</div>
          <div class="rg-coins">🪙 {{ coins }}</div>
        </div>
        <button class="rg-btn" @click="exit" aria-label="Salir">✕</button>
      </div>
    </div>

    <!-- loading -->
    <div v-if="phase === 'loading'" class="rg-overlay rg-loading">
      <div class="rg-spinner" aria-hidden="true"></div>
      <p class="rg-loadtxt">Cargando…</p>
    </div>

    <!-- selección de personaje -->
    <div v-if="phase === 'select'" class="rg-overlay rg-select">
      <button class="rg-back" @click="exit" aria-label="Volver">
        ← Volver
      </button>
      <p class="rg-eyebrow rg-select-title">Elige tu corredor</p>
      <div class="rg-chars">
        <button
          v-for="c in charList"
          :key="c.id"
          class="rg-char"
          :style="{ '--acc': c.accent }"
          @click="selectCharacter(c.id)"
        >
          <img class="rg-char-img" :src="c.img" :alt="c.name" />
          <span class="rg-char-fade" aria-hidden="true"></span>
          <span class="rg-char-num">0{{ c.id }}</span>
          <span class="rg-char-name">{{ c.name }}</span>
          <span class="rg-char-tag">{{ c.tag }}</span>
          <span class="rg-char-go">Jugar ▶</span>
        </button>
      </div>
    </div>

    <!-- countdown -->
    <div v-if="phase === 'countdown'" class="rg-overlay rg-count">
      <div class="rg-count-num">{{ count }}</div>
      <p class="rg-hint">← → carril · ↑ / espacio saltar · ↓ deslizar</p>
    </div>

    <!-- pause -->
    <div v-if="phase === 'paused'" class="rg-overlay">
      <h3>Pausa</h3>
      <div class="rg-actions">
        <button class="rg-cta" @click="togglePause">Seguir</button>
        <button class="rg-cta ghost" @click="restart">Reiniciar</button>
        <button class="rg-cta ghost" @click="exit">Salir</button>
      </div>
    </div>

    <!-- game over -->
    <div v-if="phase === 'over'" class="rg-overlay">
      <p class="rg-eyebrow">Game Over</p>
      <div class="rg-final">{{ score }}</div>
      <p class="rg-best">Mejor: {{ best }} · 🪙 {{ coins }}</p>
      <div class="rg-actions">
        <button class="rg-cta" @click="restart">Jugar de nuevo</button>
        <button class="rg-cta ghost" @click="exit">Salir</button>
      </div>
    </div>

    <!-- leyenda de teclas (cómo se juega) -->
    <div class="rg-keys" v-show="phase === 'playing' || phase === 'countdown'">
      <div class="rg-keyrow">
        <kbd class="rg-key">←</kbd><kbd class="rg-key">→</kbd>
        <span class="rg-keylbl">Carril</span>
      </div>
      <div class="rg-keyrow">
        <kbd class="rg-key">↑</kbd>
        <span class="rg-keylbl">Saltar · mantener flota</span>
      </div>
      <div class="rg-keyrow">
        <kbd class="rg-key">↓</kbd>
        <span class="rg-keylbl">Deslizar · mantener sigue</span>
      </div>
    </div>

    <!-- controles táctiles -->
    <div class="rg-touch" v-show="phase === 'playing'">
      <button @click="moveLane(-1)" aria-label="Izquierda">◀</button>
      <button @click="jump" aria-label="Saltar">▲</button>
      <button @click="slide" aria-label="Deslizar">▼</button>
      <button @click="moveLane(1)" aria-label="Derecha">▶</button>
    </div>
  </div>
</template>

<style scoped>
.rg-root {
  position: fixed;
  inset: 0;
  z-index: 100000;
  background: #10121c;
  cursor: default;
  overflow: hidden;
  font-family: var(--font-body);
}
.rg-canvas {
  position: absolute;
  inset: 0;
}
.rg-canvas :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

.rg-hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.rg-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: clamp(0.8rem, 3vw, 1.6rem);
  /* respeta el notch / safe area */
  padding-top: calc(clamp(0.8rem, 3vw, 1.6rem) + env(safe-area-inset-top));
  padding-left: calc(clamp(0.8rem, 3vw, 1.6rem) + env(safe-area-inset-left));
  padding-right: calc(clamp(0.8rem, 3vw, 1.6rem) + env(safe-area-inset-right));
  gap: 1rem;
}
.rg-btn {
  pointer-events: auto;
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition: transform 0.15s, background 0.2s;
}
.rg-btn:hover { background: rgba(0, 0, 0, 0.6); transform: scale(1.05); }
.rg-stats {
  text-align: center;
  color: #fff;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}
.rg-score {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.4rem, 5vw, 2.2rem);
  letter-spacing: 0.05em;
  line-height: 1;
}
.rg-coins {
  font-weight: 600;
  font-size: clamp(0.9rem, 3vw, 1.1rem);
  color: #ffd23d;
}

.rg-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.2rem;
  text-align: center;
  color: #fff;
  background: rgba(10, 10, 20, 0.55);
  backdrop-filter: blur(8px);
}
/* pantalla de carga: negro neto, sin blur */
.rg-loading {
  background: #000;
  backdrop-filter: none;
}
.rg-overlay h3 {
  font-family: var(--font-display);
  font-size: clamp(2rem, 8vw, 3.5rem);
}
.rg-spinner {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: 4px solid rgba(255, 255, 255, 0.15);
  border-top-color: var(--accent);
  animation: rg-spin 0.8s linear infinite;
}
@keyframes rg-spin { to { transform: rotate(360deg); } }
.rg-loadtxt { color: rgba(255, 255, 255, 0.8); letter-spacing: 0.05em; }

/* selección de personaje */
.rg-select { gap: 2.4rem; }
.rg-back {
  pointer-events: auto;
  position: absolute;
  top: clamp(1rem, 3vw, 2rem);
  left: clamp(1rem, 3vw, 2rem);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1.1rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 100px;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition: border-color 0.2s, background 0.2s, transform 0.15s;
}
.rg-back:hover {
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(0, 0, 0, 0.55);
  transform: translateX(-3px);
}
/* título de selección: blanco, bold, grande */
.rg-select-title {
  text-transform: none;
  letter-spacing: -0.01em;
  color: #fff;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.8rem, 5vw, 3rem);
  line-height: 1;
}
.rg-chars {
  display: flex;
  flex-wrap: wrap;
  gap: 1.8rem;
  justify-content: center;
}
.rg-char {
  pointer-events: auto;
  position: relative;
  overflow: hidden;
  width: clamp(210px, 44vw, 300px);
  aspect-ratio: 3 / 4;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.25rem;
  padding: 1.2rem;
  border-radius: 18px;
  border: 2px solid rgba(255, 255, 255, 0.14);
  background:
    radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--acc) 35%, transparent), transparent 70%),
    rgba(12, 12, 20, 0.72);
  color: #fff;
  text-align: left;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: transform 0.18s var(--ease, ease), border-color 0.2s, box-shadow 0.2s;
}
.rg-char:hover {
  transform: translateY(-6px);
  border-color: var(--acc);
  box-shadow: 0 14px 40px -12px var(--acc);
}
/* personaje: grande, margen 50px arriba, cuerpo cortado por el borde inferior */
.rg-char-img {
  position: absolute;
  top: 50px;
  left: 50%;
  transform: translateX(-50%);
  height: 150%;
  width: auto;
  object-fit: contain;
  object-position: top center;
  pointer-events: none;
  z-index: 0;
  filter: drop-shadow(0 6px 20px rgba(0, 0, 0, 0.5));
}
/* degradado inferior para legibilidad del texto */
.rg-char-fade {
  position: absolute;
  inset: auto 0 0 0;
  height: 55%;
  z-index: 1;
  background: linear-gradient(to top, rgba(10, 10, 16, 0.95) 20%, transparent);
  pointer-events: none;
}
.rg-char > :not(.rg-char-img):not(.rg-char-fade) { position: relative; z-index: 2; }
.rg-char-num {
  position: absolute;
  top: 0.9rem;
  right: 1.1rem;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.6rem;
  color: var(--acc);
  opacity: 0.9;
}
.rg-char-name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.1rem, 3.6vw, 1.5rem);
  line-height: 1.05;
}
.rg-char-tag {
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.6);
}
.rg-char-go {
  margin-top: 0.7rem;
  align-self: flex-start;
  padding: 0.4rem 0.9rem;
  border-radius: 100px;
  background: var(--acc);
  color: #08080c;
  font-weight: 700;
  font-size: 0.85rem;
}

.rg-count {
  background: rgba(10, 10, 20, 0.2);
  backdrop-filter: none;
}
.rg-count-num {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(5rem, 26vw, 14rem);
  line-height: 1;
  color: var(--accent);
  text-shadow: 0 0 40px rgba(214, 255, 63, 0.5);
  animation: pop 0.7s var(--ease);
}
@keyframes pop {
  from { transform: scale(1.6); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.rg-hint {
  position: absolute;
  bottom: 12vh;
  color: rgba(255, 255, 255, 0.85);
  font-size: clamp(0.8rem, 3vw, 1rem);
}
.rg-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--accent-2, #ff5c38);
  font-size: 0.9rem;
}
.rg-final {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(3.5rem, 18vw, 9rem);
  line-height: 0.9;
  color: var(--accent);
}
.rg-best { color: rgba(255, 255, 255, 0.75); }
.rg-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  justify-content: center;
  margin-top: 0.5rem;
}
.rg-cta {
  pointer-events: auto;
  padding: 0.9rem 1.6rem;
  border-radius: 100px;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #000;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: transform 0.15s, background 0.2s;
}
.rg-cta:hover { transform: translateY(-2px); }
.rg-cta.ghost {
  background: transparent;
  color: #fff;
  border-color: rgba(255, 255, 255, 0.3);
}

.rg-touch {
  position: absolute;
  bottom: calc(clamp(1.2rem, 5vw, 2.5rem) + env(safe-area-inset-bottom));
  left: 0;
  right: 0;
  display: none;
  justify-content: center;
  gap: 0.8rem;
  padding: 0 1rem;
}
.rg-touch button {
  pointer-events: auto;
  width: 62px;
  height: 62px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font-size: 1.3rem;
  backdrop-filter: blur(6px);
  cursor: pointer;
}
.rg-touch button:active { background: rgba(214, 255, 63, 0.4); }

@media (hover: none) and (pointer: coarse) {
  .rg-touch { display: flex; }
}

/* leyenda de teclas: bordes, transparente, blur */
.rg-keys {
  position: absolute;
  bottom: clamp(1.2rem, 4vw, 2.2rem);
  left: clamp(1.2rem, 4vw, 2.2rem);
  z-index: 6;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  pointer-events: none;
  opacity: 0.85;
}
.rg-keyrow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.rg-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.1rem;
  height: 2.1rem;
  padding: 0 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #fff;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1rem;
  line-height: 1;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.25);
}
.rg-keylbl {
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.78rem;
  letter-spacing: 0.02em;
}

/* en táctil se usan los botones redondos, no la leyenda de teclado */
@media (hover: none) and (pointer: coarse) {
  .rg-keys { display: none; }
}
</style>
