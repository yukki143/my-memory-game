// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { SettingsProvider } from './context/SettingsContext' // ★追加
import { BgmProvider } from './context/BgmContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsProvider> {/* ★全体を囲む */}
      <BgmProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </BgmProvider>
    </SettingsProvider>
  </React.StrictMode>,
)