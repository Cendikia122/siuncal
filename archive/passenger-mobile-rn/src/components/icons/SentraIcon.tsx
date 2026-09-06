import { Lineicons } from "@lineiconshq/react-native-lineicons";
import { IconData } from "@lineiconshq/react-native-lineicons/dist/LineIcon";
import { StyleProp, ViewStyle } from "react-native";

type Props = {
  icon: IconData;
  size?: number;
  color: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

export function SentraIcon({ icon, size = 24, color, strokeWidth = 1.7, style }: Props) {
  return (
    <Lineicons
      icon={icon}
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      style={style}
    />
  );
}
