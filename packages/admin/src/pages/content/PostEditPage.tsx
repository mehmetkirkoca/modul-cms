import { useState, useEffect } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: unknown;
  status: string;
}

export function PostEditPage() {
  const params = useParams({ strict: false }) as { id?: string };
  const isNew = !params.id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [title, setTitle]     = useState('');
  const [slug, setSlug]       = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');

  const { data } = useQuery({
    queryKey: ['post', params.id],
    queryFn: () => apiClient.get<{ post: Post }>(`/content/posts/${params.id}`).then((r) => r.data),
    enabled: !isNew,
  });

  useEffect(() => {
    if (data?.post) {
      setTitle(data.post.title);
      setSlug(data.post.slug);
      setExcerpt(data.post.excerpt ?? '');
      setContent(typeof data.post.content === 'string' ? data.post.content : JSON.stringify(data.post.content ?? ''));
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (body: object) => isNew
      ? apiClient.post('/content/posts', body).then((r) => r.data)
      : apiClient.put(`/content/posts/${params.id}`, body).then((r) => r.data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['posts'] });
      void navigate({ to: '/content/posts' });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => apiClient.post(`/content/posts/${params.id}/publish`).then((r) => r.data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['posts'] });
      await qc.invalidateQueries({ queryKey: ['post', params.id] });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({ title, slug, excerpt, content });
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{isNew ? 'New Post' : 'Edit Post'}</h1>
        <div className="flex gap-2">
          {!isNew && data?.post.status !== 'published' && (
            <button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className="px-4 py-2 rounded-md text-sm border border-green-600 text-green-600 hover:bg-green-50"
            >
              Publish
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-700 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (isNew) setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
            }}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
          <input
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
          />
        </div>
      </div>
    </div>
  );
}
