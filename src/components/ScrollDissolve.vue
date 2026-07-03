<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as THREE from 'three'

// Port a Vue + Three.js del ScrollDissolveReveal (r3f original).
// Dos planos full-screen con shaders: el frontal se disuelve con el scroll
// (grayscale + edges) revelando el de atrás.
const props = defineProps({
  imageFront: { type: String, default: '/img1.png' },
  imageBack: { type: String, default: '/img2.png' },
})

const sectionEl = ref(null)
const canvasEl = ref(null)

let renderer, scene, camera, raf
let mat1, mat2, clock
let scrollProgress = 0
let inView = true
let disposed = false

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentFront = `
  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform vec2 uImageResolution;
  uniform float uDissolve;
  uniform vec2 uCenter;
  uniform float uTime;
  uniform float uGrayscale;
  uniform float uEdgeIntensity;
  uniform float uEdgeBrightness;
  varying vec2 vUv;

  mat3 sobelX = mat3(-1.0,0.0,1.0,-2.0,0.0,2.0,-1.0,0.0,1.0);
  mat3 sobelY = mat3(-1.0,-2.0,-1.0,0.0,0.0,0.0,1.0,2.0,1.0);

  float getLuminance(vec3 color){ return dot(color, vec3(0.299,0.587,0.114)); }

  float sobel(sampler2D tex, vec2 uv, vec2 texelSize){
    float gx=0.0; float gy=0.0;
    for(int i=-1;i<=1;i++){
      for(int j=-1;j<=1;j++){
        vec2 offset=vec2(float(i),float(j))*texelSize;
        float lum=getLuminance(texture2D(tex,uv+offset).rgb);
        gx+=lum*sobelX[i+1][j+1];
        gy+=lum*sobelY[i+1][j+1];
      }
    }
    return sqrt(gx*gx+gy*gy);
  }

  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
    float a=hash(i); float b=hash(i+vec2(1.0,0.0));
    float c=hash(i+vec2(0.0,1.0)); float d=hash(i+vec2(1.0,1.0));
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
  }
  float fbm(vec2 p){
    float value=0.0; float amplitude=0.5; float frequency=1.0;
    for(int i=0;i<5;i++){ value+=amplitude*noise(p*frequency); amplitude*=0.5; frequency*=2.0; }
    return value;
  }

  void main(){
    vec2 ratio=vec2(
      min((uResolution.x/uResolution.y)/(uImageResolution.x/uImageResolution.y),1.0),
      min((uResolution.y/uResolution.x)/(uImageResolution.y/uImageResolution.x),1.0)
    );
    vec2 uv=vec2(vUv.x*ratio.x+(1.0-ratio.x)*0.5, vUv.y*ratio.y+(1.0-ratio.y)*0.5);

    vec4 texColor=texture2D(uTexture,uv);
    float gray=getLuminance(texColor.rgb);
    texColor.rgb=mix(texColor.rgb,vec3(gray),uGrayscale);

    vec2 centeredUv=vUv-uCenter;
    float aspect=uResolution.x/uResolution.y;
    centeredUv.x*=aspect;
    float dist=length(centeredUv);
    float angle=atan(centeredUv.y,centeredUv.x);

    float noiseScale=6.0;
    vec2 pixelatedUv=floor(vUv*uResolution/noiseScale)*noiseScale/uResolution;
    float blockNoise=fbm(pixelatedUv*100.0)*0.15;
    float angularNoise=fbm(vec2(angle*5.0,0.0))*0.15;
    float totalNoise=blockNoise+angularNoise;
    float noisyDist=dist+totalNoise;

    float maxDist=length(vec2(aspect*0.5,0.5));
    float normalizedDist=noisyDist/maxDist;
    float dissolveThreshold=uDissolve*1.5;

    vec2 texelSize=1.0/uResolution;
    float edge=sobel(uTexture,uv,texelSize);
    edge=pow(edge,0.7)*2.0; edge=clamp(edge,0.0,1.0);

    float dissolveMask=smoothstep(dissolveThreshold-0.03,dissolveThreshold,normalizedDist);
    vec3 edgeColor=vec3(1.0);
    vec3 baseColor=mix(texColor.rgb,vec3(0.0),uGrayscale);
    vec3 finalColor=baseColor;

    float edgeGlow=edge*(uEdgeIntensity*2.0)*(1.0+uGrayscale*3.0);
    finalColor+=edgeColor*edgeGlow*uEdgeBrightness;

    float edgeZoneWidth=0.15*(1.0-uDissolve)+0.02;
    float edgeZone=smoothstep(dissolveThreshold-edgeZoneWidth,dissolveThreshold-edgeZoneWidth+0.04,normalizedDist)*
                   smoothstep(dissolveThreshold+0.02,dissolveThreshold-0.02,normalizedDist);
    float sparkle=hash(floor(vUv*uResolution/4.0))*edgeZone;
    float edgeBrightness=(1.0-uDissolve)*uEdgeBrightness*(1.0+uGrayscale*2.0);
    finalColor+=vec3(sparkle*3.0*edgeBrightness);

    float alpha=dissolveMask*texColor.a;
    gl_FragColor=vec4(finalColor,alpha);
  }
`

