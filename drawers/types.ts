import type { ComponentType } from "react";

export type DrawerContentProps<P = Record<string, unknown>> = P & {
  onClose: () => void;
};

export type DrawerRegistryEntry = {
  component: ComponentType<DrawerContentProps>;
  side: "left" | "right";
};
