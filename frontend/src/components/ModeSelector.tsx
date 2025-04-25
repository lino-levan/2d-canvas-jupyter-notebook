import { useState } from 'react';
import { Move, Hand, Edit3, MousePointer, Link } from 'lucide-react';

export type InteractionMode = 'move' | 'select' | 'create' | 'link';

interface ModeSelectorProps {
  activeMode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
}

const ModeSelector = ({ activeMode, onModeChange }: ModeSelectorProps) => {
  const modes: { id: InteractionMode; icon: React.ReactNode; label: string }[] = [
    { id: 'move', icon: <Move size={18} />, label: 'Move Canvas' },
    { id: 'select', icon: <MousePointer size={18} />, label: 'Select/Edit' },
    { id: 'create', icon: <Edit3 size={18} />, label: 'Create Box' },
    { id: 'link', icon: <Link size={18} />, label: 'Link Boxes' }
  ];

  return (
    <div className="flex bg-gray-100 rounded-md p-1 gap-1">
      {modes.map((mode) => (
        <button
          key={mode.id}
          className={`flex items-center gap-2 border-none py-2 px-3 rounded cursor-pointer transition ${
            activeMode === mode.id 
              ? 'bg-blue-100 text-primary' 
              : 'bg-transparent text-gray-600 hover:bg-blue-50'
          }`}
          onClick={() => onModeChange(mode.id)}
          title={mode.label}
        >
          {mode.icon}
          <span className="text-sm md:block hidden">{mode.label}</span>
        </button>
      ))}
    </div>
  );
};

export default ModeSelector;
