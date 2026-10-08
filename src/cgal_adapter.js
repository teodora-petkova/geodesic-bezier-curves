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
    this.cgalGetBufferAddress = m.cwrap("geodesic_get_path_ptr", "number", ["GeodesicSolver"]);
  }


  uploadMesh(vertexPositions, facesWithVertexIndices) {
    // allocate WebAssembly memory heaps via Emscripten
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
  computeGeodesicPath(startPoint, endPoint) {

    const floatCount = this.cgalComputeDirectPath(
      this.solver,
      startPoint.element.index,
      startPoint.bary[2],
      startPoint.bary[0],
      startPoint.bary[1],
      endPoint.element.index,
      endPoint.bary[2],
      endPoint.bary[0],
      endPoint.bary[1]
    );

    if (floatCount === 0) return [];

    const memoryOffset = this.cgalGetBufferAddress(this.solver);

    const heapIndex = memoryOffset >> 2;
    const pathCoordinates = this.cgal_module.HEAPF32.slice(
      heapIndex, heapIndex + floatCount);

    // console.log("Coords: ", pathCoordinates);

    return pathCoordinates; //this.parsePath(pathCoordinates);
  }
}
