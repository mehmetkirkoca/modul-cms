import { Outlet } from '@tanstack/react-router';
import { Sidebar } from './Sidebar.js';
import { Header } from './Header.js';

export function AppShell() {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
