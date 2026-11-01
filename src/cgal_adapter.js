/**
 * Abstracts CGAL C++ calls through Emscripten.
 **/

import { SurfacePoint } from "./surface-point.js";

export class CGALAdapter {
  constructor(wasmModule) {

    let m = wasmModule;
    this.cgal_module = wasmModule;

    console.log("WebAssembly is fully loaded and ready!");

    this.cgal_malloc = m._malloc;
    this.cgal_free = m._free;

    console.log("WebAssembly Engine Ready!");
    this.geodesic_create = m.cwrap("geodesic_create", "GeodesicSolver", []);
    this.solver = this.geodesic_create();

    this.cgalInitMesh = m.cwrap("geodesic_init", "void", [
      "GeodesicSolver",
      "number",
      "number",
      "number",
      "number",
    ]);
    // Bind the direct method function link inside Module.onRuntimeInitialized:
    this.cgalComputeDirectPath = m.cwrap(
      "geodesic_compute_path",
      "number",
      [
        "GeodesicSolver",
        "number",
        "number",
        "number",
        "number",
        "number",
        "number",
        "number",
        "number",
      ]
    );
    this.cgalGetPathBufferAddress = m.cwrap(
      "geodesic_get_path_ptr",
      "number",
      ["GeodesicSolver"]
    );
  }


  uploadMesh(vertices, facesWithVertexIndices) {
    // allocate WebAssembly memory heaps via Emscripten
    const vertexPositions = vertices.flatMap(v => [v.x, v.y, v.z]);
    const posPtr = this.cgal_module._malloc(vertexPositions.length * 4); // Float32 = 4 bytes
    const facePtr = this.cgal_module._malloc(facesWithVertexIndices.length * 4); // Int32 = 4 bytes

    // copy the flat typed arrays straight into wasm memory
    this.cgal_module.HEAPF32.set(vertexPositions, posPtr / 4);
    this.cgal_module.HEAP32.set(facesWithVertexIndices, facePtr / 4);

    // call the C++ engine function passing lengths and pointer addresses
    this.cgalInitMesh(
      this.solver,
      posPtr, // float* vertices
      vertexPositions.length / 3,
      facePtr, // int* faces
      facesWithVertexIndices.length / 3
    );

    // clean up memory
    this.cgal_module._free(posPtr);
    this.cgal_module._free(facePtr);

    console.log("Mesh registered with CGAL.");
  }

  /**
   * Compute geodesic path between two surface points.
   * @returns {Float32Array} Array of surface points representing the path.
   */
  computeGeodesicPath(startPoint, endPoint, meshGeometry) {

    // console.log('start:', startPoint.element.index,
    //   startPoint.bary[0], startPoint.bary[1], startPoint.bary[2]);
    // console.log('end:', endPoint.element.index,
    //   endPoint.bary[0], endPoint.bary[1], endPoint.bary[2]);

    const pointCount = this.cgalComputeDirectPath(
      this.solver,
      startPoint.element.index,
      startPoint.bary[0],
      startPoint.bary[1],
      startPoint.bary[2],
      endPoint.element.index,
      endPoint.bary[0],
      endPoint.bary[1],
      endPoint.bary[2]
    );

    if (pointCount === 0) return [];

    const memoryPathOffset = this.cgalGetPathBufferAddress(this.solver);
    const heapPathIndex = memoryPathOffset >> 2;
    const STRIDE = 5;
    const pathCoords = this.cgal_module.HEAPF32.slice(
      heapPathIndex, heapPathIndex + pointCount * STRIDE);

    const surfacePoints = [];

    for (let i = 0; i < pointCount; i++) {
      const base = i * STRIDE;

      // Read and convert float types back to integers where applicable
      const surfacePoint = this.getSurfacePoint(pathCoords, base, meshGeometry);

      surfacePoints.push(surfacePoint);
    }
    // console.log("Coords: ", surfacePoints);

    return surfacePoints;
  }

  getSurfacePoint(pathCoords, base, meshGeometry) {
    const typeId = Math.round(pathCoords[base + 0]);
    const elementId = Math.round(pathCoords[base + 1]);

    let type = "";
    let element = null;
    let bary = null;

    if (typeId === 0) {
      type = "vertex";
      element = meshGeometry.vertices[elementId];
      bary = null;
    }
    else if (typeId === 1) {
      type = "edge";
      element = meshGeometry.halfedges[elementId];
      bary = pathCoords[base + 2]; // Just the scalar 't'
    }
    else if (typeId === 2) {
      type = "face";
      element = meshGeometry.faces[elementId];
      bary = [
        pathCoords[base + 2], // b0
        pathCoords[base + 3], // b1
        pathCoords[base + 4]  // b2
      ];
    }
    return new SurfacePoint(type, element, bary);
  }
}
