import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
  loginSchema,
  type LoginInput,
  passwordSchema,
  registerSchema,
  type RegisterInput,
} from '@ecommerce/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  MailCheck,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';

import { Logo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { useLogin, useRegister } from '@/hooks/use-auth';
import { useDocumentTitle } from '@/hooks/use-utils';
import { errorMessage } from '@/lib/query';
import { cn } from '@/lib/utils';
import { ApiError } from '@/services/api-client';
import { authApi } from '@/services/auth.api';
import { useAuthStore } from '@/stores/auth.store';

const SHOWCASE = [
  'https://cdn.dummyjson.com/product-images/smartphones/iphone-13-pro/1.webp',
  'https://cdn.dummyjson.com/product-images/fragrances/gucci-bloom-eau-de/1.webp',
  'https://cdn.dummyjson.com/product-images/mens-watches/rolex-datejust/1.webp',
];

/** Split layout: the form on one side, an animated brand panel on the other. */
function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-[calc(100svh-7rem)] lg:grid-cols-2">
      <div className="flex items-center justify-center px-4 py-16 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <h1 className="text-display text-5xl">{title}</h1>
          <div className="mt-3 text-muted">{subtitle}</div>
          <div className="mt-10">{children}</div>
        </motion.div>
      </div>
      <div className="grain relative hidden overflow-hidden bg-[oklch(18%_0.03_280)] lg:block">
        <div className="animate-aurora absolute -top-1/4 -left-1/4 size-[80%] rounded-full bg-[radial-gradient(circle,oklch(60%_0.22_285/0.7),transparent_60%)] blur-3xl" />
        <div
          className="animate-aurora absolute -right-1/4 -bottom-1/4 size-[80%] rounded-full bg-[radial-gradient(circle,oklch(65%_0.2_340/0.5),transparent_60%)] blur-3xl"
          style={{ animationDelay: '-8s' }}
        />
        <div className="relative flex h-full flex-col justify-between p-14 text-white">
          <Logo className="text-white [&_span:last-child]:text-white" />
          <div className="relative h-80">
            {SHOWCASE.map((src, index) => (
              <motion.div
                key={src}
                initial={{ opacity: 0, y: 60, rotate: 0 }}
                animate={{ opacity: 1, y: 0, rotate: [-8, 4, -2][index] ?? 0 }}
                transition={{
                  delay: 0.3 + index * 0.15,
                  type: 'spring',
                  stiffness: 120,
                  damping: 14,
                }}
                className="animate-float absolute size-52 rounded-[32px] border border-white/15 bg-white/10 p-5 backdrop-blur-xl"
                style={{
                  left: `${String(index * 26)}%`,
                  top: `${String([10, 30, 0][index] ?? 0)}%`,
                  animationDelay: `${String(index)}s`,
                }}
              >
                <img src={src} alt="" className="size-full object-contain" />
              </motion.div>
            ))}
          </div>
          <blockquote className="max-w-md">
            <p className="text-display text-3xl leading-tight">
              “Beautifully made things, delivered faster than I expected. Aura is my go-to.”
            </p>
            <footer className="mt-4 text-sm text-white/60">- Priya, Bengaluru</footer>
          </blockquote>
        </div>
      </div>
    </div>
  );
}

function PasswordStrength({ value }: { value: string }) {
  const checks = [
    value.length >= 8,
    /[A-Za-z]/u.test(value),
    /[0-9]/u.test(value),
    /[^A-Za-z0-9]/u.test(value) || value.length >= 12,
  ];
  const score = checks.filter(Boolean).length;
  const labels = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong'];
  const colors = ['bg-sale', 'bg-sale', 'bg-warning', 'bg-success', 'bg-success'];

  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((bar) => (
          <div key={bar} className="h-1 flex-1 overflow-hidden rounded-full bg-border">
            <motion.div
              className={cn('h-full', colors[score])}
              initial={false}
              animate={{ width: bar < score ? '100%' : '0%' }}
              transition={{ type: 'spring', stiffness: 200, damping: 24 }}
            />
          </div>
        ))}
      </div>
      {value !== '' && <p className="text-xs text-muted">{labels[score]}</p>}
    </div>
  );
}

