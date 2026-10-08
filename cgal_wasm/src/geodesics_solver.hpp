// geodesic_solver.hpp
#pragma once

#include <vector>

#include <CGAL/Simple_cartesian.h>
#include <CGAL/Surface_mesh.h>
#include <CGAL/Surface_mesh_shortest_path.h>

#include <CGAL/Polygon_mesh_processing/repair_polygon_soup.h>
#include <CGAL/Polygon_mesh_processing/polygon_soup_to_polygon_mesh.h>

class GeodesicSolver
{
public:
    using Kernel = CGAL::Simple_cartesian<double>;
    using Mesh = CGAL::Surface_mesh<Kernel::Point_3>;
    using Traits =
        CGAL::Surface_mesh_shortest_path_traits<Kernel, Mesh>;
    using Solver =
        CGAL::Surface_mesh_shortest_path<Traits>;

    void init(
        const float* vertices,
        int vertex_count,
        const int* faces,
        int face_count);

    int compute_path(
        int start_face_idx,
        float start_b0,
        float start_b1,
        float start_b2,
        int end_face_idx,
        float end_b0,
        float end_b1,
        float end_b2);

    const float* path_data() const;
    int path_size() const;

    int face_count() const;

private:
    Mesh mesh_;
    Solver* solver_ = nullptr;
    std::vector<float> path_buffer_;
};
