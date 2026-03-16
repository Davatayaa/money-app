import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    console.log('Update available. Refresh now?');
  },
  onOfflineReady() {
    console.log('PWA Ready (Offline Mode)')
  },
})

if ('Notification' in window) {
  console.log('Notifikasi didukung browser ini.');
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)