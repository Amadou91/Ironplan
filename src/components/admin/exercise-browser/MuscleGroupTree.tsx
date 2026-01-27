'use client';

import React from 'react';
import { Exercise } from '@/types/domain';
import { ChevronRight, ChevronDown, Check } from 'lucide-react';
import { MUSCLE_MAPPING, REGION_ORDER, BodyRegion, LimbGroup } from '@/lib/muscle-mapping';
import { cn } from '@/lib/utils'; // Assuming generic utility, or I can implement minimal inline

// --- Helper Types ---
type TreeNode = {
  id: string; // 'upper', 'arms', 'biceps'
  label: string;
  count: number;
  level: number;
  children?: TreeNode[];
  isLeaf?: boolean;
  muscleKey?: string; // only for leaves
};

interface MuscleGroupTreeProps {
  exercises: Exercise[];
  filteredExercises: Exercise[]; // used for counts
  selectedMuscle: string | null;
  onSelectMuscle: (muscle: string | null) => void;
}

export function MuscleGroupTree({ 
  exercises, 
  filteredExercises, 
  selectedMuscle, 
  onSelectMuscle 
}: MuscleGroupTreeProps) {
  
  // 1. Build the Tree Structure based on filtered exercises to show relevant counts
  const treeData = React.useMemo(() => {
    // Counts per muscle
    const muscleCounts: Record<string, number> = {};
    filteredExercises.forEach(ex => {
      const muscle = ex.primaryMuscle || 'other';
      muscleCounts[muscle] = (muscleCounts[muscle] || 0) + 1;
    });

    const regions: Record<BodyRegion, {
      limbs: Record<string, { label: string; muscles: string[] }>;
      directMuscles: string[];
    }> = {
      'Upper Body': { limbs: {}, directMuscles: [] },
      'Lower Body': { limbs: {}, directMuscles: [] },
      'Full Body & Core': { limbs: {}, directMuscles: [] },
    };

    // Populate structure
    Object.entries(MUSCLE_MAPPING).forEach(([key, mapping]) => {
      if (!mapping) return;
      const { region, limb, order } = mapping;
      
      // Ensure region exists (safe guard)
      if (!regions[region]) return;

      if (limb) {
        if (!regions[region].limbs[limb]) {
          regions[region].limbs[limb] = { label: limb, muscles: [] };
        }
        regions[region].limbs[limb].muscles.push(key);
      } else {
        regions[region].directMuscles.push(key);
      }
    });

    // Sort function
    const sortByOrder = (aKey: string, bKey: string) => {
      const a = MUSCLE_MAPPING[aKey]?.order || 99;
      const b = MUSCLE_MAPPING[bKey]?.order || 99;
      return a - b;
    };

    // Build Nodes
    return REGION_ORDER.map(regionName => {
      const regionData = regions[regionName];
      if (!regionData) return null;

      const children: TreeNode[] = [];
      let regionCount = 0;

      // Add Limb Groups
      Object.entries(regionData.limbs).forEach(([limbKey, limbData]) => {
        const limbChildren: TreeNode[] = limbData.muscles
          .sort(sortByOrder)
          .map(mKey => {
            const count = muscleCounts[mKey] || 0;
            regionCount += count;
            return {
              id: mKey,
              label: MUSCLE_MAPPING[mKey]?.label || mKey,
              count,
              level: 2,
              isLeaf: true,
              muscleKey: mKey
            };
          });
        
        // Only add limb group if it has muscles with exercises (or always show? Let's show all for discovery)
        // But count aggregation is needed.
        const limbCount = limbChildren.reduce((acc, child) => acc + child.count, 0);

        children.push({
          id: `${regionName}-${limbKey}`,
          label: limbData.label,
          count: limbCount,
          level: 1,
          children: limbChildren,
        });
      });

      // Add Direct Muscles
      regionData.directMuscles.sort(sortByOrder).forEach(mKey => {
        const count = muscleCounts[mKey] || 0;
        regionCount += count;
        children.push({
          id: mKey,
          label: MUSCLE_MAPPING[mKey]?.label || mKey,
          count,
          level: 1, // Direct children of region
          isLeaf: true,
          muscleKey: mKey
        });
      });

      return {
        id: regionName,
        label: regionName,
        count: regionCount,
        level: 0,
        children: children
      } as TreeNode;
    }).filter(Boolean) as TreeNode[];

  }, [filteredExercises]);

  // Expand state management
  const [expandedNodes, setExpandedNodes] = React.useState<Record<string, boolean>>({
    'Upper Body': true,
    'Lower Body': true,
    'Full Body & Core': true,
    'Upper Body-Arms': true,
    'Lower Body-Legs': true
  });

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelect = (node: TreeNode) => {
    if (node.isLeaf && node.muscleKey) {
      onSelectMuscle(selectedMuscle === node.muscleKey ? null : node.muscleKey);
    } else {
      setExpandedNodes(prev => ({ ...prev, [node.id]: !prev[node.id] }));
    }
  };

  return (
    <div className="w-full bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex flex-col h-[calc(100vh-200px)] sticky top-6">
      <div className="p-5 border-b border-border bg-muted/30">
        <h3 className="font-bold text-base uppercase tracking-wider text-muted-foreground">Categories</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {treeData.map(node => (
          <TreeNodeRow 
            key={node.id} 
            node={node} 
            expandedNodes={expandedNodes} 
            onToggle={toggleExpand} 
            onSelect={handleSelect}
            selectedMuscle={selectedMuscle}
          />
        ))}
      </div>
    </div>
  );
}

function TreeNodeRow({ 
  node, 
  expandedNodes, 
  onToggle, 
  onSelect, 
  selectedMuscle 
}: { 
  node: TreeNode; 
  expandedNodes: Record<string, boolean>; 
  onToggle: (id: string, e: React.MouseEvent) => void;
  onSelect: (node: TreeNode) => void;
  selectedMuscle: string | null;
}) {
  const isExpanded = expandedNodes[node.id];
  const isSelected = node.muscleKey === selectedMuscle;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="select-none">
      <div 
        onClick={() => onSelect(node)}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors text-base group",
          isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground",
          node.level === 0 ? "font-bold py-4 text-lg" : "",
          node.level === 1 && !node.isLeaf ? "font-semibold" : ""
        )}
        style={{ paddingLeft: `${(node.level * 20) + 16}px` }}
      >
        {/* Expand Icon */}
        {hasChildren ? (
          <div 
            role="button"
            onClick={(e) => onToggle(node.id, e)}
            className="p-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-5 h-5 opacity-60" /> : <ChevronRight className="w-5 h-5 opacity-60" />}
          </div>
        ) : (
          <span className="w-5" /> // Spacer
        )}

        {/* Label */}
        <span className="flex-1 truncate">{node.label}</span>

        {/* Count Badge */}
        <span className={cn(
          "text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center",
          isSelected 
            ? "bg-primary text-primary-foreground" 
            : "bg-muted-foreground/10 text-muted-foreground group-hover:bg-muted-foreground/20"
        )}>
          {node.count}
        </span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="animate-in slide-in-from-top-1 fade-in-50 duration-200">
          {node.children!.map(child => (
            <TreeNodeRow 
              key={child.id} 
              node={child} 
              expandedNodes={expandedNodes} 
              onToggle={onToggle} 
              onSelect={onSelect}
              selectedMuscle={selectedMuscle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
