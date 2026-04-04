import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client.js';
import { router } from './router.js';
import { useAuthStore } from './lib/auth-store.js';
import './index.css';

// Expose JWT to Web Components via window.__CMS_TOKEN__
(window as unknown as Record<string, unknown>)['__CMS_TOKEN__'] =
  useAuthStore.getState().accessToken;
useAuthStore.subscribe((state) => {
  (window as unknown as Record<string, unknown>)['__CMS_TOKEN__'] = state.accessToken;
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
