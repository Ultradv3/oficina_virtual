/**
 * Minimal WebGPU capability probe.
 * Run from a secure context in a browser with WebGPU support.
 */
async function probeWebGPU() {
  if (!navigator.gpu) {
    return { supported: false, reason: "navigator.gpu is unavailable" };
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    return { supported: false, reason: "No adapter was returned" };
  }

  const info = adapter.info;
  const device = await adapter.requestDevice();

  const result = {
    supported: true,
    adapterInfo: info,
    features: [...device.features],
    limits: {
      maxBufferSize: device.limits.maxBufferSize,
      maxStorageBufferBindingSize: device.limits.maxStorageBufferBindingSize,
      maxComputeWorkgroupSizeX: device.limits.maxComputeWorkgroupSizeX,
    },
  };

  device.destroy();
  return result;
}

probeWebGPU().then(console.log).catch(console.error);
