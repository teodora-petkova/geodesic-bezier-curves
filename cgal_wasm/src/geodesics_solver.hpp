// geodesic_solver.hpp
#pragma once

#include <vector>
#include <variant>
#include <utility>

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

    using Graph_traits = boost::graph_traits<Mesh>;
    using Bary = Traits::Barycentric_coordinates;
    using FT = Traits::FT;
    using vertex_descriptor = typename Graph_traits::vertex_descriptor;
    using face_descriptor = typename Graph_traits::face_descriptor;
    using halfedge_descriptor = typename Graph_traits::halfedge_descriptor;
    using Simplex = std::variant<vertex_descriptor,
                                 std::pair<halfedge_descriptor, double>,
                                 std::pair<face_descriptor, Traits::Barycentric_coordinates>>;

    void init(
        const float *vertices,
        int vertex_count,
        const int *faces,
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

    const float *path_data() const;

    // const int *face_data() const;

    int path_size() const;

    // int face_count() const;

private:
    Mesh mesh_;
    Solver *solver_ = nullptr;
    // std::vector<float> path_buffer_;
    // std::vector<int> face_buffer_;
    std::vector<float> unified_path_buffer_;

    bool canonicalize_barycentric(Bary& b);
    
    // Local sequence collector matching the documentation structure
    struct LocalSequenceCollector
    {
        std::vector<Simplex> sequence;

        void operator()(halfedge_descriptor he, double alpha)
        {
            sequence.push_back(std::make_pair(he, alpha));
        }
        void operator()(vertex_descriptor v)
        {
            sequence.push_back(v);
        }
        void operator()(face_descriptor f, Traits::Barycentric_coordinates alpha)
        {
            sequence.push_back(std::make_pair(f, alpha));
        }
    };
};
