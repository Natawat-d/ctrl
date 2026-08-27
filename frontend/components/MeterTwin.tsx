"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

type Kind = "watt" | "water" | "both" | "cabinet";
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
  const brass = new THREE.MeshStandardMaterial({ color: 0x9c7b3a, metalness: 0.85, roughness: 0.5, envMapIntensity: 0.8 });
  const brassDark = new THREE.MeshStandardMaterial({ color: 0x6f5527, metalness: 0.85, roughness: 0.55, envMapIntensity: 0.7 });
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

// brushed-metal roughness variation
function makeBrushedTex(rep = 3) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 256; const x = c.getContext("2d")!;
  x.fillStyle = "#9a9a9a"; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) { const y = Math.random() * 256; const v = 130 + (Math.random() * 110 | 0); x.strokeStyle = `rgba(${v},${v},${v},0.06)`; x.beginPath(); x.moveTo(0, y); x.lineTo(256, y + (Math.random() - 0.5) * 2); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t;
}
// small brand label on a meter body
function makeLabelTex(seed: number) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 140; const x = c.getContext("2d")!;
  x.fillStyle = "#e9eaec"; x.fillRect(0, 0, 256, 140);
  x.fillStyle = "#12141a"; x.fillRect(0, 0, 256, 34);
  x.fillStyle = "#e9eaec"; x.font = "700 22px " + F; x.fillText("DMR121", 12, 25);
  x.fillStyle = "#3a3f48"; x.font = "600 15px " + F; x.fillText("1(6)A · 230V · 50Hz", 12, 62);
  x.fillText("kWh · RS485 Modbus", 12, 84);
  for (let i = 0; i < 34; i++) { x.fillStyle = i % 2 ? "#12141a" : "#e9eaec"; x.fillRect(12 + i * 6.6, 98, i % 3 ? 3 : 5, 30); }
  x.fillStyle = "#12141a"; x.font = "600 12px " + F; x.fillText("SN " + (100000 + seed * 4813 % 899999), 170, 118);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ===== compact DMR121 meter for the cabinet rows =====
function makeMini(seed: number, brushed: THREE.Texture) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.74, 1.7, 0.55, 4, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x2b2e35, metalness: 0.5, roughness: 0.5, roughnessMap: brushed, envMapIntensity: 1.15 }));
  group.add(body);
  const face = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.62, 0.05, 3, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x0b0c10, metalness: 0.3, roughness: 0.45 }));
  face.position.set(0, 0.48, 0.29); group.add(face);
  const dc = document.createElement("canvas"); dc.width = 256; dc.height = 160;
  const g = dc.getContext("2d")!;
  const tex = new THREE.CanvasTexture(dc); tex.colorSpace = THREE.SRGBColorSpace;
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.31), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  disp.position.set(0, 0.48, 0.315); group.add(disp);
  // printed label
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.33), new THREE.MeshStandardMaterial({ map: makeLabelTex(seed), roughness: 0.85 }));
  label.position.set(0, -0.18, 0.281); group.add(label);
  // side vents
  for (let v = 0; v < 5; v++) { const vt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.02), new THREE.MeshStandardMaterial({ color: 0x15171c })); vt.position.set(0, -0.62 + v * 0.05, 0.281); group.add(vt); }
  const ledMat = new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 2, roughness: 0.3 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 12), ledMat); led.position.set(0.22, 0.78, 0.3); group.add(led);
  const tmat = new THREE.MeshStandardMaterial({ color: 0x27282e, metalness: 0.6, roughness: 0.5 });
  const smat = new THREE.MeshStandardMaterial({ color: 0xcfd2d6, metalness: 1, roughness: 0.3 });
  for (const sy of [-0.92, 0.92]) for (let i = 0; i < 2; i++) {
    const tb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.42), tmat); tb.position.set(-0.18 + i * 0.36, sy, 0.16); group.add(tb);
    const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), smat); sc.rotation.x = Math.PI / 2; sc.position.set(-0.18 + i * 0.36, sy + (sy < 0 ? 0.06 : -0.06), 0.38); group.add(sc);
  }
  let kwh = 1000 + seed * 733 % 8000; const ph = seed * 1.7;
  const update = (t: number) => {
    kwh += 0.02;
    g.fillStyle = "#05070b"; g.fillRect(0, 0, 256, 160);
    g.fillStyle = "#5aa0ff"; g.font = `700 15px ${F}`; g.fillText("kWh", 12, 26);
    g.fillStyle = "#eaf3ff"; g.font = `700 40px ${F}`; g.fillText(kwh.toFixed(0), 12, 74);
    g.fillStyle = "#7f9dc7"; g.font = `600 14px ${F}`; g.fillText((900 + Math.round(Math.sin(t + ph) * 300)) + " W", 12, 102);
    g.fillStyle = "rgba(0,229,255,0.22)"; g.fillRect(12, 120, 232, 22);
    g.fillStyle = "#00e5ff"; g.fillRect(12, 120, 116 + Math.sin(t * 1.4 + ph) * 90, 22);
    tex.needsUpdate = true; ledMat.emissiveIntensity = 1 + Math.max(0, Math.sin(t * 5 + ph)) * 2.6;
  };
  return { group, update };
}

