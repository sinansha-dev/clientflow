import { forgotPasswordSchema } from '@clientflow/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import type { z } from 'zod';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useToastStore } from '../stores/toast-store';

type ForgotInput = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const notify = useToastStore((state) => state.notify);
  const form = useForm<ForgotInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const response = await api.post('/auth/forgot-password', values);
      const resetToken = response.data.data.resetToken as string | undefined;
      notify({
        type: 'success',
        title: 'Reset requested',
        message: resetToken ? `Development token: ${resetToken}` : undefined,
      });
    } catch (error) {
      notify({ type: 'error', title: 'Request failed', message: errorMessage(error) });
    }
  });

  return (
    <Card className="w-full max-w-md">
      <h1 className="text-2xl font-semibold">Forgot password</h1>
      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <Input
          label="Email"
          type="email"
          {...form.register('email')}
          error={form.formState.errors.email?.message}
        />
        <Button disabled={form.formState.isSubmitting} type="submit">
          Send reset link
        </Button>
      </form>
      <Link className="mt-5 block text-sm font-medium text-primary" to="/login">
        Back to sign in
      </Link>
    </Card>
  );
}
