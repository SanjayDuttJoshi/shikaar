import * as THREE from "three";

/** Night sky dome with stars and a hazy moon, seen from courtyards and through the open gate. */
export const createSky = (): THREE.Mesh => {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { moonDir: { value: new THREE.Vector3(-0.3, 0.75, -0.55).normalize() } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 moonDir;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(vec3(0.018, 0.022, 0.04), vec3(0.002, 0.003, 0.012), pow(h, 0.6));
        vec3 cell = floor(vDir * 320.0);
        float star = step(0.9965, hash(cell)) * smoothstep(0.05, 0.3, h);
        col += vec3(0.75, 0.8, 1.0) * star * (0.4 + 0.6 * hash(cell + 3.1));
        float m = dot(vDir, moonDir);
        col += vec3(0.85, 0.88, 1.0) * smoothstep(0.9993, 0.9996, m);
        col += vec3(0.25, 0.3, 0.45) * pow(max(m, 0.0), 220.0) * 0.6;
        col += vec3(0.06, 0.07, 0.1) * pow(max(m, 0.0), 12.0);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), material);
  sky.name = "sky";
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  return sky;
};
