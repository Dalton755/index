import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const base = process.env.VITE_BASE_PATH || './'

const zeloLoginMarkup = '<div className="auth-brand zelo-auth-brand"><div className="zelo-logo-lockup" aria-label="Zelo by Nethanel"><svg className="zelo-symbol" viewBox="0 0 64 64" role="img" aria-hidden="true"><defs><linearGradient id="zeloGradient" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse"><stop stopColor="#123D7A"/><stop offset="1" stopColor="#2878F0"/></linearGradient></defs><rect x="4" y="4" width="56" height="56" rx="18" fill="url(#zeloGradient)"/><path d="M18 20H46L22 44H46" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="46.5" cy="20" r="4" fill="#A7D8FF"/></svg><div className="zelo-wordmark"><strong>Zelo</strong><span>by Nethanel</span></div></div></div>'

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
        'redirectTo: `${window.location.origin}${window.location.pathname}`',
      )

      source = source.replace(
        '<div className="auth-brand"><div className="brand-mark large">N</div><div><strong>Nethanel OS</strong><span>Ordem de serviço inteligente</span></div></div>',
        zeloLoginMarkup,
      )

      source = source.replaceAll('Nethanel OS', 'Zelo')
      source = source.replaceAll('<div className="brand-mark">N</div>', '<div className="brand-mark">Z</div>')
      source = source.replaceAll('<div className="brand-mark large">N</div>', '<div className="brand-mark large">Z</div>')
      source = source.replaceAll('Carregando Nethanel OS', 'Carregando Zelo')
    }

    if (folder === 'src/style-chunks') {
      source += '\n.zelo-auth-brand{justify-content:center!important;align-items:center!important;padding:0!important;margin-bottom:22px}.zelo-logo-lockup{display:flex;align-items:center;justify-content:center;gap:14px}.zelo-symbol{display:block;width:64px;height:64px;flex:0 0 64px;filter:drop-shadow(0 10px 22px rgba(20,77,160,.18))}.zelo-wordmark{display:flex;flex-direction:column;align-items:flex-start;line-height:1}.zelo-wordmark strong{font-size:38px;letter-spacing:-1.6px;font-weight:800;color:#0b1730}.zelo-wordmark span{margin-top:7px;font-size:13px;font-weight:700;letter-spacing:.04em;color:#7c8ba0}@media(max-width:430px){.zelo-logo-lockup{gap:12px}.zelo-symbol{width:56px;height:56px;flex-basis:56px}.zelo-wordmark strong{font-size:34px}.zelo-wordmark span{font-size:12px}}\n'
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
