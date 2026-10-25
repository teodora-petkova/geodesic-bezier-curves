all: clean_build build clean_wasm wasm

build:
	# run CMake and provide the paths to /opt installations
	docker compose exec compiler \
		cmake -S . -B ./build \
    		-DCMAKE_BUILD_TYPE=Debug \
    		-DCMAKE_PREFIX_PATH="/opt/cgal/CGAL-6.2.1;/opt/boost"

	# build the project
	docker compose exec compiler \
		cmake --build ./build -j$$(nproc)

test:
	docker compose exec compiler \
		./build/test_geodesics

# Default compiler and core flags shared by both environments
EM_EXEC = docker compose exec compiler em++
STD     = -std=c++17
INCLUDES = -I/opt/cgal/CGAL-6.2.1/include -I/opt/boost -I/usr/include/eigen3
SRCS     = ./src/geodesics_api.cpp ./src/geodesics_solver.cpp
OUT      = ./compiled/geodesics.js

# Shared Emscripten configuration settings
EMSCRIPTEN_FLAGS = \
	-s FORCE_FILESYSTEM=1 \
	-s PRINTF_LONG_DOUBLE=1 \
	-s WASM=1 \
	-s "EXPORTED_FUNCTIONS=['_geodesic_create','_geodesic_destroy','_geodesic_init','_geodesic_compute_path','_geodesic_get_path_ptr','_geodesic_get_path_size','_malloc','_free']" \
	-s "EXPORTED_RUNTIME_METHODS=['cwrap','HEAPF32','HEAP32']" \
	-s MODULARIZE=1 \
	-s EXPORT_ES6=1 \
	-s ALLOW_MEMORY_GROWTH=1 \
	-DCGAL_DISABLE_GMP \
	-DCGAL_DISABLE_ROUNDING_MATH_CHECK \
	-DCGAL_ALWAYS_ROUND_TO_NEAREST

# --- Target-Specific Flag Definitions ---

# Debug configuration: Full source maps, no optimizations, verbose runtime checks
wasm_debug: OPT_FLAGS = -O0 -g4
wasm_debug: ASSERT_FLAGS = -s ASSERTIONS=2

# Production configuration: Maximum optimization, minified output, strip debug symbols
wasm_release: OPT_FLAGS = -O3
wasm_release: ASSERT_FLAGS = -s ASSERTIONS=0

# --- Build Targets ---

.PHONY: all debug release clean

all: debug

wasm_debug: wasm_compile
	@echo "WASM debug build finished successfully."

wasm_release: wasm_compile
	@echo "WASM production build finished successfully."

wasm_compile:
	$(EM_EXEC) $(STD) $(OPT_FLAGS) $(ASSERT_FLAGS) $(EMSCRIPTEN_FLAGS) $(INCLUDES) $(SRCS) -o $(OUT)


clean_build:
	docker compose exec compiler \
		rm -rf ./build

clean_wasm:
	docker compose exec compiler \
		rm -f ./compiled/geodesics.js ./compiled/geodesics.wasm
	docker compose exec compiler \
		emcc --clear-cache

