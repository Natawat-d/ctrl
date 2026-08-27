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

// ===== Electric: Schneider DMR121-style single-phase DIN energy meter =====
function buildWatt() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x23252b, metalness: 0.45, roughness: 0.42, envMapIntensity: 1.2 });
  group.add(new THREE.Mesh(new RoundedBoxGeometry(1.5, 3.0, 1.15, 6, 0.1), bodyMat));
  // recessed faceplate (upper area)
  const face = new THREE.Mesh(new RoundedBoxGeometry(1.24, 1.34, 0.08, 4, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x0b0c10, metalness: 0.35, roughness: 0.5 }));
  face.position.set(0, 0.55, 0.58); group.add(face);
  // LCD
  const dc = document.createElement("canvas"); dc.width = 640; dc.height = 400;
  const g = dc.getContext("2d")!;
  const tex = new THREE.CanvasTexture(dc); tex.colorSpace = THREE.SRGBColorSpace;
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.66), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  disp.position.set(0, 0.55, 0.625); group.add(disp);
  // red imp/kWh pulse LED (as on real energy meters)
  const ledMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 3, roughness: 0.3 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 18, 18), ledMat); led.position.set(0.44, 1.24, 0.6); group.add(led);
  // brand strip
  const acc = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.16, 0.02), new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.6 }));
  acc.position.set(0, 1.24, 0.59); group.add(acc);
  const acc2 = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.025, 0.02), new THREE.MeshStandardMaterial({ color: 0x2563eb, emissive: 0x2563eb, emissiveIntensity: 2 }));
  acc2.position.set(0, -0.32, 0.59); group.add(acc2);
  // screw terminals: 3 top + 3 bottom (L/N in, L/N out, RS485)
  const termMat = new THREE.MeshStandardMaterial({ color: 0x27282e, metalness: 0.7, roughness: 0.45 });
  const screwMat = new THREE.MeshStandardMaterial({ color: 0xcfd2d6, metalness: 1, roughness: 0.28 });
  for (const sy of [-1.62, 1.62]) for (let i = 0; i < 3; i++) {
    const x = -0.45 + i * 0.45;
    const tm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.55), termMat); tm.position.set(x, sy, 0.3); group.add(tm);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 14), screwMat); s.rotation.x = Math.PI / 2; s.position.set(x, sy + (sy < 0 ? 0.1 : -0.1), 0.6); group.add(s);
  }
  let kwh = 4820.6, watt = 1180; const wave: number[] = new Array(50).fill(0.5);
  const update = (t: number, dt: number) => {
    kwh += dt * 0.04; watt = 1180 + Math.sin(t * 1.3) * 120 + (Math.random() - 0.5) * 26;
    wave.push(0.5 + Math.sin(t * 3.1) * 0.32 + (Math.random() - 0.5) * 0.08); if (wave.length > 50) wave.shift();
    g.fillStyle = "#05070b"; g.fillRect(0, 0, 640, 400);
    g.strokeStyle = "rgba(120,180,255,0.05)"; g.lineWidth = 1;
    for (let x = 0; x <= 640; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 400); g.stroke(); }
    g.fillStyle = "#5aa0ff"; g.font = `700 22px ${F}`; g.fillText("kWh METER · DMR121", 24, 44);
    g.fillStyle = "rgba(0,229,255,0.7)"; g.beginPath(); g.arc(600, 36, 7, 0, 7); g.fill();
    const k = kwh.toFixed(1); g.fillStyle = "#eaf3ff"; g.font = `700 78px ${F}`; g.fillText(k, 24, 150);
    g.fillStyle = "#5aa0ff"; g.font = `700 24px ${F}`; g.fillText("kWh", 24 + g.measureText(k).width + 12, 150);
    g.fillStyle = "#d4e4ff"; g.font = `700 36px ${F}`; g.fillText(Math.round(watt) + " W", 24, 214);
    g.fillStyle = "#7f9dc7"; g.font = `600 20px ${F}`; g.fillText("230.4 V   5.12 A   50.0 Hz", 24, 250);
    g.beginPath(); wave.forEach((v, i) => { const x = 24 + i * (592 / 49), y = 382 - v * 96; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.strokeStyle = "rgba(0,229,255,0.18)"; g.lineWidth = 10; g.stroke(); g.strokeStyle = "#00e5ff"; g.lineWidth = 3; g.stroke();
    tex.needsUpdate = true; ledMat.emissiveIntensity = 1.2 + Math.max(0, Math.sin(t * 6)) * 3.2; // blink like imp LED
  };
  return { group, update };
}

