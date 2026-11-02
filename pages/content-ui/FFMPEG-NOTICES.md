# Bundled video encoder

Recording trim and MP4 conversion run locally using `@ffmpeg/ffmpeg` 0.12.15 (MIT) and the single-threaded `@ffmpeg/core` 0.12.10 (GPL-2.0-or-later). The core includes FFmpeg and its enabled codec libraries, including libx264. The original project is available at <https://github.com/ffmpegwasm/ffmpeg.wasm>; its build recipes and component license information are maintained there. The FFmpeg project's license and source information are at <https://ffmpeg.org/legal.html> and <https://ffmpeg.org/download.html#get-sources>.

The extension packages the encoder JavaScript and WebAssembly locally and never downloads executable encoder code at runtime. Redistributors must comply with the bundled components' licenses, including applicable corresponding-source obligations. This notice does not change the license of the extension's original source files.
