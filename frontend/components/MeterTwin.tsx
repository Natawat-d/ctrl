"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

type Kind = "watt" | "water" | "both";
const F = "'IBM Plex Mono','Space Mono',monospace";

// ---- electric watt meter (dark PBR body, glowing LCD) ----
function buildWatt() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1b1c21, metalness: 0.55, roughness: 0.34, envMapIntensity: 1.25 });
  group.add(new THREE.Mesh(new RoundedBoxGeometry(2.0, 2.9, 1.2, 6, 0.12), bodyMat));
  const face = new THREE.Mesh(new RoundedBoxGeometry(1.72, 1.52, 0.08, 4, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x0b0c10, metalness: 0.35, roughness: 0.5 }));
  face.position.set(0, 0.42, 0.6); group.add(face);

  const dc = document.createElement("canvas"); dc.width = 640; dc.height = 384;
  const g = dc.getContext("2d")!;
  const tex = new THREE.CanvasTexture(dc); tex.colorSpace = THREE.SRGBColorSpace;
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  disp.position.set(0, 0.42, 0.648); group.add(disp);

  const ledMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 3, roughness: 0.3 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 20), ledMat); led.position.set(0.66, 1.16, 0.62); group.add(led);
  const acc = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.03, 0.02), new THREE.MeshStandardMaterial({ color: 0x2563eb, emissive: 0x2563eb, emissiveIntensity: 2.2 }));
  acc.position.set(0, -0.52, 0.61); group.add(acc);

  const termMat = new THREE.MeshStandardMaterial({ color: 0x27282e, metalness: 0.7, roughness: 0.45 });
  const screwMat = new THREE.MeshStandardMaterial({ color: 0xcfd2d6, metalness: 1, roughness: 0.28 });
  for (const sy of [-1.56, 1.56]) for (let i = 0; i < 5; i++) {
    const x = -0.72 + i * 0.36;
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.42, 0.55), termMat); t.position.set(x, sy, 0.32); group.add(t);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 14), screwMat); s.rotation.x = Math.PI / 2; s.position.set(x, sy + (sy < 0 ? 0.12 : -0.12), 0.62); group.add(s);
  }

  let kwh = 4820.6, watt = 1180; const wave: number[] = new Array(56).fill(0.5);
  const update = (t: number, dt: number) => {
    kwh += dt * 0.04; watt = 1180 + Math.sin(t * 1.3) * 120 + (Math.random() - 0.5) * 26;
    wave.push(0.5 + Math.sin(t * 3.1) * 0.32 + (Math.random() - 0.5) * 0.08); if (wave.length > 56) wave.shift();
    g.fillStyle = "#05070b"; g.fillRect(0, 0, 640, 384);
    g.strokeStyle = "rgba(120,180,255,0.05)"; g.lineWidth = 1;
    for (let x = 0; x <= 640; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 384); g.stroke(); }
    for (let y = 0; y <= 384; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(640, y); g.stroke(); }
    g.fillStyle = "#5aa0ff"; g.font = `700 22px ${F}`; g.fillText("CTRL · WATT METER", 26, 44);
    g.fillStyle = "rgba(0,229,255,0.7)"; g.beginPath(); g.arc(556, 37, 7, 0, 7); g.fill();
    const k = kwh.toFixed(1); g.fillStyle = "#eaf3ff"; g.font = `700 82px ${F}`; g.fillText(k, 26, 148);
    g.fillStyle = "#5aa0ff"; g.font = `700 26px ${F}`; g.fillText("kWh", 26 + g.measureText(k).width + 14, 148);
    g.fillStyle = "#d4e4ff"; g.font = `700 38px ${F}`; g.fillText(Math.round(watt) + " W", 26, 212);
    g.fillStyle = "#7f9dc7"; g.font = `600 20px ${F}`; g.fillText("230.4 V    5.12 A    50.0 Hz", 26, 248);
    g.beginPath(); wave.forEach((v, i) => { const x = 26 + i * (588 / 55), y = 366 - v * 96; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.strokeStyle = "rgba(0,229,255,0.18)"; g.lineWidth = 10; g.stroke(); g.strokeStyle = "#00e5ff"; g.lineWidth = 3; g.stroke();
    tex.needsUpdate = true; ledMat.emissiveIntensity = 2 + Math.sin(t * 4) * 1.7;
  };
  return { group, update };
}

