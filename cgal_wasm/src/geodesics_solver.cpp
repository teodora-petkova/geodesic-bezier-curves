// geodesics_solver.cpp
#include "geodesics_solver.hpp"

#include <cmath>
#include <stdexcept>

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
}

void GeodesicSolver::init(
    const float *vertices,
    int vertex_count,
    const int *faces,
    int face_count)
{
    if (!vertices || !faces ||
        vertex_count < 0 ||
        face_count < 0)
    {
        throw std::invalid_argument("Invalid mesh input");
    }

    mesh_.clear();
    path_buffer_.clear();

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

    if (start_face_idx < 0 ||
        end_face_idx < 0 ||
        start_face_idx >= static_cast<int>(mesh_.number_of_faces()) ||
        end_face_idx >= static_cast<int>(mesh_.number_of_faces()))
    {
        return 0;
    }

    if (!valid_barycentric(start_b0, start_b1, start_b2) ||
        !valid_barycentric(end_b0, end_b1, end_b2))
    {
        return 0;
    }

    path_buffer_.clear();

    Traits::Barycentric_coordinates start_bary =
        {{start_b0, start_b1, start_b2}};

    Traits::Barycentric_coordinates end_bary =
        {{end_b0, end_b1, end_b2}};

    solver_->clear();

    solver_->add_source_point(
        Mesh::Face_index(start_face_idx),
        start_bary);

    solver_->build_sequence_tree();

    std::vector<Kernel::Point_3> path_points;

    solver_->shortest_path_points_to_source_points(
        Mesh::Face_index(end_face_idx),
        end_bary,
        std::back_inserter(path_points));

    path_buffer_.reserve(path_points.size() * 3);

    for (const auto &point : path_points)
    {
        path_buffer_.push_back(
            static_cast<float>(point.x()));

        path_buffer_.push_back(
            static_cast<float>(point.y()));

        path_buffer_.push_back(
            static_cast<float>(point.z()));
    }

    return static_cast<int>(path_buffer_.size());
}

const float *GeodesicSolver::path_data() const
{
    return path_buffer_.empty()
               ? nullptr
               : path_buffer_.data();
}

int GeodesicSolver::path_size() const
{
    return static_cast<int>(path_buffer_.size());
}

int GeodesicSolver::face_count() const
{
    return static_cast<int>(mesh_.number_of_faces());
}
