import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { apiClient } from '../../lib/api-client.js';

interface Post {
  id: string;
  title: string;
  slug: string;
  status: string;
  authorId: string;
  createdAt: string;
}

export function PostsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: () => apiClient.get<{ posts: Post[]; total: number }>('/content/posts').then((r) => r.data),
  });

  if (isLoading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Posts</h1>
        <Link
          to="/content/posts/new"
          className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-700"
        >
          New Post
        </Link>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Title', 'Status', 'Created'].map((h) => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data?.posts.map((p) => (
              <tr key={p.id}>
                <td className="px-6 py-4 text-sm">
                  <Link to="/content/posts/$id" params={{ id: p.id }} className="font-medium text-gray-900 hover:underline">
                    {p.title}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <span className={`px-2 py-0.5 rounded text-xs ${p.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
