import { create } from 'zustand';

interface UIState {
  isQuickAddOpen: boolean;
  setQuickAddOpen: (isOpen: boolean) => void;
  quickAddText: string;
  setQuickAddText: (text: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isQuickAddOpen: false,
  setQuickAddOpen: (isOpen) => set({ isQuickAddOpen: isOpen }),
  quickAddText: '',
  setQuickAddText: (text) => set({ quickAddText: text }),
}));
