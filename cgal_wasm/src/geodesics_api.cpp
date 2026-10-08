// #include <emscripten/emscripten.h>
// EMSCRIPTEN_KEEPALIVE

#include "geodesics_solver.hpp"

extern "C"
{
    GeodesicSolver* geodesic_create()
    {
        return new GeodesicSolver();
    }

    void geodesic_destroy(GeodesicSolver* solver)
    {
        delete solver;
    }

    int geodesic_init(
        GeodesicSolver* solver,
        const float* vertices,
        int vertex_count,
        const int* faces,
        int face_count)
    {
        if (!solver)
            return 0;

        try
        {
            solver->init(
                vertices,
                vertex_count,
                faces,
                face_count);

            return 1;
        }
        catch (...)
        {
            return 0;
        }
    }

    int geodesic_compute_path(
        GeodesicSolver* solver,
        int start_face_idx,
        float start_b0,
        float start_b1,
        float start_b2,
        int end_face_idx,
        float end_b0,
        float end_b1,
        float end_b2)
    {
        if (!solver)
            return 0;

        try
        {
            return solver->compute_path(
                start_face_idx,
                start_b0,
                start_b1,
                start_b2,
                end_face_idx,
                end_b0,
                end_b1,
                end_b2);
        }
        catch (...)
        {
            return 0;
        }
    }

    float* geodesic_get_path_ptr(GeodesicSolver* solver)
    {
        if (!solver)
            return nullptr;

        return const_cast<float*>(solver->path_data());
    }

    int geodesic_get_path_size(GeodesicSolver* solver)
    {
        return solver ? solver->path_size() : 0;
    }

    int geodesic_get_face_count(GeodesicSolver* solver)
    {
        return solver ? solver->face_count() : 0;
    }
}
