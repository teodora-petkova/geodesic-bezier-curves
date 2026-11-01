import { CGALAdapter } from "./cgal_adapter.js";
import { MeshLoader } from "./mesh-loader.js";
import { SurfacePoint } from "./surface-point.js";
import { SignpostMesh } from "./signpost-mesh.js";
import { Visualizer } from "./visualizer.js";
import { MeshInteractionManager } from "./mobile-interaction-manager.js";
import { Bezier } from "./bezier.js";

// import the factory function from emscripten-generated js file
import wasmFactory from "../cgal_wasm/compiled/geodesics.js";

export class SceneApp {
    constructor() {
        let scene, camera, renderer, controls;

        this.currentMesh = null;
        this.signpostMesh = null;

        // this.visualizer = null;
        this.visualMesh = null;
        this.visualWireframe = null;

        let cgalAdapter = null;

        let selectedPoints = [];

        this.initializeCGALWasmAndScene();
    }

    initializeCGALWasmAndScene() {

        const moduleConfig = {
            print: (text) => console.log(`[WASM STDOUT]: ${text}`),
            printErr: (text) => console.warn(`[WASM STDERR]: ${text}`),
            onRuntimeInitialized: () => {
                console.log("WASM Runtime has initialized its internal streams.");
            }
        };

        wasmFactory(moduleConfig)
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

        const light1 = new THREE.DirectionalLight(0xffffff, 1);
        light1.position.set(5, 10, 10).normalize();
        this.scene.add(light1);
        this.scene.add(new THREE.AmbientLight(0x404040));

        // const boxObjText = `
        //     v -0.5 -0.5  0.5 # 1
        //     v  0.5 -0.5  0.5 # 2
        //     v -0.5  0.5  0.5 # 3
        //     v  0.5  0.5  0.5 # 4
        //     v -0.5 -0.5 -0.5 # 5
        //     v  0.5 -0.5 -0.5 # 6
        //     v -0.5  0.5 -0.5 # 7
        //     v  0.5  0.5 -0.5 # 8
        //     # Front face (Z = 0.5)
        //     f 1 2 3
        //     f 3 2 4
        //     # Top face (Y = 0.5)
        //     f 3 4 7
        //     f 7 4 8
        //     # Back face (Z = -0.5)
        //     f 7 8 5
        //     f 5 8 6
        //     # Bottom face (Y = -0.5)
        //     f 5 6 1
        //     f 1 6 2
        //     # Left face (X = -0.5)
        //     f 5 1 7
        //     f 7 1 3
        //     # Right face (X = 0.5)
        //     f 2 6 4
        //     f 4 6 8
        // `;

        // this.loadMeshFromText(boxObjText, "Default Box Cube");

        this.loadMeshFromPath("./models/spot.obj");


        // ---- bind UI + events
        this.bindUI();

        requestAnimationFrame(this.animate);
    }

    convertHalfEdgeGeometryToThreeJsTopology(halfEdgeMesh, halfEdgeGeometry) {
        var { vertexPositions, vertexIndices, vertexColors } =
            this._extractVertexDataFromHalfEdgeMesh(halfEdgeMesh, halfEdgeGeometry);

        const threeGeometry = this._createThreeJsGeometry(
            vertexPositions,
            vertexIndices,
            vertexColors
        );

        let meshMaterial = new THREE.MeshPhongMaterial({
            // Phong
            color: 0x4bb47e,
            flatShading: true,
            side: THREE.DoubleSide,
            vertexColors: true,
            // side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
            // transparent: true,
            // opacity: 0.3,
        });

        this.visualMesh = new THREE.Mesh(threeGeometry, meshMaterial);

        // force Three.js to use the pure object-space coordinates
        // from your data arrays
        this.visualMesh.position.set(0, 0, 0);
        this.visualMesh.rotation.set(0, 0, 0);
        this.visualMesh.scale.set(1, 1, 1);
        // Prevents Three.js from injecting matrix adjustments
        this.visualMesh.matrixAutoUpdate = false;
        this.visualMesh.updateMatrixWorld(true);

        const wireMaterial = new THREE.MeshBasicMaterial({
            // color: 0x44aa66,
            wireframe: true,
            transparent: true,
            opacity: 0.3,
        });
        this.visualWireframe = new THREE.Mesh(threeGeometry, wireMaterial);

        // Match the wireframe matrix to the mesh matrix exactly
        this.visualWireframe.position.set(0, 0, 0);
        this.visualWireframe.rotation.set(0, 0, 0);
        this.visualWireframe.scale.set(1, 1, 1);
        this.visualWireframe.matrixAutoUpdate = false;
        this.visualWireframe.updateMatrixWorld(true);

        threeGeometry.computeBoundingSphere();
        const boundingSphereRadius = threeGeometry.boundingSphere.radius;

        // TODO: to debug issues
        // addShaders(threeGeometry);

        return [
            this.visualMesh,
            this.visualWireframe,
            boundingSphereRadius,
            threeGeometry,
        ];
    }