function usePasswordToggle() {
  const [visible, setVisible] = useState(false);
  const toggle = (
    <button
      type="button"
      onClick={() => {
        setVisible((value) => !value);
      }}
      className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2"
      aria-label={visible ? 'Hide password' : 'Show password'}
    >
      {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
  return { type: visible ? 'text' : 'password', toggle };
}

export function LoginPage() {
  useDocumentTitle('Sign in');
  const login = useLogin();
  const password = usePasswordToggle();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  return (
    <AuthShell
      title="Welcome back"
      subtitle={
        <>
          New to Aura?{' '}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(event) => {
          void form.handleSubmit((values) => {
            login.mutate(values, {
              onSuccess: (session) => {
                toast.success(`Welcome back, ${session.user.firstName}!`);
              },
            });
          })(event);
        }}
        className="space-y-5"
      >
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <Input
          label="Password"
          type={password.type}
          autoComplete="current-password"
          trailing={password.toggle}
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="inline-block py-2 text-sm font-medium text-accent hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <AnimatePresence>
          {login.error !== null && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="rounded-2xl bg-sale/10 px-4 py-3 text-sm text-sale"
            >
              {errorMessage(login.error)}
            </motion.p>
          )}
        </AnimatePresence>
        <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
          Sign in
        </Button>
        <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">
          <p className="font-medium text-fg">Demo account</p>
          <p className="mt-1">demo@example.com · Demo@12345</p>
          <button
            type="button"
            onClick={() => {
              form.setValue('email', 'demo@example.com');
              form.setValue('password', 'Demo@12345');
            }}
            className="mt-1 py-2 font-medium text-accent hover:underline"
          >
            Fill in demo credentials
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  useDocumentTitle('Create account');
  const register = useRegister();
  const password = usePasswordToggle();
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  });
  const passwordValue = useWatch({ control: form.control, name: 'password' });

  return (
    <AuthShell
      title="Create your account"
      subtitle={
        <>
          Already have one?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(event) => {
          void form.handleSubmit((values) => {
            register.mutate(values, {
              onSuccess: (session) => {
                toast.success(
                  `Welcome to Aura, ${session.user.firstName}! Check your inbox to verify your email.`,
                );
              },
              onError: (error) => {
                if (error instanceof ApiError && error.fieldError('email') !== undefined) {
                  form.setError('email', { message: error.fieldError('email') ?? error.message });
                }
              },
            });
          })(event);
        }}
        className="space-y-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            autoComplete="given-name"
            error={form.formState.errors.firstName?.message}
            {...form.register('firstName')}
          />
          <Input
            label="Last name"
            autoComplete="family-name"
            error={form.formState.errors.lastName?.message}
            {...form.register('lastName')}
          />
        </div>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <div className="space-y-2">
          <Input
            label="Password"
            type={password.type}
            autoComplete="new-password"
            trailing={password.toggle}
            error={form.formState.errors.password?.message}
            {...form.register('password')}
          />
          <PasswordStrength value={passwordValue} />
        </div>
        {register.error !== null &&
          !(
            register.error instanceof ApiError && register.error.fieldError('email') !== undefined
          ) && (
            <p role="alert" className="rounded-2xl bg-sale/10 px-4 py-3 text-sm text-sale">
              {errorMessage(register.error)}
            </p>
          )}
        <Button type="submit" size="lg" className="w-full" loading={register.isPending}>
          Create account
        </Button>
        <p className="text-center text-xs text-muted">
          By continuing you agree to our terms and privacy policy.
        </p>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  useDocumentTitle('Reset password');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });
  const request = useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
    onSuccess: (_result, email) => {
      setSentTo(email);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="We’ll email you a secure link to choose a new one."
    >
      <AnimatePresence mode="wait">
        {sentTo === null ? (
          <motion.form
            key="form"
            exit={{ opacity: 0, x: -20 }}
            noValidate
            onSubmit={(event) => {
              void form.handleSubmit((values) => {
                request.mutate(values.email);
              })(event);
            }}
            className="space-y-5"
          >
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              error={form.formState.errors.email?.message}
              {...form.register('email')}
            />
            <Button type="submit" size="lg" className="w-full" loading={request.isPending}>
              Send reset link
            </Button>
          </motion.form>
        ) : (
          <motion.div
            key="sent"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4 rounded-3xl bg-surface-2 p-6"
          >
            <MailCheck className="size-8 text-accent" />
            <p>
              If an account exists for <span className="font-medium">{sentTo}</span>, a reset link
              is on its way.
            </p>
            <p className="text-sm text-muted">
              In development the link is printed in the API console.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      <Link
        to="/login"
        className="mt-8 inline-flex items-center gap-2 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </AuthShell>
  );
}

const resetFormSchema = z.object({ password: passwordSchema });

export function ResetPasswordPage() {
  useDocumentTitle('Choose a new password');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const password = usePasswordToggle();
  const form = useForm<{ password: string }>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { password: '' },
  });
  const passwordValue = useWatch({ control: form.control, name: 'password' });
  const reset = useMutation({
    mutationFn: (value: string) => authApi.resetPassword({ token, password: value }),
    onSuccess: (result) => {
      toast.success(result.message);
      useAuthStore.getState().clear();
      void navigate('/login', { replace: true });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Make it strong - you’ll be signed out of other devices."
    >
      {token === '' ? (
        <p className="rounded-2xl bg-sale/10 p-4 text-sm text-sale">
          This reset link is missing its token. Request a new one.
        </p>
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            void form.handleSubmit((values) => {
              reset.mutate(values.password);
            })(event);
          }}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Input
              label="New password"
              type={password.type}
              autoComplete="new-password"
              trailing={password.toggle}
              error={form.formState.errors.password?.message}
              {...form.register('password')}
            />
            <PasswordStrength value={passwordValue} />
          </div>
          <Button type="submit" size="lg" className="w-full" loading={reset.isPending}>
            Reset password
          </Button>
        </form>
      )}
      <Link
        to="/forgot-password"
        className="mt-8 inline-flex items-center gap-2 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" /> Request a new link
      </Link>
    </AuthShell>
  );
}

