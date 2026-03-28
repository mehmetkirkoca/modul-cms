import { useAuthStore } from '../../lib/auth-store.js';
import { apiClient } from '../../lib/api-client.js';
import { useNavigate } from '@tanstack/react-router';

export function Header() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await apiClient.post('/auth/logout').catch(() => null);
    logout();
    void navigate({ to: '/login' });
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">{user?.name} ({user?.role})</span>
        <button
          onClick={() => void handleLogout()}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
