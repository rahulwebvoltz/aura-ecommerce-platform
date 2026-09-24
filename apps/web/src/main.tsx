import './index.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';

import { restoreSession } from '@/hooks/use-auth';
import { createQueryClient } from '@/lib/query';
import { router } from '@/router';
import { useThemeStore } from '@/stores/theme.store';

const queryClient = createQueryClient();
void restoreSession();

function ThemedToaster() {
  const theme = useThemeStore((state) => state.theme);
  return (
    <Toaster
      theme={theme}
      position="bottom-center"
      offset={24}
      toastOptions={{
        classNames: {
          toast:
            '!rounded-2xl !border-border !bg-surface !text-fg !shadow-[0_20px_50px_-20px_rgb(0_0_0/0.35)] !font-sans',
          description: '!text-muted',
          actionButton: '!bg-fg !text-bg !rounded-full',
        },
      }}
    />
  );
}

const root = document.getElementById('root');
if (root === null) {
  throw new Error('Root element is missing.');
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <RouterProvider router={router} />
        <ThemedToaster />
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
);
