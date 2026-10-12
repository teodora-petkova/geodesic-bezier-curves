export class MeshInteractionManager {
    constructor(renderer, scene, camera, onPointSelected) {
        this.canvas = renderer.domElement;
        this.scene = scene;
        this.camera = camera;

        this.onPointSelected = onPointSelected;

        // isolated internal state variables
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();

        this.touchTimer = null;
        this.isTouchMoving = false;

        this.init();
    }

    init() {
        // desktop listeners
        window.addEventListener('click', (e) => this.handleDesktopClick(e));

        // mobile listeners
        window.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        window.addEventListener('touchmove', () => this.handleTouchMove(), { passive: true });
        window.addEventListener('touchend', () => this.handleTouchEnd(), { passive: true });
    }

    /**
     * Converts screen pixel inputs into standardized Three.js coordinates (-1 to 1)
     */
    updatePointer(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();

        this.pointer.x = ((clientX - rect.left) / this.canvas.clientWidth) * 2 - 1;
        this.pointer.y = -((clientY - rect.top) / this.canvas.clientHeight) * 2 + 1;
    }

    /**
     * Casts a ray through the scene and fires the custom callback if a mesh is hit
     */
    checkIntersection() {
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        const validMeshHit = intersects.find(hit => hit.object.isMesh && hit.face);

        if (validMeshHit) {
            // Send the specific hit point up to your application logic
            this.onPointSelected(validMeshHit);
        }
        else {
            // console.log("Clicked on empty space, ignoring.");
            return; // stop the function here so it doesn't pass null down the line
        }
    }

    /**
     * Desktop logic - handles Shift + Click point selection
     */
    handleDesktopClick(event) {
        if (!event.shiftKey) return; // Ignore standard rotation clicks

        this.updatePointer(event.clientX, event.clientY);
        this.checkIntersection();
    }

    /**
     * Mobile logic - touch + hold for 300ms
     */
    handleTouchStart(event) {
        // only process deliberate single-finger clicks
        if (event.touches.length !== 1) return;

        const touch = event.touches[0];
        this.isTouchMoving = false;

        // cache the initial touch coordinates
        this.startX = touch.clientX;
        this.startY = touch.clientY;

        this.updatePointer(touch.clientX, touch.clientY);

        // set up the long-press countdown
        this.touchTimer = setTimeout(() => {
            if (!this.isTouchMoving) {
                this.checkIntersection();

                // haptic feedback (vibrates mobile devices for 30ms)
                if (navigator.vibrate) navigator.vibrate(30);
            }
        }, 300);
    }

    /**
     * Touch move process even tiny changes of pixel movements
     * Notes:
     * Because our fingers are soft, any tiny change in pressure, heart rate pulse, 
     * or the angle of our hand alters the shape of that contact patch.
     * Even if our hand seems perfectly still, the android hardware registers this 
     * as continuous, micro-pixel movements.
     * 
     * Steps:
     * 1. touchstart fires -> a timer starts for 250ms.
     * 2. touchmove fires -> if even 1 single pixel of movement is detected, 
     *                       the timer is completely destroyed (clearTimeout).
     * 
     * If the user's finger shakes within an 8-pixel circle, the timer keeps running, 
     * and the selection will succeed. 
     * If they drag their finger across the screen to pan the camera, the distance 
     * easily clears 8 pixels, the timer kills cleanly, and the camera moves normally.
     */
    handleTouchMove() {
        if (event.touches.length !== 1) return;
        const touch = event.touches[0];

        // calculate how many pixels the finger actually drifted
        const dx = touch.clientX - this.startX;
        const dy = touch.clientY - this.startY;
        const distanceMoved = Math.sqrt(dx * dx + dy * dy);

        // ignore tiny tremors. Only cancel if they deliberately drag more than 8 pixels.
        if (distanceMoved > 8) {
            // moving means they are rotating the camera -> kill the timer
            this.isTouchMoving = true;
            if (this.touchTimer) clearTimeout(this.touchTimer);
        }
    }

    handleTouchEnd() {
        // lifting finger early cancels selection.
        if (this.touchTimer) clearTimeout(this.touchTimer);

        // prevent Android from triggering text selections / context menus
        if (event.cancelable) {
            event.preventDefault();
        }
    }
}
