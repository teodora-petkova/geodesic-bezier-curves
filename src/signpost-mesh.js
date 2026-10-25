/**
 * Represents an Intrinsic Signpost Triangulation Mesh.
 * Handles topological reference tracking, dynamic edge-lengths, and polar direction vectors.
 */
export class SignpostMesh {
    EPSILON = 1e-6;

    /**
     * @param {object} mesh - Core topology data layout.
     * @param {object} geometry - System framework geometric metrics engine.
     * @param {boolean} debug - Enable runtime integrity tracking alerts.
     * @param {object} visualizer - Reference pointer context instance to a Three.js interface engine.
     */
    constructor(mesh, geometry, debug = false, visualizer = null) {
        this.mesh = mesh;
        this.geometry = geometry;
        this.debug = debug;
        this.visualizer = visualizer;

        this.intrinsicAngles = new Map();
        this.intrinsicLengths = new Map();

        if (this.mesh && this.geometry) {
            this._initializeSignposts();
        }
    }

    /**
     * Factory pattern alternative mapping clone instantiations securely.
     * @param {SignpostMesh} source - Original intrinsic mesh to map state attributes from.
     * @returns {SignpostMesh} Completely distinct manifold mesh layout clone.
     */
    static fromSource(source) {
        const flatFaceIndices = [];
        for (const face of source.mesh.faces) {
            for (const vert of face.adjacentVertices()) {
                flatFaceIndices.push(vert.index);
            }
        }

        const rawPositions = source.mesh.vertices.map(v => source.geometry.positions[v]);

        const freshMesh = new Mesh();
        freshMesh.build({ v: rawPositions, f: flatFaceIndices });

        // Maintain exact baseline metric lengths from the source mesh (do not re-normalize coordinates)
        const freshGeometry = new Geometry(freshMesh, rawPositions, false);

        const clone = new SignpostMesh(freshMesh, freshGeometry, source.debug, source.visualizer);
        clone.intrinsicAngles = new Map(source.intrinsicAngles);
        clone.intrinsicLengths = new Map(source.intrinsicLengths);

        return clone;
    }

    /**
     * Creates a deep structure clone instance.
     */
    clone() {
        return SignpostMesh.fromSource(this);
    }

    /**
     * Map a topological coordinate position directly into a Three.js coordinate vector space.
     * Useful for updating three.js point buffers or raycasting markers.
     * @param {object} face - Mesh target face descriptor.
     * @param {number[]} barycentric - Array containing three weights tracking [b0, b1, b2].
     * @returns {object} Three.js Vector3 coordinate output object container.
     */
    toWorldPosition(face, barycentric) {
        if (!this.visualizer) return null;

        const verts = Array.from(face.adjacentVertices());
        const p0 = this.geometry.positions[verts[0].index];
        const p1 = this.geometry.positions[verts[1].index];
        const p2 = this.geometry.positions[verts[2].index];

        return new THREE.Vector3(
            p0.x * barycentric[0] + p1.x * barycentric[1] + p2.x * barycentric[2],
            p0.y * barycentric[0] + p1.y * barycentric[1] + p2.y * barycentric[2],
            p0.z * barycentric[0] + p1.z * barycentric[1] + p2.z * barycentric[2]
        );
    }

    /**
     * Sets up local reference configurations, baseline distances, and angular direction lines.
     * @private
     */
    _initializeSignposts() {
        for (const edge of this.mesh.edges) {
            this.intrinsicLengths.set(edge, this.geometry.length(edge));
        }

        for (const vertex of this.mesh.vertices) {
            vertex.referenceHalfedge = vertex.halfedge;
        }

        this._populateIntrinsicAngles();
    }

    /**
     * Populates absolute radial coordinate bounds by orbiting vertices.
     * @private
     */
    _populateIntrinsicAngles() {
        for (const vertex of this.mesh.vertices) {
            const startHE = vertex.referenceHalfedge;
            if (!startHE) continue;

            let currentAngle = 0.0;
            let h = startHE;

            do {
                this.intrinsicAngles.set(h, currentAngle);

                if (!h.onBoundary && h.corner) {
                    currentAngle += this.geometry.angle(h.corner);
                }

                h = h.twin.next; // Orbit clockwise around vertex frame
            } while (h !== startHE && h !== null);
        }
    }

    /**
     * Calculates the exact micro angle spanning two baseline edges sharing a common node.
     * @private
     */
    _computeCornerAngle(halfedge) {
        const root = this.geometry.positions[halfedge.vertex.index];
        const next = this.geometry.positions[halfedge.next.vertex.index];
        const prev = this.geometry.positions[halfedge.next.next.vertex.index];

        const dirNext = next.minus(root).unit();
        const dirPrev = prev.minus(root).unit();

        const dotProduct = Math.max(-1.0, Math.min(1.0, dirNext.dot(dirPrev)));
        return Math.acos(dotProduct);
    }

    /**
     * Clamps tiny floating point precision offsets cleanly down to zero.
     * @private
     */
    _clamp(value) {
        return Math.abs(value) < this.EPSILON ? 0 : value;
    }
}
