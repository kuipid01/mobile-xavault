import { DRAWER_REGISTRY } from "@/drawers";
import { useDrawerStore } from "@/store/drawerStore";
import { PropsWithChildren, useEffect } from "react";
import { BackHandler, View } from "react-native";
import { Drawer } from "react-native-drawer-layout";

export default function GlobalDrawerHost({ children }: PropsWithChildren) {
  const activeDrawerId = useDrawerStore((state) => state.activeDrawerId);
  const activeDrawerProps = useDrawerStore((state) => state.activeDrawerProps);
  const closeDrawer = useDrawerStore((state) => state.closeDrawer);

  const entry = activeDrawerId ? DRAWER_REGISTRY[activeDrawerId] : null;
  const Content = entry?.component;

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (activeDrawerId) {
        closeDrawer();
        return true;
      }

      return false;
    });

    return () => sub.remove();
  }, [activeDrawerId, closeDrawer]);

  return (
    <Drawer
      open={activeDrawerId !== null}
      onOpen={() => { }}
      onClose={closeDrawer}
      drawerPosition={entry?.side ?? "left"}
      drawerStyle={{ width: 280 }}
      renderDrawerContent={() =>
        Content ? (
          <View style={{ flex: 1 }} key={activeDrawerId}>
            <Content {...(activeDrawerProps ?? {})} onClose={closeDrawer} />
          </View>
        ) : null
      }
    >
      {children}
    </Drawer>
  );
}