export function VerifyEmailPage() {
  useDocumentTitle('Verify email');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const setUser = useAuthStore((state) => state.setUser);
  const signedIn = useAuthStore((state) => state.user !== null);
  const verification = useQuery({
    queryKey: ['verify-email', token],
    queryFn: async () => {
      const user = await authApi.verifyEmail(token);
      if (signedIn) {
        setUser(user);
      }
      return user;
    },
    enabled: token !== '',
    retry: false,
    staleTime: Infinity,
  });

  const state =
    token === '' || verification.isError ? 'error' : verification.isSuccess ? 'done' : 'pending';

  return (
    <AuthShell
      title="Email verification"
      subtitle="Confirming your email keeps your account secure."
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col items-center gap-4 rounded-3xl bg-surface-2 p-10 text-center"
        >
          {state === 'pending' && <LoaderCircle className="size-10 animate-spin text-accent" />}
          {state === 'done' && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 12 }}
            >
              <CheckCircle2 className="size-12 text-success" />
            </motion.span>
          )}
          {state === 'error' && <XCircle className="size-12 text-sale" />}
          <p className="font-medium">
            {state === 'pending'
              ? 'Verifying your email…'
              : state === 'done'
                ? 'Your email is verified. Thank you!'
                : 'This link is invalid or has expired.'}
          </p>
          <Link to={state === 'done' ? '/products' : '/account'}>
            <Button variant="outline">
              {state === 'done' ? 'Start shopping' : 'Go to your account'}
            </Button>
          </Link>
        </motion.div>
      </AnimatePresence>
    </AuthShell>
  );
}
