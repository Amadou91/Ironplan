'use client';

import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { ExerciseCategory, Difficulty, Goal } from '@/types/domain';

interface ExerciseFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilters: {
    category: ExerciseCategory[];
    difficulty: Difficulty[];
    goal: Goal[];
  };
  setActiveFilters: React.Dispatch<React.SetStateAction<{
    category: ExerciseCategory[];
    difficulty: Difficulty[];
    goal: Goal[];
  }>>;
}

export function ExerciseFilters({ 
  searchQuery, 
  setSearchQuery, 
  activeFilters, 
  setActiveFilters 
}: ExerciseFiltersProps) {

  const toggleFilter = <K extends keyof typeof activeFilters>(
    type: K, 
    value: typeof activeFilters[K][number]
  ) => {
    setActiveFilters(prev => {
      const current = prev[type] as string[];
      const next = current.includes(value as string)
        ? current.filter(item => item !== value)
        : [...current, value];
      return { ...prev, [type]: next };
    });
  };

  const clearFilters = () => {
    setActiveFilters({ category: [], difficulty: [], goal: [] });
    setSearchQuery('');
  };

  const hasFilters = searchQuery || 
    Object.values(activeFilters).some(arr => arr.length > 0);

  return (
    <div className="space-y-4 mb-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input 
          placeholder="Search exercises by name, equipment, or muscle..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 h-12 text-base bg-background rounded-xl"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Chip Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center text-sm font-medium text-muted-foreground mr-2">
          <Filter className="w-4 h-4 mr-2" />
          <span>Filters:</span>
        </div>

        {/* Categories */}
        {(['Strength', 'Cardio', 'Yoga'] as ExerciseCategory[]).map(cat => (
          <FilterChip 
            key={cat}
            label={cat}
            isActive={activeFilters.category.includes(cat)}
            onClick={() => toggleFilter('category', cat)}
          />
        ))}

        <div className="w-px h-6 bg-border mx-1" />

        {/* Difficulties */}
        {(['beginner', 'intermediate', 'advanced'] as Difficulty[]).map(diff => (
          <FilterChip 
            key={diff}
            label={diff}
            isActive={activeFilters.difficulty.includes(diff)}
            onClick={() => toggleFilter('difficulty', diff)}
          />
        ))}

        {hasFilters && (
          <button 
            onClick={clearFilters}
            className="ml-auto text-sm font-medium text-destructive hover:underline"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

function FilterChip({ 
  label, 
  isActive, 
  onClick 
}: { 
  label: string; 
  isActive: boolean; 
  onClick: () => void; 
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 rounded-full text-sm font-semibold transition-all border
        ${isActive 
          ? 'bg-primary text-primary-foreground border-primary shadow-sm' 
          : 'bg-secondary/50 text-secondary-foreground border-transparent hover:bg-secondary hover:border-border'
        }
      `}
    >
      <span className="capitalize">{label}</span>
    </button>
  );
}
