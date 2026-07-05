import { profileSchema } from '@clientflow/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useAuthStore } from '../stores/auth-store';
import { useToastStore } from '../stores/toast-store';

type ProfileInput = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const { user, setSession } = useAuthStore();
  const notify = useToastStore((state) => state.notify);
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phone: user?.phone ?? '',
      avatar: user?.avatar ?? '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const response = await api.patch('/users/profile', values);
      setSession(response.data.data.user);
      notify({ type: 'success', title: 'Profile saved' });
    } catch (error) {
      notify({ type: 'error', title: 'Update failed', message: errorMessage(error) });
    }
  });

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Profile</h1>
        <p className="mt-2 text-foreground/65">Keep your contact details current.</p>
      </div>
      <Card className="max-w-2xl">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
          <Input
            label="First name"
            {...form.register('firstName')}
            error={form.formState.errors.firstName?.message}
          />
          <Input
            label="Last name"
            {...form.register('lastName')}
            error={form.formState.errors.lastName?.message}
          />
          <Input
            label="Phone"
            {...form.register('phone')}
            error={form.formState.errors.phone?.message}
          />
          <Input
            label="Avatar URL"
            {...form.register('avatar')}
            error={form.formState.errors.avatar?.message}
          />
          <div className="sm:col-span-2">
            <Button disabled={form.formState.isSubmitting} type="submit">
              Save profile
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
