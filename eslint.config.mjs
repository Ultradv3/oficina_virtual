import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // Los SFC con <script> + <script setup> importan en ambos bloques.
    'import/first': 'off',
    // El adaptador normaliza respuestas externas heterogéneas de OpenCode.
    '@typescript-eslint/no-explicit-any': 'off',
  },
})
