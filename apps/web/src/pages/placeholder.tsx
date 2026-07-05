import { Card } from '../components/ui/card';

interface PlaceholderPageProps {
  title: string;
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-foreground/65">Coming Soon</p>
      </div>
      <Card>
        <div className="rounded-md border border-dashed border-border p-10 text-center">
          <p className="text-lg font-semibold">{title} workspace</p>
          <p className="mt-2 text-sm text-foreground/60">
            This module is reserved for a later ClientFlow phase.
          </p>
        </div>
      </Card>
    </div>
  );
}
