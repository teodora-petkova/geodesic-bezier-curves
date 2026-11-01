// geodesics_solver.cpp
#include "geodesics_solver.hpp"

#include <cmath>
#include <stdexcept>
#include <iostream>
#include <cstdio>

namespace
{
    bool valid_barycentric(float b0, float b1, float b2)
    {
        constexpr float epsilon = 1e-5f;

        if (!std::isfinite(b0) ||
            !std::isfinite(b1) ||
            !std::isfinite(b2))
        {
            return false;
        }

        if (std::abs((b0 + b1 + b2) - 1.0f) > epsilon)
            return false;

        return b0 >= -epsilon &&
               b1 >= -epsilon &&
               b2 >= -epsilon;
    }
};

bool GeodesicSolver::canonicalize_barycentric(Bary &b)
{
    const FT eps(1e-6);

    for (int i = 0; i < 3; ++i)
    {
        // reject weights that are clearly outside the triangle
        if (b[i] < -eps || b[i] > FT(1) + eps)
            return false;

        // treat tiny values as exactly zero
        if (CGAL::abs(b[i]) <= eps)
            b[i] = FT(0);
    }

    // count zero weights + remember where they are
    int zeroCount = 0;
    int zeroIndex = -1;
    int nonzeroIndex = -1;

    for (int i = 0; i < 3; ++i)
    {
        if (b[i] == FT(0))
        {
            ++zeroCount;
            zeroIndex = i;
        }
        else
        {
            nonzeroIndex = i;
        }
    }

    // all-zero weights do not describe a point
    if (zeroCount == 3)
        return false;

    // two zero weights means the point is at a vertex
    if (zeroCount == 2)
    {
        b = {{FT(0), FT(0), FT(0)}};
        b[nonzeroIndex] = FT(1);
        return true;
    }

    // one zero weight means the point is on an edge
    if (zeroCount == 1)
    {
        const int i = (zeroIndex + 1) % 3;
        const int j = (zeroIndex + 2) % 3;
        const FT sum = b[i] + b[j];

        if (sum == FT(0))
            return false;

        b[i] /= sum;
        b[j] = FT(1) - b[i];
        return true;
    }

    int zero = -1;
    for (int i = 0; i < 3; ++i)
    {
        if (b[i] == FT(0))
        {
            if (zero != -1)
            {
                // Vertex: two weights are zero.
                const int vertex = 3 - zero - i;
                b = {{FT(0), FT(0), FT(0)}};
                b[vertex] = FT(1);
                return true;
            }
            zero = i;
        }
    }
    
    // no zero weights means the point is inside the triangle
    const FT sum = b[0] + b[1] + b[2];

    if (sum == FT(0))
        return false;

    b[0] /= sum;
    b[1] /= sum;
    b[2] = FT(1) - b[0] - b[1];

    return true;
}

void GeodesicSolver::init(
    const float *vertices,
    int vertex_count,
    const int *faces,
    int face_count)
{
    std::setvbuf(stdout, NULL, _IONBF, 0);

    if (!vertices || !faces ||
        vertex_count < 0 ||
        face_count < 0)
    {
        throw std::invalid_argument("Invalid mesh input");
    }

    mesh_.clear();
    unified_path_buffer_.clear();

    delete solver_;
    solver_ = nullptr;

    std::vector<Kernel::Point_3> points;
    points.reserve(static_cast<std::size_t>(vertex_count));

    for (int i = 0; i < vertex_count; ++i)
    {
        points.emplace_back(Kernel::Point_3(
            vertices[i * 3 + 0],
            vertices[i * 3 + 1],
            vertices[i * 3 + 2]));
    }

    std::vector<std::vector<std::size_t>> polygons;
    polygons.reserve(static_cast<std::size_t>(face_count));

    for (int i = 0; i < face_count; ++i)
    {
        const int a = faces[i * 3 + 0];
        const int b = faces[i * 3 + 1];
        const int c = faces[i * 3 + 2];

        if (a < 0 || b < 0 || c < 0 ||
            a >= vertex_count ||
            b >= vertex_count ||
            c >= vertex_count)
        {
            throw std::invalid_argument("Face references invalid vertex");
        }

        polygons.push_back({static_cast<std::size_t>(a),
                            static_cast<std::size_t>(b),
                            static_cast<std::size_t>(c)});
    }

    // Repairing/orienting can modify element topologies and sequence IDs.

    CGAL::Polygon_mesh_processing::repair_polygon_soup(
        points,
        polygons);

    CGAL::Polygon_mesh_processing::orient_polygon_soup(
        points,
        polygons);

    CGAL::Polygon_mesh_processing::polygon_soup_to_polygon_mesh(
        points,
        polygons,
        mesh_);

    solver_ = new Solver(mesh_);
}

