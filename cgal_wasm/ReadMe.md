# CGAL WASM

Main steps (idea):

1.) Build a docker image containing Emscripten, dependencies, and the downloaded CGAL ZIP with boost zip
- https://hub.docker.com/r/emscripten/emsdk
- cgal releases: https://github.com/CGAL/cgal/releases
- boost releases: https://archives.boost.io/release/

2.) Reuse that container to run em++.

3.) Recompile out own C++ source whenever it changes.


## Emscripten [[docs]](https://emscripten.org/docs/introducing_emscripten/about_emscripten.html)

Emscripten is a complete Open Source compiler toolchain to WebAssembly. Using Emscripten you can compile C and C++ code, or any other language that uses LLVM, into WebAssembly, and run it on the Web, Node.js, or other Wasm runtimes.

Emscripten generates small and fast code! Its default output format is WebAssembly , a highly optimizable executable format, that runs almost as fast as native code, while being portable and safe. Emscripten does a lot of optimization work for you automatically, by careful integration with LLVM, Binaryen, Closure Compiler, and other tools.

The main tool is the Emscripten Compiler Frontend (emcc). This is a drop-in replacement for a standard compiler like gcc or clang. 

Emcc uses Clang and LLVM to compile to WebAssembly. Emcc also emits JavaScript that provides API support to the compiled code. That JavaScript can be executed by Node.js, or from within HTML in a browser.

The Emscripten SDK is used to install the entire toolchain, including emcc and LLVM and so forth. The Emscripten SDK (emsdk) can be used on Linux, Windows or MacOS.






