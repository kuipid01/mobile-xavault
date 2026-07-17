import { StyleSheet, View } from "react-native";

const SkeletonBlock = ({
  height,
  width = "100%",
  radius = 10,
}: {
  height: number;
  width?: number | `${number}%`;
  radius?: number;
}) => (
  <View style={[styles.block, { borderRadius: radius, height, width }]} />
);

export function PlanListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.listWrap}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.planCard}>
          <View style={styles.cardHeader}>
            <SkeletonBlock height={46} width={46} radius={23} />
            <SkeletonBlock height={26} width={76} radius={999} />
          </View>
          <SkeletonBlock height={20} width="62%" />
          <SkeletonBlock height={12} width="82%" radius={6} />
          <View style={styles.amountRow}>
            <View style={styles.amountStack}>
              <SkeletonBlock height={18} width={120} radius={8} />
              <SkeletonBlock height={10} width={66} radius={5} />
            </View>
            <SkeletonBlock height={16} width={42} radius={8} />
          </View>
          <SkeletonBlock height={8} radius={999} />
        </View>
      ))}
    </View>
  );
}

export function PlanDetailSkeleton() {
  return (
    <View style={styles.detailWrap}>
      <View style={styles.topBar}>
        <SkeletonBlock height={42} width={42} radius={21} />
        <SkeletonBlock height={34} width={104} radius={999} />
      </View>

      <View style={styles.heroCard}>
        <View style={styles.cardHeader}>
          <View style={styles.heroTitleStack}>
            <SkeletonBlock height={12} width={108} radius={6} />
            <SkeletonBlock height={28} width="72%" />
          </View>
          <SkeletonBlock height={46} width={46} radius={16} />
        </View>
        <SkeletonBlock height={12} width={104} radius={6} />
        <SkeletonBlock height={44} width="76%" radius={14} />
        <SkeletonBlock height={6} radius={999} />
        <View style={styles.pillRow}>
          <SkeletonBlock height={28} width={120} radius={999} />
          <SkeletonBlock height={28} width={142} radius={999} />
        </View>
      </View>

      <View style={styles.statsCard}>
        {[0, 1, 2].map((item) => (
          <View key={item} style={styles.statCell}>
            <SkeletonBlock height={32} width={32} radius={10} />
            <SkeletonBlock height={10} width={72} radius={5} />
            <SkeletonBlock height={14} width="84%" radius={7} />
          </View>
        ))}
      </View>

      <SkeletonBlock height={20} width={112} />
      <SkeletonBlock height={12} width={210} radius={6} />
      <EnvelopeListSkeleton count={2} />
    </View>
  );
}

export function EnvelopeListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.envelopeList}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={styles.envelopeCard}>
          <SkeletonBlock height={52} width={52} radius={26} />
          <View style={styles.envelopeCopy}>
            <View style={styles.cardHeader}>
              <SkeletonBlock height={16} width="54%" radius={8} />
              <SkeletonBlock height={22} width={72} radius={999} />
            </View>
            <View style={styles.cardHeader}>
              <SkeletonBlock height={13} width={88} radius={7} />
              <SkeletonBlock height={12} width={112} radius={6} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

export function EnvelopeDetailSkeleton() {
  return (
    <View style={styles.detailWrap}>
      <View style={styles.topBar}>
        <SkeletonBlock height={42} width={42} radius={21} />
        <SkeletonBlock height={34} width={98} radius={999} />
      </View>

      <View style={styles.heroCard}>
        <View style={styles.cardHeader}>
          <View style={styles.heroTitleStack}>
            <SkeletonBlock height={12} width={130} radius={6} />
            <SkeletonBlock height={28} width="66%" />
          </View>
          <SkeletonBlock height={46} width={46} radius={16} />
        </View>
        <SkeletonBlock height={12} width={118} radius={6} />
        <SkeletonBlock height={44} width="70%" radius={14} />
        <SkeletonBlock height={6} radius={999} />
        <SkeletonBlock height={28} width={160} radius={999} />
      </View>

      <View style={styles.statsCard}>
        {[0, 1, 2].map((item) => (
          <View key={item} style={styles.statCell}>
            <SkeletonBlock height={32} width={32} radius={10} />
            <SkeletonBlock height={10} width={68} radius={5} />
            <SkeletonBlock height={14} width="80%" radius={7} />
          </View>
        ))}
      </View>

      <SkeletonBlock height={20} width={136} />
      <SkeletonBlock height={12} width={170} radius={6} />
      <EnvelopeListSkeleton count={1} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: "#E5ECE8",
  },
  listWrap: {
    gap: 16,
  },
  planCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E7ECE9",
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  amountRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  amountStack: {
    gap: 7,
  },
  detailWrap: {
    flex: 1,
    gap: 14,
    paddingBottom: 110,
    paddingHorizontal: 18,
    paddingTop: 56,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  heroCard: {
    backgroundColor: "#063B2E",
    borderRadius: 28,
    gap: 18,
    overflow: "hidden",
    padding: 22,
  },
  heroTitleStack: {
    flex: 1,
    gap: 8,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statsCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DDE6E1",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
  },
  statCell: {
    flex: 1,
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  envelopeList: {
    gap: 10,
  },
  envelopeCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E7ECE9",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 16,
    padding: 18,
  },
  envelopeCopy: {
    flex: 1,
    gap: 12,
  },
});