// ===== DIN-rail cabinet + DMR121 bank + RS485 → switch → cloud (with data pulses) =====
function buildCabinet() {
  const group = new THREE.Group();
  const minis: { group: THREE.Group; update: (t: number) => void }[] = [];
  const brushed = makeBrushedTex(4);
  // enclosure back + inner panel + side walls (depth)
  const back = new THREE.Mesh(new RoundedBoxGeometry(9.9, 5.7, 0.4, 6, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x202329, metalness: 0.45, roughness: 0.5, roughnessMap: brushed, envMapIntensity: 1 }));
  back.position.z = -0.7; group.add(back);
  const panel = new THREE.Mesh(new RoundedBoxGeometry(9.2, 5.0, 0.14, 4, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x2b2e35, metalness: 0.5, roughness: 0.5, roughnessMap: brushed })); panel.position.z = -0.4; group.add(panel);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x171a1f, metalness: 0.4, roughness: 0.6 });
  for (const [w, h, x, y] of [[9.9, 0.9, 0, 2.85], [9.9, 0.9, 0, -2.85], [0.9, 5.7, -4.95, 0], [0.9, 5.7, 4.95, 0]] as const) {
    const wl = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.0), wallMat); wl.position.set(x, y, -0.2); group.add(wl);
  }
  // outer door frame (brushed steel)
  const fmat = new THREE.MeshStandardMaterial({ color: 0x40434b, metalness: 0.85, roughness: 0.42, roughnessMap: brushed, envMapIntensity: 1.1 });
  const fw = 10.0, fh = 5.8, tk = 0.22;
  ([[fw, tk, 0, fh / 2], [fw, tk, 0, -fh / 2], [tk, fh, -fw / 2, 0], [tk, fh, fw / 2, 0]] as const)
    .forEach(([w, h, x, y]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), fmat); b.position.set(x, y, 0.42); group.add(b); });
  // trunking ducts
  const ductMat = new THREE.MeshStandardMaterial({ color: 0x373a41, metalness: 0.3, roughness: 0.75, roughnessMap: brushed });
  const slotMat = new THREE.MeshStandardMaterial({ color: 0x1c1e23, roughness: 0.85 });
  for (const dy of [2.35, 0, -2.35]) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.5, 0.5), ductMat); d.position.set(0, dy, -0.05); group.add(d);
    for (let s = 0; s < 22; s++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.02), slotMat); sl.position.set(-4.35 + s * 0.415, dy, 0.21); group.add(sl); }
  }
  // DIN rails + meters
  const railMat = new THREE.MeshStandardMaterial({ color: 0x6b7178, metalness: 0.9, roughness: 0.4, roughnessMap: brushed, envMapIntensity: 1.05 });
  const meterXs: number[] = [];
  [1.15, -1.15].forEach((ry, r) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(8.7, 0.34, 0.12), railMat); rail.position.set(0, ry, 0); group.add(rail);
    for (let i = 0; i < 5; i++) { const x = -3.4 + i * 1.7; const m = makeMini(r * 5 + i, brushed); m.group.position.set(x, ry, 0.34); group.add(m.group); minis.push(m); if (r === 1) meterXs.push(x); }
  });

  // ---- RS485 daisy-chain (teal) touching each meter, then out to a switch ----
  const rsMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, metalness: 0.2, roughness: 0.6 });
  const tube = (pts: THREE.Vector3[], rad = 0.05) => { const cv = new THREE.CatmullRomCurve3(pts); return new THREE.Mesh(new THREE.TubeGeometry(cv, Math.max(16, pts.length * 8), rad, 10, false), rsMat); };
  // horizontal bus per row + drop stubs to each meter
  for (const ry of [1.15, -1.15]) {
    group.add(tube([new THREE.Vector3(-3.9, ry - 0.98, 0.5), new THREE.Vector3(3.9, ry - 0.98, 0.5)], 0.045));
    for (const mx of meterXs) { const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 8), rsMat); stub.position.set(mx, ry - 0.92, 0.42); group.add(stub); }
  }
  group.add(tube([new THREE.Vector3(3.9, 0.17, 0.5), new THREE.Vector3(3.9, -2.13, 0.5)], 0.045)); // riser joining rows
  // exit to switch (down-right, outside the box)
  const switchPos = new THREE.Vector3(6.4, -2.7, 1.2);
  group.add(tube([new THREE.Vector3(3.9, -2.13, 0.5), new THREE.Vector3(4.8, -2.3, 0.7), new THREE.Vector3(5.6, -2.55, 1.0), switchPos.clone().add(new THREE.Vector3(-0.2, 0.15, -0.1))], 0.05));

  // ---- network SWITCH ----
  const sw = new THREE.Group(); sw.position.copy(switchPos); group.add(sw);
  sw.add(new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.55, 0.9, 3, 0.06), new THREE.MeshStandardMaterial({ color: 0x1a1c22, metalness: 0.6, roughness: 0.4, roughnessMap: brushed, envMapIntensity: 1.1 })));
  const swLeds: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < 8; i++) {
    const px = -0.7 + i * 0.2;
    const port = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.04), new THREE.MeshStandardMaterial({ color: 0x0a0b0e, roughness: 0.5 })); port.position.set(px, -0.08, 0.46); sw.add(port);
    const lm = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 2, roughness: 0.3 });
    const ld = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 10), lm); ld.position.set(px, 0.12, 0.46); sw.add(ld); swLeds.push(lm);
  }

  // ---- CLOUD / WEB node (top-right) ----
  const cloud = new THREE.Group(); cloud.position.set(5.4, 3.7, 0.2); group.add(cloud);
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0x0a2540, emissive: 0x2dd4ff, emissiveIntensity: 1.1, metalness: 0.2, roughness: 0.4, transparent: true, opacity: 0.92 });
  for (const [r, dx, dy] of [[0.5, 0, 0], [0.38, -0.5, -0.08], [0.34, 0.5, -0.05], [0.3, -0.25, 0.28], [0.3, 0.28, 0.26]] as const) {
    const cs = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 24), cloudMat); cs.position.set(dx, dy, 0); cloud.add(cs);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.02, 10, 60), new THREE.MeshStandardMaterial({ color: 0x2dd4ff, emissive: 0x2dd4ff, emissiveIntensity: 2 }));
  ring.rotation.x = 1.2; cloud.add(ring);

  // switch → cloud uplink
  group.add(tube([switchPos.clone().add(new THREE.Vector3(0.2, 0.3, 0)), new THREE.Vector3(6.2, -1, 0.8), new THREE.Vector3(5.9, 1, 0.5), new THREE.Vector3(5.5, 2.8, 0.3), cloud.position.clone().add(new THREE.Vector3(0, -0.7, 0))],
    0.05));

  // ---- animated data pulses (meters → switch → cloud) ----
  const flow = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.9, -2.13, 0.5), new THREE.Vector3(3.9, -2.13, 0.5),
    new THREE.Vector3(4.8, -2.3, 0.7), switchPos.clone(),
    new THREE.Vector3(6.2, -1, 0.8), new THREE.Vector3(5.9, 1, 0.5), new THREE.Vector3(5.5, 2.8, 0.3), cloud.position.clone(),
  ]);
  const pulseMat = new THREE.MeshStandardMaterial({ color: 0x67e8ff, emissive: 0x67e8ff, emissiveIntensity: 4, roughness: 0.2 });
  const pulses: THREE.Mesh[] = [];
  const NP = 7;
  for (let i = 0; i < NP; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), pulseMat); group.add(p); pulses.push(p); }

  const update = (t: number) => {
    for (const m of minis) m.update(t);
    swLeds.forEach((lm, i) => { lm.emissiveIntensity = 0.8 + Math.max(0, Math.sin(t * 4 + i * 1.3)) * 2.4; });
    (cloudMat as THREE.MeshStandardMaterial).emissiveIntensity = 0.9 + Math.sin(t * 1.8) * 0.4;
    cloud.rotation.y = Math.sin(t * 0.3) * 0.2;
    pulses.forEach((p, i) => { const u = (t * 0.11 + i / NP) % 1; const pt = flow.getPoint(u); p.position.copy(pt); const sc = 0.6 + Math.sin(u * Math.PI) * 0.8; p.scale.setScalar(sc); });
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9; renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 100);
    const pmrem = new THREE.PMREMGenerator(renderer); const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environment = envTex;
    const keyL = new THREE.DirectionalLight(0xffffff, 1.15); keyL.position.set(-5, 7, 5); scene.add(keyL);
    const rimL = new THREE.DirectionalLight(0x88aaff, 1.1); rimL.position.set(6, 2, -5); scene.add(rimL);
    const warmL = new THREE.DirectionalLight(0xffe4b8, 0.22); warmL.position.set(3, -2, 4); scene.add(warmL);
    const frontL = new THREE.DirectionalLight(0xcfe0ff, 0.26); frontL.position.set(0.5, 0.6, 9); scene.add(frontL);
    scene.add(new THREE.AmbientLight(0xffffff, 0.14));

    const parts: { group: THREE.Group; update: (t: number, dt: number) => void; baseRot: number; amp: number }[] = [];
    if (kind === "cabinet") { const p = buildCabinet(); p.group.scale.setScalar(0.62); p.group.rotation.x = -0.05; scene.add(p.group); parts.push({ ...p, baseRot: 0, amp: 0.05 }); }
    if (kind === "watt" || kind === "both") { const p = buildWatt(); p.group.position.x = kind === "both" ? -2.0 : 0; scene.add(p.group); parts.push({ ...p, baseRot: 0.3, amp: 0.5 }); }
    if (kind === "water" || kind === "both") { const p = buildWater(); p.group.position.set(kind === "both" ? 2.1 : 0, kind === "both" ? 0.05 : 0, 0); scene.add(p.group); parts.push({ ...p, baseRot: -0.3, amp: 0.5 }); }
    if (kind === "cabinet") { camera.position.set(0.6, 0.35, 11.6); camera.lookAt(0.7, 0.15, 0); }
    else if (kind === "both") { camera.position.set(0, 1.1, 10.5); camera.lookAt(0, 0, 0); }
    else if (kind === "water") { camera.position.set(2.4, 1.6, 6.8); camera.lookAt(0, 0.2, 0); }
    else { camera.position.set(2.4, 1.0, 6.4); camera.lookAt(0, 0.1, 0); }

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.34, 0.4, 0.92));
    composer.addPass(new OutputPass());

    const clock = new THREE.Clock(); let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick); const dt = clock.getDelta(), t = clock.elapsedTime;
      parts.forEach((p, i) => { p.group.rotation.y = p.baseRot + Math.sin(t * 0.4 + i) * p.amp; p.group.position.y = (p.group.userData.baseY ?? (p.group.userData.baseY = p.group.position.y)) + Math.sin(t * 0.85 + i) * p.amp * 0.5; p.update(t, dt); });
      composer.render();
    };
    tick();
    const onR = () => { w = mount.clientWidth || w; h = mount.clientHeight || h; renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(onR); ro.observe(mount);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); envTex.dispose(); pmrem.dispose(); if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement); };
  }, [kind]);
  return <div ref={mountRef} className="twin-canvas" style={height ? { height } : undefined} aria-hidden="true" />;
}
