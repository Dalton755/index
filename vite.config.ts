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
      source = source.replace(
        'redirectTo: window.location.origin',
        'redirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).toString()',
      )

      source = source.replace(
        'const url=`${window.location.origin}${window.location.pathname}?os=${data.order.token_publico}`;',
        'const url=`${new URL(import.meta.env.BASE_URL, window.location.origin).toString()}?os=${data.order.token_publico}`;',
      )

      source = source.replace(
        '<div className="auth-brand"><div className="brand-mark large">N</div><div><strong>Nethanel OS</strong><span>Ordem de serviço inteligente</span></div></div>',
        '<div className="auth-brand zelo-auth-brand"><img className="zelo-auth-logo" src={`${import.meta.env.BASE_URL}zelo-logo.jpg`} alt="Zelo by Nethanel"/></div>',
      )

      source = source.replaceAll('Nethanel OS', 'Zelo')
      source = source.replaceAll('<div className="brand-mark">N</div>', '<div className="brand-mark">Z</div>')
      source = source.replaceAll('<div className="brand-mark large">N</div>', '<div className="brand-mark large">Z</div>')
      source = source.replaceAll('Carregando Nethanel OS', 'Carregando Zelo')
    }

    if (folder === 'src/style-chunks') {
      source += '\n.zelo-auth-brand{justify-content:center!important;align-items:center!important;padding:0!important;margin-bottom:18px}.zelo-auth-logo{display:block;width:min(235px,76vw);height:auto;max-height:235px;object-fit:contain;border-radius:26px;margin:0 auto;box-shadow:0 16px 40px rgba(8,17,32,.16)}@media(max-width:430px){.zelo-auth-logo{width:min(215px,72vw);border-radius:22px}}\n'
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
