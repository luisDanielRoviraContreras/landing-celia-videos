<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

// Port a Vue de cullenwebber/three-html-to-canvas:
// rasteriza un DOM (#page) -> textura (SVG foreignObject) y la PROYECTA
// sobre un modelo 3D. La cámara se mueve con el scroll (keyframes).

/* ---------- utils ---------- */
function smoothstep(t) {
  return t * t * (3 - 2 * t)
}
function keyframeValue(progress) {
  const KF = [
    { x: 0, y: 0, z: 0, roll: 0 },
    { x: 20, y: -2, z: -10, roll: 0.22 },
    { x: -15, y: 10, z: -5, roll: -0.22 },
    { x: 0, y: 0, z: 0, roll: 0 },
  ]
  const segs = KF.length - 1
  const scaled = progress * segs
  const idx = Math.min(Math.floor(scaled), segs - 1)
  const t = smoothstep(scaled - idx)
  const a = KF[idx], b = KF[idx + 1]
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    roll: a.roll + (b.roll - a.roll) * t,
  }
}

/* ---------- CSS collect (para que fuentes/estilos entren al foreignObject) ---------- */
async function collectDocumentCss() {
  const chunks = await Promise.all(
    Array.from(document.styleSheets).map((s) => readSheet(s))
  )
  return chunks.filter(Boolean).join('\n')
}
async function readSheet(sheet) {
  try {
    const rules = sheet.cssRules
    if (rules) return Array.from(rules).map((r) => r.cssText).join('\n')
  } catch {}
  if (!sheet.href) return ''
  try {
    const res = await fetch(sheet.href)
    const css = await res.text()
    return await inlineFontUrls(css)
  } catch {
    return ''
  }
}
async function inlineFontUrls(css) {
  const re = /url\((https:\/\/[^)"']+)\)/g
  const urls = Array.from(new Set(Array.from(css.matchAll(re), (m) => m[1])))
  if (!urls.length) return css
  const pairs = await Promise.all(
    urls.map(async (url) => {
      try {
        const r = await fetch(url)
        const blob = await r.blob()
        const dataUri = await new Promise((res, rej) => {
          const fr = new FileReader()
          fr.onload = () => res(fr.result)
          fr.onerror = rej
          fr.readAsDataURL(blob)
        })
        return [url, dataUri]
      } catch {
        return [url, null]
      }
    })
  )
  let out = css
  for (const [orig, uri] of pairs) if (uri) out = out.split(orig).join(uri)
  return out
}

/* ---------- HtmlToCanvas ---------- */
class HtmlToCanvas {
  constructor(element, { width, height, pixelRatio = 2 } = {}) {
    this.element = element
    this.pixelRatio = pixelRatio
    this.extraCss = ''
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.texture.generateMipmaps = false
    this._rendering = false
    this._pending = false
    this.resize(width ?? window.innerWidth, height ?? window.innerHeight)
  }
  resize(w, h) {
    this.width = w
    this.height = h
  }
  async update() {
    if (this._rendering) {
      this._pending = true
      return
    }
    this._rendering = true
    try {
      do {
        this._pending = false
        const nw = Math.floor(this.width * this.pixelRatio)
        const nh = Math.floor(this.height * this.pixelRatio)
        if (nw !== this.canvas.width || nh !== this.canvas.height) {
          this.canvas.width = nw
          this.canvas.height = nh
        }
        const url = this.#svgUrl()
        const img = new Image()
        img.src = url
        await img.decode()
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height)
        this.texture.needsUpdate = true
      } while (this._pending)
    } finally {
      this._rendering = false
    }
  }
  #svgUrl() {
    const serialized = new XMLSerializer().serializeToString(this.element)
    const styleBlock = this.extraCss
      ? `<style xmlns="http://www.w3.org/1999/xhtml">/*<![CDATA[*/${this.extraCss}/*]]>*/</style>`
      : ''
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}">
      <foreignObject width="100%" height="100%">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:${this.width}px;height:${this.height}px;">
      ${styleBlock}${serialized}
      </div></foreignObject></svg>`
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  }
  dispose() {
    this.texture.dispose()
  }
}

/* ---------- Projector (onBeforeCompile) ---------- */
function createProjector({ camera, texture }) {
  const uniforms = {
    projectedTexture: { value: texture },
    projectorViewMatrix: { value: new THREE.Matrix4() },
    projectorProjectionMatrix: { value: new THREE.Matrix4() },
    projectorPosition: { value: new THREE.Vector3() },
    uLitness: { value: 0 },
  }
  function applyTo(mesh) {
    const material = mesh.material
    if (!material) return
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        projectedTexture: uniforms.projectedTexture,
        projectorViewMatrix: uniforms.projectorViewMatrix,
        projectorProjectionMatrix: uniforms.projectorProjectionMatrix,
        projectorPosition: uniforms.projectorPosition,
        uLitness: uniforms.uLitness,
      })
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform mat4 projectorViewMatrix;
          uniform mat4 projectorProjectionMatrix;
          uniform vec3 projectorPosition;
          varying vec4 vProjectedCoord;
          varying vec3 vProjectorDir;
          varying vec3 vProjectorNormal;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec4 _projWorld = modelMatrix * vec4(transformed, 1.0);
          vProjectedCoord = projectorProjectionMatrix * projectorViewMatrix * _projWorld;
          vProjectorDir = normalize(projectorPosition - _projWorld.xyz);
          vProjectorNormal = normalize(mat3(modelMatrix) * normal);`
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform sampler2D projectedTexture;
          uniform float uLitness;
          varying vec4 vProjectedCoord;
          varying vec3 vProjectorDir;
          varying vec3 vProjectorNormal;`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec3 _projNDC = vProjectedCoord.xyz / vProjectedCoord.w;
          vec2 _projUV = _projNDC.xy * 0.5 + 0.5;
          float _inFrustum = step(0.0, _projUV.x) * step(_projUV.x, 1.0)
                           * step(0.0, _projUV.y) * step(_projUV.y, 1.0)
                           * step(-1.0, _projNDC.z) * step(_projNDC.z, 1.0);
          float _facing = step(0.0, dot(vProjectorNormal, vProjectorDir));
          vec4 _projColor = texture2D(projectedTexture, _projUV);
          float _mask = _inFrustum * _facing;
          diffuseColor.rgb = mix(diffuseColor.rgb, _projColor.rgb, _mask);
          vec3 _flatDiffuse = diffuseColor.rgb;`
        )
        .replace(
          '#include <opaque_fragment>',
          `#include <opaque_fragment>
          gl_FragColor.rgb = mix(_flatDiffuse, gl_FragColor.rgb, uLitness);`
        )
    }
    material.needsUpdate = true
  }
  function update() {
    camera.updateMatrixWorld()
    uniforms.projectorViewMatrix.value.copy(camera.matrixWorldInverse)
    uniforms.projectorProjectionMatrix.value.copy(camera.projectionMatrix)
    uniforms.projectorPosition.value.setFromMatrixPosition(camera.matrixWorld)
  }
  return { applyTo, update, uniforms, camera }
}

