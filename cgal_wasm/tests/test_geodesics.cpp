#include "../src/geodesics_solver.hpp"

#include <gtest/gtest.h>
#include <cmath>
#include <iostream>

// --- Helper Functions ---
void ASSERT_POINT(
    const float* path,
    int point_index,
    float expected_x,
    float expected_y,
    float expected_z)
{
    const int offset = point_index * 3;
    EXPECT_NEAR(path[offset + 0], expected_x, 1e-4f);
    EXPECT_NEAR(path[offset + 1], expected_y, 1e-4f);
    EXPECT_NEAR(path[offset + 2], expected_z, 1e-4f);
}

void print_path(const float* path, int float_count)
{
    const int point_count = float_count / 3;
    for (int i = 0; i < point_count; ++i)
    {
        std::cout << i << ": "
                  << path[i * 3 + 0] << ", "
                  << path[i * 3 + 1] << ", "
                  << path[i * 3 + 2] << '\n';
    }
}

// --- The Test Fixture Class ---
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


TEST_F(GeodesicSolverTest, FindsPathOnSquare_SameFace_FoundEdge)
{
    ASSERT_EQ(solver.face_count(), 2);

    // Source: face 0, barycentric (1, 0, 0) = vertex 0 = (0, 0, 0)
    // Target: face 0, barycentric (0, 0, 1) = vertex 2 = (1, 1, 0)
    int float_count = solver.compute_path(
        0, 1.0f, 0.0f, 0.0f,
        0, 0.0f, 0.0f, 1.0f);

    ASSERT_GT(float_count, 0);
    ASSERT_EQ(float_count % 3, 0);

    const float* path = solver.path_data();
    ASSERT_NE(path, nullptr);

    ASSERT_POINT(path, 0, 1.0f, 0.0f, 0.0f);
    ASSERT_POINT(path, 1, 1.0f, 1.0f, 0.0f);

    std::cout << "Same face path:\n";
    print_path(path, float_count);
}

TEST_F(GeodesicSolverTest, FindsPathOnSquare_CrossFace_FoundCrossedEdgePoint)
{
    // Source: face 0, barycentric (0, 0.5, 0.5) = middle of edge [v1, v2]
    // Target: face 1, barycentric (0.5, 0, 0.5) = middle of edge [v0, v3]
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
    int float_count = solver.compute_path(
        0, 0.0f, 0.5f, 0.5f,
        1, 0.5f, 0.0f, 0.5f);

    ASSERT_GT(float_count, 0);
    ASSERT_EQ(float_count % 3, 0);

    const float* path = solver.path_data();
    ASSERT_NE(path, nullptr);

    ASSERT_POINT(path, 0, 0.5f, 1.0f, 0.0f);
    ASSERT_POINT(path, 1, 0.5f, 0.5f, 0.0f);
    ASSERT_POINT(path, 2, 0.5f, 0.0f, 0.0f);
    
    std::cout << "Cross-face path:\n";
    print_path(path, float_count);
}
