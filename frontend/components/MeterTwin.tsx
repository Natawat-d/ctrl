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
// small brand label on a meter body — DARK matte plaque so it recedes into the body (no bright/blown band)
function makeLabelTex(seed: number) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 140; const x = c.getContext("2d")!;
  // dark low-contrast plaque tone-matched to the meter body — must NOT read as a bright strip
  x.fillStyle = "#26292c"; x.fillRect(0, 0, 256, 140);
  x.fillStyle = "#191b1f"; x.fillRect(0, 0, 256, 34);
  x.fillStyle = "#7a8087"; x.font = "700 22px " + F; x.fillText("DMR121", 12, 25);
  x.fillStyle = "#5c6167"; x.font = "600 15px " + F; x.fillText("1(6)A · 230V · 50Hz", 12, 62);
  x.fillText("kWh · RS485 Modbus", 12, 84);
  // muted barcode: dark bars on the plaque tone, never bright
  for (let i = 0; i < 34; i++) { x.fillStyle = i % 2 ? "#4a4f55" : "#2c2f34"; x.fillRect(12 + i * 6.6, 98, i % 3 ? 3 : 5, 30); }
  x.fillStyle = "#5c6167"; x.font = "600 12px " + F; x.fillText("SN " + (100000 + seed * 4813 % 899999), 170, 118);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ===== 7-segment LCD digit renderer (real segment glyphs so meter faces read as live displays) =====
const SEG_MAP: Record<string, number> = { // bits: a b c d e f g
  "0": 0b1111110, "1": 0b0110000, "2": 0b1101101, "3": 0b1111001, "4": 0b0110011,
  "5": 0b1011011, "6": 0b1011111, "7": 0b1110000, "8": 0b1111111, "9": 0b1111011, "-": 0b0000001, " ": 0,
};
function draw7seg(g: CanvasRenderingContext2D, str: string, x0: number, y0: number, dw: number, dh: number, on: string, off: string) {
  const t = Math.max(2, dw * 0.16), gap = t * 0.55, mid = y0 + dh / 2, xr = x0 + dw, yb = y0 + dh;
  const seg = (pts: [number, number][]) => { g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.fill(); };
  for (let c = 0; c < str.length; c++) {
    const bits = SEG_MAP[str[c]] ?? 0, x = x0 + c * (dw + dw * 0.34);
    const xrr = x + dw, S = [ // a,b,c,d,e,f,g as horizontal/vertical hexagon strips
      [[x + gap, y0], [xrr - gap, y0], [xrr - gap - t, y0 + t], [x + gap + t, y0 + t]],                                        // a top
      [[xrr, y0 + gap], [xrr, mid - gap * 0.5], [xrr - t, mid - gap * 0.5 - t * 0.4], [xrr - t, y0 + gap + t]],                // b top-right
      [[xrr, mid + gap * 0.5], [xrr, yb - gap], [xrr - t, yb - gap - t], [xrr - t, mid + gap * 0.5 + t * 0.4]],                // c bot-right
      [[x + gap, yb], [xrr - gap, yb], [xrr - gap - t, yb - t], [x + gap + t, yb - t]],                                        // d bottom
      [[x, mid + gap * 0.5], [x, yb - gap], [x + t, yb - gap - t], [x + t, mid + gap * 0.5 + t * 0.4]],                        // e bot-left
      [[x, y0 + gap], [x, mid - gap * 0.5], [x + t, mid - gap * 0.5 - t * 0.4], [x + t, y0 + gap + t]],                        // f top-left
      [[x + gap, mid], [x + gap + t, mid - t * 0.6], [xrr - gap - t, mid - t * 0.6], [xrr - gap, mid], [xrr - gap - t, mid + t * 0.6], [x + gap + t, mid + t * 0.6]], // g middle
    ] as [number, number][][];
    for (let s = 0; s < 7; s++) { g.fillStyle = bits & (1 << (6 - s)) ? on : off; seg(S[s]); }
  }
}

// centered rounded-rectangle path (used for the extruded LCD bezel + its cut-out)
function roundRectPath(p: THREE.Shape | THREE.Path, w: number, h: number, r: number) {
  const x = -w / 2, y = -h / 2;
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y);
}

// ===== TS35 top-hat DIN rail: thin-walled hat cross-section extruded along its length =====
// traces the sheet-metal outline (brim lips -> walls -> raised channel -> back along the inner face)
function makeTopHatRailGeo(length: number) {
  const wb = 0.17, wt = 0.125, hh = 0.11, th = 0.02, lip = 0.03;
  const s = new THREE.Shape();
  s.moveTo(-wb, lip); s.lineTo(-wb, 0); s.lineTo(-wt, 0); s.lineTo(-wt, hh);
  s.lineTo(wt, hh); s.lineTo(wt, 0); s.lineTo(wb, 0); s.lineTo(wb, lip);
  s.lineTo(wb - th, lip); s.lineTo(wb - th, th); s.lineTo(wt - th, th); s.lineTo(wt - th, hh - th);
  s.lineTo(-wt + th, hh - th); s.lineTo(-wt + th, th); s.lineTo(-wb + th, th); s.lineTo(-wb + th, lip);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false, steps: 1 });
  geo.translate(0, 0, -length / 2);   // centre the extrusion on origin
  geo.rotateY(Math.PI / 2); geo.rotateX(Math.PI / 2); // span -> +Y, depth -> +Z, length -> +X
  geo.computeVertexNormals();
  return geo;
}

// ===== keyed RJ45 keystone outline (rectangle with a bottom-centre tab notch) for the switch jacks =====
function makeRJ45Geo(depth: number) {
  const w = 0.13, h = 0.15, tabW = 0.055, tabH = 0.045;
  const s = new THREE.Shape();
  s.moveTo(-w / 2, h / 2); s.lineTo(w / 2, h / 2);
  s.lineTo(w / 2, -h / 2 + tabH); s.lineTo(tabW / 2, -h / 2 + tabH);
  s.lineTo(tabW / 2, -h / 2); s.lineTo(-tabW / 2, -h / 2);
  s.lineTo(-tabW / 2, -h / 2 + tabH); s.lineTo(-w / 2, -h / 2 + tabH);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, steps: 1 });
}

// small dark managed-switch label plaque
function makeSwitchLabelTex() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 96; const x = c.getContext("2d")!;
  x.fillStyle = "#101216"; x.fillRect(0, 0, 256, 96);
  x.fillStyle = "#6b7178"; x.font = "700 20px " + F; x.fillText("CTRL-NET", 12, 30);
  x.fillStyle = "#4c525a"; x.font = "600 13px " + F; x.fillText("8-PORT · RS485 GW", 12, 54);
  x.fillText("MODBUS · 100M", 12, 74);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// generic SCADA topology node-label plaque — dark matte panel + small dim cyan tick + light text
