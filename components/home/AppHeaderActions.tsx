import { View } from "react-native";
import ProfileHeader from "./ProfileHeader";
import ActionsHeader from "./actions";

type Props = {
  onDeposit: () => void;
  onWithdraw: () => void;
};

export default function AppHeaderActions({ onDeposit, onWithdraw }: Props) {
  return (
    <View>
      <ProfileHeader />
      <ActionsHeader onDeposit={onDeposit} onWithdraw={onWithdraw} />
    </View>
  );
}
