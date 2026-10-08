import { CGALAdapter } from "./cgal_adapter.js";
import { SurfacePoint } from "./surface-point.js";
// import the factory function from emscripten-generated js file
import wasmFactory from "../cgal_wasm/compiled/geodesics.js";

export class SceneApp {
    constructor() {
        let scene, camera, renderer, raycaster, mouse, controls;
        let loadedMesh, geodesicLineMesh;
        let startMarker, endMarker;

        // Use cloneable Vector3 blocks to completely eliminate property parsing errors
        let startPoint = null;
        let endPoint = null;

        let cgalAdapter = null;

        let savedStartFace = null,
            savedStartBary = null;

        this.initializeCGALWasmAndScene();
    }

    initializeCGALWasmAndScene() {
        wasmFactory()
            .then((m) => {
                this.cgalAdapter = new CGALAdapter(m);
                this.init3DScene();
                console.log("CGAL Adapter loaded safely!");
            })
            .catch((error) => {
                console.error("Failed to load WebAssembly module:", error);
            });
    }

    init3DScene() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 0, 7);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        console.log(this.mouse);

        const light1 = new THREE.DirectionalLight(0xffffff, 1);
        light1.position.set(5, 10, 10).normalize();
        this.scene.add(light1);
        this.scene.add(new THREE.AmbientLight(0x404040));

        // const material = new THREE.MeshPhongMaterial({
        //   color: 0x367a41,
        //   flatShading: true,
        // });

        const objLoader = new THREE.OBJLoader();

        objLoader.load(
            // "./models/cube.obj",
            // "./models/bunny.obj",
            "./models/spot.obj",
            (object) => {
                // find the actual structural mesh inside the loaded group container
                object.traverse((child) => {
                    if (child.isMesh) {
                        this.loadMesh(child);
                    }
                });
            },
            // loading progress tracking callback
            (xhr) => {
                console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
            },
            // error handling layout callback
            (error) => {
                console.error("An error occurred loading the mesh:", error);
            }
        );

        // start position indicator (green sphere)
        const startGeo = new THREE.SphereGeometry(0.35, 16, 16);
        const startMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.startMarker = new THREE.Mesh(startGeo, startMat);
        this.startMarker.visible = false;
        this.scene.add(this.startMarker);

        // end position indicator (yellow sphere)
        const endGeo = new THREE.SphereGeometry(0.35, 16, 16);
        const endMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        this.endMarker = new THREE.Mesh(endGeo, endMat);
        this.endMarker.visible = false;
        this.scene.add(this.endMarker);

        // path rendering buffer line configuration
        const lineGeometry = new THREE.BufferGeometry();

        // offset path slightly using PolygonOffset to avoid clipping
        // issues inside the mesh faces
        // prevent crease clipping (TODO: TO UNDERSTAND IT?)
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xff1100,
            linewidth: 5,
            depthTest: true,

            // force the path to float pixel-perfectly on top of the OBJ faces
            polygonOffset: true,
            polygonOffsetFactor: -4,
            polygonOffsetUnits: -4,
        });
        this.geodesicLineMesh = new THREE.Line(lineGeometry, lineMaterial);
        this.geodesicLineMesh.position.set(0, 0, 0);
        this.scene.add(this.geodesicLineMesh);

        // ---- bind UI + events
        this.bindUI();

        requestAnimationFrame(this.animate);
    }

    loadMesh(mesh) {
            this.loadedMesh = mesh;
            
            this.loadedMesh.material = new THREE.MeshPhongMaterial({
                color: 0x4bb47e,
                flatShading: true,
                side: THREE.DoubleSide,
            });


            const wireMaterial = new THREE.MeshBasicMaterial({
                wireframe: true,
                transparent: true,
                opacity: 0.3,
            });
            // console.log(this.loadedMesh.geometry);

            let visualWireframe = new THREE.Mesh(this.loadedMesh.geometry, wireMaterial);

            // center the model inside the view
            this.loadedMesh.geometry.center();

            // add the model to the workspace canvas
            this.scene.add(this.loadedMesh);
            this.scene.add(visualWireframe);

            this.cgalUploadMesh(this.loadedMesh);

            const size = new THREE.Vector3();
            this.loadedMesh.geometry.boundingBox.getSize(size);
            const maxDimension = Math.max(size.x, size.y, size.z);

            // set dot radius to roughly 1% of the model's total size
            const dynamicScale = maxDimension * 0.01;
            this.startMarker.scale.set(dynamicScale, dynamicScale, dynamicScale);
            this.endMarker.scale.set(dynamicScale, dynamicScale, dynamicScale);

            // dynamically push the camera back so the model fits on screen perfectly
            this.camera.position.set(0, 0, maxDimension * 2);
            if (this.controls) this.controls.target.set(0, 0, 0);
        
    }

    cgalUploadMesh(mesh) {
        const positions = mesh.geometry.attributes.position.array;
        let jsFaces = mesh.geometry.index
            ? new Int32Array(mesh.geometry.index.array)
            : null;

        if (!jsFaces) {
            const vertexCount = positions.length / 3;
            jsFaces = new Int32Array(vertexCount);
            for (let i = 0; i < vertexCount; i++) jsFaces[i] = i;
        }

        this.cgalAdapter.uploadMesh(positions, jsFaces);
    }

    onSurfaceClick(event) {
        if (!this.mouse) {
            console.warn("Scene or mouse mapping not ready yet!");
            return;
        }
        // if (controls.state !== -1) return; // Skip if user was rotating

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObject(this.loadedMesh);

        if (intersects.length > 0) {
            const hit = intersects[0]; // Extract the closest intersection details

            const faceIndex = hit.faceIndex; // 1. Mapped Face Index from the Raycaster
            const geometry = this.loadedMesh.geometry;
            const positions = geometry.attributes.position;

            // 2. Fetch the 3 exact global Vector3 coordinates bounding this specific triangle
            const vA = new THREE.Vector3().fromBufferAttribute(
                positions,
                hit.face.a
            );
            const vB = new THREE.Vector3().fromBufferAttribute(
                positions,
                hit.face.b
            );
            const vC = new THREE.Vector3().fromBufferAttribute(
                positions,
                hit.face.c
            );

            // 3. Use THREE.Triangle to calculate barycentric coordinates from the hit point
            const triangle = new THREE.Triangle(vA, vB, vC);
            const barycentricTarget = new THREE.Vector3();

            // This calculates the weights and saves them into barycentricTarget
            triangle.getBarycoord(hit.point, barycentricTarget);

            const w0 = barycentricTarget.x;
            const w1 = barycentricTarget.y;
            const w2 = barycentricTarget.z;

            if (!this.savedStartFace) {
                // Lock your start coordinates
                this.savedStartFace = faceIndex;
                this.savedStartBary = [w0, w1, w2];

                this.startMarker.position.copy(hit.point);
                this.startMarker.visible = true;
                this.endMarker.visible = false;
            } else {
                // Lock your end coordinates
                this.endMarker.position.copy(hit.point);
                this.endMarker.visible = true;

                const surfacePoint1 = new SurfacePoint("face", { index: this.savedStartFace }, this.savedStartBary);
                const surfacePoint2 = new SurfacePoint("face", { index: faceIndex }, [w0, w1, w2]);
                const pathCoordinates = this.cgalAdapter.computeGeodesicPath(surfacePoint1, surfacePoint2);

                this.geodesicLineMesh.geometry.setAttribute(
                    "position",
                    new THREE.BufferAttribute(pathCoordinates, 3)
                );
                this.geodesicLineMesh.geometry.computeBoundingBox();
                this.geodesicLineMesh.geometry.computeBoundingSphere();
                this.geodesicLineMesh.geometry.attributes.position.needsUpdate = true;
                // }

                // Reset variables for subsequent path queries
                this.savedStartFace = null;
                this.savedStartBary = null;
            }
        }
        else {
            console.log("Clicked on empty space, ignoring.");
            return; // Stop the function here so it doesn't pass null down the line
        }
    }

    bindUI() {
        // attach clean event handlers
        window.addEventListener("click",
            (e) => this.onSurfaceClick(e));

        window.addEventListener("resize", () => {
            if (!this.camera) return;
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    // IMPORTANT: arrow function keeps `this` correct
    animate = () => {
        requestAnimationFrame(this.animate);

        if (this.controls) this.controls.update();
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    };
}

// boot
const app = new SceneApp();