    async loadMeshFromPath(filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const textData = await response.text();

            // Extract the filename from the path to pass to your existing method
            const fileName = filePath.split('/').pop();

            this.loadMeshFromText(textData, fileName);
        } catch (error) {
            console.error('Failed to fetch or parse the mesh file:', error);
        }
    }

    loadMeshFromFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) =>
            this.loadMeshFromText(evt.target.result, file.name);
        reader.readAsText(file);
    }

    loadMeshFromText(text, name, renderer) {
        // clean up previous visualization elements from the Three.js scene
        if (this.visualMesh) this.scene.remove(this.visualMesh);
        if (this.visualWireframe) this.scene.remove(this.visualWireframe);

        this.clearActivePath();

        this.meshLoader = new MeshLoader(this.cgalAdapter);
        let buildSuccess;
        [
            buildSuccess,
            this.currentMesh,
            this.currentGeometry,
            this.cleanPolygonSoup,
        ] = this.meshLoader.loadMesh(text);

        let threeGeometry;
        [this.visualMesh, this.visualWireframe, this.radius, threeGeometry] =
            this.convertHalfEdgeGeometryToThreeJsTopology(
                this.currentMesh,
                this.currentGeometry
            );

        this.scene.add(this.visualMesh);
        this.scene.add(this.visualWireframe);

        this.visualizer = new Visualizer(
            this.scene,
            this.currentMesh,
            this.visualMesh,
            threeGeometry
        );

        this.signpostMesh = new SignpostMesh(
            this.currentMesh,
            this.currentGeometry,
            (this.debug = true),
            (this.visualizer = this.visualizer)
        );

        if (!buildSuccess) {
            document.getElementById("status").innerText =
                "Error: Mesh topology is non-manifold!";
            return;
        }

        // Center view this.camera bounds automatically
        this.camera.position.set(0, this.radius * 1.2, this.radius * 1.8);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }


    _extractVertexDataFromHalfEdgeMesh(halfEdgeMesh, halfEdgeGeometry) {
        // 1. Map continuous spatial vertex positions
        const numVertices = halfEdgeMesh.vertices.length;
        const vertexPositions = new Float32Array(numVertices * 3);

        for (let v of halfEdgeMesh.vertices) {
            let i = v.index; // Unique topological vertex index

            // Extraction from geometry-central layout
            let p = halfEdgeGeometry.positions[v];

            vertexPositions[3 * i + 0] = p.x;
            vertexPositions[3 * i + 1] = p.y;
            vertexPositions[3 * i + 2] = p.z;
        }

        // 2. Map structural face triangles in the exact order of halfEdgeMesh.faces
        const vertexIndices = [];
        for (let f of halfEdgeMesh.faces) {
            // Collect adjacent vertices using half-edge traversal
            const faceVertices = [];
            for (let v of f.adjacentVertices()) {
                faceVertices.push(v.index);
            }

            // Push the matching triangle indices to the flat WebGL index table
            vertexIndices.push(faceVertices[0], faceVertices[1], faceVertices[2]);
        }

        // 3. Initialize color buffers matching the synchronized vertex length
        const PASTEL_GREEN = new Vector(0.03, 0.43, 0.23);
        let vertexColors = new Float32Array(numVertices * 3);
        for (let i = 0; i < numVertices; i++) {
            vertexColors[3 * i + 0] = PASTEL_GREEN.x;
            vertexColors[3 * i + 1] = PASTEL_GREEN.y;
            vertexColors[3 * i + 2] = PASTEL_GREEN.z;
        }
        return { vertexPositions, vertexIndices, vertexColors };
    }

    _createThreeJsGeometry(vertexPositions, vertexIndices, vertexColors) {
        const threeGeometry = new THREE.BufferGeometry();
        // vertex positions
        threeGeometry.setAttribute(
            "position",
            new THREE.BufferAttribute(vertexPositions, 3)
        );
        // vertex indices
        const threeIndices = new Uint32Array(vertexIndices);
        // Perfect 1-to-1 sync
        threeGeometry.setIndex(new THREE.BufferAttribute(threeIndices, 1));
        // colors
        threeGeometry.setAttribute(
            "color",
            new THREE.BufferAttribute(vertexColors, 3)
        );
        threeGeometry.computeVertexNormals();
        return threeGeometry;
    }

    clearActivePath() {
        this.selectedVertices = [];
        this.selectedPoints = [];

        if (this.visualizer != null) {
            this.visualizer.clear();
        }
    }

    handleMeshIntersection(intersect) {
        const faceIndex = intersect.faceIndex;
        const face = this.signpostMesh.mesh.faces[faceIndex];

        // Compute the exact Barycentric Coordinates of the intersection point
        const barycentricCoords = this.calculateBarycentricCoords(intersect);

        const surfacePoint = new SurfacePoint("face", face, barycentricCoords);

        // Pass the structural face surface point token to your handler sequence
        this.handleSurfacePointSelection(surfacePoint);
    }

    handleSurfacePointSelection(surfacePoint) {
        if (this.selectedPoints.length >= 4) this.clearActivePath();

        this.selectedPoints.push(surfacePoint);

        var pos = surfacePoint.to3D(this.signpostMesh.geometry);
        this.visualizer.drawSphere(pos);

        if (this.selectedPoints.length === 4) {
            // const pathCoordinates = this.cgalAdapter.computeGeodesicPath(
            //     this.selectedPoints[0],
            //     this.selectedPoints[1],
            //     this.signpostMesh.mesh
            // );

            // const pathPoints = pathCoordinates.map((p) => p.to3D(this.signpostMesh.geometry));

            // this.visualizer.drawPath(pathPoints, 0xff0033);

            let [P0, P1, P2, P3] = [
                this.selectedPoints[0],
                this.selectedPoints[1],
                this.selectedPoints[2],
                this.selectedPoints[3],
            ];

            const bezier = new Bezier(
                (p1, p2) => this.cgalAdapter.computeGeodesicPath(p1, p2, this.signpostMesh.mesh), this.visualizer);

            // 2. Run quadratic geodesic Bézier subdivision
            let number_points = 9;
            const frame = bezier.sampleCubicGeodesicBezier(
                this.signpostMesh, P0, P1, P2, P3, number_points);
            const samples = frame[0];
            // const samples = bezier.sampleQuadraticGeodesicBezier(
            //  this.signpostMesh, P0, P1, P2, 6)
            
            const samplePoints = samples.map(
                (p) => p.to3D(this.signpostMesh.geometry));
            this.visualizer.drawPath(samplePoints, 0xff0033);//, color = 0x990044);
            
            // midpoint frame
            const middle_point_ind = Math.floor(number_points / 2);
            this.visualizer.drawBezierFrame(frame[1][middle_point_ind]);
        }
    }

    /**
     * Computes exact barycentric coordinates from a Three.js this.raycaster intersection instance.
     * @param {Object} intersect - The Three.js this.raycaster target point match object
     * @returns {number[]} Array tracking fractional weights sum equaling 1.0 -> [u, v, w]
     **/
    calculateBarycentricCoords(intersect) {
        const meshGeometry = intersect.object.geometry;
        const positionAttribute = meshGeometry.attributes.position;
        const face = intersect.face;

        // Fetch the three concrete corner positions of the target triangle
        const vA = new THREE.Vector3().fromBufferAttribute(positionAttribute, face.a);
        const vB = new THREE.Vector3().fromBufferAttribute(positionAttribute, face.b);
        const vC = new THREE.Vector3().fromBufferAttribute(positionAttribute, face.c);

        // 2. Instantiate a math utility triangle object with those corners
        const triangle = new THREE.Triangle(vA, vB, vC);

        // 3. Compute barycentric coordinates using the instance method
        const targetPoint = intersect.point;
        const targetBaryCoords = new THREE.Vector3();

        // In older three.js versions, this was named: triangle.barycoordFromPoint(targetPoint, resultBarycentric);
        // In all modern versions, it is: triangle.getBarycoord(targetPoint, resultBarycentric);
        if (typeof triangle.getBarycoord === "function") {
            triangle.getBarycoord(targetPoint, targetBaryCoords);
        } else {
            triangle.barycoordFromPoint(targetPoint, targetBaryCoords);
        }

        // Return as array format matching standard geometry-central signatures
        return [targetBaryCoords.x, targetBaryCoords.y, targetBaryCoords.z];
    }

    bindUI() {
        this.interactionManager = new MeshInteractionManager(
            this.renderer,
            this.scene,
            this.camera,
            (h) => this.handleMeshIntersection(h)
        );

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

        this.renderer.render(this.scene, this.camera);
    };
}

// boot
const app = new SceneApp();
