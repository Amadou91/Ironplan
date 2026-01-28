'use client';

import React from 'react';
import { Activity, Dumbbell, Filter, Heart, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { ExerciseCategory, Goal } from '@/types/domain';
import { cn } from '@/lib/utils';

interface ExerciseFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilters: {
    category: ExerciseCategory[];
    goal: Goal[];
  };
  setActiveFilters: React.Dispatch<React.SetStateAction<{
    category: ExerciseCategory[];
    goal: Goal[];
  }>>;
}

export function ExerciseFilters({ 
  searchQuery, 
  setSearchQuery, 
  activeFilters, 
  setActiveFilters 
}: ExerciseFiltersProps) {

  const categories = [
    { value: 'Strength', label: 'Strength', icon: Dumbbell },
    { value: 'Cardio', label: 'Cardio', icon: Heart },
    { value: 'Mobility', label: 'Yoga / Mobility', icon: Activity }
  ] as { value: ExerciseCategory; label: string; icon: React.ElementType }[];

  const selectCategory = (value: ExerciseCategory) => {
    setActiveFilters(prev => {
      // Single select logic: if already selected, clear it. Otherwise set it as the only one.
      const isSelected = prev.category.includes(value);
      return { 
        ...prev, 
        category: isSelected ? [] : [value] 
      };
    });
  };

  const clearFilters = () => {
    setActiveFilters({ category: [], goal: [] });
    setSearchQuery('');
  };

  const hasFilters = Boolean(searchQuery) || 
    Object.values(activeFilters).some(arr => arr.length > 0);

  return (
    <div className="space-y-5 mb-8">
      {/* Search Bar */}
      <div className="rounded-2xl bg-[var(--color-surface-muted)]/30 border border-[var(--color-border)] p-4 sm:p-5 shadow-sm">
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center">
            <Search className="h-5 w-5" />
          </div>
          <Input 
            placeholder="Search exercises..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-14 pr-12 h-14 text-base font-semibold bg-[var(--color-surface-subtle)] text-[var(--color-text)] rounded-2xl border border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-soft)] focus-visible:border-[var(--color-border-strong)]"
          />
          {searchQuery && (
            <button 
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              aria-label="Clear search"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Chip Filters */}
      <div className="rounded-2xl bg-[var(--color-surface-muted)]/30 border border-[var(--color-border)] p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] border-r border-[var(--color-border)] pr-5">
            <Filter className="w-3.5 h-3.5" />
            <span>Category</span>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap items-center gap-3">
            {categories.map(cat => {
              const Icon = cat.icon;
              const isActive = activeFilters.category.includes(cat.value);
              
              const activeColors: Record<string, string> = {
                Strength: 'bg-blue-500/10 text-blue-600 border-blue-200 shadow-none',
                Cardio: 'bg-rose-500/10 text-rose-600 border-rose-200 shadow-none',
                Mobility: 'bg-teal-500/10 text-teal-600 border-teal-200 shadow-none',
              };

              return (
                <FilterButton 
                  key={cat.value} 
                  isActive={isActive} 
                  onClick={() => selectCategory(cat.value)}
                  activeClassName={activeColors[cat.value]}
                >
                  <Icon className="w-4 h-4" />
                  {cat.label}
                </FilterButton>
              );
            })}
          </div>

          {hasFilters && (
            <button 
              type="button"
              onClick={clearFilters}
              className="ml-auto text-[10px] font-black uppercase tracking-widest text-[var(--color-danger)] hover:text-[var(--color-danger-strong)] transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterButton({ 
  children, 
  isActive, 
  onClick,
  activeClassName
}: { 
  children: React.ReactNode; 
  isActive: boolean; 
  onClick: () => void; 
  activeClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        "inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all duration-300 border min-h-[44px]",
        isActive 
          ? (activeClassName || "bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)] border-[var(--color-primary-border)] shadow-sm") 
          : "bg-[var(--color-bg)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
      )}
    >
      {children}
    </button>
  );
}