/* ---------- componente ---------- */
const CAMERA_FOV = 45
const REST = new THREE.Vector3(0, 0, 15)
const LOOK = new THREE.Vector3(0, -1, -4)

const sectionEl = ref(null)
const canvasEl = ref(null)
const pageEl = ref(null)

let renderer, scene, camera, raf, clock
let projector, htmlToCanvas, projectedMeshes = []
let width = 0, height = 0
let scrollProgress = 0
let inView = true
let disposed = false
let ro = null

function dims() {
  const c = canvasEl.value
  return { w: c.clientWidth, h: c.clientHeight }
}

function computeProgress() {
  const el = sectionEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const total = r.height - window.innerHeight
  const passed = Math.min(Math.max(-r.top, 0), total)
  scrollProgress = total > 0 ? passed / total : 0
  inView = r.bottom > 0 && r.top < window.innerHeight
}
function onScroll() {
  computeProgress()
}

async function init() {
  const { w, h } = dims()
  width = w; height = h

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0a0a0c)

  camera = new THREE.PerspectiveCamera(CAMERA_FOV, w / h, 1, 100)
  camera.position.copy(REST)
  camera.lookAt(LOOK)

  renderer = new THREE.WebGLRenderer({ canvas: canvasEl.value, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h, false)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace

  scene.add(new THREE.AmbientLight(0xffffff, 1.0))
  const key = new THREE.DirectionalLight(0xffffff, 2.6)
  key.position.set(5, 8, 6)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 50
  key.shadow.camera.left = -15
  key.shadow.camera.right = 15
  key.shadow.camera.top = 15
  key.shadow.camera.bottom = -15
  key.shadow.bias = -0.0001
  key.shadow.normalBias = 0.02
  scene.add(key)

  clock = new THREE.Clock()

  const loader = new GLTFLoader()
  const draco = new DRACOLoader()
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
  loader.setDRACOLoader(draco)
  loader.load('/projection-model.glb', (gltf) => {
    if (disposed) return
    const model = gltf.scene
    // materiales oscuros: sin blanco. Donde cae la proyección se ve el HTML,
    // el resto queda casi negro (solo se lee el texto proyectado).
    const standard = new THREE.MeshStandardMaterial({
      color: 0x0a0a0c,
      roughness: 0.85,
      metalness: 0,
    })
    const basic = new THREE.MeshBasicMaterial({ color: 0x0a0a0c })
    projectedMeshes = []
    model.traverse((c) => {
      if (!c.isMesh) return
      const nm = c.userData?.name || c.name || ''
      if (nm === 'bg') {
        c.material = basic
        c.castShadow = false
        c.receiveShadow = true
      } else {
        c.material = standard
        c.castShadow = true
        c.receiveShadow = true
      }
      projectedMeshes.push(c)
    })
    scene.add(model)
    setupProjection()
    animate()
  })
}

