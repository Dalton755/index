import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const base = process.env.VITE_BASE_PATH || '/'

function chunkedVirtualModules(): Plugin {
  const appId = 'virtual:nethanel-app'
  const styleId = 'virtual:nethanel-styles.css'
  const resolvedAppId = resolve(process.cwd(), 'src/__virtual_app.tsx')
  const resolvedStyleId = resolve(process.cwd(), 'src/__virtual_styles.css')

  const readChunks = (folder: string) => {
    let source = readdirSync(resolve(process.cwd(), folder))
      .filter(name => name.endsWith('.txt'))
      .sort()
      .map(name => readFileSync(resolve(process.cwd(), folder, name), 'utf8'))
      .join('')

    if (folder === 'src/app-chunks') {
      // Mantém links internos, OAuth e portal funcionando em /index/ no GitHub Pages
      // e em / quando o mesmo código for usado em domínio próprio/Vercel.
      const appRoot = "new URL(import.meta.env.BASE_URL, window.location.origin).toString().replace(/\\/$/, '')"
      source = source.replaceAll('window.location.origin', appRoot)

      // Rebranding direto no código-fonte virtual: sem MutationObserver e sem alterar o DOM em runtime.
      source = source.replaceAll('Nethanel OS', 'Zelo')
      source = source.replaceAll('Carregando Zelo', 'Carregando Zelo')
      source = source.replaceAll('<div className=\"brand-mark\">N</div>', '<div className=\"brand-mark\">Z</div>')
      source = source.replaceAll('<div className=\"brand-mark large\">N</div>', '<div className=\"brand-mark large\">Z</div>')
    }

    return source
  }

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
  base,
  plugins: [chunkedVirtualModules(), react()],
})
