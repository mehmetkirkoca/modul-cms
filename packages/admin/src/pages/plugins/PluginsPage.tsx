import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';

interface Plugin {
  name: string;
  version: string;
  status: string;
  runtime: string;
  registeredAt: string;
}

export function PluginsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: () => apiClient.get<{ plugins: Plugin[] }>('/plugins').then((r) => r.data),
  });

  if (isLoading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Plugins</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Name', 'Version', 'Runtime', 'Status'].map((h) => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data?.plugins.map((p) => (
              <tr key={p.name}>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{p.version}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{p.runtime}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <span className={`px-2 py-0.5 rounded text-xs ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
