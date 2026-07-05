import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 text-center">
      <div>
        <h1 className="text-3xl font-semibold">404</h1>
        <p className="mt-3 text-foreground/65">The page you requested could not be found.</p>
        <Link to="/dashboard">
          <Button className="mt-6">Back to dashboard</Button>
        </Link>
      </div>
    </main>
  );
}
