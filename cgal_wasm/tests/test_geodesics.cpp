#include "../src/geodesics_solver.hpp"

#include <gtest/gtest.h>
#include <cmath>
#include <iostream>

void ASSERT_PATH(
    const float* path, int count, const float* expected_path, int expected_count)
{
    EXPECT_EQ(count, expected_count);
    for (int i = 0; i < count; ++i)
    {
        EXPECT_NEAR(path[i * 5 + 0], expected_path[i * 5 + 0], 1e-4f);
        EXPECT_NEAR(path[i * 5 + 1], expected_path[i * 5 + 1], 1e-4f);
        EXPECT_NEAR(path[i * 5 + 2], expected_path[i * 5 + 2], 1e-4f);
        EXPECT_NEAR(path[i * 5 + 3], expected_path[i * 5 + 3], 1e-4f);
        EXPECT_NEAR(path[i * 5 + 4], expected_path[i * 5 + 4], 1e-4f);
    }
}

void print_path(const float* path, int float_count)
{
    const int point_count = float_count;//* 5;
    for (int i = 0; i < point_count; ++i)
    {
        std::cout << i << ": "
                  << path[i * 5 + 0] << ", "
                  << path[i * 5 + 1] << ", "
                  << path[i * 5 + 2] << ", "
                  << path[i * 5 + 3] << ", "
                  << path[i * 5 + 4] << '\n';
    }
}

class GeodesicSolverTest : public ::testing::Test 
{
protected:
    GeodesicSolver solver;

    void SetUp() override 
    {
        /*
            3 -------- 2
            |        / |
            |      /   |
            |    /     |
            |  /       |
            0 -------- 1

            face 0 = (0, 1, 2)
            face 1 = (0, 2, 3)
        */
        static const float vertices[] = {
            0.0f, 0.0f, 0.0f, // vertex 0
            1.0f, 0.0f, 0.0f, // vertex 1
            1.0f, 1.0f, 0.0f, // vertex 2
            0.0f, 1.0f, 0.0f  // vertex 3
        };

        static const int faces[] = {
            0, 1, 2,
            0, 2, 3
        };

        // Initialize the shared solver instance
        solver.init(vertices, 4, faces, 2);
    }

    // Optional: Cleans up resources after each test runs
    void TearDown() override 
    {
        // cleanup code here
    }
};


TEST_F(GeodesicSolverTest, FindsPathOnSquare_BetweenTwoVerticesInSameFace_FoundFaceEdge)
{
    /*
            3 -------- 2
            |        / |
            |      /   |
            |    /     |
            |  /       |
            0 -------- 1

            face 0 = (0, 1, 2)
            face 1 = (0, 2, 3)
    */
    // Source: face 0, barycentric (1, 0, 0) = vertex 0 = (0, 0, 0)
    // Target: face 0, barycentric (0, 0, 1) = vertex 2 = (1, 1, 0)
    int count = solver.compute_path(
        0, 1.0f, 0.0f, 0.0f,  // face bary coords
        0, 0.0f, 0.0f, 1.0f); // face bary coords

    ASSERT_GT(count, 0);
    ASSERT_EQ(count, 2);

    const float* path = solver.path_data();
    ASSERT_NE(path, nullptr);

    // std::cout << "face path:\n";
    // print_path(path, count);

    static const float expected_path[][5] = {
        {2, 0, 0.0f, 0.0f, 1.0f}, // face => Vertex = 2
        {0, 0, 0.0f, 0.0f, 0.0f}, // vertex => Vertex = 0
    };

    ASSERT_PATH(path, count, &expected_path[0][0], 2); 
}


TEST_F(GeodesicSolverTest, FindsPathOnSquare_BetweenTwoFaceCentroids_FoundCrossedEdgePoint)
{
    /*
            3 -------- 2
            |   \   /  |
            |    \ /   |
            |    /\    |
            |  /   \   |
            0 -------- 1

            face 0 = (0, 1, 2)
            face 1 = (0, 2, 3)
    */
    int count = solver.compute_path(
        0, 0.333f, 0.333f, 0.334f, // Start: Face 0, Centroid
        1, 0.333f, 0.333f, 0.334f  // End: Face 1, Centroid
    );

    ASSERT_GT(count, 0);
    ASSERT_EQ(count, 3);

    const float* path = solver.path_data();
    ASSERT_NE(path, nullptr);

    // std::cout << "face path:\n";
    // print_path(path, count);

    static const float expected_path[][5] = {
        {2, 1, 0.333, 0.333, 0.334}, // face
        {1, 5, 0.50025, 0, 0},       // edge
        {2, 0, 0.333, 0.333, 0.334}, // face
    };

    ASSERT_PATH(path, count, &expected_path[0][0], 3);
}


TEST_F(GeodesicSolverTest, FindsPathOnSquare_BetweenFaceCentroidAndFaceEdge_FoundCrossedEdgePoint)
{
    /*
            3 -------- 2
            |       /  |
            |_____/__  |
            |    /     |
            |  /       |
            0 -------- 1

            face 0 = (0, 1, 2)
            face 1 = (0, 2, 3)
    */
    int count = solver.compute_path(
        0, 0.333f, 0.333f, 0.334f, // Start: Face 0, Centroid
        1, 0.5f, 0.0, 0.5f         // End: Face 1, Centroid
    );

    ASSERT_GT(count, 0);
    ASSERT_EQ(count, 3);

    const float* path = solver.path_data();
    ASSERT_NE(path, nullptr);

    // std::cout << "face path:\n";
    // print_path(path, count);

    static const float expected_path[][5] = {
        {2, 1, 0.5, 0.0, 0.5},       // face
        {1, 5, 0.60012, 0, 0},       // edge
        {2, 0, 0.333, 0.333, 0.334}, // face
    };

    ASSERT_PATH(path, count, &expected_path[0][0], 3);
}


TEST_F(GeodesicSolverTest, FindsPathOnSquare_BetweenMidpointsOfTwoFaceEdges_FoundCrossedEdgePoint)
{
    /*
            3 -------- 2
            |        / |
            |______/___|
            |    /     |
            |  /       |
            0 -------- 1

            face 0 = (0, 1, 2)
            face 1 = (0, 2, 3)
    */
     int count = solver.compute_path(
        0, 0.0f, 0.5f, 0.5f, // Source: face 0 = middle of edge [v1, v2]
        1, 0.5f, 0.0f, 0.5f  // Target: face 1 = middle of edge [v0, v3]
    );

    ASSERT_GT(count, 0);
    ASSERT_EQ(count, 3);

    const float* path = solver.path_data();
    ASSERT_NE(path, nullptr);

    // std::cout << "face path:\n";
    // print_path(path, count);

    static const float expected_path[][5] = {
        {2, 1, 0.5, 0.0, 0.5}, // face
        {1, 5, 0.5, 0.0, 0.0}, // edge
        {2, 0, 0.0, 0.5, 0.5}, // face
    };

    ASSERT_PATH(path, count, &expected_path[0][0], 3);
}