export class Visualizer {
  constructor(scene, mesh, visualMesh, threeGeometry) {
    this.scene = scene;
    this.objects = []; // store all debug objects for easy cleanup
    this.stepObjects = []; // store temp objects
    this.anchorMarkers = [];

    this.mesh = mesh;
    this.threeGeometry = threeGeometry;
    this.savedIsolinesMesh = null;
    this.pathLineMesh = null;
    this.dynamicRadius = visualMesh.geometry.boundingSphere.radius * 0.01;

    this.pathPointsGroup = new THREE.Group();
    this.scene.add(this.pathPointsGroup);
    this.pathPointsGroup.visible = false;
  }

  add(obj) {
    if (!this.scene.children.includes(obj)) {
      this.scene.add(obj);
    }
    // this.scene.add(obj);
    this.objects.push(obj);
  }

  clearGroup(group) {
    // free up the graphics memory first
    group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();

      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    // unlink all child items from the group hierarchy at once
    group.clear();
  }

  clear() {
    for (const obj of this.objects) {
      this.scene.remove(obj);
    }
    this.objects = [];
    this.clearGroup(this.pathPointsGroup);

    if (this.pathLineMesh) {
      this.scene.remove(this.pathLineMesh);
      this.pathLineMesh = null;
    }

    this.anchorMarkers.forEach((m) => this.scene.remove(m));
    this.anchorMarkers = [];
  }

  drawSphere(pos) {
    const sphereGeo = new THREE.SphereGeometry(this.dynamicRadius, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xe53e3e,
      depthTest: false, // Prevents the main mesh from blocking the point
      depthWrite: false,
    });

    const marker = new THREE.Mesh(sphereGeo, sphereMat);
    marker.renderOrder = 999; // forces Three.js to draw it on top
    marker.position.set(pos.x, pos.y, pos.z);
    this.add(marker);

    this.anchorMarkers.push(marker);
  }

  drawPoint(P, color = 0xff0000, size = 0.01) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(size),
      new THREE.MeshBasicMaterial({ color })
    );
    sphere.position.set(P.x, P.y, P.z);
    sphere.renderOrder = 999;
    this.add(sphere);
    return sphere;
  }

  drawPath(pathPoints, color = 0xecc94b) {
    for (let p of pathPoints) {
      const point = this.drawPoint(p, 0x00ff00);
      this.pathPointsGroup.add(point);
    }
    const pathGeo = new THREE.BufferGeometry().setFromPoints(pathPoints);
    const pathMat = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 4,
    });

    this.pathLineMesh = new THREE.Line(pathGeo, pathMat);
    // Shift line slightly forward away from surface depth z-fighting anomalies
    this.pathLineMesh.position.scale = 1.002;
    // Tell Three.js to render this line after drawing everything else
    this.pathLineMesh.renderOrder = 999;
    this.add(this.pathLineMesh);
  }
}
