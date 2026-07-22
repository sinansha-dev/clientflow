import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@clientflow/shared';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { z } from 'zod';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useAuthStore } from '../stores/auth-store';
import { useToastStore } from '../stores/toast-store';

type LoginInput = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAuthStore();
  const notify = useToastStore((state) => state.notify);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  useEffect(() => {
    const savedEmail = localStorage.getItem('cf_remembered_email');
    if (savedEmail) {
      form.setValue('email', savedEmail);
      form.setValue('rememberMe', true);
    }
  }, [form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (values.rememberMe) {
        localStorage.setItem('cf_remembered_email', values.email);
      } else {
        localStorage.removeItem('cf_remembered_email');
      }

      const response = await api.post('/auth/login', values);
      setSession(response.data.data.user, response.data.data.accessToken);
      notify({ type: 'success', title: 'Welcome back' });
      const from =
        (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/dashboard';
      navigate(from, { replace: true });
    } catch (error) {
      notify({
        type: 'error',
        title: 'Login failed',
        message: errorMessage(error, 'Invalid credentials'),
      });
    }
  });

  return (
    <Card className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center text-center">
        <img
          src="/icon.jpg"
          alt="ClientFlow Logo"
          className="h-16 w-16 rounded-2xl mb-4 shadow-lg shadow-primary/5 border border-border/10"
        />
        <h1 className="text-2xl font-bold text-foreground">Sign in to ClientFlow</h1>
        <p className="mt-2 text-sm text-muted-foreground">Use your account to continue</p>
      </div>
      <form className="grid gap-4" onSubmit={onSubmit}>
        <Input
          label="Email"
          type="email"
          {...form.register('email')}
          error={form.formState.errors.email?.message}
        />
        <Input
          label="Password"
          type="password"
          {...form.register('password')}
          error={form.formState.errors.password?.message}
        />
        <label className="flex items-center gap-2 text-sm">
          <input className="h-4 w-4" type="checkbox" {...form.register('rememberMe')} />
          Remember me
        </label>
        <Button disabled={form.formState.isSubmitting} type="submit">
          Sign in
        </Button>
      </form>
      <Link className="mt-5 block text-sm font-medium text-primary" to="/forgot-password">
        Forgot password?
      </Link>
    </Card>
  );
}
