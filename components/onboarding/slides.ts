import type { ComponentType } from "react";

import LockSavings from "@/assets/onboarding/lock-savings.svg";
import SecureWithdraw from "@/assets/onboarding/secure-withdraw.svg";
import SplitMoney from "@/assets/onboarding/split-money.svg";

/**
 * A single onboarding slide.
 *
 * `Image` is the SVG illustration rendered full-size on the slide and
 * `background` is the solid color behind it. The background is also applied
 * to the whole screen (via the container) so the color extends behind the
 * bottom controls instead of stopping at the slide edge.
 */
export type OnboardingSlide = {
  id: string;
  Image: ComponentType<{ width: number; height: number }>;
  background: string;
  title: string;
};

/**
 * The three-step pitch shown to first-time users:
 * split -> lock -> withdraw. Order matters; keep it as the money journey.
 */
export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: "split",
    Image: SplitMoney,
    background: "#F8C9A5",
    title: "Split your money before it slips away.",
  },
  {
    id: "lock",
    Image: LockSavings,
    background: "#9DB9E8",
    title: "Lock savings until your plan is ready.",
  },
  {
    id: "withdraw",
    Image: SecureWithdraw,
    background: "#B7DFC3",
    title: "Withdraw securely when goals unlock.",
  },
];
