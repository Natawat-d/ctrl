"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// 3D digital-twin of a DIN-rail energy meter — PBR body, live glowing display, bloom.
export default function WattMeterTwin() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let w = mount.clientWidth || 800;
    let h = mount.clientHeight || 480;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 100);
    camera.position.set(2.6, 1.1, 6.6);
    camera.lookAt(0, 0.1, 0);

    // soft studio environment for realistic reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(-5, 7, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 1.5); rim.position.set(6, 2, -5); scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.12));

    const meter = new THREE.Group();
    scene.add(meter);

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1b1c21, metalness: 0.55, roughness: 0.34, envMapIntensity: 1.25 });
    meter.add(new THREE.Mesh(new RoundedBoxGeometry(2.0, 2.9, 1.2, 6, 0.12), bodyMat));

    const faceMat = new THREE.MeshStandardMaterial({ color: 0x0b0c10, metalness: 0.35, roughness: 0.5 });
    const face = new THREE.Mesh(new RoundedBoxGeometry(1.72, 1.52, 0.08, 4, 0.06), faceMat);
    face.position.set(0, 0.42, 0.6); meter.add(face);

    // live display via canvas texture
    const dc = document.createElement("canvas"); dc.width = 640; dc.height = 384;
    const g = dc.getContext("2d")!;
    const dispTex = new THREE.CanvasTexture(dc); dispTex.colorSpace = THREE.SRGBColorSpace;
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9),
      new THREE.MeshBasicMaterial({ map: dispTex, toneMapped: false }));
    disp.position.set(0, 0.42, 0.648); meter.add(disp);

    // status LED (pulses)
    const ledMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 3, roughness: 0.3 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 20), ledMat);
    led.position.set(0.66, 1.16, 0.62); meter.add(led);

    // accent line
    const accMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, emissive: 0x2563eb, emissiveIntensity: 2.2 });
    const acc = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.03, 0.02), accMat);
    acc.position.set(0, -0.52, 0.61); meter.add(acc);

    // screw terminals top + bottom
    const termMat = new THREE.MeshStandardMaterial({ color: 0x27282e, metalness: 0.7, roughness: 0.45 });
    const screwMat = new THREE.MeshStandardMaterial({ color: 0xcfd2d6, metalness: 1, roughness: 0.28 });
    for (const sy of [-1.56, 1.56]) {
      for (let i = 0; i < 5; i++) {
        const x = -0.72 + i * 0.36;
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.42, 0.55), termMat);
        t.position.set(x, sy, 0.32); meter.add(t);
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 14), screwMat);
        s.rotation.x = Math.PI / 2; s.position.set(x, sy + (sy < 0 ? 0.12 : -0.12), 0.62); meter.add(s);
      }
    }
    // DIN rail hint behind
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x3a3c42, metalness: 0.9, roughness: 0.4, envMapIntensity: 1.2 }));
    rail.position.set(0, -0.1, -0.75); meter.add(rail);

    // post-processing: subtle bloom on the glowing display + LED
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.42, 0.62);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // live-ish telemetry
    let kwh = 4820.6, watt = 1180;
    const wave: number[] = new Array(56).fill(0.5);
    const F = "'IBM Plex Mono','Space Mono',monospace";

    function drawDisplay(t: number) {
      g.fillStyle = "#05070b"; g.fillRect(0, 0, 640, 384);
      g.strokeStyle = "rgba(120,180,255,0.05)"; g.lineWidth = 1;
      for (let x = 0; x <= 640; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 384); g.stroke(); }
      for (let y = 0; y <= 384; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(640, y); g.stroke(); }

      g.fillStyle = "#5aa0ff"; g.font = `700 22px ${F}`; g.fillText("CTRL · WATT METER", 26, 44);
      const a = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 4));
      g.fillStyle = `rgba(0,229,255,${a})`; g.beginPath(); g.arc(556, 37, 8, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#8fb7ff"; g.font = `600 16px ${F}`; g.fillText("LIVE", 494, 43);

      const kStr = kwh.toFixed(1);
      g.fillStyle = "#eaf3ff"; g.font = `700 82px ${F}`; g.fillText(kStr, 26, 148);
      const kw = g.measureText(kStr).width;
      g.fillStyle = "#5aa0ff"; g.font = `700 26px ${F}`; g.fillText("kWh", 26 + kw + 14, 148);

      g.fillStyle = "#d4e4ff"; g.font = `700 38px ${F}`; g.fillText(Math.round(watt) + " W", 26, 212);
      g.fillStyle = "#7f9dc7"; g.font = `600 20px ${F}`; g.fillText("230.4 V    5.12 A    50.0 Hz", 26, 248);

      // waveform
      g.beginPath();
      wave.forEach((v, i) => { const x = 26 + i * (588 / (wave.length - 1)); const y = 366 - v * 96; i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.strokeStyle = "rgba(0,229,255,0.18)"; g.lineWidth = 10; g.stroke();
      g.strokeStyle = "#00e5ff"; g.lineWidth = 3; g.stroke();
    }

    const clock = new THREE.Clock();
    let raf = 0;
    function tick() {
      raf = requestAnimationFrame(tick);
      const dt = clock.getDelta(); const t = clock.elapsedTime;
      kwh += dt * 0.04;
      watt = 1180 + Math.sin(t * 1.3) * 120 + (Math.random() - 0.5) * 26;
      wave.push(0.5 + Math.sin(t * 3.1) * 0.32 + (Math.random() - 0.5) * 0.08);
      if (wave.length > 56) wave.shift();
      drawDisplay(t); dispTex.needsUpdate = true;

      meter.rotation.y = 0.28 + Math.sin(t * 0.42) * 0.52;
      meter.rotation.x = Math.sin(t * 0.3) * 0.05;
      meter.position.y = Math.sin(t * 0.9) * 0.07;
      ledMat.emissiveIntensity = 2 + Math.sin(t * 4) * 1.7;
      composer.render();
    }
    tick();

    const onResize = () => {
      w = mount.clientWidth || w; h = mount.clientHeight || h;
      renderer.setSize(w, h); composer.setSize(w, h);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize); ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      renderer.dispose(); envTex.dispose(); pmrem.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="twin-canvas" aria-hidden="true" />;
}
