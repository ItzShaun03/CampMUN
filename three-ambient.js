/* Quiet Three.js ambient field: visual texture only, no tracking and no heavy assets. */
import * as THREE from "https://unpkg.com/three@0.179.1/build/three.module.js";

const canvas = document.querySelector("#three-ambient");
if (canvas && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  /* Feature flag lives in features.js (window.CAMPMUN_FEATURES). */
  if (window.CAMPMUN_FEATURES && window.CAMPMUN_FEATURES.threeD === false) {
    canvas.remove();
  } else {
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, .1, 100); camera.position.set(0, 0, 8);
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(2.15, 3), new THREE.MeshBasicMaterial({ color: 0xcaa64e, wireframe: true, transparent: true, opacity: .32 }));
    mesh.scale.set(1.3, .92, 1);
    group.add(mesh);
    const core = new THREE.Mesh(new THREE.SphereGeometry(.82, 24, 24), new THREE.MeshBasicMaterial({ color: 0xe8cf83, transparent: true, opacity: .07 }));
    core.position.z = -.55;
    group.add(core);
    scene.add(group);
    const ringPoints = [];
    for (let i = 0; i < 200; i++) { const a = (i / 200) * Math.PI * 2; ringPoints.push(new THREE.Vector3(Math.cos(a) * 3.55, Math.sin(a) * 3.55, 0)); }
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPoints), new THREE.LineBasicMaterial({ color: 0xf1dfae, transparent: true, opacity: .18 }));
    ring.rotation.x = 1.25; ring.rotation.z = -.32;
    scene.add(ring);
    const innerRing = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPoints), new THREE.LineBasicMaterial({ color: 0xf1dfae, transparent: true, opacity: .08 }));
    innerRing.scale.set(.68, .68, .68); innerRing.rotation.x = 1.9; innerRing.rotation.y = .45;
    scene.add(innerRing);
    const pointer = { x: 0, y: 0 };
    addEventListener("pointermove", (event) => { pointer.x = event.clientX; pointer.y = event.clientY; }, { passive: true });
    const resize = () => { const parent = canvas.parentElement.getBoundingClientRect(); renderer.setSize(parent.width, parent.height, false); camera.aspect = parent.width / parent.height; camera.updateProjectionMatrix(); };
    addEventListener("resize", resize); resize();
    let hoverAmount = 0;
    const hoverTarget = () => {
      const box = canvas.getBoundingClientRect();
      const dx = pointer.x - (box.left + box.width / 2), dy = pointer.y - (box.top + box.height / 2);
      return Math.hypot(dx, dy) < Math.min(box.width, box.height) * .3 ? 1 : 0;
    };
    const render = (time) => {
      const target = hoverTarget();
      hoverAmount += (target - hoverAmount) * .08;
      const scale = 1 + hoverAmount * .18;
      group.scale.setScalar(scale);
      mesh.material.opacity = .32 + hoverAmount * .22;
      group.rotation.y = time * .00008 + (pointer.x / innerWidth - .5) * .18;
      group.rotation.x = time * .000035 + (pointer.y / innerHeight - .5) * .08;
      ring.rotation.z = -.32 + Math.sin(time * .00012) * .1;
      innerRing.rotation.y = .45 + time * .00007;
      scene.rotation.z = Math.sin(time * .00012) * .05;
      renderer.render(scene, camera);
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }
}