import React from 'react';
import ReactDOM from 'react-dom/client';
import './lumen.css'; // Lumen design system - always first
import './index.css';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