int GeodesicSolver::compute_path(
    int start_face_idx,
    float start_b0,
    float start_b1,
    float start_b2,
    int end_face_idx,
    float end_b0,
    float end_b1,
    float end_b2)
{
    if (!solver_)
        return 0;

    int total_faces = static_cast<int>(mesh_.number_of_faces());
    if (start_face_idx < 0 || end_face_idx < 0 ||
        start_face_idx >= total_faces || end_face_idx >= total_faces)
    {
        return 0;
    }

    if (!valid_barycentric(start_b0, start_b1, start_b2) ||
        !valid_barycentric(end_b0, end_b1, end_b2))
    {
        return 0;
    }

    // clear both persistent buffers
    unified_path_buffer_.clear();
    solver_->clear();

    Bary start_bary = {{FT(start_b0), FT(start_b1), FT(start_b2)}};
    Bary end_bary = {{FT(end_b0), FT(end_b1), FT(end_b2)}};

    if (!canonicalize_barycentric(start_bary) ||
        !canonicalize_barycentric(end_bary))
    {
        std::cout << "Coordinates are not cannonical: " <<
            "(" << start_b0 << ", " << start_b1 << ", " << start_b2 << "), " <<
            "(" << end_b0 << ", " << end_b1 << ", " << end_b2 << ")" << std::endl;
        return 0;
    }

    // map the indices to the true CGAL face handles safely
    auto face_range = CGAL::faces(mesh_);
    auto start_face_it = std::next(face_range.begin(), start_face_idx);
    auto end_face_it = std::next(face_range.begin(), end_face_idx);

    // solver_->add_source_point(Mesh::Face_index(start_face_idx), start_bary);
    // solver_->add_source_point(*start_face_it, start_bary);
    
    // =========================================================================
    // WORKAROUND FOR CGAL BUG #9646: Detect exact vertex inputs and inject safely
    // =========================================================================
    constexpr float eps = 1e-4f;
    bool start_is_vertex = false;
    vertex_descriptor start_v;

    // Check if the source point is exactly on a vertex corner
    int local_idx = -1;
    if (std::abs(start_b0 - 1.0f) < eps) local_idx = 0;
    else if (std::abs(start_b1 - 1.0f) < eps) local_idx = 1;
    else if (std::abs(start_b2 - 1.0f) < eps) local_idx = 2;

    if (local_idx >= 0) {
        int i = 0;
        for (auto he : CGAL::halfedges_around_face(halfedge(*start_face_it, mesh_), mesh_)) {
            if (i == local_idx) {
                start_v = CGAL::target(he, mesh_);
                start_is_vertex = true;
                break;
            }
            i++;
        }
    }

    // Add source point using the safe type representation
    if (start_is_vertex) {
        solver_->add_source_point(start_v); // Directly adding vertex avoids CGAL bug!
    } else {
        solver_->add_source_point(*start_face_it, start_bary);
    }
    // =========================================================================

    solver_->build_sequence_tree();

    LocalSequenceCollector sequence_collector;

    // Fetch the topological surface positions from CGAL
    solver_->shortest_path_sequence_to_source_points(
        // Mesh::Face_index(end_face_idx),
        *end_face_it,
        end_bary,
        sequence_collector);

    size_t step_count = sequence_collector.sequence.size();
    int point_count = static_cast<int>(step_count);

    // pre-allocate space for optimal performance
    unified_path_buffer_.reserve(point_count * 5); // 3 for Barycentric, 1 for face and 1 for type

    // std::cout << "point_count: " << point_count << std::endl;

    if (step_count == 0)
        return 0;

    // Every step takes exactly 5 float-sized slots
    unified_path_buffer_.reserve(step_count * 5);

    auto unpack_visitor = [this](auto &&arg)
    {
        using T = std::decay_t<decltype(arg)>;

        if constexpr (std::is_same_v<T, vertex_descriptor>)
        {
            unified_path_buffer_.push_back(0.0f); // Type: 0 = Vertex
            unified_path_buffer_.push_back(static_cast<float>(get(boost::vertex_index, mesh_)[arg]));
            unified_path_buffer_.push_back(0.0f); // Padding
            unified_path_buffer_.push_back(0.0f); // Padding
            unified_path_buffer_.push_back(0.0f); // Padding
        }
        else if constexpr (std::is_same_v<T, std::pair<halfedge_descriptor, double>>)
        {
            unified_path_buffer_.push_back(1.0f); // Type: 1 = Edge
            unified_path_buffer_.push_back(static_cast<float>(get(CGAL::halfedge_index, mesh_)[arg.first]));
            unified_path_buffer_.push_back(static_cast<float>(arg.second)); // t parameter
            unified_path_buffer_.push_back(0.0f);                           // Padding
            unified_path_buffer_.push_back(0.0f);                           // Padding
        }
        else if constexpr (std::is_same_v<T, std::pair<face_descriptor, Traits::Barycentric_coordinates>>)
        {
            unified_path_buffer_.push_back(2.0f); // Type: 2 = Face
            unified_path_buffer_.push_back(static_cast<float>(get(CGAL::face_index, mesh_)[arg.first]));
            unified_path_buffer_.push_back(static_cast<float>(arg.second[0])); // b0
            unified_path_buffer_.push_back(static_cast<float>(arg.second[1])); // b1
            unified_path_buffer_.push_back(static_cast<float>(arg.second[2])); // b2
        }
    };

    for (const auto &simplex : sequence_collector.sequence)
    {
        std::visit(unpack_visitor, simplex);
    }

    // std::cout << "--- All Mesh Faces and Vertices ---\n";
    // for (auto f : CGAL::faces(mesh_))
    // {
    //     std::cout << "Face " << get(CGAL::face_index, mesh_)[f] << ": ";
    //     for (auto he : CGAL::halfedges_around_face(
    //              halfedge(f, mesh_), mesh_))
    //     {
    //         auto v = CGAL::target(he, mesh_);
    //         std::cout << get(boost::vertex_index, mesh_)[v] << " ";
    //     }
    //     std::cout << "\n";
    // }
    // std::cout << "------------------------------------\n";

    // std::cout << "--- Real 3D Coordinates of Face 0 Vertices ---\n";
    // // auto face_range = CGAL::faces(mesh_);
    // if (!face_range.empty())
    // {
    //     auto f0 = *face_range.begin(); // Get Face 0 handle
    //     int local_idx = 0;
    //     for (auto he : CGAL::halfedges_around_face(halfedge(f0, mesh_), mesh_))
    //     {
    //         auto v = CGAL::target(he, mesh_);
    //         auto pt = mesh_.point(v); // Get the 3D Point

    //         std::cout << "Local Position [" << local_idx << "] -> Internal Vertex ID "
    //                   << get(boost::vertex_index, mesh_)[v]
    //                   << " is at: (" << pt.x() << ", " << pt.y() << ", " << pt.z() << ")\n";
    //         local_idx++;
    //     }
    // }
    // std::cout << "----------------------------------------------\n";

    return static_cast<int>(step_count); // Returns the total number of points
}

const float *GeodesicSolver::path_data() const
{
    return unified_path_buffer_.empty() ? nullptr : unified_path_buffer_.data();
}

int GeodesicSolver::path_size() const
{
    return static_cast<int>(unified_path_buffer_.size());
}
