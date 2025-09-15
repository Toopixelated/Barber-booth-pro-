/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import AuthGate from './components/AuthGate';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthGate />
    <Toaster
      position="bottom-center"
      toastOptions={{
        style: {
          background: 'linear-gradient(to right, #3b0764, #581c87)',
          color: '#e2e8f0',
          border: '1px solid #a855f7',
        },
      }}
    />
  </React.StrictMode>
);