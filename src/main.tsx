import './index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { initializeSentry } from './sentry';

<<<<<<< HEAD
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ThemeProvider>
            <App />
        </ThemeProvider>
    </React.StrictMode>
=======
initializeSentry();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
>>>>>>> main
);
