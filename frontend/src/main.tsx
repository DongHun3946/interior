import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import AppErrorModal from './AppErrorModal'
import AppErrorBoundary from './AppErrorBoundary'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
    <AppErrorModal />
  </React.StrictMode>,
)
