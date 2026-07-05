import { resetPasswordSchema } from '@clientflow/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { z } from 'zod';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useToastStore } from '../stores/toast-store';

type ResetInput = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const notify = useToastStore((state) => state.notify);
  const form = useForm<ResetInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: params.get('token') ?? '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await api.post('/auth/reset-password', values);
      notify({ type: 'success', title: 'Password updated' });
      navigate('/login');
    } catch (error) {
      notify({ type: 'error', title: 'Reset failed', message: errorMessage(error) });
    }
  });

  return (
    <Card className="w-full max-w-md">
      <h1 className="text-2xl font-semibold">Reset password</h1>
      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <Input
          label="Reset token"
          {...form.register('token')}
          error={form.formState.errors.token?.message}
        />
        <Input
          label="New password"
          type="password"
          {...form.register('password')}
          error={form.formState.errors.password?.message}
        />
        <Button disabled={form.formState.isSubmitting} type="submit">
          Update password
        </Button>
      </form>
      <Link className="mt-5 block text-sm font-medium text-primary" to="/login">
        Back to sign in
      </Link>
    </Card>
  );
}
