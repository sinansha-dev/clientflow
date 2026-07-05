import type { AuthUser } from '@clientflow/types';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../components/ui/card';
import { api } from '../lib/api';

export function UsersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data.data.users as AuthUser[];
    },
  });

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Users</h1>
        <p className="mt-2 text-foreground/65">Admin-only account management.</p>
      </div>
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="grid gap-3 p-5">
            <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-12 animate-pulse rounded bg-muted" />
            <div className="h-12 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-muted text-foreground/70">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((user) => (
                  <tr key={user.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="px-4 py-3 text-foreground/70">{user.email}</td>
                    <td className="px-4 py-3">{user.role}</td>
                    <td className="px-4 py-3">{user.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
