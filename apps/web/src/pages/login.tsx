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
    defaultValues: { email: 'admin@clientflow.local', password: 'Admin123!', rememberMe: true },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-foreground/65">Use your ClientFlow account to continue.</p>
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
