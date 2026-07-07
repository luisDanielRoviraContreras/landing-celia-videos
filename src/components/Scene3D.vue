<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// Sección 3D: un objeto WebGL que rota y se mueve según el scroll.
// El cubo es placeholder — luego se reemplaza por un modelo GLTF.
const canvasEl = ref(null)
const sectionEl = ref(null)
const cardEls = ref([])

let renderer, scene, camera, raf
let group, model, mixer, dust
let scrollProgress = 0
let disposed = false
let cardIO = null
let modelIO = null
let modelRequested = false
let inView = true

// ruido simplex 3D (Ashima) para el displacement del vértice
const NOISE_GLSL = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`

const VERT = `
uniform float uTime;
uniform float uAmp;
varying vec3 vNormal;
varying vec3 vView;
varying float vDisp;
${NOISE_GLSL}
void main(){
  float n1 = snoise(position * 1.15 + uTime * 0.22);
  float n2 = snoise(position * 2.6 - uTime * 0.16) * 0.5;
  float disp = (n1 + n2) * uAmp;
  vec3 pos = position + normal * disp;
  vDisp = disp;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`

const FRAG = `
uniform vec3 uColorA;
uniform vec3 uColorB;
varying vec3 vNormal;
varying vec3 vView;
varying float vDisp;
void main(){
  float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.4);
  vec3 col = mix(uColorB, uColorA, fres);
  col += uColorA * smoothstep(0.15, 0.8, vDisp) * 0.5;
  vec3 base = vec3(0.02, 0.02, 0.04);
  vec3 outc = mix(base, col, clamp(fres * 1.5 + 0.12, 0.0, 1.0));
  gl_FragColor = vec4(outc, 1.0);
}
`

const POINTS_VERT = `
uniform float uTime;
uniform float uAmp;
varying float vDisp;
${NOISE_GLSL}
void main(){
  float n1 = snoise(position * 1.15 + uTime * 0.22);
  float n2 = snoise(position * 2.6 - uTime * 0.16) * 0.5;
  float disp = (n1 + n2) * uAmp;
  vDisp = disp;
  vec3 pos = position + normal * (disp + 0.06);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = (2.6 + disp * 6.0) * (300.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`

const POINTS_FRAG = `
uniform vec3 uColorA;
varying float vDisp;
void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float d = smoothstep(0.5, 0.0, length(uv));
  gl_FragColor = vec4(uColorA, d * (0.35 + smoothstep(0.1, 0.7, vDisp) * 0.65));
}
`

const steps = [
  {
    n: '01',
    t: 'La idea',
    d: 'Todo arranca con una conversación. Entendemos el objetivo, el tono y a quién le habla. Armamos referencias, estilo, ritmo y paleta. Antes de crear un solo frame, ya sabemos qué historia vamos a contar y cómo se va a sentir.',
  },
  {
    n: '02',
    t: 'La creación',
    d: 'Manos a la obra. Creamos video, imagen, voz y música, iterando rápido hasta dar con la toma. La IA nos deja probar mil caminos en el tiempo que antes tomaba uno — pero cada resultado se elige por intención, no por relleno.',
  },
  {
    n: '03',
    t: 'El acabado',
    d: 'Lo que separa lo bueno de lo memorable. Color, montaje, motion y sonido que unen todas las piezas. Revisamos, ajustamos contigo y entregamos en todos los formatos que necesites, listos para salir.',
  },
]

function computeProgress() {
  const el = sectionEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const total = r.height - window.innerHeight
  const passed = Math.min(Math.max(-r.top, 0), total)
  scrollProgress = total > 0 ? passed / total : 0
  // ¿la sección está en pantalla? (para no renderizar de gratis)
  inView = r.bottom > 0 && r.top < window.innerHeight
  // fallback fiable: cargar el glb al acercarse (~1.5 pantallas), sin depender de IO
  if (!modelRequested && r.top < window.innerHeight * 1.5 && r.bottom > 0) {
    loadModel()
  }
}

function onScroll() {
  computeProgress()
}

function onResize() {
  if (!renderer || !camera) return
  const w = canvasEl.value.clientWidth
  const h = canvasEl.value.clientHeight
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

function init() {
  const canvas = canvasEl.value
  const w = canvas.clientWidth
  const h = canvas.clientHeight

  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
  camera.position.set(0, 0, 6)

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2))
  renderer.setSize(w, h, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15

  group = new THREE.Group()
  scene.add(group)

  // entorno para reflejos PBR (sin archivo HDR externo)
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

  // luces
  const key = new THREE.DirectionalLight(0xffffff, 2.6)
  key.position.set(4, 6, 5)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0xd6ff3f, 2.0) // acento verde
  rim.position.set(-5, -1, -4)
  scene.add(rim)
  const fill = new THREE.DirectionalLight(0x7b5cff, 1.2) // violeta
  fill.position.set(-3, 4, 3)
  scene.add(fill)
  scene.add(new THREE.AmbientLight(0x404050, 0.8))

  // campo de polvo alrededor
  const N = 700
  const pos = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const r = 3.2 + Math.random() * 4.5
    const th = Math.random() * Math.PI * 2
    const ph = Math.acos(Math.random() * 2 - 1)
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th)
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th)
    pos[i * 3 + 2] = r * Math.cos(ph)
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const dustMat = new THREE.PointsMaterial({
    color: 0xd6ff3f,
    size: 0.03,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  dust = new THREE.Points(dustGeo, dustMat)
  scene.add(dust)

  computeProgress()
  animate()
}

// carga diferida del glb (solo cuando la sección se acerca)
function loadModel() {
  if (modelRequested || disposed) return
  modelRequested = true
  const loader = new GLTFLoader()
  loader.load(
    '/astro.glb',
    (gltf) => {
      if (disposed) return
      model = gltf.scene
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      model.position.sub(center)
      const maxDim = Math.max(size.x, size.y, size.z)
      model.scale.setScalar(3.6 / maxDim)
      group.add(model)
      if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(model)
        mixer.clipAction(gltf.animations[0]).play()
      }
    },
    undefined,
    (err) => console.error('Error cargando astro.glb', err)
  )
}

// leve seguimiento del mouse
const mouse = { x: 0, y: 0 }
function onMouseMove(e) {
  mouse.x = (e.clientX / window.innerWidth - 0.5) * 2
  mouse.y = (e.clientY / window.innerHeight - 0.5) * 2
}

let t = 0
// suavizado de rotación hacia el mouse
let rx = 0, ry = 0
function animate() {
  if (disposed) return
  raf = requestAnimationFrame(animate)
  // fuera de pantalla: no gastamos GPU renderizando
  if (!inView) return

  t += 0.016
  const p = scrollProgress

  // animación embebida del modelo
  if (mixer) mixer.update(0.016)

  // rotación: scroll + tiempo + mouse suavizado
  ry += (mouse.x * 0.5 - ry) * 0.05
  rx += (mouse.y * 0.4 - rx) * 0.05
  group.rotation.y = p * Math.PI * 2.2 + t * 0.12 + ry
  group.rotation.x = p * Math.PI * 0.8 + rx
  group.rotation.z = Math.sin(p * Math.PI) * 0.3

  // arco de posición + escala con el scroll
  group.position.x = Math.sin(p * Math.PI) * 1.1
  group.position.y = (0.5 - p) * 0.8
  const s = 0.85 + Math.sin(p * Math.PI) * 0.35
  group.scale.setScalar(s)

  // dolly sutil de cámara
  camera.position.z = 6 - Math.sin(p * Math.PI) * 1.1

  // polvo rota lento en sentido contrario
  if (dust) {
    dust.rotation.y = -t * 0.03
    dust.rotation.x = t * 0.01
  }

  renderer.render(scene, camera)
}

onMounted(() => {
  init()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
  window.addEventListener('mousemove', onMouseMove)

  // reveal propio de las tarjetas (no depende del observer global)
  cardIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in')
          cardIO.unobserve(e.target)
        }
      })
    },
    { threshold: 0.2, rootMargin: '0px 0px -10% 0px' }
  )
  cardEls.value.forEach((el) => el && cardIO.observe(el))

  // carga diferida del glb: cuando la sección está a ~1.5 pantallas
  modelIO = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        loadModel()
        modelIO.disconnect()
      }
    },
    { rootMargin: '1500px 0px' }
  )
  if (sectionEl.value) modelIO.observe(sectionEl.value)
})

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(raf)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('mousemove', onMouseMove)
  cardIO?.disconnect()
  modelIO?.disconnect()
  mixer?.stopAllAction()
  model?.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose()
      const m = o.material
      if (Array.isArray(m)) m.forEach((x) => x.dispose())
      else m?.dispose()
    }
  })
  dust?.geometry.dispose()
  dust?.material.dispose()
  renderer?.dispose()
})
</script>

<template>
  <section ref="sectionEl" class="scene">
    <div class="sticky">
      <canvas ref="canvasEl" class="gl"></canvas>

      <div class="scene-overlay container">
        <p class="eyebrow reveal">// Cómo trabajamos</p>
        <h2 class="scene-title reveal" data-reveal-delay="80">
          De la idea<br />a la pieza final.
        </h2>
      </div>
    </div>

    <div class="steps">
      <div
        v-for="(s, i) in steps"
        :key="i"
        class="step container"
        :class="{ right: i % 2 === 1 }"
      >
        <div
          class="step-card"
          :ref="(el) => (cardEls[i] = el)"
          data-cursor="hover"
        >
          <span class="step-n">{{ s.n }}</span>
          <h3 class="step-t">{{ s.t }}</h3>
          <p class="step-d">{{ s.d }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
@media (max-width: 640px) { .scene { height: 240vh !important; } }
.scene {
  position: relative;
  height: 320vh;
  border-top: 1px solid var(--line);
  background:
    linear-gradient(180deg, rgba(123, 92, 255, 0.06), transparent 22%),
    var(--bg);
}

.sticky {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
}
.gl {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.scene-overlay {
  position: absolute;
  top: clamp(6rem, 14vh, 9rem);
  left: 50%;
  transform: translateX(-50%);
  width: min(1320px, 90vw);
  text-align: center;
  pointer-events: none;
  z-index: 2;
}
.eyebrow {
  font-size: 0.8rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1.2rem;
}
.scene-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(2rem, 5.5vw, 4.4rem);
  line-height: 1;
  letter-spacing: -0.02em;
}

/* pasos que scrollean sobre la escena fija */
.steps {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}
.step {
  height: 106.6vh; /* 320/3 */
  display: flex;
  align-items: center;
}
.step.right {
  justify-content: flex-end;
}
.step-card {
  pointer-events: auto;
  max-width: 420px;
  padding: 2rem;
  background: rgba(17, 17, 20, 0.55);
  backdrop-filter: blur(12px);
  border: 1px solid var(--line);
  border-radius: 16px;
  /* base VISIBLE — si el observer no dispara, igual se ven */
  opacity: 1;
  transition: transform 0.4s var(--ease), border-color 0.4s var(--ease);
}
/* entrada como bonus cuando entra en viewport */
.step-card.in {
  animation: cardIn 0.8s var(--ease) both;
}
@keyframes cardIn {
  from {
    opacity: 0;
    transform: translateY(40px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.step-card:hover {
  transform: translateY(-6px);
  border-color: var(--accent);
}
.step-n {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1rem;
  color: var(--accent);
}
.step-t {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(1.4rem, 3vw, 2rem);
  margin: 0.6rem 0 0.8rem;
}
.step-d {
  color: var(--fg-dim);
  font-size: 1rem;
}

@media (max-width: 620px) {
  .step.right {
    justify-content: flex-start;
  }
}
</style>