// ===== Water: 2หุน (1/2") brass multi-jet pulse water meter w/ NPN output cable =====
function buildWater() {
  const group = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: 0xb98a3e, metalness: 0.95, roughness: 0.32, envMapIntensity: 1.35 });
  const brassDark = new THREE.MeshStandardMaterial({ color: 0x8a6528, metalness: 0.95, roughness: 0.38 });
  // main chamber (horizontal round body)
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.15, 40), brass); body.rotation.z = Math.PI / 2; group.add(body);
  // 1/2" threaded ends both sides
  for (const sx of [-1, 1]) {
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 28), brass); neck.rotation.z = Math.PI / 2; neck.position.x = sx * 0.82; group.add(neck);
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 6), brassDark); nut.rotation.z = Math.PI / 2; nut.position.x = sx * 0.72; group.add(nut);
    for (let i = 0; i < 4; i++) { const th = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.02, 8, 24), brassDark); th.position.set(sx * (1.02 + i * 0.06), 0, 0); th.rotation.y = Math.PI / 2; group.add(th); }
  }
  // register housing (brass ring) on top
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.66, 0.42, 40), brass); ring.position.y = 0.62; group.add(ring);
  // dry dial face
  const dc = document.createElement("canvas"); dc.width = 512; dc.height = 512;
  const g = dc.getContext("2d")!;
  const tex = new THREE.CanvasTexture(dc); tex.colorSpace = THREE.SRGBColorSpace;
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.56, 56), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  dial.rotation.x = -Math.PI / 2; dial.position.y = 0.845; group.add(dial);
  // glass dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.04, transmission: 0.92, transparent: true, opacity: 0.35, thickness: 0.2, envMapIntensity: 1.6 }));
  dome.position.y = 0.85; group.add(dome);
  // NPN pulse output cable (the signature of the real sensor)
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.5, 0.75, 0.2), new THREE.Vector3(0.95, 0.55, 0.45),
    new THREE.Vector3(1.35, 0.05, 0.5), new THREE.Vector3(1.7, -0.45, 0.35), new THREE.Vector3(1.9, -0.95, 0.2),
  ]);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.055, 12, false),
    new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.7, metalness: 0.1 })); group.add(cable);
  const plug = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.34, 0.22, 3, 0.04), new THREE.MeshStandardMaterial({ color: 0x1b1c21, roughness: 0.5 }));
  plug.position.set(1.95, -1.02, 0.2); group.add(plug);
  const plugTip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 12), new THREE.MeshStandardMaterial({ color: 0xd0a850, metalness: 1, roughness: 0.3 }));
  plugTip.position.set(1.95, -1.24, 0.2); group.add(plugTip);
  // cable strain-relief on register
  const relief = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.18, 16), brassDark); relief.position.set(0.5, 0.78, 0.2); relief.rotation.z = -0.6; group.add(relief);

  let m3 = 1487.253;
  const update = (t: number) => {
    m3 += 0.00035 + Math.abs(Math.sin(t)) * 0.0006;
    const S = 512, cx = S / 2, cy = S / 2, R = 208;
    // cream dry-dial
    g.fillStyle = "#f3ede0"; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.strokeStyle = "#c9bfa8"; g.lineWidth = 6; g.stroke();
    // scale ticks
    for (let i = 0; i < 100; i++) { const a = (i / 100) * Math.PI * 2 - Math.PI / 2; const r1 = R - 10, r2 = R - (i % 10 ? 18 : 30);
      g.strokeStyle = i % 10 ? "#8a8069" : "#3a3428"; g.lineWidth = i % 10 ? 1.5 : 3;
      g.beginPath(); g.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a)); g.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a)); g.stroke(); }
    g.fillStyle = "#2b2a24"; g.textAlign = "center"; g.font = `700 26px ${F}`; g.fillText("m³", cx, 120);
    // odometer drum (black window, white digits)
    const rd = m3.toFixed(3).replace(".", "").padStart(8, "0"); g.fillStyle = "#161310"; g.fillRect(cx - 150, cy - 34, 300, 66);
    let dx = cx - 150 + 10; g.textAlign = "left";
    for (let i = 0; i < rd.length; i++) {
      const isDec = i >= rd.length - 3; g.fillStyle = isDec ? "#b1121b" : "#f5f5f0"; g.fillRect(dx, cy - 28, 32, 54);
      g.fillStyle = isDec ? "#fff" : "#111"; g.font = `700 40px ${F}`; g.textAlign = "center"; g.fillText(rd[i], dx + 16, cy + 15); dx += 36;
    }
    g.textAlign = "center";
    // red flow sub-dial (spinning)
    const sy = cy + 128; g.fillStyle = "#efe8d8"; g.beginPath(); g.arc(cx, sy, 50, 0, 7); g.fill(); g.strokeStyle = "#b1121b"; g.lineWidth = 2; g.stroke();
    const na = t * 2.2; g.strokeStyle = "#b1121b"; g.lineWidth = 6; g.beginPath(); g.moveTo(cx, sy); g.lineTo(cx + 40 * Math.cos(na), sy + 40 * Math.sin(na)); g.stroke();
    g.fillStyle = "#b1121b"; g.beginPath(); g.arc(cx, sy, 6, 0, 7); g.fill();
    g.fillStyle = "#6b5f45"; g.font = `600 17px ${F}`; g.fillText("×0.0001 m³", cx, sy - 60);
    g.textAlign = "left";
    tex.needsUpdate = true;
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
    const warmL = new THREE.DirectionalLight(0xffd9a0, 0.6); warmL.position.set(3, -2, 4); scene.add(warmL);
    scene.add(new THREE.AmbientLight(0xffffff, 0.12));

    const parts: { group: THREE.Group; update: (t: number, dt: number) => void; baseRot: number }[] = [];
    if (kind === "watt" || kind === "both") { const p = buildWatt(); p.group.position.x = kind === "both" ? -2.0 : 0; scene.add(p.group); parts.push({ ...p, baseRot: 0.3 }); }
    if (kind === "water" || kind === "both") { const p = buildWater(); p.group.position.set(kind === "both" ? 2.1 : 0, kind === "both" ? 0.05 : 0, 0); scene.add(p.group); parts.push({ ...p, baseRot: -0.3 }); }
    if (kind === "both") { camera.position.set(0, 1.1, 10.5); camera.lookAt(0, 0, 0); }
    else if (kind === "water") { camera.position.set(2.4, 1.6, 6.8); camera.lookAt(0, 0.2, 0); }
    else { camera.position.set(2.4, 1.0, 6.4); camera.lookAt(0, 0.1, 0); }

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.42, 0.7));
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
