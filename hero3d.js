(function () {
  'use strict';
  var wrap = document.getElementById('hero3d');
  var canvas = document.getElementById('hero-canvas');
  if (!wrap || !canvas || typeof THREE === 'undefined') return;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var palette = {
    dark: { primary: 0x7c74f0, secondary: 0x33d4bc, accent: 0xff6b4a, dust: 0xc7cbe8, glow: '124,116,240', glowOpacity: 0.5 },
    light: { primary: 0x4f46e5, secondary: 0x00a68e, accent: 0xff5a3c, dust: 0x6b7099, glow: '79,70,229', glowOpacity: 0.42 }
  };

  var renderer, scene, camera, group;
  var knot, knotWire, core, ringA, ringB, dust, glowSprite, glowTex;
  var light1, light2, light3;
  var clock = new THREE.Clock();
  var currentFade = 1, targetFade = 1;
  var visible = true;

  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  } catch (e) {
    canvas.remove();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  group = new THREE.Group();
  scene.add(group);

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  light1 = new THREE.PointLight(0xffffff, 1.4, 40);
  light1.position.set(4, 3, 5);
  scene.add(light1);
  light2 = new THREE.PointLight(0xffffff, 1.1, 40);
  light2.position.set(-4, -2, 4);
  scene.add(light2);
  light3 = new THREE.PointLight(0xffffff, 0.5, 30);
  light3.position.set(0, -4, -2);
  scene.add(light3);

  function buildScene(colors) {
    knot = new THREE.Mesh(
      new THREE.TorusKnotGeometry(1.02, 0.3, 180, 24),
      new THREE.MeshStandardMaterial({
        color: colors.primary,
        metalness: 0.55,
        roughness: 0.28,
        emissive: colors.primary,
        emissiveIntensity: 0.1
      })
    );
    group.add(knot);

    knotWire = new THREE.Mesh(
      new THREE.TorusKnotGeometry(1.02, 0.3, 180, 24),
      new THREE.MeshBasicMaterial({
        color: colors.primary,
        wireframe: true,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    knotWire.scale.setScalar(1.025);
    group.add(knotWire);

    core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 1),
      new THREE.MeshStandardMaterial({
        color: colors.secondary,
        metalness: 0.7,
        roughness: 0.25,
        emissive: colors.secondary,
        emissiveIntensity: 0.22,
        flatShading: true
      })
    );
    group.add(core);

    var coreWire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 1),
      new THREE.MeshBasicMaterial({
        color: colors.secondary,
        wireframe: true,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    coreWire.scale.setScalar(1.25);
    core.add(coreWire);

    ringA = makeRing(340, 2.35, colors.primary, 0.055, colors.glowOpacity);
    ringA.rotation.set(1.15, 0, 0.4);
    group.add(ringA);

    ringB = makeRing(210, 2.95, colors.accent, 0.04, colors.glowOpacity * 0.8);
    ringB.rotation.set(-0.85, 0.4, 0.2);
    group.add(ringB);

    dust = makeDust(150, colors.dust, 0.35);
    group.add(dust);

    glowTex = makeGlowTexture(colors.glow);
    glowSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        transparent: true,
        opacity: colors.glowOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    glowSprite.scale.set(6.5, 6.5, 1);
    group.add(glowSprite);
  }

  function makeRing(count, radius, color, size, opacity) {
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * radius;
      pos[i * 3 + 1] = Math.sin(a) * radius * 0.35;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({
      color: color,
      size: size,
      transparent: true,
      opacity: opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    return new THREE.Points(geo, mat);
  }

  function makeDust(count, color, opacity) {
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      var r = 3.4 + Math.random() * 1.8;
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({
      color: color,
      size: 0.035,
      transparent: true,
      opacity: opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    return new THREE.Points(geo, mat);
  }

  function makeGlowTexture(rgb) {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(' + rgb + ',0.55)');
    grad.addColorStop(0.4, 'rgba(' + rgb + ',0.18)');
    grad.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function applyTheme() {
    var c = palette[isDark ? 'dark' : 'light'];
    knot.material.color.set(c.primary);
    knot.material.emissive.set(c.primary);
    knotWire.material.color.set(c.primary);
    core.material.color.set(c.secondary);
    core.material.emissive.set(c.secondary);
    core.children[0].material.color.set(c.secondary);
    ringA.material.color.set(c.primary);
    ringA.material.opacity = c.glowOpacity;
    ringB.material.color.set(c.accent);
    ringB.material.opacity = c.glowOpacity * 0.8;
    dust.material.color.set(c.dust);
    glowSprite.material.map = makeGlowTexture(c.glow);
    glowSprite.material.opacity = c.glowOpacity;
    glowSprite.material.needsUpdate = true;
    light1.color.set(c.primary);
    light2.color.set(c.secondary);
    light3.color.set(c.accent);
  }

  buildScene(palette[isDark ? 'dark' : 'light']);
  applyTheme();

  function resize() {
    var w = wrap.clientWidth || 1;
    var h = wrap.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function updateScroll() {
    var top = window.pageYOffset || document.documentElement.scrollTop || 0;
    var h = wrap.offsetHeight || 1;
    targetFade = Math.max(0, Math.min(1, 1 - top / (h * 1.1)));
    if (reduced) {
      currentFade = targetFade;
      wrap.style.opacity = currentFade;
      wrap.style.transform = 'translateY(' + (1 - currentFade) * 30 + 'px)';
    }
  }

  window.addEventListener('scroll', updateScroll, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('resize', updateScroll, { passive: true });
  resize();
  updateScroll();

  if (typeof IntersectionObserver !== 'undefined') {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }).observe(wrap);
  }

  new MutationObserver(function () {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (dark !== isDark) {
      isDark = dark;
      applyTheme();
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function animate() {
    if (visible) {
      var t = clock.getElapsedTime();
      group.rotation.y = t * 0.12;
      group.rotation.x = Math.sin(t * 0.18) * 0.06;
      knot.rotation.x = t * 0.05;
      knot.rotation.y = t * 0.07;
      knotWire.rotation.x = -t * 0.04;
      knotWire.rotation.y = t * 0.06;
      core.rotation.x = -t * 0.18;
      core.rotation.y = t * 0.22;
      ringA.rotation.z = t * 0.1;
      ringB.rotation.z = -t * 0.08;
      dust.rotation.y = t * 0.02;
      glowSprite.material.opacity = (isDark ? 0.5 : 0.42) + Math.sin(t * 0.5) * 0.05;
      renderer.render(scene, camera);
    }
    if (!reduced) {
      currentFade += (targetFade - currentFade) * 0.09;
      if (Math.abs(currentFade - targetFade) < 0.001) currentFade = targetFade;
      wrap.style.opacity = currentFade;
      wrap.style.transform = 'translateY(' + (1 - currentFade) * 30 + 'px) scale(' + (0.97 + currentFade * 0.03) + ')';
      requestAnimationFrame(animate);
    }
  }

  if (reduced) {
    renderer.render(scene, camera);
  } else {
    requestAnimationFrame(animate);
  }
})();
