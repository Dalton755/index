import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from 'virtual:nethanel-app'
import 'virtual:nethanel-styles.css'
import './components/team.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
