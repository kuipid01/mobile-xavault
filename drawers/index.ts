import ProfileDrawerContent from "./ProfileDrawer";
import type { DrawerRegistryEntry } from "./types";

export const DRAWER_REGISTRY = {
  profile: { component: ProfileDrawerContent, side: "left" },
} satisfies Record<string, DrawerRegistryEntry>;

export type DrawerId = keyof typeof DRAWER_REGISTRY;