// (backgrounds kept dark & desaturated so they never bloom to white). Thai-capable font stack.
function makeNodeLabelTex(text: string) {
  const c = document.createElement("canvas"); c.width = 340; c.height = 92; const x = c.getContext("2d")!;
  x.fillStyle = "#0e1114"; x.fillRect(0, 0, 340, 92);
  x.strokeStyle = "#2a2f35"; x.lineWidth = 3; x.strokeRect(5, 5, 330, 82);
  // dim cyan accent tick (muted tone, sub-bloom) as the topology bullet
  x.fillStyle = "#1c6f7a"; x.fillRect(16, 26, 8, 40);
  x.fillStyle = "#cfd6dc"; x.textBaseline = "middle";
  x.font = "700 42px 'Tahoma','IBM Plex Mono',sans-serif";
  x.fillText(text, 44, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// enclosure brand / rating plate — dark etched-metal plaque riveted to the door frame
function makeRatingPlateTex() {
  const c = document.createElement("canvas"); c.width = 340; c.height = 200; const x = c.getContext("2d")!;
  x.fillStyle = "#191c20"; x.fillRect(0, 0, 340, 200);
  x.strokeStyle = "#3a3f45"; x.lineWidth = 4; x.strokeRect(7, 7, 326, 186);
  x.fillStyle = "#c4cad0"; x.font = "800 40px " + F; x.fillText("CTRL", 20, 52);
  x.fillStyle = "#6b7178"; x.font = "600 15px " + F; x.fillText("METERING CABINET", 132, 46);
  x.strokeStyle = "#2c3036"; x.lineWidth = 2; x.beginPath(); x.moveTo(20, 68); x.lineTo(320, 68); x.stroke();
  x.fillStyle = "#8a9096"; x.font = "600 15px " + F;
  const rows = ["MODEL   CTRL-DB10", "SUPPLY  230/400V ~ 50Hz", "RATING  10 x 1(6)A  Modbus", "PROT.   IP54 . IK08", "S/N     CDB-100482-TH"];
  rows.forEach((r, i) => x.fillText(r, 20, 96 + i * 20));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ===== shared, reusable geometry + materials for the 10 cabinet meters (built once) =====
type MiniShared = ReturnType<typeof buildMiniShared>;
let _miniShared: MiniShared | null = null;
function buildMiniShared(brushed: THREE.Texture) {
  // molded clip-on front cover (sits proud of the body → real parting line at its edge)
  const coverGeo = new RoundedBoxGeometry(0.71, 1.64, 0.09, 5, 0.05);
  // raised LCD bezel: extruded rounded frame with a rectangular cut-out (the window)
  const bezShape = new THREE.Shape(); roundRectPath(bezShape, 0.6, 0.46, 0.05);
  const bezHole = new THREE.Path(); roundRectPath(bezHole, 0.52, 0.34, 0.03); bezShape.holes.push(bezHole);
  const bezelGeo = new THREE.ExtrudeGeometry(bezShape, { depth: 0.085, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.02, bevelSegments: 2, steps: 1 });
  const faceGeo = new RoundedBoxGeometry(0.56, 0.42, 0.05, 3, 0.03);      // dark recessed LCD pocket
  const btnGeo = new THREE.CylinderGeometry(0.05, 0.056, 0.032, 20);      // push-button cap
  const btnRingGeo = new THREE.TorusGeometry(0.062, 0.009, 8, 22);        // recessed button collar
  const flapGeo = new RoundedBoxGeometry(0.66, 0.32, 0.022, 2, 0.02);     // molded terminal-cover flap
  const sealLoopGeo = new THREE.TorusGeometry(0.03, 0.008, 6, 18);        // lead-seal wire loop
  const sealPostGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.055, 6); // seal post
  const ventBackGeo = new THREE.BoxGeometry(0.5, 0.3, 0.014);             // recessed grille pocket
  const ventSlitGeo = new THREE.BoxGeometry(0.44, 0.016, 0.024);          // one grille slit (instanced)
  const partFrontGeo = new THREE.BoxGeometry(0.72, 0.012, 0.008);        // front parting-line groove
  const partSideGeo = new THREE.BoxGeometry(0.012, 0.012, 0.5);          // side parting-line groove
  const termGeo = new THREE.BoxGeometry(0.24, 0.24, 0.42);
  const screwGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12);
  const screwSlotGeo = new THREE.BoxGeometry(0.072, 0.01, 0.05);          // slotted drive across each terminal screw head
  const ferruleGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.07, 10);  // crimped wire-ferrule tip entering the terminal
  const ferruleCollarGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.02, 10); // ferrule plastic collar
  const torqueGeo = new THREE.BoxGeometry(0.2, 0.014, 0.01);             // torque-stripe decal across the terminal block
  const commBossGeo = new THREE.CylinderGeometry(0.03, 0.036, 0.06, 12);  // RS485 comm-port gland boss on the meter side
  const clipGeo = new THREE.BoxGeometry(0.15, 0.24, 0.12);          // DIN-clip foot body (grips the rail at the back)
  const clipHookGeo = new THREE.BoxGeometry(0.15, 0.05, 0.06);      // clip return hook under the rail lip
  const clipSpringGeo = new THREE.BoxGeometry(0.46, 0.05, 0.05);    // sprung release tab spanning the two feet

  const coverMat = new THREE.MeshStandardMaterial({ color: 0x24272c, metalness: 0.08, roughness: 0.78, roughnessMap: brushed, envMapIntensity: 0.7 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1c1f24, metalness: 0.1, roughness: 0.82, roughnessMap: brushed, envMapIntensity: 0.6 });
  const bezelMat = new THREE.MeshStandardMaterial({ color: 0x17191e, metalness: 0.28, roughness: 0.55, envMapIntensity: 0.5 });
  const faceMat = new THREE.MeshStandardMaterial({ color: 0x0b0c10, metalness: 0.3, roughness: 0.45 });
  const btnMat = new THREE.MeshStandardMaterial({ color: 0x2e3238, metalness: 0.2, roughness: 0.5, envMapIntensity: 0.5 });
  const flapMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, metalness: 0.12, roughness: 0.72, roughnessMap: brushed, envMapIntensity: 0.55 });
  const sealMat = new THREE.MeshStandardMaterial({ color: 0x8a9096, metalness: 0.8, roughness: 0.45, envMapIntensity: 0.5 });
  const ventBackMat = new THREE.MeshStandardMaterial({ color: 0x070809, roughness: 0.9 });
  const ventSlitMat = new THREE.MeshStandardMaterial({ color: 0x2a2e34, metalness: 0.15, roughness: 0.7, envMapIntensity: 0.4 });
  const partMat = new THREE.MeshStandardMaterial({ color: 0x090a0c, roughness: 0.9 });
  const termMat = new THREE.MeshStandardMaterial({ color: 0x212227, metalness: 0.5, roughness: 0.6 });
  const screwMat = new THREE.MeshStandardMaterial({ color: 0x5a6066, metalness: 0.85, roughness: 0.5, envMapIntensity: 0.4 });
  const screwSlotMat = new THREE.MeshStandardMaterial({ color: 0x101215, metalness: 0.5, roughness: 0.7 });
  const ferruleMat = new THREE.MeshStandardMaterial({ color: 0x9fa6ad, metalness: 0.92, roughness: 0.36, envMapIntensity: 0.5 }); // tinned copper crimp
  const ferruleCollarMat = new THREE.MeshStandardMaterial({ color: 0x22282b, metalness: 0.2, roughness: 0.6 });                    // neutral insulated collar
  const torqueMat = new THREE.MeshStandardMaterial({ color: 0x2c2926, metalness: 0.1, roughness: 0.6 });                          // dried torque-paint stripe (desaturated)
  const commBossMat = new THREE.MeshStandardMaterial({ color: 0x14181c, metalness: 0.5, roughness: 0.5 });
  const clipMat = new THREE.MeshStandardMaterial({ color: 0x2b2e33, metalness: 0.55, roughness: 0.5, envMapIntensity: 0.4 });
  return { coverGeo, bezelGeo, faceGeo, btnGeo, btnRingGeo, flapGeo, sealLoopGeo, sealPostGeo, ventBackGeo, ventSlitGeo, partFrontGeo, partSideGeo, termGeo, screwGeo,
    screwSlotGeo, ferruleGeo, ferruleCollarGeo, torqueGeo, commBossGeo,
    clipGeo, clipHookGeo, clipSpringGeo,
    coverMat, bodyMat, bezelMat, faceMat, btnMat, flapMat, sealMat, ventBackMat, ventSlitMat, partMat, termMat, screwMat,
    screwSlotMat, ferruleMat, ferruleCollarMat, torqueMat, commBossMat, clipMat };
}

