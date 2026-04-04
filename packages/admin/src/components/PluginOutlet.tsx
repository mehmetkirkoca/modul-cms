import { useEffect, useRef, useState } from 'react';

interface PluginOutletProps {
  component: string;  // custom element name, e.g. 'content-posts-page'
  bundleUrl: string;  // '/plugins/content/admin.js'
}

const loadedBundles = new Set<string>();

export function PluginOutlet({ component, bundleUrl }: PluginOutletProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadError(null);
      try {
        if (!loadedBundles.has(bundleUrl)) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = bundleUrl;
            script.onload = () => { loadedBundles.add(bundleUrl); resolve(); };
            script.onerror = () => reject(new Error(`Failed to load bundle: ${bundleUrl}`));
            document.head.appendChild(script);
          });
        }

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = '';
          const el = document.createElement(component);
          containerRef.current.appendChild(el);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Plugin failed to load');
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      // Clear container so Web Component's disconnectedCallback fires
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [component, bundleUrl]);

  if (loadError) {
    return <div className="text-red-500 text-sm p-4">{loadError}</div>;
  }

  return <div ref={containerRef} className="w-full h-full" />;
}
