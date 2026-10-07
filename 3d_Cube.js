/**
 * 3d_Cube.js
 * Simple 3D cube: shadow + grid floor + mouse drag along XYZ axes
 *
 * Controls:
 *   - Drag the red/green/blue arrows on the cube: move the cube along X / Y / Z
 *   - Drag on empty space: orbit the camera; mouse wheel: zoom
 */

// ==========================================
// 1. Settings
// ==========================================
const PLACEHOLDER_ID = 'cube_3d'; // Name (or id) of the placeholder rectangle in FUXA
const SHOW_AXES = true;           // Show the XYZ arrows (when hidden, they can still be dragged at the same spot)

// Helper: load an external script (skipped if THREE is already loaded or the script tag exists)
const loadScript = (src) => new Promise((resolve, reject) => {
    if (window.THREE || document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
});

// ══════════════════════════════════════════════════════════════
// Find the DOM element of the named rectangle in the FUXA view (same logic as 3d_Diamond.js)
// ══════════════════════════════════════════════════════════════
const findPlaceholderElement = () => {
    // Method 1: data-name attribute
    let el = document.querySelector(`[data-name="${PLACEHOLDER_ID}"]`);
    if (el) { console.log('[Cube3D] 方法1(data-name) 命中:', el.id); return el; }

    // Method 2: match by id
    el = document.getElementById(PLACEHOLDER_ID);
    if (el) { console.log('[Cube3D] 方法2(id) 命中:', el.id); return el; }

    // Method 3: plain SVG shape — <title> or textContent
    for (const e of document.querySelectorAll('[id^="svg_"], [id^="SHE_"], [id^="HXT_"]')) {
        const title = e.querySelector('title');
        if (title && title.textContent.trim() === PLACEHOLDER_ID) {
            console.log('[Cube3D] 方法3(title) 命中:', e.id); return e;
        }
        if (e.textContent && e.textContent.trim() === PLACEHOLDER_ID) {
            console.log('[Cube3D] 方法3(textContent) 命中:', e.id); return e;
        }
    }
    return null;
};

const waitForPlaceholder = (timeoutMs = 8000, intervalMs = 200) =>
    new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
            const el = findPlaceholderElement();
            if (el) { resolve(el); return; }
            if (Date.now() - start >= timeoutMs) {
                console.warn(`[Cube3D] 等待 ${timeoutMs}ms 後仍找不到 "${PLACEHOLDER_ID}"，改為預設浮動模式`);
                resolve(null); return;
            }
            setTimeout(check, intervalMs);
        };
        setTimeout(check, 300);
    });

