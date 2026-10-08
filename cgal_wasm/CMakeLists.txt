cmake_minimum_required(VERSION 3.20)
project(cgal_geodesic LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 1. Find Packages (CMake will look inside CMAKE_PREFIX_PATH for these)
# find_package(GMP REQUIRED)
# find_package(MPFR REQUIRED)
find_package(CGAL REQUIRED)
find_package(Eigen3 REQUIRED)
find_package(GTest REQUIRED) 

# 2. Define the executable
add_executable(test_geodesics
    src/geodesics_solver.cpp
    tests/test_geodesics.cpp
)

# 3. Include local project headers 
# (You can remove /opt/cgal and /opt/boost paths here; find_package handles them)
target_include_directories(test_geodesics PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src
)

# 4. Link Libraries (This fixes BOTH CGAL dependencies and the GTest linker errors)
target_link_libraries(test_geodesics PRIVATE
    CGAL::CGAL
    Eigen3::Eigen
    GTest::gtest
    GTest::gtest_main
    gmp
    mpfr
)