// ===== compact DMR121 meter for the cabinet rows — injection-moulded form =====
function makeMini(seed: number, brushed: THREE.Texture) {
  const S = _miniShared || (_miniShared = buildMiniShared(brushed));
  const group = new THREE.Group();
  // main body (chamfered rounded box) + proud molded front cover
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.74, 1.7, 0.55, 5, 0.07), S.bodyMat); group.add(body);
  const cover = new THREE.Mesh(S.coverGeo, S.coverMat); cover.position.set(0, 0, 0.235); group.add(cover);
  // parting line: recessed grooves where the cover meets the body (front + both sides)
  const pf = new THREE.Mesh(S.partFrontGeo, S.partMat); pf.position.set(0, -0.83, 0.276); group.add(pf);
  for (const sx of [-1, 1]) { const ps = new THREE.Mesh(S.partSideGeo, S.partMat); ps.position.set(sx * 0.372, 0, 0.02); group.add(ps); }
  // recessed LCD pocket + raised bezel rim around the screen
  const face = new THREE.Mesh(S.faceGeo, S.faceMat); face.position.set(0, 0.48, 0.285); group.add(face);
  const bezel = new THREE.Mesh(S.bezelGeo, S.bezelMat); bezel.position.set(0, 0.48, 0.27); group.add(bezel);
  const dc = document.createElement("canvas"); dc.width = 512; dc.height = 320;
  const g = dc.getContext("2d")!;
  const tex = new THREE.CanvasTexture(dc); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.51, 0.32), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  disp.position.set(0, 0.48, 0.305); group.add(disp);
  // 2 physical push-buttons below the screen (cap + recessed collar)
  for (const bx of [-0.13, 0.13]) {
    const ring = new THREE.Mesh(S.btnRingGeo, S.bezelMat); ring.position.set(bx, 0.16, 0.29); group.add(ring);
    const btn = new THREE.Mesh(S.btnGeo, S.btnMat); btn.rotation.x = Math.PI / 2; btn.position.set(bx, 0.16, 0.3); group.add(btn);
  }
  // printed label — dark matte plaque, low envMap so it can't catch a specular hotspot / bloom
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.33), new THREE.MeshStandardMaterial({ map: makeLabelTex(seed), roughness: 0.72, metalness: 0.15, emissive: 0x000000, emissiveIntensity: 0, envMapIntensity: 0.3, toneMapped: true }));
  label.position.set(0, -0.18, 0.286); group.add(label);
  // fine ventilation grille (recessed pocket + instanced thin slits) at the lower front
  const ventBack = new THREE.Mesh(S.ventBackGeo, S.ventBackMat); ventBack.position.set(0, -0.62, 0.275); group.add(ventBack);
  const NV = 9; const vents = new THREE.InstancedMesh(S.ventSlitGeo, S.ventSlitMat, NV); const vm = new THREE.Matrix4();
  for (let v = 0; v < NV; v++) { vm.makeTranslation(0, -0.62 + (v - (NV - 1) / 2) * 0.032, 0.283); vents.setMatrixAt(v, vm); }
  vents.instanceMatrix.needsUpdate = true; group.add(vents);
  // molded terminal-cover flaps (angled over the screws) + lead-seal loops, top & bottom
  for (const sy of [0.92, -0.92]) {
    const dir = sy > 0 ? 1 : -1;
    const flap = new THREE.Mesh(S.flapGeo, S.flapMat); flap.position.set(0, sy - dir * 0.02, 0.35); flap.rotation.x = dir * 0.42; group.add(flap);
    const loop = new THREE.Mesh(S.sealLoopGeo, S.sealMat); loop.position.set(0.16, -dir * 0.13, 0.03); flap.add(loop);
    const post = new THREE.Mesh(S.sealPostGeo, S.sealMat); post.position.set(0.16, -dir * 0.09, 0.01); post.rotation.x = Math.PI / 2; flap.add(post);
  }
  // tiny red imp/kWh LED — kept dim & sub-threshold so it never blooms; cyan stays the only glow accent
  const ledMat = new THREE.MeshStandardMaterial({ color: 0xd83228, emissive: 0xd83228, emissiveIntensity: 0.9, roughness: 0.3 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 12), ledMat); led.position.set(0.2, 0.72, 0.3); group.add(led);
  const ledRing = new THREE.Mesh(S.btnRingGeo, S.bezelMat); ledRing.scale.setScalar(0.42); ledRing.position.set(0.2, 0.72, 0.29); group.add(ledRing);
  // cyan comms/link LED — the per-meter accent that ties into the RS485 story
  const comMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 1.6, roughness: 0.3 });
  const com = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 12), comMat); com.position.set(-0.2, 0.72, 0.3); group.add(com);
  const comRing = new THREE.Mesh(S.btnRingGeo, S.bezelMat); comRing.scale.setScalar(0.42); comRing.position.set(-0.2, 0.72, 0.29); group.add(comRing);
  // RS485 comm-port gland boss on the bottom edge — where the daisy-bus drop taps this meter
  const commBoss = new THREE.Mesh(S.commBossGeo, S.commBossMat); commBoss.position.set(0, -0.78, 0.24); group.add(commBoss);
  // terminal blocks with slotted screws, crimped wire ferrules + a dried torque-paint stripe per row
  for (const sy of [-0.92, 0.92]) {
    const stripe = new THREE.Mesh(S.torqueGeo, S.torqueMat); stripe.position.set(0, sy + (sy < 0 ? 0.02 : -0.02), 0.375); group.add(stripe);
    for (let i = 0; i < 2; i++) {
      const bx = -0.18 + i * 0.36;
      const tb = new THREE.Mesh(S.termGeo, S.termMat); tb.position.set(bx, sy, 0.16); group.add(tb);
      const scy = sy + (sy < 0 ? 0.06 : -0.06);
      const sc = new THREE.Mesh(S.screwGeo, S.screwMat); sc.rotation.x = Math.PI / 2; sc.position.set(bx, scy, 0.38); group.add(sc);
      const slot = new THREE.Mesh(S.screwSlotGeo, S.screwSlotMat); slot.rotation.z = 0.5 + i * 0.9; slot.position.set(bx, scy, 0.4); group.add(slot);
      // crimped ferrule tip diving into the terminal throat (below the top row / above the bottom row)
      const fy = sy + (sy < 0 ? -0.16 : 0.16);
      const collar = new THREE.Mesh(S.ferruleCollarGeo, S.ferruleCollarMat); collar.position.set(bx, fy, 0.34); group.add(collar);
      const fer = new THREE.Mesh(S.ferruleGeo, S.ferruleMat); fer.position.set(bx, sy + (sy < 0 ? -0.1 : 0.1), 0.34); group.add(fer);
    }
  }
  // DIN-clip feet on the back — two clip bodies + return hooks gripping the rail, joined by a sprung release tab
  for (const cx of [-0.22, 0.22]) {
    const clip = new THREE.Mesh(S.clipGeo, S.clipMat); clip.position.set(cx, -0.02, -0.24); group.add(clip);
    const hook = new THREE.Mesh(S.clipHookGeo, S.clipMat); hook.position.set(cx, -0.16, -0.20); group.add(hook);
  }
  const clipSpring = new THREE.Mesh(S.clipSpringGeo, S.clipMat); clipSpring.position.set(0, -0.19, -0.25); group.add(clipSpring);
  let kwh = 1000 + seed * 733 % 8000; const ph = seed * 1.7;
  const update = (t: number) => {
    kwh += 0.02;
    // LCD: deep-black glass, 7-segment cyan readout kept sub-bloom so only the RS485/server glow
    g.fillStyle = "#03060b"; g.fillRect(0, 0, 512, 320);
    g.strokeStyle = "rgba(95,175,255,0.34)"; g.lineWidth = 4; g.strokeRect(6, 6, 500, 308);
    g.fillStyle = "#9adcf2"; g.font = `700 30px ${F}`; g.fillText("kWh", 26, 50);
    g.fillStyle = "rgba(0,229,255,0.85)"; g.beginPath(); g.arc(474, 40, 9, 0, 7); g.fill();
    // large high-contrast 7-segment energy value so the hero rows clearly read as live displays
    const val = kwh.toFixed(1).replace(".", "").slice(-6).padStart(6, "0");
    draw7seg(g, val, 28, 74, 56, 104, "#74ecf9", "rgba(70,150,170,0.13)");
    g.fillStyle = "#a9c6f0"; g.font = `700 30px ${F}`; g.fillText((900 + Math.round(Math.sin(t + ph) * 300)) + " W  230V  50Hz", 26, 240);
    g.fillStyle = "rgba(0,229,255,0.16)"; g.fillRect(26, 258, 460, 34);
    g.fillStyle = "#00d9ef"; g.fillRect(26, 258, 230 + Math.sin(t * 1.4 + ph) * 176, 34);
    tex.needsUpdate = true;
    ledMat.emissiveIntensity = 0.4 + Math.max(0, Math.sin(t * 5 + ph)) * 0.7;                 // dim red imp blink
    comMat.emissiveIntensity = 0.9 + Math.max(0, Math.sin(t * 7 + ph * 2.3)) * 1.6;           // cyan comms flicker
  };
  return { group, update };
}

