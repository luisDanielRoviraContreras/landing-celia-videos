<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// Sección VR: unas gafas de realidad virtual que flotan, rotan al hacer
// scroll con rebote fluido (spring) y se inclinan con el movimiento del mouse.
const canvasEl = ref(null)
const sectionEl = ref(null)
const cardEls = ref([])

let renderer, scene, camera, raf
let group, model, dust
let scrollProgress = 0
let disposed = false
let cardIO = null
let modelIO = null
let modelRequested = false
let inView = true

const features = [
  {
    t: 'Mundos inmersivos',
    d: 'Entornos 3D navegables a escala real. Arquitectura, naturaleza o espacios imposibles — construidos para explorarse desde dentro.',
  },
  {
    t: 'Simulacros',
    d: 'Entrenamiento y simulación segura: procesos, maquinaria o escenarios de riesgo replicados al detalle, sin consecuencias reales.',
  },
  {
    t: 'Experiencias interactivas',
    d: 'Interfaces espaciales que responden a la mirada y las manos. Producto, marca o juego, pensados para gafas VR de punta a punta.',
  },
]

function computeProgress() {
  const el = sectionEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const total = r.height - window.innerHeight
  const passed = Math.min(Math.max(-r.top, 0), total)
  scrollProgress = total > 0 ? passed / total : 0
  inView = r.bottom > 0 && r.top < window.innerHeight
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2

  group = new THREE.Group()
  scene.add(group)

  // entorno para reflejos PBR
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

  // luces
  const key = new THREE.DirectionalLight(0xffffff, 2.8)
  key.position.set(4, 6, 5)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0xd6ff3f, 2.2) // acento verde
  rim.position.set(-5, -1, -4)
  scene.add(rim)
  const fill = new THREE.DirectionalLight(0x7b5cff, 1.6) // violeta
  fill.position.set(-3, 4, 3)
  scene.add(fill)
  scene.add(new THREE.AmbientLight(0x404050, 0.9))

  // campo de partículas alrededor
  const N = 600
  const pos = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const r = 3.4 + Math.random() * 4.5
    const th = Math.random() * Math.PI * 2
    const ph = Math.acos(Math.random() * 2 - 1)
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th)
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th)
    pos[i * 3 + 2] = r * Math.cos(ph)
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const dustMat = new THREE.PointsMaterial({
    color: 0x7b5cff,
    size: 0.035,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  dust = new THREE.Points(dustGeo, dustMat)
  scene.add(dust)

  computeProgress()
  animate()
}

// carga diferida del glb de las gafas
function loadModel() {
  if (modelRequested || disposed) return
  modelRequested = true
  const loader = new GLTFLoader()
  loader.load(
    '/vr/gafas.glb',
    (gltf) => {
      if (disposed) return
      model = gltf.scene
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      model.position.sub(center)
      const maxDim = Math.max(size.x, size.y, size.z)
      model.scale.setScalar(3.4 / maxDim)
      // oscurecer el material: menos gris, más negro
      model.traverse((o) => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          mats.forEach((m) => {
            if (m.color) m.color.multiplyScalar(0.28)
            if ('metalness' in m) m.metalness = Math.min((m.metalness ?? 0.5) + 0.25, 1)
            if ('roughness' in m) m.roughness = Math.min((m.roughness ?? 0.5) + 0.15, 1)
          })
        }
      })
      group.add(model)
    },
    undefined,
    (err) => console.error('Error cargando gafas.glb', err)
  )
}

// leve seguimiento del mouse
const mouse = { x: 0, y: 0 }
function onMouseMove(e) {
  mouse.x = (e.clientX / window.innerWidth - 0.5) * 2
  mouse.y = (e.clientY / window.innerHeight - 0.5) * 2
}

let t = 0
// spring de rotación al scroll: rebote fluido (overshoot)
let springY = 0, springVelY = 0
let springX = 0, springVelX = 0
// suavizado de la inclinación por mouse
let rx = 0, ry = 0
const STIFF = 0.055
const DAMP = 0.82