const fragmentBack = `
  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform vec2 uImageResolution;
  uniform float uDissolve;
  uniform vec2 uCenter;
  uniform float uTime;
  uniform float uBrightness;
  uniform float uEdgeIntensity;
  uniform float uDarkness;
  uniform float uGrayscale;
  varying vec2 vUv;

  mat3 sobelX = mat3(-1.0,0.0,1.0,-2.0,0.0,2.0,-1.0,0.0,1.0);
  mat3 sobelY = mat3(-1.0,-2.0,-1.0,0.0,0.0,0.0,1.0,2.0,1.0);

  float getLuminance(vec3 color){ return dot(color, vec3(0.299,0.587,0.114)); }
  float sobel(sampler2D tex, vec2 uv, vec2 texelSize){
    float gx=0.0; float gy=0.0;
    for(int i=-1;i<=1;i++){
      for(int j=-1;j<=1;j++){
        vec2 offset=vec2(float(i),float(j))*texelSize;
        float lum=getLuminance(texture2D(tex,uv+offset).rgb);
        gx+=lum*sobelX[i+1][j+1];
        gy+=lum*sobelY[i+1][j+1];
      }
    }
    return sqrt(gx*gx+gy*gy);
  }

  void main(){
    vec2 ratio=vec2(
      min((uResolution.x/uResolution.y)/(uImageResolution.x/uImageResolution.y),1.0),
      min((uResolution.y/uResolution.x)/(uImageResolution.y/uImageResolution.x),1.0)
    );
    vec2 uv=vec2(vUv.x*ratio.x+(1.0-ratio.x)*0.5, vUv.y*ratio.y+(1.0-ratio.y)*0.5);

    vec4 texColor=texture2D(uTexture,uv);
    float gray=getLuminance(texColor.rgb);
    texColor.rgb=mix(texColor.rgb,vec3(gray),uGrayscale);

    vec2 texelSize=1.0/uResolution;
    float edge=sobel(uTexture,uv,texelSize);
    edge=pow(edge,0.7)*2.0; edge=clamp(edge,0.0,1.0);

    vec3 edgeColor=vec3(1.0);
    vec3 baseColor=mix(texColor.rgb,vec3(0.0),uDarkness);
    float edgeGlow=edge*uEdgeIntensity*2.0;
    baseColor+=edgeColor*edgeGlow;
    vec3 finalColor=clamp(baseColor,0.0,1.0);
    gl_FragColor=vec4(finalColor,texColor.a);
  }
`

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
function resize() {
  if (!renderer || !canvasEl.value) return
  const w = canvasEl.value.clientWidth
  const h = canvasEl.value.clientHeight
  if (w === 0 || h === 0) return
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h, false)
}

