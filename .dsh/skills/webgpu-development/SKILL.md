---
name: webgpu-development
description: Implement, debug, review, and optimize browser-side WebGPU rendering and GPU compute using JavaScript or TypeScript and WGSL. Use when a task involves navigator.gpu, GPUAdapter, GPUDevice, GPUBuffer, GPUTexture, render pipelines, compute pipelines, WGSL shaders, or WebGPU compatibility and errors.
---

# WebGPU Development Skill

## Purpose

Help the agent build correct, maintainable, and performant applications using the browser WebGPU API. Use the official MDN documentation as the primary API reference:
https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API

For exact method signatures, descriptors, limits, features, and browser support, consult the relevant MDN interface pages and the WebGPU specification rather than guessing.

## Working rules

1. **Inspect the project first.** Identify the framework, JavaScript/TypeScript version, bundler, browser targets, existing rendering libraries, and code conventions. Make the smallest compatible change.
2. **Check availability before use.** WebGPU support varies by browser and requires a secure context (normally HTTPS; localhost is generally treated as trustworthy for development). Check `navigator.gpu`, then check whether `requestAdapter()` returns an adapter.
3. **Fail gracefully.** Provide a clear fallback or an actionable message if WebGPU or a requested capability is unavailable. Do not assume every browser/device supports the API.
4. **Request only required capabilities.** Inspect adapter/device features and limits. Request optional features only when needed and only after verifying support.
5. **Use WGSL for shaders.** Validate entry-point names, binding indices, resource types, workgroup sizes, buffer sizes, alignment, and shader-visible data layouts.
6. **Choose the right pipeline.**
   - Render pipeline: vertex/fragment stages for drawing.
   - Compute pipeline: `@compute` WGSL stage for general parallel computation; no canvas is required.
7. **Respect GPU resource ownership.** Create buffers, textures, bind groups, and pipelines with matching usage flags and layouts. Destroy resources when their lifecycle ends; avoid leaking per-frame resources.
8. **Handle errors intentionally.** Listen for `device.lost`; handle rejected async pipeline creation and other promises; use `pushErrorScope()` / `popErrorScope()` around operations when useful; listen for `uncapturederror` during development.
9. **Avoid synchronous GPU readback in hot paths.** GPU-to-CPU readback can stall or add latency. For compute readback, use a staging buffer with appropriate `MAP_READ | COPY_DST` usage and a copy command, then map it after submission.
10. **Measure before optimizing.** Separate CPU encoding time, GPU execution time where measurable, shader compilation, data upload, and readback. Benchmark representative workloads and compare against a CPU or existing implementation.
11. **Keep security and privacy in mind.** Do not send user data to external services unless the project explicitly requires it. Treat shaders, images, and imported data as untrusted inputs.
12. **Do not invent API details.** If uncertain, consult the relevant MDN reference/specification and state any compatibility caveat.

## Standard implementation workflow

1. Inspect the current codebase and identify whether the goal is rendering, compute, or both.
2. Check browser support and secure-context requirements.
3. Request an adapter with appropriate preferences only if the workload warrants it.
4. Request a device with only the required optional features and limits.
5. Create WGSL shader modules and inspect compilation diagnostics when available.
6. Create GPU resources with correct sizes and `GPUBufferUsage` / `GPUTextureUsage` flags.
7. Create bind-group layouts, bind groups, and render/compute pipelines.
8. Encode commands using `GPUCommandEncoder`; begin the relevant pass; set pipeline/resources; dispatch workgroups or issue draw calls; end the pass; finish and submit the command buffer.
9. Verify output, test errors and unsupported environments, and clean up resources.
10. Report what changed, how it was tested, limitations, and any performance measurements.

## Initialization pattern

Use this as a starting point, adapting it to the project. Do not assume the adapter exists.

```ts
export async function createWebGPUDevice(): Promise<{
  adapter: GPUAdapter;
  device: GPUDevice;
}> {
  if (!("gpu" in navigator) || !navigator.gpu) {
    throw new Error(
      "WebGPU is unavailable. Use a supported browser and a secure context."
    );
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: "high-performance",
  });

  if (!adapter) {
    throw new Error(
      "No WebGPU adapter is available. Check browser, OS, and GPU support."
    );
  }

  const device = await adapter.requestDevice();

  device.addEventListener("uncapturederror", (event) => {
    console.error("Uncaptured WebGPU error:", event.error);
  });

  device.lost.then((info) => {
    console.error("WebGPU device lost:", info.reason, info.message);
    // Reinitialize the device if the application lifecycle requires it.
  });

  return { adapter, device };
}
```

