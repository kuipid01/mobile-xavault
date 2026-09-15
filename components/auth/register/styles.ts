import { COLORS, Radius } from "@/themes/colors";
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  rightIcon: {
    position: "absolute",
    right: 12,
    zIndex: 10,
  },
  container: {
    backgroundColor: "#FFFFFF",
    flexGrow: 1,
    paddingBottom: 32,
    paddingHorizontal: 24,
    // paddingTop: 54,
  },

  closeButton: {
    alignItems: "center",
    height: 30,
    justifyContent: "center",
    marginLeft: -6,
    width: 42,
  },

  artWrap: {
    alignItems: "center",
    marginTop: 150,
  },

  art: {
    height: 252,
    width: 252,
  },

  stepBody: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },

  detailsBody: {
    gap: 15,
    paddingTop: 36,
  },

  // pinBody: {
  //   flex: 1,
  //   justifyContent: "space-between",
  //   paddingBottom: 30,
  //   paddingTop: 100,
  // },
  pinBody: {
    flex: 1,
    paddingBottom: 30,
    paddingTop: 100,
  },
  pinHeader: {
    alignItems: "flex-start",
    marginTop: 20,
  },

  pinSubtitle: {
    color: COLORS.text,
    fontSize: 18,
    lineHeight: 26,
    marginBottom: 30,
    textAlign: "left",
  },

  pinBlock: {
    gap: 38,
    marginTop: 20,
  },

  pinFooter: {
    gap: 18,
    marginTop: 100,
  },

  pinLineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 0,
  },

  pinBox: {
    alignItems: "center",
    borderBottomColor: "#A8B2AE",
    borderBottomWidth: 2,
    height: 64,
    justifyContent: "center",
    width: 60,
  },

  pinText: {
    color: COLORS.primary,
    fontSize: 28,
    fontWeight: "700",
  },

  largeTitle: {
    color: COLORS.primary,
    fontSize: 38,
    fontWeight: "900",
    lineHeight: 44,
    marginBottom: 10,
    marginTop: 18,
    textAlign: "left",
  },

  title: {
    color: COLORS.primary,
    fontSize: 31,
    lineHeight: 48,
    marginBottom: 28,
  },

  fieldWrap: {
    marginBottom: 22,
  },

  fieldRow: {
    borderBottomColor: COLORS.primary,
    borderBottomWidth: 2,
    justifyContent: "center",
    minHeight: 60,
    paddingTop: 18,
    position: "relative",
  },

  fieldInput: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: "600",
    paddingRight: 42,
    paddingTop: 10,
  },

  floatingLabel: {
    color: "#9AA3B2",
    fontSize: 18,
    left: 0,
    position: "absolute",
    top: 18,
  },

  floatingLabelActive: {
    color: "#9AA3B2",
    fontSize: 12,
    top: 0,
  },

  fieldIcon: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    position: "absolute",
    right: 0,
    width: 32,
  },

  fieldLabel: {
    color: COLORS.primary,
    fontSize: 14,
    marginBottom: 0,
  },

  segmentLabel: {
    color: COLORS.primary,
    fontSize: 14,
    marginTop: -2,
  },

  countryGroup: {
    backgroundColor: "#EEF2F0",
    borderRadius: Radius.medium,
    flexDirection: "row",
    gap: 8,
    padding: 5,
  },

  countryOption: {
    alignItems: "center",
    borderRadius: Radius.medium,
    flex: 1,
    height: 42,
    justifyContent: "center",
  },

  countryOptionActive: {
    backgroundColor: COLORS.primary,
  },

  countryText: {
    color: COLORS.text,
    fontSize: 14,
  },

  countryTextActive: {
    color: "#FFFFFF",
  },

  primaryButton: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: Radius.medium,
    height: 52,
    justifyContent: "center",
    marginTop: 2,
  },

  primaryButtonDisabled: {
    opacity: 0.55,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 20,
    letterSpacing: 0.4,
  },

  footerText: {
    color: COLORS.text,
    fontSize: 16,
    marginTop: 28,
    textAlign: "center",
  },

  footerLink: {
    color: COLORS.primary,
  },

  pinField: {
    marginBottom: 12,
  },

  hiddenPinInput: {
    color: "transparent",
    height: 60,
    opacity: 0,
    position: "absolute",
    width: "100%",
    zIndex: 2,
  },
});
