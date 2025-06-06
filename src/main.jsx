// src/index.js or src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Assuming you have this for global styles
import App from './app.js'; // Corrected import with extension
import reportWebVitals from './reportWebVitals.js'; // Corrected import with extension

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();