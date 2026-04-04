import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';

interface Plugin {
  name: string;
  version: string;
  status: 'active' | 'inactive' | 'error';
  runtime: string;
  registeredAt: string;
}

interface MarketplacePlugin {
  name: string;
  version: string;
  description: string;
  author: string;
}

type ApiError = { response?: { data?: { message?: string } } };

function extractErrorMessage(err: unknown, fallback: string): string {
  return (err as ApiError)?.response?.data?.message ?? fallback;
}

export function PluginsPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const { data: installedData, isLoading: installedLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: () => apiClient.get<{ plugins: Plugin[] }>('/plugins').then((r) => r.data),
  });

  const { data: marketplaceData, isLoading: marketplaceLoading } = useQuery({
    queryKey: ['marketplace-plugins', searchQuery],
    queryFn: () =>
      apiClient
        .get<{ plugins: MarketplacePlugin[] }>(`/marketplace/plugins${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`)
        .then((r) => r.data),
  });

  const invalidatePlugins = () => {
    queryClient.invalidateQueries({ queryKey: ['plugins'] });
    queryClient.invalidateQueries({ queryKey: ['plugin-nav'] });
  };

  const clearRowError = (name: string) =>
    setRowErrors((prev) => { const next = { ...prev }; delete next[name]; return next; });

  const setRowError = (name: string, msg: string) =>
    setRowErrors((prev) => ({ ...prev, [name]: msg }));

  const deactivateMutation = useMutation({
    mutationFn: (name: string) => apiClient.delete(`/plugins/${name}`),
    onSuccess: (_data, name) => { clearRowError(name); invalidatePlugins(); },
    onError: (err: unknown, name) => setRowError(name, extractErrorMessage(err, 'Deactivate failed')),
  });

  const activateMutation = useMutation({
    mutationFn: (name: string) => apiClient.post('/plugins/register', { name }),
    onSuccess: (_data, name) => { clearRowError(name); invalidatePlugins(); },
    onError: (err: unknown, name) => setRowError(name, extractErrorMessage(err, 'Activate failed')),
  });

  const removeMutation = useMutation({
    mutationFn: (name: string) => apiClient.delete(`/plugins/${name}?remove=true`),
    onSuccess: (_data, name) => { clearRowError(name); invalidatePlugins(); },
    onError: (err: unknown, name) => setRowError(name, extractErrorMessage(err, 'Remove failed')),
  });

  const installMutation = useMutation({
    mutationFn: (name: string) => apiClient.post('/marketplace/install', { name }),
    onSuccess: (_data, name) => { clearRowError(name); invalidatePlugins(); },
    onError: (err: unknown, name) => setRowError(name, extractErrorMessage(err, 'Install failed')),
  });

  const handleDeactivate = (name: string) => {
    if (!confirm(`Deactivate plugin "${name}"?`)) return;
    deactivateMutation.mutate(name);
  };

  const handleRemove = (name: string) => {
    if (!confirm(`Remove plugin "${name}" from the system?`)) return;
    removeMutation.mutate(name);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  const installedNames = new Set(installedData?.plugins.map((p) => p.name) ?? []);

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold">Plugins</h1>

      {/* Installed Plugins */}
      <section>
        <h2 className="text-base font-semibold mb-3">Installed</h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {installedLoading ? (
            <p className="px-6 py-4 text-sm text-gray-500">Loading...</p>
          ) : !installedData?.plugins.length ? (
            <p className="px-6 py-4 text-sm text-gray-400">No plugins installed.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Version', 'Runtime', 'Status', ''].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {installedData.plugins.map((p) => (
                  <tr key={p.name}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{p.version}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{p.runtime}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          p.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : p.status === 'error'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {p.status}
                      </span>
                      {rowErrors[p.name] && (
                        <p className="text-xs text-red-500 mt-1">{rowErrors[p.name]}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-xs space-x-3">
                      {p.status === 'active' ? (
                        <button
                          onClick={() => handleDeactivate(p.name)}
                          disabled={deactivateMutation.isPending && deactivateMutation.variables === p.name}
                          className="text-yellow-600 hover:text-yellow-800 disabled:opacity-40"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => activateMutation.mutate(p.name)}
                            disabled={activateMutation.isPending && activateMutation.variables === p.name}
                            className="text-green-600 hover:text-green-800 disabled:opacity-40"
                          >
                            Activate
                          </button>
                          <button
                            onClick={() => handleRemove(p.name)}
                            disabled={removeMutation.isPending && removeMutation.variables === p.name}
                            className="text-red-500 hover:text-red-700 disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Browse Marketplace */}
      <section>
        <h2 className="text-base font-semibold mb-3">Browse Marketplace</h2>
        <form onSubmit={handleSearch} className="flex gap-3 mb-4">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search plugins..."
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm disabled:opacity-40"
          >
            Search
          </button>
        </form>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {marketplaceLoading ? (
            <p className="px-6 py-4 text-sm text-gray-500">Loading...</p>
          ) : !marketplaceData?.plugins.length ? (
            <p className="px-6 py-4 text-sm text-gray-400">No plugins found.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Version', 'Description', ''].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {marketplaceData.plugins.map((p) => {
                  const isInstalled = installedNames.has(p.name);
                  const isInstalling =
                    installMutation.isPending &&
                    installMutation.variables === p.name;
                  return (
                    <tr key={p.name}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{p.version}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {p.description}
                        {rowErrors[p.name] && (
                          <p className="text-xs text-red-500 mt-1">{rowErrors[p.name]}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-xs">
                        {isInstalled ? (
                          <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                            Installed
                          </span>
                        ) : (
                          <button
                            onClick={() => installMutation.mutate(p.name)}
                            disabled={isInstalling}
                            className="text-blue-600 hover:text-blue-800 disabled:opacity-40"
                          >
                            {isInstalling ? 'Installing...' : 'Install'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
