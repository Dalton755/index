import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

function chunkedVirtualModules(): Plugin {
  const appId = 'virtual:nethanel-app'
  const styleId = 'virtual:nethanel-styles.css'
  const resolvedAppId = resolve(process.cwd(), 'src/__virtual_app.tsx')
  const resolvedStyleId = resolve(process.cwd(), 'src/__virtual_styles.css')

  const readChunks = (folder: string) =>
    readdirSync(resolve(process.cwd(), folder))
      .filter(name => name.endsWith('.txt'))
      .sort()
      .map(name => readFileSync(resolve(process.cwd(), folder, name), 'utf8'))
      .join('')

  return {
    name: 'nethanel-chunked-source',
    resolveId(id) {
      if (id === appId) return resolvedAppId
      if (id === styleId) return resolvedStyleId
    },
    load(id) {
      if (id === resolvedAppId) return readChunks('src/app-chunks')
      if (id === resolvedStyleId) return readChunks('src/style-chunks')
    },
  }
}

export default defineConfig({
  plugins: [chunkedVirtualModules(), react()],
})
