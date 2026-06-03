import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Guest Microsoft OAuth popup shim: when the MS popup lands back on the app origin
// with ?code&state=msguest…, hand the code to the opener (the room page) and close.
// Runs before we render anything — the popup never boots the full app.
{
  const _p = new URLSearchParams(window.location.search)
  const _state = _p.get('state')
  if (window.opener && _state && _state.startsWith('msguest') && (_p.get('code') || _p.get('error'))) {
    try {
      window.opener.postMessage(
        { type: 'ms-guest-oauth', code: _p.get('code'), error: _p.get('error'), state: _state },
        window.location.origin,
      )
    } catch { /* opener gone; nothing to do */ }
    window.close()
  } else {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>
    )
  }
}