function animate() {
  if (disposed) return
  raf = requestAnimationFrame(animate)
  if (!inView) return

  t += 0.016
  const p = scrollProgress

  // objetivo de rotación en función del scroll
  const targetY = p * Math.PI * 1.6
  const targetX = Math.sin(p * Math.PI) * 0.5

  // spring hacia el objetivo -> overshoot elástico (rebote)
  springVelY += (targetY - springY) * STIFF
  springVelY *= DAMP
  springY += springVelY

  springVelX += (targetX - springX) * STIFF
  springVelX *= DAMP
  springX += springVelX

  // inclinación suave por mouse
  ry += (mouse.x * 0.45 - ry) * 0.05
  rx += (mouse.y * 0.35 - rx) * 0.05

  // rotación final: scroll (spring) + deriva lenta + mouse
  group.rotation.y = springY + t * 0.15 + ry
  group.rotation.x = springX + rx
  group.rotation.z = Math.sin(t * 0.5) * 0.05

  // flotación: bob vertical + leve deriva lateral
  group.position.y = Math.sin(t * 1.1) * 0.28 + (0.4 - p) * 0.5
  group.position.x = Math.sin(t * 0.6) * 0.12

  // partículas rotan lento en sentido contrario
  if (dust) {
    dust.rotation.y = -t * 0.03
    dust.rotation.x = t * 0.012
  }

  renderer.render(scene, camera)
}

onMounted(() => {
  init()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
  window.addEventListener('mousemove', onMouseMove)

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
  <section id="vr" ref="sectionEl" class="vr">
    <div class="sticky">
      <canvas ref="canvasEl" class="gl"></canvas>

      <div class="vr-overlay container">
        <p class="eyebrow reveal">// Realidad Virtual</p>
        <h2 class="vr-title reveal" data-reveal-delay="80">
          Creamos mundos<br />para ponerte dentro.
        </h2>
        <p class="vr-lead reveal" data-reveal-delay="160">
          Diseñamos y construimos experiencias para gafas de realidad virtual:
          mundos inmersivos, simulacros y espacios interactivos donde la marca
          deja de mirarse y empieza a habitarse.
        </p>
      </div>
    </div>

    <div class="vr-features container">
      <div
        v-for="(f, i) in features"
        :key="i"
        class="vr-card"
        :ref="(el) => (cardEls[i] = el)"
        data-cursor="hover"
      >
        <span class="vr-card-n">0{{ i + 1 }}</span>
        <h3 class="vr-card-t">{{ f.t }}</h3>
        <p class="vr-card-d">{{ f.d }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.vr {
  position: relative;
  border-top: 1px solid var(--line);
  background: var(--bg);
}
/* hairline de acento en el borde superior */
.vr::after {
  content: '';
  position: absolute;
  top: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: min(680px, 70vw);
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--violet), transparent);
  opacity: 0.5;
  pointer-events: none;
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

.vr-overlay {
  position: absolute;
  top: clamp(6rem, 15vh, 10rem);
  left: 50%;
  transform: translateX(-50%);
  width: min(1100px, 90vw);
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
.vr-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(2rem, 5.5vw, 4.2rem);
  line-height: 1;
  letter-spacing: -0.02em;
}
.vr-lead {
  margin: 1.6rem auto 0;
  max-width: 560px;
  color: var(--fg-dim);
  font-size: clamp(0.95rem, 1.4vw, 1.1rem);
  line-height: 1.5;
}

/* tarjetas debajo de la escena fija */
.vr-features {
  position: relative;
  z-index: 3;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.2rem;
  padding-block: clamp(3rem, 8vh, 6rem);
}
.vr-card {
  position: relative;
  padding: 1.9rem 1.8rem 2rem;
  background: rgba(17, 17, 20, 0.5);
  backdrop-filter: blur(12px);
  border: 1px solid var(--line);
  border-radius: 16px;
  overflow: hidden;
  opacity: 0;
  transform: translateY(40px);
  transition: transform 0.5s var(--ease), border-color 0.4s var(--ease),
    background 0.4s var(--ease), opacity 0.5s var(--ease);
}
/* línea de acento que crece en el borde superior al hover */
.vr-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  height: 2px;
  width: 100%;
  background: linear-gradient(90deg, var(--accent), var(--violet));
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.5s var(--ease);
}
.vr-card.in {
  opacity: 1;
  transform: translateY(0);
}
.vr-card:hover {
  transform: translateY(-6px);
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(20, 20, 24, 0.6);
}
.vr-card:hover::before {
  transform: scaleX(1);
}
.vr-card-n {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--accent);
  transition: border-color 0.4s var(--ease);
}
.vr-card:hover .vr-card-n {
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}
.vr-card-t {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(1.3rem, 2.4vw, 1.7rem);
  margin: 1rem 0 0.7rem;
}
.vr-card-d {
  color: var(--fg-dim);
  font-size: 0.98rem;
  line-height: 1.5;
}

@media (max-width: 860px) {
  .vr-features {
    grid-template-columns: 1fr;
    max-width: 480px;
  }
}
</style>