// ---- water meter (metal body + pipes + glowing round dial) ----
function buildWater() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.9, roughness: 0.32, envMapIntensity: 1.3 });
  // main chamber (horizontal)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.5, 40), metal); body.rotation.z = Math.PI / 2; group.add(body);
  // couplings + hex nuts both ends
  for (const sx of [-1, 1]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 32), metal); pipe.rotation.z = Math.PI / 2; pipe.position.x = sx * 1.15; group.add(pipe);
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.34, 6), metal); nut.rotation.z = Math.PI / 2; nut.position.x = sx * 0.95; group.add(nut);
    const end = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.12, 32), metal); end.rotation.z = Math.PI / 2; end.position.x = sx * 1.62; group.add(end);
  }
  // register housing on top
  const reg = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.72, 0.5, 40), new THREE.MeshStandardMaterial({ color: 0x1b1c21, metalness: 0.6, roughness: 0.4 }));
  reg.position.y = 0.72; group.add(reg);
  // dial face (canvas)
  const dc = document.createElement("canvas"); dc.width = 512; dc.height = 512;
  const g = dc.getContext("2d")!;
  const tex = new THREE.CanvasTexture(dc); tex.colorSpace = THREE.SRGBColorSpace;
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.62, 56), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  dial.rotation.x = -Math.PI / 2; dial.position.y = 0.98; group.add(dial);
  // glass dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.64, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.05, transmission: 0.9, transparent: true, opacity: 0.35, thickness: 0.2, envMapIntensity: 1.5 }));
  dome.position.y = 0.99; group.add(dome);
  const acc = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.02, 12, 48), new THREE.MeshStandardMaterial({ color: 0x0891b2, emissive: 0x22d3ee, emissiveIntensity: 2 }));
  acc.rotation.x = Math.PI / 2; acc.position.y = 0.98; group.add(acc);

  let m3 = 1487.253;
  const update = (t: number, dt: number) => {
    m3 += dt * 0.02;
    const S = 512, cx = S / 2, cy = S / 2, R = 205;
    g.fillStyle = "#04121a"; g.fillRect(0, 0, S, S);
    g.strokeStyle = "rgba(80,200,235,0.10)"; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
    // ticks
    for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2 - Math.PI / 2; const r1 = R - 4, r2 = R - (i % 5 ? 14 : 26);
      g.strokeStyle = i % 5 ? "rgba(120,220,245,0.35)" : "#5ad6ff"; g.lineWidth = i % 5 ? 2 : 3;
      g.beginPath(); g.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)); g.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a)); g.stroke(); }
    // header + LIVE
    g.fillStyle = "#4fd0f0"; g.font = `700 26px ${F}`; g.textAlign = "center"; g.fillText("WATER  m³", cx, 120);
    // odometer window
    const rd = m3.toFixed(3); g.fillStyle = "#031017"; g.fillRect(cx - 130, cy - 34, 260, 68);
    g.strokeStyle = "#22d3ee"; g.lineWidth = 2; g.strokeRect(cx - 130, cy - 34, 260, 68);
    g.fillStyle = "#e6faff"; g.font = `700 52px ${F}`; g.fillText(rd, cx, cy + 18);
    // flow needle
    const na = t * 1.4; g.strokeStyle = "#22d3ee"; g.lineWidth = 6; g.beginPath(); g.moveTo(cx, cy + 120); g.lineTo(cx + (R - 40) * Math.cos(na - Math.PI / 2), cy + 120 + 0); // keep needle in lower sub-dial
    g.stroke();
    // sub-dial for flow (lower)
    const sy = cy + 130; g.strokeStyle = "rgba(120,220,245,0.3)"; g.lineWidth = 2; g.beginPath(); g.arc(cx, sy, 46, 0, 7); g.stroke();
    g.strokeStyle = "#5ad6ff"; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, sy); g.lineTo(cx + 38 * Math.cos(na), sy + 38 * Math.sin(na)); g.stroke();
    g.fillStyle = "#22d3ee"; g.beginPath(); g.arc(cx, sy, 6, 0, 7); g.fill();
    g.fillStyle = "#7fb8cc"; g.font = `600 18px ${F}`; g.fillText("L/min", cx, sy - 56);
    g.textAlign = "left";
    tex.needsUpdate = true; (acc.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.4 + Math.sin(t * 3) * 0.9;
  };
  return { group, update };
}

export default function MeterTwin({ kind = "both", height }: { kind?: Kind; height?: number }) {
  const mountRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    let w = mount.clientWidth || 800, h = mount.clientHeight || 480;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 100);
    const pmrem = new THREE.PMREMGenerator(renderer); const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environment = envTex;
    const keyL = new THREE.DirectionalLight(0xffffff, 2.1); keyL.position.set(-5, 7, 5); scene.add(keyL);
    const rimL = new THREE.DirectionalLight(0x88aaff, 1.5); rimL.position.set(6, 2, -5); scene.add(rimL);
    scene.add(new THREE.AmbientLight(0xffffff, 0.12));

    const parts: { group: THREE.Group; update: (t: number, dt: number) => void; baseRot: number }[] = [];
    if (kind === "watt" || kind === "both") { const p = buildWatt(); p.group.position.x = kind === "both" ? -2.1 : 0; scene.add(p.group); parts.push({ ...p, baseRot: 0.3 }); }
    if (kind === "water" || kind === "both") { const p = buildWater(); p.group.position.set(kind === "both" ? 2.2 : 0, kind === "both" ? 0.1 : 0, 0); if (kind === "both") p.group.scale.setScalar(1.05); scene.add(p.group); parts.push({ ...p, baseRot: -0.25 }); }

    if (kind === "both") { camera.position.set(0, 1.1, 11); camera.lookAt(0, 0.1, 0); }
    else if (kind === "water") { camera.position.set(2.6, 2.0, 7.2); camera.lookAt(0, 0.3, 0); }
    else { camera.position.set(2.6, 1.1, 6.6); camera.lookAt(0, 0.1, 0); }

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.42, 0.62));
    composer.addPass(new OutputPass());

    const clock = new THREE.Clock(); let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick); const dt = clock.getDelta(), t = clock.elapsedTime;
      parts.forEach((p, i) => { p.group.rotation.y = p.baseRot + Math.sin(t * 0.42 + i) * 0.5; p.group.position.y = (p.group.userData.baseY ?? (p.group.userData.baseY = p.group.position.y)) + Math.sin(t * 0.9 + i) * 0.07; p.update(t, dt); });
      composer.render();
    };
    tick();
    const onR = () => { w = mount.clientWidth || w; h = mount.clientHeight || h; renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(onR); ro.observe(mount);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); envTex.dispose(); pmrem.dispose(); if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement); };
  }, [kind]);
  return <div ref={mountRef} className="twin-canvas" style={height ? { height } : undefined} aria-hidden="true" />;
}
