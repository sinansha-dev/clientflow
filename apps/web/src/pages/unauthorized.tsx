import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export function UnauthorizedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 text-center">
      <div>
        <h1 className="text-3xl font-semibold">Unauthorized</h1>
        <p className="mt-3 text-foreground/65">Your role does not have access to this page.</p>
        <Link to="/dashboard">
          <Button className="mt-6">Back to dashboard</Button>
        </Link>
      </div>
    </main>
  );
}
