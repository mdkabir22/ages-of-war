import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import i18n from './lib/i18n'
import { initSentry } from './lib/sentry'
import App from './App.tsx'

initSentry()

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </I18nextProvider>
  </StrictMode>,
)