function makeMat(fragment, tex, extra) {
  const img = tex.image
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: fragment,
    transparent: true,
    uniforms: {
      uTexture: { value: tex },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uImageResolution: { value: new THREE.Vector2(img.width, img.height) },
      uDissolve: { value: 0.0 },
      uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uTime: { value: 0.0 },
      ...extra,
    },
  })
}

function init() {
  const canvas = canvasEl.value
  const w = canvas.clientWidth
  const h = canvas.clientHeight

  scene = new THREE.Scene()
  // cámara ortográfica: plano 2x2 llena el clip space
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
  camera.position.set(0, 0, 1)

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h, false)

  clock = new THREE.Clock()

  const loader = new THREE.TextureLoader()
  let loadedCount = 0
  const geo = new THREE.PlaneGeometry(2, 2)

  const onBoth = () => {
    if (loadedCount < 2 || disposed) return
    computeProgress()
    animate()
  }

  loader.load(props.imageBack, (t2) => {
    t2.colorSpace = THREE.SRGBColorSpace
    mat2 = makeMat(fragmentBack, t2, {
      uBrightness: { value: 0.0 },
      uEdgeIntensity: { value: 0.6 },
      uDarkness: { value: 1.0 },
      uGrayscale: { value: 1.0 },
    })
    const m2 = new THREE.Mesh(geo, mat2)
    m2.position.z = -0.1
    scene.add(m2)
    loadedCount++
    onBoth()
  })

  loader.load(props.imageFront, (t1) => {
    t1.colorSpace = THREE.SRGBColorSpace
    mat1 = makeMat(fragmentFront, t1, {
      uGrayscale: { value: 0.0 },
      uEdgeIntensity: { value: 0.0 },
      uEdgeBrightness: { value: 1.0 },
    })
    const m1 = new THREE.Mesh(geo, mat1)
    m1.position.z = 0
    scene.add(m1)
    loadedCount++
    onBoth()
  })
}

function animate() {
  if (disposed) return
  raf = requestAnimationFrame(animate)
  if (!inView) return

  const time = clock.getElapsedTime()
  const w = renderer.domElement.width
  const h = renderer.domElement.height
  const progress = scrollProgress

  if (mat1) {
    const u = mat1.uniforms
    u.uTime.value = time
    u.uResolution.value.set(w, h)
    u.uDissolve.value = progress
    u.uGrayscale.value = Math.min(1.0, progress / 0.4)
    u.uEdgeIntensity.value = progress * 0.5
    u.uEdgeBrightness.value = 1.0 - progress
  }
  if (mat2) {
    const u = mat2.uniforms
    u.uTime.value = time
    u.uResolution.value.set(w, h)
    const acc = Math.min(1.0, progress * 1.1)
    u.uEdgeIntensity.value = 0.6 * (1.0 - acc)
    u.uDarkness.value = 1.0 - acc
    u.uGrayscale.value = 1.0 - acc
  }

  renderer.render(scene, camera)
}

let ro = null
onMounted(() => {
  init()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', resize)
  // ResizeObserver: mantiene el buffer sincronizado con el canvas siempre
  ro = new ResizeObserver(() => resize())
  if (canvasEl.value) ro.observe(canvasEl.value)
})
onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(raf)
  ro?.disconnect()
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', resize)
  mat1?.uniforms.uTexture.value.dispose()
  mat2?.uniforms.uTexture.value.dispose()
  mat1?.dispose()
  mat2?.dispose()
  renderer?.dispose()
})
</script>

<template>
  <section ref="sectionEl" class="dissolve">
    <div class="pin">
      <canvas ref="canvasEl" class="gl"></canvas>
    </div>
  </section>
</template>

<style scoped>
.dissolve {
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
  width: 100%;
  height: 100%;
  display: block;
}
</style>
