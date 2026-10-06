import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from 'virtual:nethanel-app'
import 'virtual:nethanel-styles.css'
import './brand.css'
import './brand'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
