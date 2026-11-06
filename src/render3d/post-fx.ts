import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

export interface FxParams {
  /** 0..1 red bleed at the edges (hurt). */
  damage: number;
  /** 0..1 panic: chromatic split and stronger grain (monster close / chase). */
  panic: number;
  /** 0..1 white flash (torch flash). */
  flash: number;
  /** 0..1 fade to black. */
  black: number;
  /** Colour grade tint (asylum is sickly green, haveli is warm). */
  tint: THREE.Color;
}

const FILM_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    damage: { value: 0 },
    panic: { value: 0 },
    flash: { value: 0 },
    black: { value: 0 },
    tint: { value: new THREE.Color(1, 1, 1) },
    aspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time, damage, panic, flash, black, aspect;
    uniform vec3 tint;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233)) + time * 7.13) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float r = length(c * vec2(aspect, 1.0));
      float split = (0.0015 + panic * 0.006) * r;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + c * split * 2.0).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - c * split * 2.0).b;
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(luma), col, 0.78) * tint;
      float vig = smoothstep(0.95, 0.25, r);
      col *= mix(0.35, 1.0, vig);
      float grain = (rand(vUv * 913.0) - 0.5) * (0.07 + panic * 0.06);
      col += grain;
      float edge = smoothstep(0.3, 0.85, r);
      col = mix(col, vec3(0.35, 0.0, 0.0), damage * edge * 0.85);
      col = mix(col, vec3(1.0), flash);
      col *= 1.0 - black;
      float lines = 0.985 + 0.015 * sin(vUv.y * 900.0 + time * 30.0);
      gl_FragColor = vec4(col * lines, 1.0);
    }
  `,
};

export interface PostFx {
  render: (params: FxParams, t: number) => void;
  resize: (w: number, h: number) => void;
  dispose: () => void;
}

/** Found-footage look: desaturated grade, vignette, grain, scanline shimmer, chromatic panic, red hurt edges. */
export const createPostFx = (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): PostFx => {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());
  const film = new ShaderPass(FILM_SHADER);
  composer.addPass(film);
  const render = (p: FxParams, t: number): void => {
    film.uniforms.time.value = t % 1000;
    film.uniforms.damage.value = p.damage;
    film.uniforms.panic.value = p.panic;
    film.uniforms.flash.value = p.flash;
    film.uniforms.black.value = p.black;
    (film.uniforms.tint.value as THREE.Color).copy(p.tint);
    composer.render();
  };
  const resize = (w: number, h: number): void => {
    composer.setSize(w, h);
    film.uniforms.aspect.value = w / Math.max(1, h);
  };
  return { render, resize, dispose: () => composer.dispose() };
};
