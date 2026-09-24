import { Compass, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { Button } from '@/components/ui/button';

function Shell({
  code,
  title,
  description,
  retry,
}: {
  code: string;
  title: string;
  description: string;
  retry?: boolean;
}) {
  return (
    <div className="container-page grid min-h-[70vh] place-items-center py-24 text-center">
      <div className="space-y-6">
        <motion.p
          initial={{ opacity: 0, scale: 0.8, rotate: -6 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 14 }}
          className="text-display bg-gradient-to-b from-fg to-fg/10 bg-clip-text text-[clamp(7rem,22vw,16rem)] leading-none text-transparent"
        >
          {code}
        </motion.p>
        <h1 className="text-display text-4xl">{title}</h1>
        <p className="mx-auto max-w-md text-muted">{description}</p>
        <div className="flex justify-center gap-3">
          <Link to="/">
            <Button>
              <Compass className="size-4" /> Back to shop
            </Button>
          </Link>
          {retry === true && (
            <Button
              variant="outline"
              onClick={() => {
                window.location.reload();
              }}
            >
              <RefreshCw className="size-4" /> Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <Shell
      code="404"
      title="This page wandered off"
      description="The page you’re looking for doesn’t exist or has moved. Let’s get you back to something beautiful."
    />
  );
}

export function ErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />;
  }

  return (
    <Shell
      code="Oops"
      title="Something went wrong"
      description="An unexpected error interrupted this page. Please try again in a moment."
      retry
    />
  );
}
