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

    // Helper struct placed right above compute_path (or in your .cpp file)
    struct LocalPatch {
        Mesh sub_mesh;
        std::vector<face_descriptor> local_to_global_face;
        std::vector<vertex_descriptor> local_to_global_vert;
        std::vector<halfedge_descriptor> local_to_global_he;
        face_descriptor local_start_face;
        face_descriptor local_end_face;
    };

    static LocalPatch build_local_patch(
        const Mesh& full_mesh,
        face_descriptor g_start_face,
        face_descriptor g_end_face,
        std::vector<int>& visited_stamp,
        int& current_stamp,
        int padding_rings = 6)
    {
        if (visited_stamp.size() < full_mesh.number_of_faces()) {
            visited_stamp.assign(full_mesh.number_of_faces(), 0);
        }
        current_stamp++;

        std::queue<std::pair<face_descriptor, int>> q;
        std::vector<face_descriptor> selected_faces;

        visited_stamp[g_start_face.idx()] = current_stamp;
        q.push({g_start_face, 0});

        bool connected = (g_start_face == g_end_face);
        int stop_ring = connected ? padding_rings : -1;

        while (!q.empty()) {
            auto [curr_f, dist] = q.front();
            q.pop();
            selected_faces.push_back(curr_f);

            if (curr_f == g_end_face && !connected) {
                connected = true;
                stop_ring = dist + padding_rings;
            }

            if (connected && dist >= stop_ring) {
                continue;
            }

            for (auto he : CGAL::halfedges_around_face(halfedge(curr_f, full_mesh), full_mesh)) {
                auto opp = opposite(he, full_mesh);
                if (!CGAL::is_border(opp, full_mesh)) {
                    face_descriptor nf = face(opp, full_mesh);
                    if (visited_stamp[nf.idx()] != current_stamp) {
                        visited_stamp[nf.idx()] = current_stamp;
                        q.push({nf, dist + 1});
                    }
                }
            }
        }

        LocalPatch patch;
        patch.local_to_global_face.reserve(selected_faces.size());
        std::unordered_map<int, vertex_descriptor> g2l_vert;

        for (face_descriptor gf : selected_faces) {
            std::vector<vertex_descriptor> tri_verts;
            std::vector<halfedge_descriptor> global_hes;
            tri_verts.reserve(3);
            global_hes.reserve(3);

            for (auto ghe : CGAL::halfedges_around_face(halfedge(gf, full_mesh), full_mesh)) {
                global_hes.push_back(ghe);
                vertex_descriptor gv = CGAL::target(ghe, full_mesh);
                auto [it, inserted] = g2l_vert.try_emplace(gv.idx(), vertex_descriptor());
                if (inserted) {
                    vertex_descriptor lv = patch.sub_mesh.add_vertex(full_mesh.point(gv));
                    it->second = lv;
                    if (patch.local_to_global_vert.size() <= static_cast<size_t>(lv.idx())) {
                        patch.local_to_global_vert.resize(lv.idx() + 1);
                    }
                    patch.local_to_global_vert[lv.idx()] = gv;
                }
                tri_verts.push_back(it->second);
            }

            face_descriptor lf = patch.sub_mesh.add_face(tri_verts[0], tri_verts[1], tri_verts[2]);
            if (lf != Mesh::null_face()) {
                if (patch.local_to_global_face.size() <= static_cast<size_t>(lf.idx())) {
                    patch.local_to_global_face.resize(lf.idx() + 1);
                }
                patch.local_to_global_face[lf.idx()] = gf;

                if (gf == g_start_face) patch.local_start_face = lf;
                if (gf == g_end_face)   patch.local_end_face = lf;

                int idx = 0;
                for (auto lhe : CGAL::halfedges_around_face(halfedge(lf, patch.sub_mesh), patch.sub_mesh)) {
                    if (patch.local_to_global_he.size() <= static_cast<size_t>(lhe.idx())) {
                        patch.local_to_global_he.resize(lhe.idx() + 1);
                    }
                    patch.local_to_global_he[lhe.idx()] = global_hes[idx++];
                }
            }
        }

        return patch;
    }
}; // namespace

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

    std::vector<Point_3> points;
    points.reserve(static_cast<std::size_t>(vertex_count));

    for (int i = 0; i < vertex_count; ++i)
    {
        points.emplace_back(Point_3(
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
    // solver_->clear();
    solver_->remove_all_source_points();

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

    // O(1) direct handle lookup (replaces O(N) std::next)
    face_descriptor g_start_face(start_face_idx);
    face_descriptor g_end_face(end_face_idx);

    // solver_->add_source_point(Mesh::Face_index(start_face_idx), start_bary);
    // solver_->add_source_point(*start_face_it, start_bary);

    // extract local sub-mesh patch (+6 padding rings)
    LocalPatch patch = build_local_patch(
        mesh_, g_start_face, g_end_face, visited_stamp_, current_stamp_, 6);

    bool use_patch = (patch.sub_mesh.number_of_faces() > 0 &&
                      patch.sub_mesh.number_of_faces() < mesh_.number_of_faces() * 0.65);

    const Mesh& active_mesh = use_patch ? patch.sub_mesh : mesh_;
    std::unique_ptr<Solver> local_solver;
    if (use_patch) {
        local_solver = std::make_unique<Solver>(patch.sub_mesh);
    } else {
        // solver_->clear();
        solver_->remove_all_source_points();
    }
    Solver& active_solver = use_patch ? *local_solver : *solver_;

    face_descriptor active_start_face = use_patch ? patch.local_start_face : g_start_face;
    face_descriptor active_end_face   = use_patch ? patch.local_end_face   : g_end_face;

    // =========================================================================
    // WORKAROUND FOR CGAL BUG #9646: Detect exact vertex inputs and inject safely on active_mesh
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
        for (auto he : CGAL::halfedges_around_face(halfedge(active_start_face, active_mesh), active_mesh)) {
            if (i == local_idx) {
                start_v = CGAL::target(he, active_mesh);
                start_is_vertex = true;
                break;
            }
            i++;
        }
    }

    // Add source point using the safe type representation
    if (start_is_vertex) {
        active_solver.add_source_point(start_v); // directly adding vertex avoids CGAL bug!
    } else {
        active_solver.add_source_point(active_start_face, start_bary);
    }
    // =========================================================================

    active_solver.build_sequence_tree();

    LocalSequenceCollector sequence_collector;

    // Fetch the topological surface positions from CGAL
    active_solver.shortest_path_sequence_to_source_points(
        active_end_face,
        end_bary,
        sequence_collector);

    size_t step_count = sequence_collector.sequence.size();


    ///// removed for now after optimisation TODO: ???
    // int point_count = static_cast<int>(step_count);

    // // pre-allocate space for optimal performance
    // unified_path_buffer_.reserve(point_count * 5); // 3 for Barycentric, 1 for face and 1 for type

    // // std::cout << "point_count: " << point_count << std::endl;
    //////

    if (step_count == 0)
        return 0;

    // every step takes exactly 5 float-sized slots
    unified_path_buffer_.reserve(step_count * 5);

    auto unpack_visitor = [this, use_patch, &patch](auto &&arg)
    {
        using T = std::decay_t<decltype(arg)>;

        if constexpr (std::is_same_v<T, vertex_descriptor>)
        {
            vertex_descriptor gv = use_patch ? patch.local_to_global_vert[arg.idx()] : arg;
            unified_path_buffer_.push_back(0.0f); // Type: 0 = Vertex
            unified_path_buffer_.push_back(static_cast<float>(get(boost::vertex_index, mesh_)[gv]));
            unified_path_buffer_.push_back(0.0f); // padding
            unified_path_buffer_.push_back(0.0f); // padding
            unified_path_buffer_.push_back(0.0f); // padding
        }
        else if constexpr (std::is_same_v<T, std::pair<halfedge_descriptor, double>>)
        {
            halfedge_descriptor ghe = use_patch ? patch.local_to_global_he[arg.first.idx()] : arg.first;
            unified_path_buffer_.push_back(1.0f); // Type: 1 = Edge
            unified_path_buffer_.push_back(static_cast<float>(get(CGAL::halfedge_index, mesh_)[ghe]));
            unified_path_buffer_.push_back(static_cast<float>(arg.second)); // t parameter
            unified_path_buffer_.push_back(0.0f); // padding
            unified_path_buffer_.push_back(0.0f); // padding
        }
        else if constexpr (std::is_same_v<T, std::pair<face_descriptor, Traits::Barycentric_coordinates>>)
        {
            face_descriptor gf = use_patch ? patch.local_to_global_face[arg.first.idx()] : arg.first;
            unified_path_buffer_.push_back(2.0f); // Type: 2 = Face
            unified_path_buffer_.push_back(static_cast<float>(get(CGAL::face_index, mesh_)[gf]));
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
