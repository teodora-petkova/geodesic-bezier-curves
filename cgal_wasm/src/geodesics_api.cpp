#include <emscripten/emscripten.h>

#include <iostream>
#include <cstdio>

#include "geodesics_solver.hpp"

extern "C"
{
    EMSCRIPTEN_KEEPALIVE
    GeodesicSolver* geodesic_create()
    {
        // // force stdout to be completely unbuffered ONCE globally
        // std::setvbuf(stdout, NULL, _IONBF, 0);
        // std::setvbuf(stderr, NULL, _IONBF, 0);
        
        // // sync standard C streams with C++ streams
        // std::ios_base::sync_with_stdio(false);

        // std::cout << "Explicitly forced browser console log." << std::endl;

        return new GeodesicSolver();
    }

    EMSCRIPTEN_KEEPALIVE
    void geodesic_destroy(GeodesicSolver* solver)
    {
        delete solver;
    }

    EMSCRIPTEN_KEEPALIVE
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
        catch (const std::exception& e)
        {
            // Catches out_of_range, invalid_argument, and standard CGAL internal exceptions
            std::cerr << "GeodesicSolver Error: " << e.what() << std::endl;
            return 0;
        }
        catch (...)
        {
            return 0;
        }
    }

    EMSCRIPTEN_KEEPALIVE
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
        catch (const std::exception& e)
        {
            // Catches out_of_range, invalid_argument, and standard CGAL internal exceptions
            std::cerr << "GeodesicSolver Error: " << e.what() << std::endl;
            return 0;
        }
        catch (...)
        {
            // Fallback for non-standard or raw third-party system exceptions
            std::cerr << "GeodesicSolver Error: Unknown critical exception encountered." << std::endl;
            return 0;
        }
    }

    EMSCRIPTEN_KEEPALIVE
    float* geodesic_get_path_ptr(GeodesicSolver* solver)
    {
        if (!solver)
            return nullptr;

        return const_cast<float*>(solver->path_data());
    }

    // EMSCRIPTEN_KEEPALIVE
    // int* geodesic_get_face_ptr(GeodesicSolver* solver)
    // {
    //         if (!solver)
    //         return nullptr;

    //     return const_cast<int*>(solver->face_data());
    // }

    EMSCRIPTEN_KEEPALIVE
    int geodesic_get_path_size(GeodesicSolver* solver)
    {
        return solver ? solver->path_size() : 0;
    }

    // EMSCRIPTEN_KEEPALIVE
    // int geodesic_get_face_count(GeodesicSolver* solver)
    // {
    //     return solver ? solver->face_count() : 0;
    // }
    
}
