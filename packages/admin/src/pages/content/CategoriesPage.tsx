import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

export function CategoriesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.get<{ categories: Category[] }>('/content/categories').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; slug: string }) => apiClient.post('/content/categories', body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['categories'] });
      setName('');
      setSlug('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/content/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });

  if (isLoading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Categories</h1>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Add Category</h2>
        <div className="flex gap-3">
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
            }}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1"
          />
          <input
            placeholder="Slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1 font-mono"
          />
          <button
            onClick={() => createMutation.mutate({ name, slug })}
            disabled={!name || !slug || createMutation.isPending}
            className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Name', 'Slug', ''].map((h, i) => (
                <th key={i} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data?.categories.map((c) => (
              <tr key={c.id}>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500 font-mono">{c.slug}</td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => deleteMutation.mutate(c.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
