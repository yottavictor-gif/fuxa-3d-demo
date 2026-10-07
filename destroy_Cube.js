try {
    if (window.destroyCube3D) {
        window.destroyCube3D();
    }

    // Extra safety: force-remove the 3D container (never leave a ghost image)
    const c = document.getElementById('cube-3d-container');
    if (c && c.parentNode) c.parentNode.removeChild(c);
} catch(e) {}
