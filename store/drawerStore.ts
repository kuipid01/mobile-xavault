import { create } from "zustand";
import type { DrawerId } from "@/drawers";

type DrawerState = {
  activeDrawerId: DrawerId | null;
  activeDrawerProps: Record<string, unknown> | null;
  openDrawer: (id: DrawerId, props?: Record<string, unknown>) => void;
  closeDrawer: () => void;
};

export const useDrawerStore = create<DrawerState>((set) => ({
  activeDrawerId: null,
  activeDrawerProps: null,
  openDrawer: (id, props = {}) =>
    set({ activeDrawerId: id, activeDrawerProps: props }),
  closeDrawer: () => set({ activeDrawerId: null, activeDrawerProps: null }),
}));
