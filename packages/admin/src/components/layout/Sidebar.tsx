import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';

interface NavItem {
  path: string;
  component: string;
  label: string;
  bundleUrl: string;
}

const coreNavItems = [
  { path: '/',        label: 'Dashboard' },
  { path: '/users',   label: 'Users' },
  { path: '/plugins', label: 'Plugins' },
];

export function Sidebar() {
  const { data: pluginNavItems = [] } = useQuery({
    queryKey: ['plugin-nav'],
    queryFn: () => apiClient.get<NavItem[]>('/admin/navigation').then((r) => r.data),
  });

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col">
      <div className="px-4 py-5 border-b border-gray-700">
        <span className="text-lg font-semibold">moduleCMS</span>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {coreNavItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="block px-3 py-2 rounded-md text-sm hover:bg-gray-700 [&.active]:bg-gray-700"
          >
            {item.label}
          </Link>
        ))}

        {pluginNavItems.length > 0 && (
          <>
            <div className="pt-4 pb-1 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Content
            </div>
            {pluginNavItems.map((item) => (
              <Link
                key={item.component}
                to="/plugins/$component"
                params={{ component: item.component }}
                className="block px-3 py-2 rounded-md text-sm hover:bg-gray-700 [&.active]:bg-gray-700"
              >
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
