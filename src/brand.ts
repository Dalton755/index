const applyZeloBrand = () => {
  document.title = 'Zelo'

  if (document.body) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    let node = walker.nextNode()
    while (node) {
      nodes.push(node as Text)
      node = walker.nextNode()
    }
    for (const textNode of nodes) {
      const value = textNode.nodeValue ?? ''
      if (value.includes('Nethanel OS')) {
        textNode.nodeValue = value.replaceAll('Nethanel OS', 'Zelo')
      }
    }
  }

  document.querySelectorAll<HTMLElement>('.brand-mark').forEach(mark => {
    if (mark.textContent !== 'Z') mark.textContent = 'Z'
    mark.setAttribute('aria-label', 'Zelo')
  })

  document.querySelectorAll<HTMLElement>('.brand-copy strong').forEach(title => {
    if (title.textContent !== 'Zelo') title.textContent = 'Zelo'
  })

  const authBrand = document.querySelector<HTMLElement>('.auth-brand')
  if (authBrand && !authBrand.classList.contains('zelo-ready')) {
    const logo = document.createElement('img')
    logo.src = '/zelo-logo.png'
    logo.alt = 'Zelo by Nethanel'
    logo.className = 'zelo-auth-logo'
    authBrand.prepend(logo)
    authBrand.classList.add('zelo-ready')
  }

  document.querySelectorAll<HTMLElement>('.center-screen strong').forEach(label => {
    if (label.textContent?.includes('Carregando')) label.textContent = 'Carregando Zelo'
  })
}

const startZeloBrand = () => {
  applyZeloBrand()
  const observer = new MutationObserver(() => applyZeloBrand())
  observer.observe(document.documentElement, { childList: true, subtree: true })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startZeloBrand, { once: true })
} else {
  startZeloBrand()
}
