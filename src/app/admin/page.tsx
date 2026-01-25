import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function AdminDashboard() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <Link href="/admin/workouts/new">
          <Button>+ Create New Workout</Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-2">Workout Management</h2>
          <p className="text-slate-500 mb-4">Create, edit, and organize standard exercises and workout templates.</p>
          <div className="space-y-2">
            <Link href="/admin/workouts/new" className="block text-sm text-[var(--color-primary)] hover:underline">
              Create New Workout Item
            </Link>
            {/* Future: Link to list of workouts */}
            <span className="block text-sm text-slate-400">Manage Existing (Coming Soon)</span>
          </div>
        </Card>
        
        {/* Placeholder for other admin modules */}
        <Card className="p-6 opacity-50">
          <h2 className="text-xl font-semibold mb-2">User Management</h2>
          <p className="text-slate-500 mb-4">Manage user accounts and permissions.</p>
          <span className="text-xs bg-slate-100 px-2 py-1 rounded">Coming Soon</span>
        </Card>
      </div>
    </div>
  );
}
