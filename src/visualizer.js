export class Visualizer {
  constructor(scene, mesh, visualMesh, threeGeometry) {
    this.scene = scene;
    this.objects = []; // store all debug objects for easy cleanup
    this.renderedObjects = [];
    this.stepObjects = []; // store temp objects
    this.anchorMarkers = [];

    this.mesh = mesh;
    this.threeGeometry = threeGeometry;
    this.savedIsolinesMesh = null;
    this.pathLineMesh = null;
    this.dynamicRadius = visualMesh.geometry.boundingSphere.radius * 0.01;

    this.pathPointsGroup = new THREE.Group();
    this.scene.add(this.pathPointsGroup);
    this.pathPointsGroup.visible = false; //true;//false;

    // materials
    this.matGray = new THREE.LineBasicMaterial({ 
      color: 0xaaaaaa,
      linewidth: 2
    });
    this.matGreen = new THREE.LineBasicMaterial({
      color: 0x0000ff,
      linewidth: 2,
    });
    this.matMagenta = new THREE.LineBasicMaterial({
      color: 0xff00ff,
      linewidth: 2,
    });
    this.matBlue = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
    this.matPointGreen = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    this.matRed = new THREE.MeshBasicMaterial({ color: 0xff00ff });
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
    for (const obj of this.renderedObjects) {
      this.scene.remove(obj);
    }
    this.objects = [];
    this.renderedObjects = [];
    this.clearGroup(this.pathPointsGroup);

    if (this.pathLineMesh) {
      this.scene.remove(this.pathLineMesh);
      this.pathLineMesh = null;
    }

    this.anchorMarkers.forEach((m) => this.scene.remove(m));
    this.anchorMarkers = [];
  }

  drawSphere(pos, color = 0xe53e3e) {
    const sphereGeo = new THREE.SphereGeometry(this.dynamicRadius, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: color,
      depthTest: false, // Prevents the main mesh from blocking the point
      depthWrite: false,
    });

    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.renderOrder = 999; // forces Three.js to draw it on top
    sphere.position.set(pos.x, pos.y, pos.z);
    this.add(sphere);

    this.anchorMarkers.push(sphere);

    return sphere;
  }

  drawPath(pathPoints, color = 0xecc94b) {
    for (let p of pathPoints) {
      const point = this.drawSphere(p, 0x00ff00);
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

  drawBezierPoint(v3, material) {
    const sphereGeo = new THREE.SphereGeometry(this.dynamicRadius, 16, 16);
    const mesh = new THREE.Mesh(sphereGeo, material);
    mesh.position.copy(v3);
    this.scene.add(mesh);
    this.renderedObjects.push(mesh);
  }

  drawBezierPath(v3Array, material) {
    const geo = new THREE.BufferGeometry().setFromPoints(v3Array);
    const line = new THREE.Line(geo, material);
    this.scene.add(line);
    this.renderedObjects.push(line);
  }

  // draw a specific frame without calculating anything new
  drawBezierFrame(frame) {
    // 1. draw pre-calculated lines
    frame.paths.controlLines.forEach((line) =>
      this.drawBezierPath(line, this.matGray)
    );
    frame.paths.greenLines.forEach((line) =>
      this.drawBezierPath(line, this.matGreen)
    );
    this.drawBezierPath(
      frame.paths.magentaLine, this.matMagenta);

    // 2. draw pre-calculated points
    this.drawBezierPoint(frame.points.Q0, this.matBlue);
    this.drawBezierPoint(frame.points.Q1, this.matBlue);
    this.drawBezierPoint(frame.points.Q2, this.matBlue);

    this.drawBezierPoint(frame.points.R0, this.matPointGreen);
    this.drawBezierPoint(frame.points.R1, this.matPointGreen);

    this.drawBezierPoint(frame.points.C, this.matRed);
  }

}
