import { SurfacePoint } from "./surface-point.js";

export class Bezier {

  constructor(traceBetweenPoints) {
    this.traceBetweenPoints = traceBetweenPoints
  }

  geodesicInterp(signpostMesh, trace, u) {
    // given two SurfacePoints A, B on the mesh and parameter u in [0,1],
    // return the point at fraction u along the geodesic between them.
    // a geodesic path is made of straight pieces inside individual triangles
    // to find the point at fraction u along the path:
    //    - find the geodesic trace from A to B
    //    - measure the lengths of its segments
    //    - locate the segment containing the requested distance.
    //    - interpolate inside that segment’s triangle.
    u = Math.max(0, Math.min(1, u));

    if (!trace?.length) return null;
    if (trace.length === 1 || u === 0) return trace[0];
    if (u === 1) return trace[trace.length - 1];

    // arc-length parameterization of the trace
    const s = [0];
    for (let i = 0; i < trace.length - 1; i++) {
      const length = this.intrinsicDistance(
        trace[i],
        trace[i + 1],
        signpostMesh
      );

      if (!Number.isFinite(length) || length < 0) {
        console.error("Invalid trace segment length.", { i, length });
        return null;
      }

      s.push(s[i] + length);
    }

    const totalLen = s[s.length - 1];
    if (totalLen === 0) return trace[0];

    const target = u * totalLen;

    let i = 0;
    while (i < s.length - 2 && s[i + 1] < target) {
      i++;
    }

    const segmentLength = s[i + 1] - s[i];
    const t = segmentLength > 0
      ? (target - s[i]) / segmentLength
      : 0;

    return this.interpolateSurfacePoint(
      trace[i],
      trace[i + 1],
      t,
      signpostMesh
    );
  }

  sampleQuadraticGeodesicBezier(signpostMesh, P0, P1, P2, numSamples) {
    numSamples -= 1;
    const samples = [];

    const trace_P0_P1 = this.traceBetweenPoints(P0, P1);
    const trace_P1_P2 = this.traceBetweenPoints(P1, P2);

    for (let k = 0; k <= numSamples; k++) {
      const u = k / numSamples;

      // First level: interpolate between P0-P1 and P1-P2
      const Q0 = this.geodesicInterp(signpostMesh, trace_P0_P1, u);
      const Q1 = this.geodesicInterp(signpostMesh, trace_P1_P2, u);

      // console.log('Q0: ', Q0.element.index, Q0.bary);
      // console.log('Q1: ', Q1.element.index, Q1.bary);

      // Second level: interpolate between Q0-Q1
      const C = this.geodesicInterp(signpostMesh, Q0, Q1, u);

      console.log('Q0: ', Q0.element.index, Q0.bary);
      console.log('Q1: ', Q1.element.index, Q1.bary);
      // samples.push(Q0);
      // samples.push(Q1);

      // console.log('C: ', C.element.index, C.bary);
      if (C != null) {
        console.log('C: ', C.element.index, C.bary);
        samples.push(C);
      }
    }

    var geodesic_samples = [];
    for (let c = 0; c < samples.length - 1; c++) {
      const c1 = samples[c];
      const c2 = samples[c + 1];

      var current_points = this.traceBetweenPoints(c1, c2);
      current_points.reverse();
      // TODO: remove abundant points here!!
      geodesic_samples.push(...current_points);
    }

    return geodesic_samples; // array of SurfacePoint on the geodesic Bézier curve
  }

  sampleCubicGeodesicBezier(signpostMesh, P0, P1, P2, P3, numSamples) {
    numSamples -= 1;
    let geom = signpostMesh.geometry;
    var cache = [];
    const samples = [];

    const path_P0_P1 = this.traceBetweenPoints(P0, P1);
    const path_P1_P2 = this.traceBetweenPoints(P1, P2);
    const path_P2_P3 = this.traceBetweenPoints(P2, P3);

    for (let k = 0; k <= numSamples; k++) {
      const u = k / numSamples;

      const Q0 = this.geodesicInterp(signpostMesh, path_P0_P1, u);
      const Q1 = this.geodesicInterp(signpostMesh, path_P1_P2, u);
      const Q2 = this.geodesicInterp(signpostMesh, path_P2_P3, u);

      const path_Q0_Q1 = this.traceBetweenPoints(Q0, Q1);
      const path_Q1_Q2 = this.traceBetweenPoints(Q1, Q2);

      const R0 = this.geodesicInterp(signpostMesh, path_Q0_Q1, u);
      const R1 = this.geodesicInterp(signpostMesh, path_Q1_Q2, u);

      const path_R0_R1 = this.traceBetweenPoints(R0, R1);
      
      const C = this.geodesicInterp(signpostMesh, path_R0_R1, u);

      samples.push(C);

      cache.push({
        u: u,
        // Points
        points: {
          Q0: Q0.to3D(geom), Q1: Q1.to3D(geom), Q2: Q2.to3D(geom),
          R0: R0.to3D(geom), R1: R1.to3D(geom),
          C: C.to3D(geom)
        },
        // Geodesic path line sequences
        paths: {
          controlLines: [
            path_P0_P1.map(p => p.to3D(geom)),
            path_P1_P2.map(p => p.to3D(geom)),
            path_P2_P3.map(p => p.to3D(geom))
          ],
          greenLines: [
            path_Q0_Q1.map(p => p.to3D(geom)),
            path_Q1_Q2.map(p => p.to3D(geom))
          ],
          magentaLine: path_R0_R1.map(p => p.to3D(geom))
        }
      });
    }

    var geodesic_samples = [];
    for (let c = 0; c < samples.length - 1; c++) {
      const c1 = samples[c];
      const c2 = samples[c + 1];

      // if(c1.element.index == c2.element.index)
      // {
      //   geodesic_samples.push(c1);
      //   geodesic_samples.push(c2);
      // }
      // else
      // {
      var current_points = this.traceBetweenPoints(c1, c2);
      current_points.reverse();
      geodesic_samples.push(...current_points);
      // }
    }

    return [geodesic_samples, cache]; // array of SurfacePoint on the geodesic Bézier curve
  }

