import type { ComponentType } from "react";
// Per-icon imports: the package entry pulls in all ~1500 icons.
import Car from "lucide-react-native/icons/car";
import Ellipsis from "lucide-react-native/icons/ellipsis";
import GraduationCap from "lucide-react-native/icons/graduation-cap";
import HeartPulse from "lucide-react-native/icons/heart-pulse";
import House from "lucide-react-native/icons/house";
import PartyPopper from "lucide-react-native/icons/party-popper";
import Repeat from "lucide-react-native/icons/repeat";
import Tag from "lucide-react-native/icons/tag";
import Utensils from "lucide-react-native/icons/utensils";

type Icon = ComponentType<{ color?: string; size?: number }>;

/**
 * Category `icon` keys → Lucide icons. `home` and `more-horizontal` are
 * the names the seed uses; Lucide has since renamed them.
 */
const ICONS: Record<string, Icon> = {
  utensils: Utensils,
  car: Car,
  home: House,
  house: House,
  "party-popper": PartyPopper,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  repeat: Repeat,
  "more-horizontal": Ellipsis,
  ellipsis: Ellipsis,
};

/** The category's icon; unknown keys (own categories) get a tag. */
export function CategoryIcon({ icon, color, size }: { icon: string; color: string; size: number }) {
  const Component = ICONS[icon] ?? Tag;
  return <Component color={color} size={size} />;
}
