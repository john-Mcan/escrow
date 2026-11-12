"use client";

import { type CSSProperties, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Mar de partículas para el fondo del hero: una grilla en perspectiva que un puñado de olas de Gerstner empuja hacia
 * quien mira. Todo el movimiento ocurre en el vertex shader, así que cada cuadro es un solo draw call sin trabajo por
 * partícula en JS. Sin WebGL queda el fondo liso; con "reducir movimiento" se dibuja un único cuadro quieto.
 */

const VERTEX = /* glsl */ `
precision highp float;
attribute vec3 a_point; // u: posición a lo ancho, v: profundidad (0 cerca, 1 horizonte), semilla
uniform mat4 u_viewProj;
uniform vec3 u_eye;
uniform vec3 u_light;
uniform vec2 u_spread; // medio ancho visible a la distancia d: d * x + y
uniform float u_near;
uniform float u_far;
uniform float u_rowStep; // separación entre filas a la distancia d: d * u_rowStep
uniform float u_time;
uniform float u_pointSize;
uniform vec3 u_body;
uniform vec3 u_crest;
varying vec3 v_color;
varying float v_alpha;
varying float v_sigma;
varying float v_quad;

const float STEEPNESS = 0.8;
// Luz que aporta cada partícula por píxel de tamaño; calibrada para el mismo brillo medio que los puntos sin filtrar.
const float ENERGY = 0.7;
const float WAVES = 6.0;

// Ola de Gerstner que avanza en la dirección dir; m (0..1) escala su altura. Acumula desplazamiento y normal.
void wave(vec2 dir, float wavelength, float amp, float m, float d, vec2 xz, inout vec3 offset, inout vec3 normal) {
  // Mar adentro las filas se separan: una ola con pocas filas por longitud de onda ya no se puede dibujar y genera
  // moiré. Se apaga antes de llegar a ese punto, así que lejos solo quedan las ondulaciones largas.
  float lod = smoothstep(3.0, 6.0, wavelength / (d * u_rowStep));
  float k = 6.2831853 / wavelength;
  float f = k * dot(dir, xz) - sqrt(9.8 * k) * u_time;
  float c = cos(f);
  float s = sin(f);
  float a = amp * m * lod;
  // La "picudez" se reparte entre las olas: juntas no superan STEEPNESS y las crestas nunca se dan vuelta.
  float q = STEEPNESS / WAVES * m * lod;
  offset += vec3(q / k * dir.x * c, a * s, q / k * dir.y * c);
  normal -= vec3(dir.x * k * a * c, q * s, dir.y * k * a * c);
}

void main() {
  // Filas espaciadas en forma exponencial: densas al frente y comprimidas hacia el horizonte, donde se leen como líneas.
  float d = u_near * pow(u_far / u_near, a_point.y);
  vec2 xz = vec2((a_point.x * 2.0 - 1.0) * (d * u_spread.x + u_spread.y), -d);

  // Modulación lenta de la altura: zonas más agitadas y otras casi planas, como en mar abierto.
  float m = 0.6 + 0.4 * sin(xz.x * 0.09 + xz.y * 0.05 + u_time * 0.21) * sin(xz.x * 0.05 - xz.y * 0.08 - u_time * 0.13);

  vec3 offset = vec3(0.0);
  vec3 normal = vec3(0.0, 1.0, 0.0);
  // Direcciones cerca de +z (hacia la cámara), cada una girada unos grados para que el oleaje no se vea en fila.
  wave(vec2(0.139, 0.990), 9.0, 0.30, m, d, xz, offset, normal);
  wave(vec2(-0.342, 0.940), 5.6, 0.18, m, d, xz, offset, normal);
  wave(vec2(0.500, 0.866), 3.4, 0.11, m, d, xz, offset, normal);
  wave(vec2(-0.616, 0.788), 2.1, 0.065, m, d, xz, offset, normal);
  wave(vec2(0.242, 0.970), 1.3, 0.036, m, d, xz, offset, normal);
  wave(vec2(-0.819, 0.574), 0.8, 0.018, m, d, xz, offset, normal);

  vec3 p = vec3(xz.x + offset.x, offset.y, xz.y + offset.z);
  gl_Position = u_viewProj * vec4(p, 1.0);

  // Brillo: las crestas se encienden como líneas a lo ancho y un reflejo suave de la luz baja les suma destellos.
  vec3 n = normalize(normal);
  float spec = pow(max(dot(reflect(-u_light, n), normalize(u_eye - p)), 0.0), 8.0);
  float crest = smoothstep(0.08, 0.36, offset.y);
  float glint = clamp(crest * 0.9 + spec * 0.6, 0.0, 1.0);

  float fog = 1.0 - smoothstep(u_far * 0.5, u_far, d);
  float front = 0.35 + 0.65 * smoothstep(u_near, u_near * 4.0, d);
  float intensity = (0.16 + 1.05 * glint) * fog * front * (0.75 + 0.25 * a_point.z);

  // Antialiasing: cada partícula es una mancha gaussiana (su tamaño más un filtro de medio píxel) que reparte su luz
  // entre los píxeles vecinos según su posición exacta. Sin esto, cada punto cae entero en un píxel y las crestas se
  // ven escalonadas y titilan al moverse. La energía total depende solo del tamaño: el brillo medio no cambia.
  float size = u_pointSize * clamp(2.6 / sqrt(d), 0.5, 2.0);
  v_sigma = sqrt(size * size * 0.16 + 0.25);
  v_quad = ceil(v_sigma * 5.0);
  v_color = mix(u_body, u_crest, glint);
  v_alpha = intensity * ENERGY * size / (6.2831853 * v_sigma * v_sigma);
  gl_PointSize = v_quad;
}
`;

const FRAGMENT = /* glsl */ `
precision mediump float;
varying vec3 v_color;
varying float v_alpha;
varying float v_sigma;
varying float v_quad;

void main() {
  vec2 offset = (gl_PointCoord - 0.5) * v_quad; // en píxeles, desde el centro exacto de la partícula
  float a = v_alpha * exp(-dot(offset, offset) / (2.0 * v_sigma * v_sigma));
  gl_FragColor = vec4(v_color * a, a);
}
`;

/** Altura de la cámara sobre el agua y distancia a la que se apaga el mar. */
const EYE_HEIGHT = 1.5;
const FAR = 60;
/** Fracción del alto, desde arriba, donde queda el horizonte. */
const HORIZON = 0.12;
const MAX_DPR = 1.5;

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/** PRNG determinista: el mar sale igual en cada carga. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Grilla con desorden: al frente se ve como ruido fino; mar adentro las filas quedan casi rectas y se leen como líneas
 * de contorno que suben y bajan con las olas.
 */
function buildPoints(cols: number, rows: number) {
  const random = mulberry32(7);
  const data = new Float32Array(cols * rows * 3);
  let i = 0;
  for (let row = 0; row < rows; row++) {
    const depth = row / rows;
    const rowJitter = 0.9 - 0.8 * Math.min(1, depth * 1.6);
    for (let col = 0; col < cols; col++) {
      data[i++] = (col + 0.5 + (random() - 0.5) * 0.9) / cols;
      data[i++] = (row + 0.5 + (random() - 0.5) * rowJitter) / rows;
      data[i++] = random();
    }
  }
  return data;
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

/** Cámara mirando mar adentro, inclinada para que el horizonte quede en HORIZON. Matriz en orden de columnas. */
function camera(aspect: number) {
  // En pantallas angostas se abre el campo vertical para no ver solo un pasillo de agua.
  const tanV = Math.min(1.2, Math.max(Math.tan((22.5 * Math.PI) / 180), 0.36 / aspect));
  const tanH = tanV * aspect;
  const pitch = Math.atan((1 - 2 * HORIZON) * tanV);
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  // Distancia a la que el borde inferior de la vista toca el agua.
  const bottom = pitch + Math.atan(tanV);
  const near = bottom < Math.PI / 2 - 0.05 ? Math.max(0.3, (EYE_HEIGHT / Math.tan(bottom)) * 0.8) : 0.3;

  const zNear = 0.1;
  const zFar = 200;
  const f = 1 / tanV;
  const nf = 1 / (zNear - zFar);
  // proyección · rotación (pitch) · traslación (-ojo), ya multiplicadas.
  const viewProj = new Float32Array([
    f / aspect, 0, 0, 0,
    0, f * c, (zFar + zNear) * nf * s, -s,
    0, -f * s, (zFar + zNear) * nf * c, -c,
    0, -f * c * EYE_HEIGHT, -(zFar + zNear) * nf * s * EYE_HEIGHT + 2 * zFar * zNear * nf, s * EYE_HEIGHT,
  ]);
  // Margen extra porque las olas también desplazan los puntos de lado.
  const spread: [number, number] = [c * tanH * 1.15, s * EYE_HEIGHT * tanH * 1.15];
  return { viewProj, spread, near };
}

export function SeaBackground({
  colors = ["#11796e", "#e0fff6"],
  speed = 0.3,
  className,
  style,
}: {
  /** Cuerpo del agua y crestas iluminadas. */
  colors?: [string, string];
  speed?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [body, crest] = colors;

  useEffect(() => {
    const host = hostRef.current;
    // Un canvas nuevo por montaje: al desmontar se libera su contexto de GPU, y un segundo montaje (Strict Mode)
    // no hereda un contexto ya perdido.
    const canvas = document.createElement("canvas");
    canvas.className = "size-full opacity-0 transition-opacity duration-[1600ms] ease-out data-[ready]:opacity-100";
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: "low-power",
    });
    if (!host || !gl) return;

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const u = {
      viewProj: uniform("u_viewProj"),
      eye: uniform("u_eye"),
      light: uniform("u_light"),
      spread: uniform("u_spread"),
      near: uniform("u_near"),
      far: uniform("u_far"),
      rowStep: uniform("u_rowStep"),
      time: uniform("u_time"),
      pointSize: uniform("u_pointSize"),
      body: uniform("u_body"),
      crest: uniform("u_crest"),
    };
    gl.uniform3f(u.eye, 0, EYE_HEIGHT, 0);
    // Luz baja, al fondo: su reflejo arma una franja de destellos que viene hacia quien mira.
    const lightLength = Math.hypot(0.25, 1);
    gl.uniform3f(u.light, 0, 0.25 / lightLength, -1 / lightLength);
    gl.uniform1f(u.far, FAR);
    gl.uniform3f(u.body, ...hexToRgb(body));
    gl.uniform3f(u.crest, ...hexToRgb(crest));

    const buffer = gl.createBuffer();
    const attribute = gl.getAttribLocation(program, "a_point");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 0, 0);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.clearColor(0, 0, 0, 0);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let count = 0;
    let grid = "";
    let time = reducedMotion ? 9 : 0;
    let last = 0;
    let frame = 0;
    let visible = false;
    let shown = false;

    function draw() {
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.uniform1f(u.time, time);
      gl!.drawArrays(gl!.POINTS, 0, count);
      if (!shown) {
        // Aparece con un fundido recién cuando hay algo dibujado.
        shown = true;
        canvas.dataset.ready = "";
      }
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      gl!.viewport(0, 0, canvas.width, canvas.height);

      // Cantidad de partículas según el tamaño en pantalla: unas 100.000 en un teléfono, cerca de 300.000 en escritorio.
      const cols = Math.round(Math.min(640, Math.max(160, rect.width * 0.5)));
      const rows = Math.round(Math.min(560, Math.max(220, rect.height * 0.62)));
      if (`${cols}x${rows}` !== grid) {
        grid = `${cols}x${rows}`;
        count = cols * rows;
        gl!.bufferData(gl!.ARRAY_BUFFER, buildPoints(cols, rows), gl!.STATIC_DRAW);
      }

      const view = camera(rect.width / rect.height);
      gl!.uniformMatrix4fv(u.viewProj, false, view.viewProj);
      gl!.uniform2f(u.spread, ...view.spread);
      gl!.uniform1f(u.near, view.near);
      gl!.uniform1f(u.rowStep, Math.log(FAR / view.near) / rows);
      gl!.uniform1f(u.pointSize, dpr);
      draw();
    }

    function tick(now: number) {
      // Tope al salto entre cuadros: al volver de otra pestaña el mar sigue donde estaba.
      time += (Math.min(now - (last || now), 50) / 1000) * speed;
      last = now;
      draw();
      frame = requestAnimationFrame(tick);
    }

    function play() {
      if (reducedMotion || frame || !visible) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    }

    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
    }

    host.appendChild(canvas);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    // Fuera de pantalla no se anima: el hero queda atrás apenas se hace scroll.
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) play();
      else stop();
    });
    intersectionObserver.observe(canvas);

    const onLost = (event: Event) => {
      event.preventDefault();
      stop();
    };
    canvas.addEventListener("webglcontextlost", onLost);

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, [body, crest, speed]);

  return <div ref={hostRef} aria-hidden="true" className={cn("pointer-events-none", className)} style={style} />;
}
