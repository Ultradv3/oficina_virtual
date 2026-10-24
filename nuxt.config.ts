export default defineNuxtConfig({
  compatibilityDate: '2026-10-24',
  devtools: { enabled: true },
  modules: ['@tresjs/nuxt'],
  css: ['~/assets/css/main.css'],
  typescript: {
    strict: true,
    typeCheck: false,
  },
  app: {
    head: {
      title: 'Agent Office · Supervisión de agentes',
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
