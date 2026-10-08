// SurfacePoint.js
export class SurfacePoint {
  // type: "vertex" | "edge" | "face"
  // element: Vertex | Halfedge | Face
  // bary:
  //   - vertex: null
  //   - edge: { t } with t in [0,1]
  //   - face: { b0, b1, b2 } with b0+b1+b2=1
  constructor(type, element, bary = null) {
    this.type = type;
    this.element = element;
    this.bary = bary;
  }

  // Convert to 3D using geom (VertexPositionGeometry or signpost.geom)
  to3D(geom) {
    if (this.type === "vertex") {
      return geom.positions[this.element];
    }

    if (this.type === "edge") {
      const he = this.element;//.halfedge || this.element; // edge or halfedge
      const v0 = he.vertex.index;
      const v1 = he.next.vertex.index;
      const p0 = geom.positions[v0];
      const p1 = geom.positions[v1];
      const t = this.bary;
      return p0.times(1 - t).plus(p1.times(t));
    }

    if (this.type === "face") {
      const f = this.element;

      const h0 = f.halfedge;
      const h1 = h0.next;
      const h2 = h1.next;

      const v0 = h0.vertex.index;
      const v1 = h1.vertex.index;
      const v2 = h2.vertex.index;

      const p0 = geom.positions[v0];
      const p1 = geom.positions[v1];
      const p2 = geom.positions[v2];
      const [b0, b1, b2] = this.bary;
      return p0.times(b0).plus(p1.times(b1)).plus(p2.times(b2));
    }

    throw new Error(`Unknown SurfacePoint type: ${this.type}`);
  }
}