  convertToFacePoint(p, signpostTri) {
    if (p.type === "face") return p;

    if (p.type === "vertex") {
      const v = p.element;
      const face = v.halfedge.face();
      const verts = face.vertices();
      const bary = signpostTri.getBarycentricOnVertex(verts, v);
      return new SurfacePoint("face", face, bary);
    }

    if (p.type === "edge") {
      const he = p.element;
      const face = he.face();
      const verts = face.vertices();
      const pos = interpolateEdgePosition(he, p.bary.t);
      const bary = computeBarycentric(face, pos);
      return new SurfacePoint("face", face, bary);
    }
  }

  intrinsicDistance(a, b, signpostMesh) {
    // unify to face points
    const A = a; //this.convertToFacePoint(a, signpostTri);
    const B = b; //this.convertToFacePoint(b, signpostTri);

    // console.log(a);
    // console.log(b);

    const face = A.element;
    if (face !== B.element) {
      // for a traced polyline, consecutive points should share a face or edge;
      // if not, you can fall back to Euclidean distance in 3D
      const pA = A.to3D(signpostMesh.geometry);
      const pB = B.to3D(signpostMesh.geometry);
      return pA.minus(pB).norm();
    } else {
      // console.log(face);
      const verts = Array.from(face.adjacentVertices());
      const verts_pos = verts.map((v) => signpostMesh.geometry.positions[v.index]);
      // 2. Compute barycentric position pA
      const pA = verts_pos[0]
        .times(A.bary[0])
        .plus(verts_pos[1].times(A.bary[1]))
        .plus(verts_pos[2].times(A.bary[2]));

      // 3. Compute barycentric position pB
      const pB = verts_pos[0]
        .times(B.bary[0])
        .plus(verts_pos[1].times(B.bary[1]))
        .plus(verts_pos[2].times(B.bary[2]));

      return pA.minus(pB).norm();
    }
  }

  getCandidateFaces(point) {
    const element = point?.element;
    if (!element) return [];

    if (element instanceof Face) {
      return [element];
    }

    if (element instanceof Halfedge) {
      return [element.face, element.twin?.face].filter(Boolean);
    }

    if (element instanceof Vertex) {
      return Array.from(element.adjacentFaces());
    }

    return [];
  }

  barycentricsInFace(point, face, signpostMesh) {
    const vertices = Array.from(face.adjacentVertices());
    const position = point.to3D(signpostMesh.geometry);

    return signpostMesh.getBaryForPointInFaceByVerticesIndices(
      vertices,
      position
    );
  }

  interpolateSurfacePoint(a, b, t, signpostMesh) {
    t = Math.max(0, Math.min(1, t));

    const facesA = this.getCandidateFaces(a);
    const facesB = this.getCandidateFaces(b);

    // choose a face that both points can be represented in.
    const face = facesA.find(f => facesB.includes(f));
    if (!face) {
      console.error("Trace segment endpoints do not share a face.", { a, b });
      return null;
    }

    const baryA = this.barycentricsInFace(a, face, signpostMesh);
    const baryB = this.barycentricsInFace(b, face, signpostMesh);

    if (!baryA || !baryB || baryA.length !== 3 || baryB.length !== 3) {
      console.error("Could not compute endpoint barycentrics in shared face.", {
        face, baryA, baryB
      });
      return null;
    }

    // interpolate within the shared triangle.
    let bary = baryA.map((x, i) => (1 - t) * x + t * baryB[i]);

    // clamp tiny floating-point errors near edges, then renormalize.
    const eps = 1e-8;
    if (bary.some(x => x < -eps)) {
      console.error("Interpolated point is outside the shared face.", {
        face, baryA, baryB, t, bary
      });
      return null;
    }

    bary = bary.map(x => Math.max(0, x));
    const sum = bary.reduce((total, x) => total + x, 0);
    if (sum === 0) return null;

    bary = bary.map(x => x / sum);
    return new SurfacePoint("face", face, bary);
  }
}