## Render pipeline checklist

- Obtain a canvas and request `canvas.getContext("webgpu")`; handle `null`.
- Configure the context with the device and `navigator.gpu.getPreferredCanvasFormat()`.
- Keep canvas pixel dimensions synchronized with CSS size and device pixel ratio, while capping extreme dimensions if necessary.
- Create WGSL vertex and fragment entry points matching the pipeline descriptor.
- Ensure vertex buffer formats, offsets, and `arrayStride` match the WGSL inputs.
- For each frame, obtain the current texture view, encode the render pass, bind the pipeline and resources, draw, end, and submit.
- Reconfigure or resize safely when canvas dimensions change; unconfigure when the context lifecycle ends if appropriate.

## Compute pipeline checklist

- Use `@compute` and a valid `@workgroup_size(...)`.
- Use `@group(n)` and `@binding(n)` consistently with the bind-group layout.
- Guard shader indices against the actual element count; dispatching whole workgroups can create extra invocations.
- Calculate byte sizes explicitly (for example, `count * Float32Array.BYTES_PER_ELEMENT`) and check device limits.
- Encode `beginComputePass()`, set pipeline and bind groups, call `dispatchWorkgroups()`, end the pass, finish, and submit.
- For CPU readback, copy the result to a staging buffer configured for mapping, await `mapAsync(GPUMapMode.READ)`, copy out the data, then unmap.
- Prefer `createComputePipelineAsync()` when appropriate to avoid blocking pipeline creation on the main thread; catch and report failures.

## Debugging procedure

When an implementation fails:

1. Capture the exact browser, OS, GPU, error text, and minimal reproduction.
2. Verify secure context and `navigator.gpu`.
3. Verify adapter acquisition and requested features/limits.
4. Check shader compilation messages, entry-point spelling, WGSL syntax, and resource bindings.
5. Check buffer/texture usage flags, byte sizes, alignment, formats, bind-group layouts, and pipeline descriptors.
6. Use `device.pushErrorScope("validation")` and `await device.popErrorScope()` where useful; also consider `"out-of-memory"` and `"internal"` scopes.
7. Handle `GPUValidationError`, `GPUOutOfMemoryError`, `GPUInternalError`, `GPUPipelineError`, and `device.lost` appropriately.
8. Reduce to the smallest failing shader or pipeline, then fix and retest.
9. Check MDN browser compatibility and the relevant interface documentation before concluding the API is unsupported.

## Performance guidance

- Minimize per-frame allocations and redundant pipeline/resource creation.
- Reuse buffers, textures, pipelines, bind groups, and command patterns where practical.
- Batch work and reduce CPU-to-GPU transfers.
- Keep intermediate data on the GPU when possible.
- Tune workgroup sizes empirically; do not assume one size is optimal across devices.
- Avoid waiting for GPU completion after every small operation.
- Benchmark release builds on representative hardware; report both correctness and performance.
- Do not claim GPU acceleration without a measurement or evidence that the relevant work executes through WebGPU.

## Response expectations

For implementation tasks, deliver:
- A brief architecture summary.
- Complete code or a focused patch consistent with the repository.
- Setup/run instructions.
- Browser and security requirements.
- Tests performed and remaining caveats.
- Performance results only if actually measured.

Prefer TypeScript when the project uses it; otherwise follow the repository conventions. Do not introduce a framework or dependency without a clear need.

## Official reference map

- Main API guide: https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API
- `GPU`: https://developer.mozilla.org/en-US/docs/Web/API/GPU
- `GPU.requestAdapter()`: https://developer.mozilla.org/en-US/docs/Web/API/GPU/requestAdapter
- `GPUDevice`: https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice
- `GPUBuffer`: https://developer.mozilla.org/en-US/docs/Web/API/GPUBuffer
- `GPUCanvasContext`: https://developer.mozilla.org/en-US/docs/Web/API/GPUCanvasContext
- WGSL specification: https://www.w3.org/TR/WGSL/
- WebGPU specification: https://www.w3.org/TR/webgpu/
- WebGPU samples: https://webgpu.github.io/webgpu-samples/
