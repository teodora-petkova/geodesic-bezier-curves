"use strict";

/**
 * This class converts text from 3D file formats such as OBJ to a polygon soup mesh
 * and vice versa.
 * @memberof module:Utils
 */
class MeshIO {
  /**
   * Converts text from an OBJ file to a polygon soup mesh.
   * @static
   * @param {string} input The text from an OBJ file containing vertex positions
   * and indices.
   * @returns {Object} A polygon soup mesh containing vertex positions and indices.
   * Vertex positions and indices are keyed by "v" and "f" respectively.
   */

  static readOBJ(input) {
    let lines = input.split("\n");
    let positions = [];
    let indices = [];

    for (let line of lines) {
      line = line.trim();
      let tokens = line.split(/\s+/);
      let identifier = tokens[0];//.trim();

      if (identifier === "v") {
		let x = parseFloat(tokens[1]);
		let y = parseFloat(tokens[2]);
		let z = parseFloat(tokens[3]);

		// Check if any coordinate failed to parse
		if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
			console.error(`Malformed vertex found on line: ${line}`);
			// Handle the error (skip, default to 0, or alert)
		}

		positions.push(new Vector(x, y, z));
      }
	  else if (identifier === "f") {
        // Extract the clean vertex indices (ignoring texture/normal info)
        let faceIndices = [];
        for (let i = 1; i < tokens.length; i++) {
          let index = tokens[i].split("/")[0].trim();
          faceIndices.push(parseInt(index) - 1);
        }

        if (tokens.length == 4) {
           // Triangle: f v0, v1, v2
        	indices.push(faceIndices[0], faceIndices[1], faceIndices[2]);
        } else if (tokens.length == 5) {
			// Quad: f v0, v1, v2 v3
			// Triangulate into (v0, v1, v2) and (v0, v2, v3)
			indices.push(faceIndices[0], faceIndices[1], faceIndices[2]);
			indices.push(faceIndices[0], faceIndices[2], faceIndices[3]);
        } else {
           alert("Only triangle and quad faces are supported at this time!");
        return undefined;
        }
      }
    }

    return {
      v: positions,
      f: indices,
    };
  }

  /**
   * Converts a polygon soup mesh to the OBJ file format.
   * @static
   * @param {Object} polygonSoup A polygon soup mesh containing vertex positions
   * and indices. Texture coordinates and normals are optional.
   * @param {module:LinearAlgebra.Vector[]} polygonSoup.v The vertex positions of the polygon soup mesh.
   * @param {module:LinearAlgebra.Vector[]} polygonSoup.vt The texture coordinates of the polygon soup mesh.
   * @param {module:LinearAlgebra.Vector[]} polygonSoup.vn The normals of the polygon soup mesh.
   * @param {number[]} polygonSoup.f The indices of the polygon soup mesh.
   * @returns {string} Text containing vertex positions, texture coordinates, normals
   * and indices in the OBJ format.
   */
  static writeOBJ(polygonSoup) {
    let output = "";

    // write positions
    let positions = polygonSoup["v"];
    let uvs = polygonSoup["vt"];
    let normals = polygonSoup["vn"];
    for (let i = 0; i < positions.length / 3; i++) {
      output +=
        "v " +
        positions[3 * i + 0] +
        " " +
        positions[3 * i + 1] +
        " " +
        positions[3 * i + 2] +
        "\n";
      if (uvs) output += "vt " + uvs[3 * i + 0] + " " + uvs[3 * i + 1] + "\n";
      if (normals)
        output +=
          "vn " +
          normals[3 * i + 0] +
          " " +
          normals[3 * i + 1] +
          " " +
          normals[3 * i + 2] +
          "\n";
    }

    // write indices
    let indices = polygonSoup["f"];
    for (let i = 0; i < indices.length; i += 3) {
      output += "f ";
      for (let j = 0; j < 3; j++) {
        let index = indices[i + j] + 1;
        output += index;
        if (uvs) output += "/" + index;
        if (!uvs && normals) output += "/";
        if (normals) output += "/" + index;
        output += " ";
      }
      output += "\n";
    }

    return output;
  }
}
