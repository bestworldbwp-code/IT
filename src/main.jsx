import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { Toaster, installAlertToast } from './toast.jsx'
import './index.css'

installAlertToast()

ReactDOM.createRoot(document.getElementById('root')).render(
    <>
        <App />
        <Toaster />
    </>
)