function setupProjection() {
  const projCam = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 1, 100)
  projCam.position.copy(REST)
  projCam.lookAt(LOOK)
  projCam.updateMatrixWorld()

  htmlToCanvas = new HtmlToCanvas(pageEl.value, {
    width,
    height,
    pixelRatio: Math.min(window.devicePixelRatio, 2),
  })

  projector = createProjector({ camera: projCam, texture: htmlToCanvas.texture })
  for (const m of projectedMeshes) projector.applyTo(m)
  projector.update()
  rasterize()
}

async function rasterize() {
  if (document.fonts && document.fonts.ready) await document.fonts.ready
  if (!htmlToCanvas.extraCss) htmlToCanvas.extraCss = await collectDocumentCss()
  await htmlToCanvas.update()
}

function animate() {
  if (disposed) return
  raf = requestAnimationFrame(animate)
  if (!inView) return

  const p = scrollProgress
  const kf = keyframeValue(p)
  camera.position.set(REST.x + kf.x, REST.y + kf.y, REST.z + kf.z)
  camera.lookAt(LOOK)
  camera.rotateZ(kf.roll)

  if (projector) {
    const distFromRest = Math.min(p, 1 - p) * 2
    const t = Math.min(distFromRest, 1)
    // fade suave: nunca funde del todo, el HTML sigue legible
    projector.uniforms.uLitness.value = smoothstep(t) * 0.45
  }
  renderer.render(scene, camera)
}

function resize() {
  if (!renderer || !canvasEl.value) return
  const { w, h } = dims()
  if (!w || !h) return
  width = w; height = h
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  if (projector) {
    projector.camera.aspect = w / h
    projector.camera.updateProjectionMatrix()
    projector.update()
  }
  if (htmlToCanvas) {
    htmlToCanvas.resize(w, h)
    rasterize()
  }
}

onMounted(() => {
  init()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', resize)
  ro = new ResizeObserver(() => resize())
  if (canvasEl.value) ro.observe(canvasEl.value)
  computeProgress()
})
onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(raf)
  ro?.disconnect()
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', resize)
  htmlToCanvas?.dispose()
  renderer?.dispose()
})
</script>

<template>
  <section ref="sectionEl" class="projscene">
    <div class="pin">
      <!-- DOM que se rasteriza y proyecta (estilos INLINE para que el
           foreignObject los aplique sí o sí; las fuentes vienen del CSS
           inyectado por collectDocumentCss) -->
      <div
        ref="pageEl"
        id="page"
        class="page"
        style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#0a0a0c;color:#f2f0eb;overflow:hidden;"
      >
        <div style="text-align:center;padding:4vw;">
          <p style="font-family:'Satoshi',sans-serif;font-size:1.6rem;letter-spacing:0.2em;text-transform:uppercase;color:#d6ff3f;margin:0 0 1.5rem;">
            Estudio creativo · 2026
          </p>
          <h2 style="font-family:'Clash Display',sans-serif;font-weight:700;font-size:7rem;line-height:0.95;letter-spacing:-0.02em;color:#f2f0eb;margin:0;">
            Creamos<br />cosas
          </h2>
          <p style="font-family:'Satoshi',sans-serif;font-size:1.8rem;color:#8a8a92;margin:2rem 0 0;">
            Video · Imagen · Marca · Ideas
          </p>
          <p style="font-family:'Clash Display',sans-serif;font-size:2.2rem;color:#d6ff3f;margin:1rem 0 0;">
            luisdanielrovira8@gmail.com
          </p>
        </div>
      </div>

      <canvas ref="canvasEl" class="gl"></canvas>
    </div>
  </section>
</template>

<style scoped>
.projscene {
  position: relative;
  height: 300vh;
  border-top: 1px solid var(--line);
  background: var(--bg);
}
.pin {
  position: sticky;
  top: 0;
  height: 100vh;
  width: 100%;
  overflow: hidden;
}
.gl {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  display: block;
}

/* #page: full-viewport, detrás del canvas (canvas opaco lo tapa) */
.page {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  background: #0a0a0c;
  color: #f2f0eb;
  overflow: hidden;
}
.page-inner {
  text-align: center;
  padding: 4vw;
}
.page-kicker {
  font-family: 'Satoshi', sans-serif;
  font-size: 1.4rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #d6ff3f;
  margin-bottom: 1.5rem;
}
.page-title {
  font-family: 'Clash Display', sans-serif;
  font-weight: 700;
  font-size: 6rem;
  line-height: 0.95;
  letter-spacing: -0.02em;
  color: #f2f0eb;
}
.page-sub {
  font-family: 'Satoshi', sans-serif;
  font-size: 1.6rem;
  color: #8a8a92;
  margin-top: 2rem;
}
.page-mail {
  font-family: 'Clash Display', sans-serif;
  font-size: 2rem;
  color: #d6ff3f;
  margin-top: 1rem;
}
</style>
