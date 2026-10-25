export class MeshLoader {

    constructor(cgalAdapt) {
        this.cgalAdapter = cgalAdapt;
    }

    loadMesh(objFileString) {
        const parsedOBJ = MeshIO.readOBJ(objFileString);
        let rawPositions = parsedOBJ.v;
        let indices = [];
        const flatFaces = parsedOBJ.f;

        // track clean indices
        const usedVertices = new Array(rawPositions.length).fill(false);
        for (let i = 0; i < flatFaces.length; i++) {
            usedVertices[flatFaces[i]] = true;
            indices.push(i);
        }

        const cleanPositions = [];
        const oldToNewIndexMap = new Map();
        for (let oldIdx = 0; oldIdx < rawPositions.length; oldIdx++) {
            if (usedVertices[oldIdx]) {
                oldToNewIndexMap.set(oldIdx, cleanPositions.length);
                cleanPositions.push(rawPositions[oldIdx]);
            }
        }

        const cleanFlatFaces = [];
        for (let i = 0; i < flatFaces.length; i++) {
            cleanFlatFaces.push(oldToNewIndexMap.get(flatFaces[i]));
        }

        const cleanPolygonSoup = { v: cleanPositions, f: cleanFlatFaces };

        // upload to CGAL - CGAL will build its mesh using this exact polygon soup
        this.cgalAdapter.uploadMesh(cleanPositions, cleanFlatFaces);

        // emulate CGAL's topology generation in javascript
        const cleanMesh = new Mesh();
        let buildSuccess = cleanMesh.build(cleanPolygonSoup);
        this.reorder(cleanMesh, cleanFlatFaces);
        
        // for (let he of cleanMesh.halfedges) {
        //     console.log(he.toString());
        // }

        const cleanGeometry = new Geometry(cleanMesh, cleanPositions);

        // console.log([buildSuccess, cleanMesh, cleanGeometry, cleanPolygonSoup]);

        return [buildSuccess, cleanMesh, cleanGeometry, cleanPolygonSoup];
    }

    reorder(mesh, flatFaces) {
        this.validateInput(mesh, flatFaces);

        const halfedgeByDirection = this.buildDirectedHalfedgeMap(mesh.halfedges);
        const ordered = new Array(mesh.halfedges.length);
        const seenEdges = new Set();

        let nextIndex = 0;

        for (let faceStart = 0; faceStart < flatFaces.length; faceStart += 3) {
            const face = flatFaces.slice(faceStart, faceStart + 3);

            for (let i = 0; i < 3; i++) {
                const source = face[i];
                const target = face[(i + 1) % 3];
                const key = this.undirectedEdgeKey(source, target);

                if (seenEdges.has(key)) continue;

                const forward = halfedgeByDirection.get(this.directedEdgeKey(source, target));
                const reverse = halfedgeByDirection.get(this.directedEdgeKey(target, source));

                if (!forward || !reverse) {
                    throw new Error(
                        `Missing one or both halfedges for edge ${source}-${target}.`
                    );
                }

                if (nextIndex + 1 >= ordered.length) {
                    throw new Error("More edge pairs found than the mesh contains.");
                }

                // the pair follows the direction used by the first face that
                // encounters this edge, followed by its opposite direction.
                ordered[nextIndex] = forward;
                ordered[nextIndex + 1] = reverse;

                seenEdges.add(key);
                nextIndex += 2;
            }
        }

        if (nextIndex !== ordered.length) {
            throw new Error(
                `Placed ${nextIndex} of ${ordered.length} halfedges. ` +
                "The face list and mesh may not describe the same edges."
            );
        }

        mesh.halfedges = ordered;
        this.updateHalfedgeIndices(ordered);
        this.assignOutgoingHalfedges(ordered);

        return mesh;
    }

    validateInput(mesh, flatFaces) {
        if (!mesh?.halfedges) {
            throw new Error("Mesh must have a halfedges array.");
        }

        if (flatFaces.length % 3 !== 0) {
            throw new Error("flatFaces must contain triangle triples.");
        }
    }

    buildDirectedHalfedgeMap(halfedges) {
        const map = new Map();

        for (const halfedge of halfedges) {
            if (!halfedge?.vertex || !halfedge?.twin?.vertex) {
                throw new Error("A halfedge, twin, or endpoint is missing.");
            }

            const source = halfedge.vertex.index;
            const target = halfedge.twin.vertex.index;
            const key = this.directedEdgeKey(source, target);

            if (map.has(key)) {
                throw new Error(`Duplicate directed edge ${key}.`);
            }

            map.set(key, halfedge);
        }

        return map;
    }

    directedEdgeKey(source, target) {
        return `${source}->${target}`;
    }

    undirectedEdgeKey(a, b) {
        return a < b ? `${a}-${b}` : `${b}-${a}`;
    }

    updateHalfedgeIndices(halfedges) {
        for (let i = 0; i < halfedges.length; i++) {
            halfedges[i].index = i;
        }
    }

    assignOutgoingHalfedges(halfedges) {
        const assignedVertices = new Set();

        for (const halfedge of halfedges) {
            const vertex = halfedge.vertex;

            if (!assignedVertices.has(vertex)) {
                vertex.halfedge = halfedge;
                assignedVertices.add(vertex);
            }
        }
    }
}