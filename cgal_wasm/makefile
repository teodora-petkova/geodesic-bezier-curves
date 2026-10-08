build_test: build test

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

wasm:
	docker compose exec compiler \
		em++ \
		-std=c++17 \
		-O3 \
		-I/opt/cgal/CGAL-6.2.1/include \
		-I/opt/boost \
		-I/usr/include/eigen3 \
		./src/geodesics_api.cpp \
		./src/geodesics_solver.cpp \
		-o ./compiled/geodesics.js \
		-s WASM=1 \
		-s "EXPORTED_FUNCTIONS=['_geodesic_create','_geodesic_destroy','_geodesic_init','_geodesic_compute_path','_geodesic_get_path_ptr','_geodesic_get_path_size','_geodesic_get_face_count','_malloc','_free']" \
		-s "EXPORTED_RUNTIME_METHODS=['cwrap','HEAPF32','HEAP32']" \
		-s MODULARIZE=1 \
		-s EXPORT_ES6=1 \
		-s ASSERTIONS=2 \
		-s ALLOW_MEMORY_GROWTH=1 \
		-DCGAL_DISABLE_GMP \
		-DCGAL_DISABLE_ROUNDING_MATH_CHECK \
		-DCGAL_ALWAYS_ROUND_TO_NEAREST

clean:
	docker compose exec compiler \
		rm -rf ./build