const initCube = async () => {
    let isDestroyed = false;
    let renderer = null, camera = null; // Declared up front so resize events firing before creation don't hit a TDZ error
    console.log('[Cube3D] 初始化開始...');

    // On reopen, destroy the previous instance first to avoid leftover render loops and WebGL contexts (leaks)
    if (window.destroyCube3D) { try { window.destroyCube3D(); } catch (e) {} }

    // Force-remove any leftover container (safety net)
    const oldContainer = document.getElementById('cube-3d-container');
    if (oldContainer) oldContainer.remove();

    // ==========================================
    // 2. Find the rectangle on the FUXA canvas to use as the placeholder
    // ==========================================
    const placeholder = await waitForPlaceholder();

    let initRect = { left: 100, top: 100, width: 300, height: 300 };
    if (placeholder && placeholder.getBoundingClientRect) {
        initRect = placeholder.getBoundingClientRect();
        placeholder.style.visibility = 'hidden'; // Hide the original rectangle
        console.log('[Cube3D] 找到佔位框:', initRect);
    }

    // ==========================================
    // 3. Create the outer container (overlaid on the rectangle)
    // ==========================================
    const container = document.createElement('div');
    container.id = 'cube-3d-container';
    Object.assign(container.style, {
        position: 'fixed',
        left: initRect.left + 'px',
        top: initRect.top + 'px',
        width: initRect.width + 'px',
        height: initRect.height + 'px',
        zIndex: '10',          // Low z-index: lets FUXA's own sidebar/cards (1001+) stack above the 3D view
        overflow: 'hidden',
        pointerEvents: 'none', // Let clicks pass through to the background
    });
    // Mount inside app-fuxa-view (not body): same stacking context as the FUXA UI
    const mountNode = (placeholder && placeholder.closest('app-fuxa-view')) || document.body;
    mountNode.appendChild(container);

    // Keep position in sync when the window or canvas is resized
    const updateContainerPosition = () => {
        if (placeholder) {
            const rect = placeholder.getBoundingClientRect();
            if (!rect.width || !rect.height) return;   // Size is 0 while hidden; skip to avoid a NaN aspect
            Object.assign(container.style, {
                left: rect.left + 'px',
                top: rect.top + 'px',
                width: rect.width + 'px',
                height: rect.height + 'px'
            });
            if (!renderer || !camera) return;          // Skip if the event fires before renderer/camera exist
            renderer.setSize(rect.width, rect.height);
            camera.aspect = rect.width / rect.height;
            camera.updateProjectionMatrix();
        }
    };
    let mo = null;
    if (placeholder) {
        window.addEventListener('resize', updateContainerPosition);
        const svgEl = placeholder.closest('svg');
        if (svgEl) {
            mo = new MutationObserver(updateContainerPosition);
            mo.observe(svgEl, { attributes: true, subtree: false });
        }
    }

    // ==========================================
    // 4. Build the Three.js 3D scene
    // ==========================================
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
    if (isDestroyed) return;
    const THREE = window.THREE;
    if (!THREE) { console.error('[Cube3D] three.js 載入失敗'); return; }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e2230);

    camera = new THREE.PerspectiveCamera(45, initRect.width / initRect.height, 0.1, 200);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(initRect.width, initRect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;                 // Enable shadows
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.pointerEvents = 'auto';  // Allow mouse dragging
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(5, 10, 6);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    Object.assign(dirLight.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 0.5, far: 40 });
    scene.add(dirLight);

    // Floor (receives shadows)
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.MeshStandardMaterial({ color: 0x2a2f40, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid
    const grid = new THREE.GridHelper(20, 20, 0x8899aa, 0x445066);
    grid.position.y = 0.001; // Slightly above the floor to avoid z-fighting
    scene.add(grid);

    // Cube (casts shadows)
    const CUBE_SIZE = 2;
    const cube = new THREE.Mesh(
        new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE),
        new THREE.MeshStandardMaterial({ color: 0x3fa9f5, metalness: 0.2, roughness: 0.45 })
    );
    cube.position.set(0, CUBE_SIZE / 2, 0);
    cube.castShadow = true;
    cube.receiveShadow = true;
    scene.add(cube);

    // XYZ drag arrows (X red / Y green / Z blue), always drawn on top so the cube never hides them
    const gizmo = new THREE.Group();
    const AXES = [
        { dir: new THREE.Vector3(1, 0, 0), color: 0xff4040 },
        { dir: new THREE.Vector3(0, 1, 0), color: 0x40ff40 },
        { dir: new THREE.Vector3(0, 0, 1), color: 0x4080ff },
    ];
    const handles = [];
    AXES.forEach((axis) => {
        const mat = new THREE.MeshBasicMaterial({ color: axis.color, depthTest: false, transparent: true });
        const arrow = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 8), mat);
        shaft.position.y = 1;
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 12), mat);
        head.position.y = 2.2;
        // Thicker invisible hit area so the arrows are easier to grab
        const hitArea = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.22, 2.5, 8),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        hitArea.position.y = 1.25;
        [shaft, head].forEach((m) => { m.renderOrder = 999; });
        arrow.add(shaft, head, hitArea);
        // Cylinders point along +Y by default; rotate to the matching axis
        arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.dir);
        [shaft, head, hitArea].forEach((m) => { m.userData.axis = axis; });
        handles.push(shaft, head, hitArea);
        gizmo.add(arrow);
    });
    gizmo.visible = SHOW_AXES; // Only affects rendering; raycasts still hit the arrows
    scene.add(gizmo);

    // ==========================================
    // 5. Mouse interaction: drag arrows to move the cube / drag empty space to orbit / wheel to zoom
    // ==========================================
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const target = new THREE.Vector3(0, 1, 0);         // Orbit center
    const view = { radius: 13, theta: Math.PI / 4, phi: Math.PI / 3 }; // Camera in spherical coordinates
    const updateCamera = () => {
        view.phi = Math.min(Math.max(view.phi, 0.1), Math.PI / 2 - 0.05); // Keep the camera above the floor
        view.radius = Math.min(Math.max(view.radius, 4), 40);
        camera.position.set(
            target.x + view.radius * Math.sin(view.phi) * Math.sin(view.theta),
            target.y + view.radius * Math.cos(view.phi),
            target.z + view.radius * Math.sin(view.phi) * Math.cos(view.theta)
        );
        camera.lookAt(target);
    };
    updateCamera();

    const pickHandle = (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(handles, false);
        return hits.length > 0 ? hits[0].object.userData.axis : null;
    };

    // Project a 3D point to screen pixel coordinates
    const toScreen = (v) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const p = v.clone().project(camera);
        return new THREE.Vector2((p.x * 0.5 + 0.5) * rect.width, (-p.y * 0.5 + 0.5) * rect.height);
    };

    let drag = null; // { mode: 'axis' | 'orbit', ... }
    const onPointerDown = (e) => {
        if (e.button !== 0) return;
        const axis = pickHandle(e);
        if (axis) {
            // Screen-space pixel vector for moving 1 unit along this axis
            const a = toScreen(cube.position);
            const b = toScreen(cube.position.clone().add(axis.dir));
            const screenDir = b.sub(a);
            drag = { mode: 'axis', axis, screenDir, lenSq: screenDir.lengthSq() || 1,
                     startX: e.clientX, startY: e.clientY, startPos: cube.position.clone() };
        } else {
            drag = { mode: 'orbit', lastX: e.clientX, lastY: e.clientY };
        }
        renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
        if (!drag) {
            renderer.domElement.style.cursor = pickHandle(e) ? 'pointer' : 'grab';
            return;
        }
        if (drag.mode === 'axis') {
            const d = new THREE.Vector2(e.clientX - drag.startX, e.clientY - drag.startY);
            const amount = d.dot(drag.screenDir) / drag.lenSq;
            cube.position.copy(drag.startPos).addScaledVector(drag.axis.dir, amount);
            cube.position.y = Math.max(cube.position.y, CUBE_SIZE / 2); // Don't sink below the floor
        } else {
            view.theta -= (e.clientX - drag.lastX) * 0.008;
            view.phi -= (e.clientY - drag.lastY) * 0.008;
            drag.lastX = e.clientX; drag.lastY = e.clientY;
            updateCamera();
            renderer.domElement.style.cursor = 'grabbing';
        }
    };
    const onPointerUp = (e) => {
        drag = null;
        if (renderer.domElement.hasPointerCapture(e.pointerId)) {
            renderer.domElement.releasePointerCapture(e.pointerId);
        }
    };
    const onWheel = (e) => {
        e.preventDefault(); // Prevent the FUXA page from scrolling
        view.radius *= e.deltaY > 0 ? 1.1 : 0.9;
        updateCamera();
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // ==========================================
    // 6. Render loop
    // ==========================================
    let animationId = null;
    const animate = () => {
        if (isDestroyed) return;
        // Liveness check (safety net): when switching views / entering edit mode, the placeholder is removed or hidden (width 0), so clean up automatically
        if (placeholder && (!document.body.contains(placeholder) || placeholder.getBoundingClientRect().width === 0)) {
            console.log('[Cube3D] 偵測到佔位元素消失或隱藏，自動執行銷毀...');
            cleanup();
            return;
        }

        animationId = requestAnimationFrame(animate);
        gizmo.position.copy(cube.position); // Arrows follow the cube
        renderer.render(scene, camera);
    };
    animate();

    // ==========================================
    // 7. Release resources (called by the FUXA close script)
    // ==========================================
    function cleanup() {
        if (isDestroyed) return;
        console.log('[Cube3D] 執行 destroy (關閉畫面清理資源)...');
        isDestroyed = true;
        if (animationId) cancelAnimationFrame(animationId);

        window.removeEventListener('resize', updateContainerPosition);
        if (mo) mo.disconnect();
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('pointercancel', onPointerUp);
        renderer.domElement.removeEventListener('wheel', onWheel);

        // Remove the DOM container
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }

        // Restore the FUXA placeholder
        if (placeholder) {
            placeholder.style.visibility = '';
        }

        // Free Three.js WebGL memory
        if (renderer) {
            renderer.dispose();
            if (renderer.forceContextLoss) {
                renderer.forceContextLoss();
            } else {
                const gl = renderer.getContext();
                if (gl) {
                    const loseContext = gl.getExtension('WEBGL_lose_context');
                    if (loseContext) loseContext.loseContext();
                }
            }
        }
        scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(mat => mat.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
        if (window.destroyCube3D === cleanup) {
            window.destroyCube3D = null;
        }
    }
    window.destroyCube3D = cleanup;
};

// Start
initCube().catch(err => console.error('[Cube3D] 初始化失敗:', err));
