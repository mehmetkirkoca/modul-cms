import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';
import { PluginOutlet } from '../../components/PluginOutlet.js';
import { pluginPageRoute } from '../../router.js';

interface NavItem {
  path: string;
  component: string;
  label: string;
  bundleUrl: string;
}

export function PluginPage() {
  const { component } = pluginPageRoute.useParams();

  const { data: navItems = [] } = useQuery({
    queryKey: ['plugin-nav'],
    queryFn: () => apiClient.get<NavItem[]>('/admin/navigation').then((r) => r.data),
  });

  const navItem = navItems.find((n) => n.component === component);

  if (!navItem) {
    return <p className="text-gray-500 text-sm">Plugin page not found.</p>;
  }

  return (
    <PluginOutlet
      component={navItem.component}
      bundleUrl={navItem.bundleUrl}
    />
  );
}
