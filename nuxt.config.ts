export default defineNuxtConfig({
  compatibilityDate: '2026-10-24',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@tresjs/nuxt'],
  // Renderer WebGPU de three r186 (node materials). Si el navegador/equipo no
  // expone WebGPU, WebGPURenderer cae automáticamente al backend WebGL2.
  tres: {
    renderer: 'webgpu',
  },
  css: ['~/assets/css/main.css'],
  typescript: {
    strict: true,
    typeCheck: false,
  },
  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      title: 'Agent Office · Supervisión de agentes',
      link: [
        {
          rel: 'preload',
          href: '/fonts/InterVariable.woff2',
          as: 'font',
          type: 'font/woff2',
          crossorigin: 'anonymous',
        },
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Oficina virtual isométrica para supervisar y controlar agentes de IA ejecutados con OpenCode.',
        },
        { name: 'theme-color', content: '#070a0f' },
      ],
    },
  },
})
