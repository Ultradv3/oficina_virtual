# WebGPU Quick Reference

Primary source: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API

## Main object flow

`navigator.gpu` → `GPU.requestAdapter()` → `GPUAdapter.requestDevice()` → `GPUDevice`

A render or compute workload generally follows:

1. Create shader module(s) from WGSL.
2. Create buffers/textures and bind groups.
3. Create a render or compute pipeline.
4. Create a command encoder and begin the relevant pass.
5. Set pipeline and resources; draw or dispatch.
6. End pass, finish command encoding, submit to `device.queue`.

## Rendering

- Canvas context: `canvas.getContext("webgpu")`
- Preferred format: `navigator.gpu.getPreferredCanvasFormat()`
- Context configuration: `context.configure({ device, format })`
- Typical stages: `@vertex` and `@fragment`

## Compute

- Shader stage: `@compute`
- Entry point often named `main`, but the pipeline descriptor must match the actual name.
- Use `dispatchWorkgroups(x, y?, z?)`.
- Guard out-of-range invocation IDs in WGSL.
- No canvas is required for compute-only tasks.

## Diagnostics

- Check `navigator.gpu` and a non-null adapter.
- Inspect WGSL compilation messages.
- Catch errors from async pipeline creation.
- Listen for `device.lost` and `uncapturederror`.
- Use error scopes for validation, out-of-memory, and internal errors.

## Compatibility and security

MDN currently marks WebGPU as having limited availability; confirm browser support for the target users. The API requires a secure context. Feature-detect instead of relying on browser names alone.