// ===== DIN-rail cabinet + DMR121 bank + RS485 → switch → server (with data pulses) =====
function buildCabinet() {
  const group = new THREE.Group();
  const minis: { group: THREE.Group; update: (t: number) => void }[] = [];
  const brushed = makeBrushedTex(4);
  // soft radial vignette backdrop: gentle pool of light behind the cabinet, sinking the frame corners to near-black
  {
    const vc = document.createElement("canvas"); vc.width = vc.height = 512; const vx = vc.getContext("2d")!;
    // raking pool of light offset to camera-left so one side of the cabinet gradients into shadow; deeper corners
    const grd = vx.createRadialGradient(210, 205, 30, 256, 256, 340);
    grd.addColorStop(0, "#1a1e25"); grd.addColorStop(0.42, "#101318"); grd.addColorStop(0.78, "#0a0a0a"); grd.addColorStop(1, "#0a0a0a");
    vx.fillStyle = grd; vx.fillRect(0, 0, 512, 512);
    const vt = new THREE.CanvasTexture(vc); vt.colorSpace = THREE.SRGBColorSpace;
    // large full-frustum backdrop; edges land on the site's #0a0a0a so the canvas blends seamlessly into the .twin-band (toneMapped:false keeps the hex literal)
    const vig = new THREE.Mesh(new THREE.PlaneGeometry(70, 42), new THREE.MeshBasicMaterial({ map: vt, depthWrite: false, toneMapped: false }));
    vig.position.set(0.5, 0.6, -5.5); group.add(vig);
  }
  // enclosure back + inner panel + side walls (depth)
  const back = new THREE.Mesh(new RoundedBoxGeometry(9.9, 5.7, 0.4, 6, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x1b1e23, metalness: 0.8, roughness: 0.36, roughnessMap: brushed, envMapIntensity: 0.8 }));
  back.position.z = -0.7; group.add(back);
  const panel = new THREE.Mesh(new RoundedBoxGeometry(9.2, 5.0, 0.14, 4, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x212429, metalness: 0.75, roughness: 0.38, roughnessMap: brushed, envMapIntensity: 0.7 })); panel.position.z = -0.4; group.add(panel);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x171a1f, metalness: 0.4, roughness: 0.6 });
  for (const [w, h, x, y] of [[9.9, 0.9, 0, 2.85], [9.9, 0.9, 0, -2.85], [0.9, 5.7, -4.95, 0], [0.9, 5.7, 4.95, 0]] as const) {
    const wl = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.0), wallMat); wl.position.set(x, y, -0.2); group.add(wl);
  }
  // outer door frame (dark anodized steel) — darkened so it recedes and only catches an edge highlight
  const fmat = new THREE.MeshStandardMaterial({ color: 0x22262a, metalness: 0.7, roughness: 0.44, roughnessMap: brushed, envMapIntensity: 0.5 });
  const fw = 10.0, fh = 5.8, tk = 0.22;
  ([[fw, tk, 0, fh / 2], [fw, tk, 0, -fh / 2], [tk, fh, -fw / 2, 0], [tk, fh, fw / 2, 0]] as const)
    .forEach(([w, h, x, y]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), fmat); b.position.set(x, y, 0.42); group.add(b); });
  // door RETURN / reveal — a reveal wall lining the opening that bridges the front frame back into the enclosure
  // body, so the door reads as one part with real depth (kills the detached "floating frame" gap on the left)
  ([[fw - 2 * tk, 0.18, 0, fh / 2 - tk], [fw - 2 * tk, 0.18, 0, -(fh / 2 - tk)], [0.18, fh - 2 * tk, -(fw / 2 - tk), 0], [0.18, fh - 2 * tk, fw / 2 - tk, 0]] as const)
    .forEach(([w, h, x, y]) => { const rv = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.82), fmat); rv.position.set(x, y, 0.03); group.add(rv); });
  // trunking ducts
  const ductMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.3, roughness: 0.8, roughnessMap: brushed });
  const slotMat = new THREE.MeshStandardMaterial({ color: 0x1c1e23, roughness: 0.85 });
  for (const dy of [2.35, 0, -2.35]) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(9.0, 0.5, 0.5), ductMat); d.position.set(0, dy, -0.05); group.add(d);
    for (let s = 0; s < 22; s++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.02), slotMat); sl.position.set(-4.35 + s * 0.415, dy, 0.21); group.add(sl); }
  }
  // vertical wire-duct risers on the flanks — slotted-teeth trunking carrying conductors between rows
  const teethGeo = new THREE.BoxGeometry(0.28, 0.12, 0.02);            // one slotted tooth (instanced)
  for (const rx of [-4.15, 4.15]) {
    const vd = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.0, 0.5), ductMat); vd.position.set(rx, 0, -0.05); group.add(vd);
    const NT = 20; const teeth = new THREE.InstancedMesh(teethGeo, slotMat, NT); const tmx = new THREE.Matrix4();
    for (let s = 0; s < NT; s++) { tmx.makeTranslation(rx, -2.3 + s * 0.242, 0.21); teeth.setMatrixAt(s, tmx); }
    teeth.instanceMatrix.needsUpdate = true; group.add(teeth);
  }
  // ---- enclosure door hardware: barrel hinges, quarter-turn latch, corner screws, cable gland ----
  const hwMat = new THREE.MeshStandardMaterial({ color: 0x40454b, metalness: 0.9, roughness: 0.34, roughnessMap: brushed, envMapIntensity: 0.6 });
  const hwDark = new THREE.MeshStandardMaterial({ color: 0x191c20, metalness: 0.6, roughness: 0.5 });
  const boltGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.1, 6);         // corner mounting bolt head
  const boltMat = new THREE.MeshStandardMaterial({ color: 0x6a7076, metalness: 0.9, roughness: 0.4, envMapIntensity: 0.5 });
  // two barrel hinges on the left frame edge
  for (const hy of [1.75, -1.75]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.66, 16), hwMat); barrel.position.set(-5.0, hy, 0.5); group.add(barrel);
    for (const ky of [0.22, 0, -0.22]) { const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.16, 16), hwDark); kn.position.set(-5.0, hy + ky, 0.5); group.add(kn); }
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.06), hwMat); leaf.position.set(-4.74, hy, 0.62); group.add(leaf);
  }
  // continuous piano-hinge strip running the full left door edge (knuckle barrel + two mounting flanges)
  const hingeStripGeo = new THREE.CylinderGeometry(0.075, 0.075, 5.2, 14);
  const hStrip = new THREE.Mesh(hingeStripGeo, hwMat); hStrip.position.set(-5.02, 0, 0.52); group.add(hStrip);
  const hKnuckleGeo = new THREE.CylinderGeometry(0.088, 0.088, 0.16, 14);        // segmented knuckles along the barrel
  const NK = 13; const knuckles = new THREE.InstancedMesh(hKnuckleGeo, hwDark, NK); const kmx = new THREE.Matrix4();
  for (let k = 0; k < NK; k++) { kmx.makeTranslation(-5.02, -2.5 + k * (5.0 / (NK - 1)), 0.52); knuckles.setMatrixAt(k, kmx); }
  knuckles.instanceMatrix.needsUpdate = true; group.add(knuckles);
  const hFlange = new THREE.Mesh(new THREE.BoxGeometry(0.16, 5.2, 0.04), hwMat); hFlange.position.set(-4.9, 0, 0.63); group.add(hFlange);
  // quarter-turn latch / lock barrel on the right frame edge
  const latchBody = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.34, 20), hwMat); latchBody.rotation.x = Math.PI / 2; latchBody.position.set(5.0, 0, 0.62); group.add(latchBody);
  const latchRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 10, 24), hwDark); latchRing.position.set(5.0, 0, 0.74); group.add(latchRing);
  const latchSlot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.04), hwDark); latchSlot.position.set(5.0, 0, 0.8); group.add(latchSlot);
  // four corner mounting bolts through the frame + a cross-recess mounting screw beside each
  const cornerScrewGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 14);
  const crossAGeo = new THREE.BoxGeometry(0.07, 0.014, 0.03);
  const crossBGeo = new THREE.BoxGeometry(0.014, 0.07, 0.03);
  for (const bx of [-4.72, 4.72]) for (const by of [2.62, -2.62]) {
    const b = new THREE.Mesh(boltGeo, boltMat); b.rotation.x = Math.PI / 2; b.position.set(bx, by, 0.66); group.add(b);
    const csx = bx * 0.955, csy = by * 0.93;                                 // corner mounting screw just inboard of the bolt
    const cs = new THREE.Mesh(cornerScrewGeo, boltMat); cs.rotation.x = Math.PI / 2; cs.position.set(csx, csy, 0.65); group.add(cs);
    const ca = new THREE.Mesh(crossAGeo, hwDark); ca.position.set(csx, csy, 0.68); group.add(ca);
    const cb = new THREE.Mesh(crossBGeo, hwDark); cb.position.set(csx, csy, 0.68); group.add(cb);
  }
  // cable gland on the lower-right wall where the RS485 / uplink pierce the enclosure
  const glandBody = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.34, 20), hwMat); glandBody.rotation.z = Math.PI / 2; glandBody.position.set(5.05, -2.15, 0.45); group.add(glandBody);
  const glandNut = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 6), hwDark); glandNut.rotation.z = Math.PI / 2; glandNut.position.set(4.92, -2.15, 0.45); group.add(glandNut);
  const glandDome = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), hwDark); glandDome.rotation.z = -Math.PI / 2; glandDome.position.set(5.28, -2.15, 0.45); group.add(glandDome);
  // ---- bottom GLAND PLATE: removable base plate carrying a row of downward cable glands where feeders exit ----
  const glandPlateMat = new THREE.MeshStandardMaterial({ color: 0x1f2429, metalness: 0.72, roughness: 0.42, roughnessMap: brushed, envMapIntensity: 0.55 });
  const glandPlate = new THREE.Mesh(new RoundedBoxGeometry(4.8, 0.6, 1.0, 3, 0.06), glandPlateMat); glandPlate.position.set(-0.4, -2.98, -0.12); group.add(glandPlate);
  // plate fixing screws at its four corners
  const gpScrewGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.06, 12);
  for (const gx of [-2.62, 1.82]) for (const gy of [-2.76, -3.2]) {
    const gps = new THREE.Mesh(gpScrewGeo, boltMat); gps.rotation.x = Math.PI / 2; gps.position.set(gx, gy, 0.4); group.add(gps);
  }
  // reusable downward-gland parts (axis already +Y) — body + hex lock-nut + domed cap + entry hole shadow
  const gBodyGeo = new THREE.CylinderGeometry(0.15, 0.19, 0.28, 18);
  const gNutGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.12, 6);
  const gCapGeo = new THREE.CylinderGeometry(0.11, 0.15, 0.14, 18);
  const gHoleGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.02, 14);
  const feederMat = new THREE.MeshStandardMaterial({ color: 0x0c0e11, roughness: 0.7, metalness: 0.08 });
  for (let i = 0; i < 5; i++) {
    const gx = -2.4 + i * 1.0;
    const gnut = new THREE.Mesh(gNutGeo, hwDark); gnut.position.set(gx, -3.02, -0.12); group.add(gnut);
    const gbody = new THREE.Mesh(gBodyGeo, hwMat); gbody.position.set(gx, -3.2, -0.12); group.add(gbody);
    const gcap = new THREE.Mesh(gCapGeo, hwDark); gcap.position.set(gx, -3.36, -0.12); group.add(gcap);
    const ghole = new THREE.Mesh(gHoleGeo, hwDark); ghole.position.set(gx, -2.78, -0.12); group.add(ghole);
    // two of the glands carry a short feeder cable stub dropping out of the enclosure
    if (i === 1 || i === 3) {
      const fcv = new THREE.CatmullRomCurve3([new THREE.Vector3(gx, -3.4, -0.12), new THREE.Vector3(gx + 0.05, -3.75, -0.05), new THREE.Vector3(gx + 0.02, -4.05, -0.02)]);
      group.add(new THREE.Mesh(new THREE.TubeGeometry(fcv, 16, 0.05, 8, false), feederMat));
    }
  }
  // brand / rating plate riveted to the lower door frame
  const ratePlate = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.88), new THREE.MeshStandardMaterial({ map: makeRatingPlateTex(), roughness: 0.6, metalness: 0.2, envMapIntensity: 0.35 }));
  ratePlate.position.set(-3.5, -2.55, 0.735); group.add(ratePlate);
  const rpRivetGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8);
  for (const rx of [-4.16, -2.84]) for (const ry of [-2.19, -2.91]) {
    const rv = new THREE.Mesh(rpRivetGeo, boltMat); rv.rotation.x = Math.PI / 2; rv.position.set(rx, ry, 0.745); group.add(rv);
  }
  // perimeter gasket lip: soft rubber frame set just inside the door opening (shows the door has thickness)
  const gasketMat = new THREE.MeshStandardMaterial({ color: 0x101215, metalness: 0.05, roughness: 0.95 });
  ([[9.4, 0.12, 0, 2.62], [9.4, 0.12, 0, -2.62], [0.12, 5.2, -4.72, 0], [0.12, 5.2, 4.72, 0]] as const)
    .forEach(([w, h, x, y]) => { const gk = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), gasketMat); gk.position.set(x, y, 0.28); group.add(gk); });
  // inner mounting sub-plate standoff bosses lifting the panel off the backplate (visible depth at the corners)
  const standoffGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.34, 14);
  const standoffMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, metalness: 0.8, roughness: 0.4, envMapIntensity: 0.5 });
  for (const sx of [-4.2, -1.4, 1.4, 4.2]) for (const sy of [2.2, -2.2]) {
    const so = new THREE.Mesh(standoffGeo, standoffMat); so.rotation.x = Math.PI / 2; so.position.set(sx, sy, -0.55); group.add(so);
    const soCap = new THREE.Mesh(boltGeo, boltMat); soCap.rotation.x = Math.PI / 2; soCap.position.set(sx, sy, -0.36); group.add(soCap);
  }
  // green/yellow earthing strap bonding the door frame to the backplate
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x24261f, roughness: 0.55, metalness: 0.1, envMapIntensity: 0.25 });
  const strapCv = new THREE.CatmullRomCurve3([new THREE.Vector3(-4.74, -2.3, 0.5), new THREE.Vector3(-4.5, -2.55, 0.1), new THREE.Vector3(-4.2, -2.5, -0.3)]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(strapCv, 18, 0.03, 6, false), strapMat));

  // ---- GROUND: dark floor slab + soft radial contact-shadow pool so the cabinet is anchored, not floating ----
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(84, 48),
    new THREE.MeshStandardMaterial({ color: 0x070809, metalness: 0.35, roughness: 0.52, envMapIntensity: 0.45 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -3.95, 0.1); group.add(floor);
  {
    const sc = document.createElement("canvas"); sc.width = sc.height = 512; const sx = sc.getContext("2d")!;
    const sg = sx.createRadialGradient(256, 236, 30, 256, 256, 250);
    sg.addColorStop(0, "rgba(0,0,0,0.62)"); sg.addColorStop(0.55, "rgba(0,0,0,0.24)"); sg.addColorStop(1, "rgba(0,0,0,0)");
    sx.fillStyle = sg; sx.fillRect(0, 0, 512, 512);
    const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, toneMapped: true }));
    contact.rotation.x = -Math.PI / 2; contact.position.set(0.2, -3.93, 0.4); group.add(contact);
  }

  // ---- transparent polycarbonate viewing window sealing the meter bank (gives the cyan glow a surface to reflect in) ----
  const paneMat = new THREE.MeshPhysicalMaterial({ color: 0x0b1216, metalness: 0, roughness: 0.14, transparent: true, opacity: 0.16, envMapIntensity: 1.5, clearcoat: 0.9, clearcoatRoughness: 0.08, reflectivity: 0.5, ior: 1.49, side: THREE.DoubleSide });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(8.9, 4.7), paneMat); pane.position.set(0, 0, 0.66); group.add(pane);
  // window retaining bezel — thin dark frame clamping the polycarbonate into the door opening
  const winMat = new THREE.MeshStandardMaterial({ color: 0x1a1e22, metalness: 0.6, roughness: 0.45, roughnessMap: brushed, envMapIntensity: 0.5 });
  ([[9.3, 0.2, 0, 2.46], [9.3, 0.2, 0, -2.46], [0.2, 5.12, -4.55, 0], [0.2, 5.12, 4.55, 0]] as const)
    .forEach(([w, h, x, y]) => { const wf = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), winMat); wf.position.set(x, y, 0.64); group.add(wf); });

  // ---- DIN rails (TS35 top-hat) + end stops + backplate screws + meter bank ----
  const railGeo = makeTopHatRailGeo(8.7);
  const railMat = new THREE.MeshStandardMaterial({ color: 0xb9bdc4, metalness: 0.92, roughness: 0.3, roughnessMap: brushed, envMapIntensity: 0.75 });
  const slotGeo = new THREE.BoxGeometry(0.1, 0.05, 0.04);                 // oblong mounting slot on the rail web (reused)
  const slotMatR = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
  const endStopGeo = new RoundedBoxGeometry(0.17, 0.5, 0.36, 2, 0.03);    // spring end-stop bracket (reused)
  const endStopMat = new THREE.MeshStandardMaterial({ color: 0x2b2e34, metalness: 0.55, roughness: 0.5, roughnessMap: brushed, envMapIntensity: 0.4 });
  const bpScrewGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12);    // panhead screw fixing rail to backplate (reused)
  const bpScrewMat = new THREE.MeshStandardMaterial({ color: 0x7c828a, metalness: 0.9, roughness: 0.4, envMapIntensity: 0.5 });
  const meterPos: { x: number; y: number; row: number }[] = [];
  [1.15, -1.15].forEach((ry, r) => {
    const rail = new THREE.Mesh(railGeo, railMat); rail.position.set(0, ry, 0); group.add(rail);
    // periodic slotted holes down the web
    const NS = 15; const slots = new THREE.InstancedMesh(slotGeo, slotMatR, NS); const sm = new THREE.Matrix4();
    for (let s = 0; s < NS; s++) { sm.makeTranslation(-4.1 + s * 0.585, ry, 0.115); slots.setMatrixAt(s, sm); }
    slots.instanceMatrix.needsUpdate = true; group.add(slots);
    // end-stop brackets + fixing screws at both rail ends
    for (const ex of [-4.28, 4.28]) {
      const es = new THREE.Mesh(endStopGeo, endStopMat); es.position.set(ex, ry, 0.08); group.add(es);
      const bs = new THREE.Mesh(bpScrewGeo, bpScrewMat); bs.rotation.x = Math.PI / 2; bs.position.set(ex, ry, 0.2); group.add(bs);
    }
    // backplate fixing screws along the rail
    for (const gx of [-2.6, 0, 2.6]) { const bs = new THREE.Mesh(bpScrewGeo, bpScrewMat); bs.rotation.x = Math.PI / 2; bs.position.set(gx, ry, 0.14); group.add(bs); }
    for (let i = 0; i < 5; i++) { const x = -3.4 + i * 1.7; const m = makeMini(r * 5 + i, brushed); m.group.position.set(x, ry, 0.34); group.add(m.group); minis.push(m); meterPos.push({ x, y: ry, row: r }); }
  });

  // ---- wiring harness: L (dark red) + N (black) conductors diving from each terminal into the trunking ducts ----
  // conductors desaturated to near-black graphite so cyan stays the ONLY accent (tone separated only by value)
  const wireL = new THREE.MeshStandardMaterial({ color: 0x1a1715, roughness: 0.5, metalness: 0.05, envMapIntensity: 0.3 });    // phase (warm-black)
  const wireN = new THREE.MeshStandardMaterial({ color: 0x0c0e11, roughness: 0.58, metalness: 0.05 });                          // neutral (near-black)
  const wireB = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.5, metalness: 0.05, envMapIntensity: 0.3 });    // second phase (cool-black)
  const routeWire = (tx: number, ty: number, ddy: number, up: boolean, sag: number, mat: THREE.Material) => {
    const entryY = ddy + (up ? -0.28 : 0.28);
    const midY = ty + (entryY - ty) * 0.5 - sag;
    const cv = new THREE.CatmullRomCurve3([
      new THREE.Vector3(tx, ty, 0.5),
      new THREE.Vector3(tx + (Math.random() - 0.5) * 0.07, midY, 0.42),
      new THREE.Vector3(tx + (Math.random() - 0.5) * 0.05, entryY, 0.3),
      new THREE.Vector3(tx, ddy, 0.14),
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 22, 0.024, 6, false), mat));
  };
  meterPos.forEach((m, idx) => {
    const sag = 0.05 + (idx % 3) * 0.05;
    const topDuct = m.row === 0 ? 2.35 : 0;
    const botDuct = m.row === 0 ? 0 : -2.35;
    routeWire(m.x - 0.18, m.y + 0.92, topDuct, true, sag, wireL);
    routeWire(m.x + 0.18, m.y + 0.92, topDuct, true, sag * 0.7, wireN);
    routeWire(m.x - 0.18, m.y - 0.92, botDuct, false, sag * 0.8, m.row === 0 ? wireB : wireL);
    routeWire(m.x + 0.18, m.y - 0.92, botDuct, false, sag, wireN);
  });

  // ---- copper earth busbar along the bottom of the panel + green/yellow ground leads ----
  // busbar taken from bright copper to dark bronzed/near-black metal — the orange bar was the palette-breaker
  const copperMat = new THREE.MeshStandardMaterial({ color: 0x33302c, metalness: 0.92, roughness: 0.4, envMapIntensity: 0.55 });
  const copperOx = new THREE.MeshStandardMaterial({ color: 0x232120, metalness: 0.8, roughness: 0.55 });
  const earthMat = new THREE.MeshStandardMaterial({ color: 0x24261f, roughness: 0.5, metalness: 0.05, envMapIntensity: 0.25 }); // PE lead, desaturated dark
  const busbar = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.15, 0.17), copperMat); busbar.position.set(0, -2.62, 0.35); group.add(busbar);
  const bossGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.12, 12);
  const bossHole = new THREE.CylinderGeometry(0.028, 0.028, 0.14, 8);
  for (let i = 0; i < 12; i++) {
    const bx = -3.6 + i * 0.655;
    const boss = new THREE.Mesh(bossGeo, copperOx); boss.position.set(bx, -2.55, 0.35); group.add(boss);
    const hole = new THREE.Mesh(bossHole, hwDark); hole.position.set(bx, -2.52, 0.35); group.add(hole);
  }
  // short PE leads tapping from the bottom-row meters down into the busbar
  meterPos.filter((m) => m.row === 1).forEach((m) => {
    const cv = new THREE.CatmullRomCurve3([
      new THREE.Vector3(m.x + 0.18, m.y - 0.9, 0.48),
      new THREE.Vector3(m.x + 0.1, -2.3, 0.42),
      new THREE.Vector3(m.x, -2.5, 0.36),
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 16, 0.026, 6, false), earthMat));
  });

  // ---- RS485 daisy bus raised to terminal height, with T-tap drops, then out to the switch ----
  const rsMat = new THREE.MeshStandardMaterial({ color: 0x16323a, metalness: 0.25, roughness: 0.6, emissive: 0x18c6d8, emissiveIntensity: 0.28 });
  const tapMat = new THREE.MeshStandardMaterial({ color: 0x0e1418, metalness: 0.4, roughness: 0.5 });
  const tube = (pts: THREE.Vector3[], rad = 0.05) => { const cv = new THREE.CatmullRomCurve3(pts); return new THREE.Mesh(new THREE.TubeGeometry(cv, Math.max(16, pts.length * 8), rad, 10, false), rsMat); };
  const tTapGeo = new THREE.BoxGeometry(0.16, 0.14, 0.16);
  const glandBossGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.1, 12);   // connector gland where the bus taps a meter
  const dropGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.12, 8);       // short drop stub into each comm port
  const busY = (ry: number) => ry - 0.9; // terminal height
  const busSag = 0.08;                    // gentle catenary droop between meter taps
  for (const ry of [1.15, -1.15]) {
    const by = busY(ry);
    const xs = meterPos.filter((p) => p.y === ry).map((p) => p.x).sort((a, b) => a - b);
    const nodes = [-3.85, ...xs, 3.85];
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < nodes.length; i++) {
      if (i > 0) pts.push(new THREE.Vector3((nodes[i - 1] + nodes[i]) / 2, by - busSag, 0.55)); // sagged mid-span
      pts.push(new THREE.Vector3(nodes[i], by, 0.55));                                          // taut over each tap
    }
    group.add(tube(pts, 0.045));
    for (const m of meterPos.filter((p) => p.y === ry)) {
      const tap = new THREE.Mesh(tTapGeo, tapMat); tap.position.set(m.x, by, 0.55); group.add(tap);
      const gboss = new THREE.Mesh(glandBossGeo, tapMat); gboss.position.set(m.x, by + 0.09, 0.55); group.add(gboss);
      const drop = new THREE.Mesh(dropGeo, rsMat); drop.position.set(m.x, m.y - 0.84, 0.57); group.add(drop);
    }
  }
  group.add(tube([new THREE.Vector3(3.85, busY(1.15), 0.55), new THREE.Vector3(3.85, busY(-1.15), 0.55)], 0.05)); // riser joining rows
  // SWITCH sits mid-height to the RIGHT of the cabinet (horizontal topology). RS485 exits the cabinet's right side and runs rightward to it.
  const switchPos = new THREE.Vector3(8.2, 0.1, 0.8);
  group.add(tube([new THREE.Vector3(3.85, busY(-1.15), 0.55), new THREE.Vector3(4.6, -1.1, 0.6), new THREE.Vector3(5.2, 0.05, 0.7), new THREE.Vector3(6.6, 0.1, 0.8), switchPos.clone().add(new THREE.Vector3(-1.0, -0.02, -0.05))], 0.055));

  // ---- managed network SWITCH: keyed RJ45 jacks + link/act LEDs + vents + DIN clip + label ----
  const sw = new THREE.Group(); sw.position.copy(switchPos); group.add(sw);
  sw.add(new THREE.Mesh(new RoundedBoxGeometry(1.85, 0.62, 0.95, 3, 0.06), new THREE.MeshStandardMaterial({ color: 0x191b21, metalness: 0.65, roughness: 0.38, roughnessMap: brushed, envMapIntensity: 1.0 })));
  const shroudGeo = makeRJ45Geo(0.07);
  const cavityGeo = makeRJ45Geo(0.06);
  const shroudMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.95, roughness: 0.34, envMapIntensity: 0.7 });
  const cavityMat = new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.7 });
  const contactMat = new THREE.MeshStandardMaterial({ color: 0xc79a3e, metalness: 0.9, roughness: 0.4 });
  const linkMats: THREE.MeshStandardMaterial[] = [];
  const actMats: THREE.MeshStandardMaterial[] = [];
  // recessed front bezel plate the RJ45 bank sits in (adds real face depth + a metal lip line)
  const bezelPlate = new THREE.Mesh(new RoundedBoxGeometry(1.72, 0.34, 0.06, 3, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x0d0f12, metalness: 0.5, roughness: 0.45, envMapIntensity: 0.5 }));
  bezelPlate.position.set(-0.02, -0.05, 0.44); sw.add(bezelPlate);
  const pinGeo = new THREE.BoxGeometry(0.006, 0.03, 0.012);               // one of the 8 gold contact pins (instanced)
  for (let i = 0; i < 8; i++) {
    const px = -0.735 + i * 0.21;
    const shroud = new THREE.Mesh(shroudGeo, shroudMat); shroud.position.set(px, -0.07, 0.41); sw.add(shroud);
    const cav = new THREE.Mesh(cavityGeo, cavityMat); cav.scale.set(0.78, 0.78, 1); cav.position.set(px, -0.07, 0.36); sw.add(cav);
    const contact = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.02), contactMat); contact.position.set(px, -0.02, 0.44); sw.add(contact);
    // 8-pin gold contact comb hinted inside each jack
    const pins = new THREE.InstancedMesh(pinGeo, contactMat, 8); const pmm = new THREE.Matrix4();
    for (let p = 0; p < 8; p++) { pmm.makeTranslation(px - 0.028 + p * 0.008, -0.015, 0.43); pins.setMatrixAt(p, pmm); }
    pins.instanceMatrix.needsUpdate = true; sw.add(pins);
    // paired LEDs above each port: green/cyan link (accent, animated) + faint amber act
    const lm = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x22d3ee, emissiveIntensity: 2, roughness: 0.3 }); linkMats.push(lm);
    const am = new THREE.MeshStandardMaterial({ color: 0x6b4a12, emissive: 0xd98a1a, emissiveIntensity: 0.35, roughness: 0.4 }); actMats.push(am);
    const ll = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), lm); ll.position.set(px - 0.035, 0.14, 0.46); sw.add(ll);
    const al = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 10), am); al.position.set(px + 0.035, 0.14, 0.46); sw.add(al);
  }
  // top + side vent slits
  const ventGeo = new THREE.BoxGeometry(1.4, 0.02, 0.04);
  const ventMatS = new THREE.MeshStandardMaterial({ color: 0x070809, roughness: 0.85 });
  const topVents = new THREE.InstancedMesh(ventGeo, ventMatS, 7); const vmx = new THREE.Matrix4();
  for (let v = 0; v < 7; v++) { vmx.makeTranslation(0, 0.31, -0.28 + v * 0.075); topVents.setMatrixAt(v, vmx); } topVents.instanceMatrix.needsUpdate = true; sw.add(topVents);
  const sideGeo = new THREE.BoxGeometry(0.04, 0.02, 0.55);
  const sideVents = new THREE.InstancedMesh(sideGeo, ventMatS, 6); const svm = new THREE.Matrix4();
  for (let v = 0; v < 6; v++) { svm.makeTranslation(0.925, 0.18 - v * 0.07, 0); sideVents.setMatrixAt(v, svm); } sideVents.instanceMatrix.needsUpdate = true; sw.add(sideVents);
  // four chassis corner screws on the switch face
  const swScrewGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.03, 10);
  const swSlotGeo = new THREE.BoxGeometry(0.05, 0.008, 0.02);
  for (const cx of [-0.86, 0.86]) for (const cy of [0.24, -0.24]) {
    const s = new THREE.Mesh(swScrewGeo, bpScrewMat); s.rotation.x = Math.PI / 2; s.position.set(cx, cy, 0.47); sw.add(s);
    const sl = new THREE.Mesh(swSlotGeo, cavityMat); sl.rotation.z = cx * cy > 0 ? 0.6 : -0.6; sl.position.set(cx, cy, 0.49); sw.add(sl);
  }
  // DIN clip on the back of the switch
  const swClip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.1), hwDark); swClip.position.set(0, -0.1, -0.5); sw.add(swClip);
  const swClipHook = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.08), hwDark); swClipHook.position.set(0, -0.24, -0.46); sw.add(swClipHook);
  // dark managed-switch label plaque
  const swLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.22), new THREE.MeshStandardMaterial({ map: makeSwitchLabelTex(), roughness: 0.7, metalness: 0.1, envMapIntensity: 0.25 }));
  swLabel.position.set(0.5, 0.16, 0.478); sw.add(swLabel);

  // ---- SERVER node (RIGHT end, mid-height): 2U rack chassis on a shelf — hot-swap bays, status LEDs, vents, rack ears ----
  const serverPos = new THREE.Vector3(12.3, 0.1, 0.4);
  const server = new THREE.Group(); server.position.copy(serverPos); group.add(server);
  // materials (dark brushed metal chassis + cyan LED accent only)
  const chassisMat = new THREE.MeshStandardMaterial({ color: 0x1b1e23, metalness: 0.7, roughness: 0.4, roughnessMap: brushed, envMapIntensity: 0.85 });
  const chassisRearMat = new THREE.MeshStandardMaterial({ color: 0x121519, metalness: 0.6, roughness: 0.52, roughnessMap: brushed, envMapIntensity: 0.4 });
  const serverFaceMat = new THREE.MeshStandardMaterial({ color: 0x0f1216, metalness: 0.5, roughness: 0.45, envMapIntensity: 0.5 });
  const bayMat = new THREE.MeshStandardMaterial({ color: 0x23272d, metalness: 0.55, roughness: 0.5, roughnessMap: brushed, envMapIntensity: 0.6 });
  const bayHandleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, metalness: 0.8, roughness: 0.4, envMapIntensity: 0.5 });
  const earMat = new THREE.MeshStandardMaterial({ color: 0x2a2e33, metalness: 0.75, roughness: 0.42, roughnessMap: brushed, envMapIntensity: 0.55 });
  const ventMatSv = new THREE.MeshStandardMaterial({ color: 0x070809, roughness: 0.9 });
  // subtle cyan hi-tech edge light-bar so bloom still catches the server (single cyan accent)
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x0a2a30, emissive: 0x22d3ee, emissiveIntensity: 1.6, roughness: 0.3 });
  // faint second stacked unit tucked behind for depth
  const rearUnit = new THREE.Mesh(new RoundedBoxGeometry(2.5, 0.9, 1.0, 3, 0.05), chassisRearMat); rearUnit.position.set(0.06, 0.16, -0.55); server.add(rearUnit);
  // shelf the server sits on
  const shelf = new THREE.Mesh(new RoundedBoxGeometry(2.9, 0.1, 1.35, 2, 0.03), chassisRearMat); shelf.position.set(0, -0.6, -0.06); server.add(shelf);
  // main 2U chassis
  const chassis = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.95, 1.15, 4, 0.06), chassisMat); server.add(chassis);
  // recessed dark front faceplate (adds real face depth)
  const facePlate = new THREE.Mesh(new RoundedBoxGeometry(2.46, 0.83, 0.06, 3, 0.03), serverFaceMat); facePlate.position.set(0, 0, 0.57); server.add(facePlate);
  // --- 6 hot-swap drive bays (tray + tiny handle + dim bay LED) ---
  const bayTrayGeo = new RoundedBoxGeometry(0.2, 0.74, 0.05, 2, 0.02);
  const bayHandleGeo = new THREE.BoxGeometry(0.035, 0.52, 0.07);
  const bayLedGeo = new THREE.SphereGeometry(0.018, 10, 10);
  const bayLedMats: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < 6; i++) {
    const bx = -0.271 + i * 0.258;
    const tray = new THREE.Mesh(bayTrayGeo, bayMat); tray.position.set(bx, 0, 0.6); server.add(tray);
    const handle = new THREE.Mesh(bayHandleGeo, bayHandleMat); handle.position.set(bx - 0.07, -0.02, 0.64); server.add(handle);
    // dim green bay LED kept sub-bloom so cyan stays the only glow
    const blMat = new THREE.MeshStandardMaterial({ color: 0x0e3a1e, emissive: 0x22c55e, emissiveIntensity: 0.35, roughness: 0.4 }); bayLedMats.push(blMat);
    const bl = new THREE.Mesh(bayLedGeo, blMat); bl.position.set(bx + 0.055, 0.28, 0.63); server.add(bl);
  }
  // --- control panel (left): recessed plate + recessed power button + status LEDs + grille ---
  const ctrlPanel = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.78, 0.04, 2, 0.02), serverFaceMat); ctrlPanel.position.set(-0.82, 0, 0.6); server.add(ctrlPanel);
  const pwrRing = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 10, 22), hwDark); pwrRing.position.set(-0.82, 0.26, 0.63); server.add(pwrRing);
  const pwrBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.04, 20), bayHandleMat); pwrBtn.rotation.x = Math.PI / 2; pwrBtn.position.set(-0.82, 0.26, 0.63); server.add(pwrBtn);
  // green power LED (steady) + cyan activity LED (blinks)
  const pwrLedMat = new THREE.MeshStandardMaterial({ color: 0x0e3a1e, emissive: 0x22c55e, emissiveIntensity: 1.4, roughness: 0.3 });
  const pwrLed = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), pwrLedMat); pwrLed.position.set(-0.96, -0.02, 0.63); server.add(pwrLed);
  const actLedMat = new THREE.MeshStandardMaterial({ color: 0x08343b, emissive: 0x22d3ee, emissiveIntensity: 2.2, roughness: 0.3 });
  const actLed = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), actLedMat); actLed.position.set(-0.68, -0.02, 0.63); server.add(actLed);
  // ventilation grille slits below the control cluster
  const svVentGeo = new THREE.BoxGeometry(0.5, 0.02, 0.04);
  const NSV = 6; const svVents = new THREE.InstancedMesh(svVentGeo, ventMatSv, NSV); const svmx = new THREE.Matrix4();
  for (let v = 0; v < NSV; v++) { svmx.makeTranslation(-0.82, -0.14 - v * 0.05, 0.62); svVents.setMatrixAt(v, svmx); }
  svVents.instanceMatrix.needsUpdate = true; server.add(svVents);
  // top-face ventilation slits (airflow)
  const topVentGeo = new THREE.BoxGeometry(2.0, 0.02, 0.04);
  const NTV = 5; const topSvVents = new THREE.InstancedMesh(topVentGeo, ventMatSv, NTV); const tvmx = new THREE.Matrix4();
  for (let v = 0; v < NTV; v++) { tvmx.makeTranslation(0.1, 0.475, -0.35 + v * 0.15); topSvVents.setMatrixAt(v, tvmx); }
  topSvVents.instanceMatrix.needsUpdate = true; server.add(topSvVents);
  // rack "ears" on both sides with mounting holes + screws
  for (const ex of [-1.42, 1.42]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.05, 0.5), earMat); ear.position.set(ex, 0, 0.15); server.add(ear);
    for (const ey of [0.34, -0.34]) {
      const holeR = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 8, 18), hwDark); holeR.position.set(ex, ey, 0.41); server.add(holeR);
      const esc = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), boltMat); esc.rotation.x = Math.PI / 2; esc.position.set(ex, ey, 0.4); server.add(esc);
    }
  }
  // faceplate corner screws
  for (const cx of [-1.16, 1.16]) for (const cy of [0.36, -0.36]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 10), bpScrewMat); s.rotation.x = Math.PI / 2; s.position.set(cx, cy, 0.62); server.add(s);
  }
  // subtle cyan edge light-bar across the front bottom (hi-tech glow for bloom)
  const edgeBar = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.02, 0.03), edgeMat); edgeBar.position.set(0, -0.45, 0.6); server.add(edgeBar);

  // switch → server uplink (continues rightward)
  group.add(tube([switchPos.clone().add(new THREE.Vector3(0.95, -0.02, -0.05)), new THREE.Vector3(9.6, 0.1, 0.75), new THREE.Vector3(10.8, 0.1, 0.6), serverPos.clone().add(new THREE.Vector3(-1.2, -0.05, 0.2))],
    0.055));

  // ---- SCADA topology node labels (dark matte plaques, low bloom) beneath/near each node, left → right ----
  const makeNodeLabel = (text: string, w: number, hgt: number) => new THREE.Mesh(new THREE.PlaneGeometry(w, hgt),
    new THREE.MeshStandardMaterial({ map: makeNodeLabelTex(text), roughness: 0.72, metalness: 0.1, envMapIntensity: 0.22, toneMapped: true }));
  const labCab = makeNodeLabel("ตู้มิเตอร์", 1.9, 0.5); labCab.position.set(-3.2, -3.42, 0.75); group.add(labCab);
  const labSw = makeNodeLabel("SWITCH", 1.4, 0.38); labSw.position.set(8.2, -1.15, 0.85); group.add(labSw);
  const labSv = makeNodeLabel("SERVER", 1.4, 0.38); labSv.position.set(12.3, -1.15, 0.45); group.add(labSv);

  // ---- realistic RS485 Modbus poll: a request packet runs server → switch → ONE meter, the meter answers back → server, then the master moves to the next meter (half-duplex, one at a time) ----
  const serverEnd = serverPos.clone().add(new THREE.Vector3(-1.2, -0.05, 0.2));
  // shared trunk (server → switch → cabinet entry at the bottom bus), reused by every meter's path
  const trunk = [
    serverEnd,
    new THREE.Vector3(10.8, 0.1, 0.6), new THREE.Vector3(9.6, 0.1, 0.75), switchPos.clone(),
    new THREE.Vector3(6.6, 0.1, 0.8), new THREE.Vector3(5.2, 0.05, 0.7), new THREE.Vector3(4.6, -1.1, 0.6),
    new THREE.Vector3(3.85, busY(-1.15), 0.55),
  ];
  // one server→meter path per meter (poll bottom row first, then top; left→right)
  const pollOrder = [...meterPos].sort((a, b) => (b.row - a.row) || (a.x - b.x));
  const pollPaths = pollOrder.map((m) => {
    const branch: THREE.Vector3[] = [];
    if (m.y < 0) {                                   // bottom row: run the bottom bus out to the meter
      branch.push(new THREE.Vector3((3.85 + m.x) / 2, busY(-1.15) - busSag, 0.55), new THREE.Vector3(m.x, busY(-1.15), 0.55));
    } else {                                         // top row: up the riser, then along the top bus
      branch.push(new THREE.Vector3(3.85, (busY(-1.15) + busY(1.15)) / 2, 0.55), new THREE.Vector3(3.85, busY(1.15), 0.55),
        new THREE.Vector3((3.85 + m.x) / 2, busY(1.15) - busSag, 0.55), new THREE.Vector3(m.x, busY(1.15), 0.55));
    }
    branch.push(new THREE.Vector3(m.x, m.y - 0.84, 0.57), new THREE.Vector3(m.x, m.y - 0.25, 0.5)); // drop into the comm port
    return new THREE.CatmullRomCurve3([...trunk, ...branch]);
  });
  // a single small "packet" (head + 2-sphere trail) — dimmed so it reads as data, not a flare
  const pkColor = 0x67e8ff;
  const pkHead = [0.058, 0.044, 0.03], pkGlow = [1.6, 1.0, 0.55];
  const packet = [0, 1, 2].map((i) => {
    const mat = new THREE.MeshStandardMaterial({ color: pkColor, emissive: pkColor, emissiveIntensity: pkGlow[i], roughness: 0.3 });
    const s = new THREE.Mesh(new THREE.SphereGeometry(pkHead[i], 10, 10), mat); group.add(s); return s;
  });
  const NM = pollPaths.length;
  const reqDur = 0.8, dwellM = 0.12, rspDur = 0.8, dwellS = 0.16;   // request → read → response → idle, per meter
  const slot = reqDur + dwellM + rspDur + dwellS;

  const update = (t: number) => {
    for (const m of minis) m.update(t);
    linkMats.forEach((lm, i) => { lm.emissiveIntensity = 0.8 + Math.max(0, Math.sin(t * 4 + i * 1.3)) * 2.4; });
    actMats.forEach((am, i) => { am.emissiveIntensity = 0.2 + Math.max(0, Math.sin(t * 9 + i * 2.1)) * 0.5; });
    // server status LEDs: cyan activity blinks, green power steady, dim bay LEDs flicker, cyan edge breathes
    actLedMat.emissiveIntensity = 0.8 + Math.max(0, Math.sin(t * 6)) * 2.2;
    pwrLedMat.emissiveIntensity = 1.2 + Math.sin(t * 2) * 0.2;
    edgeMat.emissiveIntensity = 1.2 + Math.max(0, Math.sin(t * 1.6)) * 0.8;
    bayLedMats.forEach((bm, i) => { bm.emissiveIntensity = 0.25 + Math.max(0, Math.sin(t * 3 + i * 1.7)) * 0.35; });
    // sequential Modbus poll: pick the active meter + phase, run the packet out and back along that one path
    const lt = t % (slot * NM);
    const idx = Math.floor(lt / slot);
    const s = lt - idx * slot;
    const path = pollPaths[idx];
    let u: number, fwd: boolean;
    if (s < reqDur) { u = s / reqDur; fwd = true; }                                   // server → meter (request)
    else if (s < reqDur + dwellM) { u = 1; fwd = true; }                              // meter reads
    else if (s < reqDur + dwellM + rspDur) { u = 1 - (s - reqDur - dwellM) / rspDur; fwd = false; } // meter → server (response)
    else { u = 0; fwd = false; }                                                      // master idle before next meter
    const trail = fwd ? -1 : 1;                                                        // trailing spheres lag behind travel direction
    packet.forEach((sp, i) => {
      const uu = Math.min(1, Math.max(0, u + trail * i * 0.02));
      sp.position.copy(path.getPoint(uu));
      sp.visible = i === 0 || (u > 0.001 && u < 0.999);                                // hide the trail while parked at either end
    });
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
    const cab = kind === "cabinet";
    if (cab) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = cab ? 0.82 : 0.9; renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    // fade the far floor edge into the site tone so the ground melts into the backdrop with no visible horizon seam
    if (cab) scene.fog = new THREE.Fog(0x0a0a0a, 16, 34);
    const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 100);
    const pmrem = new THREE.PMREMGenerator(renderer); const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environment = envTex;
    // single strong raking key pushed further camera-left/high so the far side of the cabinet gradients into shadow
    const keyL = new THREE.DirectionalLight(0xffffff, cab ? 1.4 : 1.15); keyL.position.set(cab ? -7 : -5, cab ? 8 : 7, 5); scene.add(keyL);
    if (cab) {
      keyL.castShadow = true; keyL.shadow.mapSize.set(1024, 1024);
      keyL.shadow.bias = -0.0004; keyL.shadow.normalBias = 0.04;
      const sc = keyL.shadow.camera; sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6; sc.near = 0.5; sc.far = 40; sc.updateProjectionMatrix();
    }
    // cabinet: lean 3-light rig (key + cool rim + ambient) — the PMREM RoomEnvironment carries the fill, so the extra dim fills were dropped to cut per-fragment cost
    const rimL = new THREE.DirectionalLight(cab ? 0x8fd6e6 : 0x88aaff, cab ? 0.7 : 1.1); rimL.position.set(6, 2, -5); scene.add(rimL);
    if (!cab) {
      const warmL = new THREE.DirectionalLight(0xffe4b8, 0.22); warmL.position.set(3, -2, 4); scene.add(warmL);
      const frontL = new THREE.DirectionalLight(0xcfe0ff, 0.26); frontL.position.set(0.5, 0.6, 9); scene.add(frontL);
    }
    scene.add(new THREE.AmbientLight(cab ? 0xdde6ea : 0xffffff, cab ? 0.2 : 0.14));

    const parts: { group: THREE.Group; update: (t: number, dt: number) => void; baseRot: number; amp: number }[] = [];
    if (kind === "cabinet") {
      const p = buildCabinet(); p.group.scale.setScalar(0.58); p.group.rotation.x = -0.05; scene.add(p.group); parts.push({ ...p, baseRot: 0, amp: 0.05 });
      // ground the solid geometry with contact shadows; skip flat backdrops + glowing emitters so the cyan stays clean
      p.group.traverse((o: THREE.Object3D) => {
        const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if ((mat as unknown as THREE.MeshBasicMaterial).isMeshBasicMaterial) return;      // vignette + LCD planes
        if (mat.emissive && mat.emissive.getHex() > 0 && mat.emissiveIntensity > 0.6) { mesh.castShadow = false; mesh.receiveShadow = false; return; } // LEDs, server edge, RS485, pulses
        mesh.castShadow = true; mesh.receiveShadow = true;
      });
    }
    if (kind === "watt" || kind === "both") { const p = buildWatt(); p.group.position.x = kind === "both" ? -2.0 : 0; scene.add(p.group); parts.push({ ...p, baseRot: 0.3, amp: 0.5 }); }
    if (kind === "water" || kind === "both") { const p = buildWater(); p.group.position.set(kind === "both" ? 2.1 : 0, kind === "both" ? 0.05 : 0, 0); scene.add(p.group); parts.push({ ...p, baseRot: -0.3, amp: 0.5 }); }
    if (kind === "cabinet") { camera.position.set(3.0, 1.15, 9.4); camera.lookAt(2.7, -0.05, 0); }
    else if (kind === "both") { camera.position.set(0, 1.1, 10.5); camera.lookAt(0, 0, 0); }
    else if (kind === "water") { camera.position.set(2.4, 1.6, 6.8); camera.lookAt(0, 0.2, 0); }
    else { camera.position.set(2.4, 1.0, 6.4); camera.lookAt(0, 0.1, 0); }

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), cab ? 0.38 : 0.34, cab ? 0.5 : 0.4, cab ? 0.98 : 0.92));
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
