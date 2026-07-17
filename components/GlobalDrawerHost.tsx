import { DRAWER_REGISTRY } from "@/drawers";
import { useDrawerStore } from "@/store/drawerStore";
import { PropsWithChildren, useEffect } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
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
      onOpen={() => {
        if (!activeDrawerId) {
          closeDrawer();
        }
      }}
      onClose={closeDrawer}
      drawerPosition={entry?.side ?? "left"}
      drawerType="front"
      swipeEnabled={false}
      swipeEdgeWidth={0}
      drawerStyle={styles.drawer}
      overlayStyle={styles.overlay}
      overlayAccessibilityLabel="Close drawer"
      renderDrawerContent={() =>
        Content ? (
          <View style={styles.content} key={activeDrawerId}>
            <Content {...(activeDrawerProps ?? {})} onClose={closeDrawer} />
          </View>
        ) : (
          <View style={styles.content} />
        )
      }
    >
      {children}
    </Drawer>
  );
}

const styles = StyleSheet.create({
  drawer: {
    backgroundColor: "#002626",
    width: 280,
  },
  content: {
    backgroundColor: "#002626",
    flex: 1,
  },
  overlay: {
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },
});
