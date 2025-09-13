
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Toaster } from 'react-hot-toast';
import { loadTranslations } from './i18n/i18n';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const renderApp = () => {
  root.render(
    <React.StrictMode>
      <App />
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: 'linear-gradient(to right, #1e1b4b, #312e81)',
            color: '#e2e8f0',
            border: '1px solid #4f46e5',
          },
        }}
      />
    </React.StrictMode>
  );
};

loadTranslations().then(renderApp);