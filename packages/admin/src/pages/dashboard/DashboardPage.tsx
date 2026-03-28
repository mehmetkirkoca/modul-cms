import { useAuthStore } from '../../lib/auth-store.js';

export function DashboardPage() {
  const { user } = useAuthStore();

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Dashboard</h1>
      <p className="text-gray-500">Welcome, {user?.name}.</p>
    </div>
  );
}
