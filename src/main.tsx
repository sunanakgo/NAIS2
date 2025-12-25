import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'
import './i18n'

// Hide splash screen when React is ready
const hideSplash = () => {
    const splash = document.getElementById('splash-screen')
    if (splash) {
        splash.classList.add('fade-out')
        setTimeout(() => splash.remove(), 500)
    }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)

// Delay slightly to ensure app renders, then hide splash
requestAnimationFrame(() => {
    requestAnimationFrame(hideSplash)
})
