import Ionicons from "@expo/vector-icons/Ionicons";
import { Image, View } from "react-native";
import { SvgXml } from "react-native-svg";

import { appCatalogId } from "../lib/appCatalog";

// Exact bundled brand SVG paths. Sources and attribution: assets/app-logos/README.md.
const vectors: Record<string, string> = {
  paypal:
    '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>PayPal</title><path fill="#003087" d="M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z"/></svg>',
  wise: '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Wise</title><path fill="#163300" d="M6.488 7.469 0 15.05h11.585l1.301-3.576H7.922l3.033-3.507.01-.092L8.993 4.48h8.873l-6.878 18.925h4.706L24 .595H2.543l3.945 6.874Z"/></svg>',
  revolut:
    '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Revolut</title><path fill="#FFFFFF" d="M20.9133 6.9566C20.9133 3.1208 17.7898 0 13.9503 0H2.424v3.8605h10.9782c1.7376 0 3.177 1.3651 3.2087 3.043.016.84-.2994 1.633-.8878 2.2324-.5886.5998-1.375.9303-2.2144.9303H9.2322a.2756.2756 0 0 0-.2755.2752v3.431c0 .0585.018.1142.052.1612L16.2646 24h5.3114l-7.2727-10.094c3.6625-.1838 6.61-3.2612 6.61-6.9494zM6.8943 5.9229H2.424V24h4.4704z"/></svg>',
  binance:
    '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Binance</title><path fill="#F0B90B" d="M16.624 13.9202l2.7175 2.7154-7.353 7.353-7.353-7.352 2.7175-2.7164 4.6355 4.6595 4.6356-4.6595zm4.6366-4.6366L24 12l-2.7154 2.7164L18.5682 12l2.6924-2.7164zm-9.272.001l2.7163 2.6914-2.7164 2.7174v-.001L9.2721 12l2.7164-2.7154zm-9.2722-.001L5.4088 12l-2.6914 2.6924L0 12l2.7164-2.7164zM11.9885.0115l7.353 7.329-2.7174 2.7154-4.6356-4.6356-4.6355 4.6595-2.7174-2.7154 7.353-7.353z"/></svg>',
  redotpay:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 31 31"><path d="M14.9946 12.0645C13.1015 12.0645 11.5664 13.5996 11.5664 15.4927V18.9209H14.9946C16.8878 18.9209 18.4229 17.3858 18.4229 15.4927C18.4229 13.5996 16.8878 12.0645 14.9946 12.0645Z" fill="#EB0028"/><path d="M14.993 0.5C6.71426 0.5 0 7.21426 0 15.493V30.4861H6.85647V15.493C6.85647 11.0005 10.5005 7.35649 14.993 7.35649C19.4856 7.35649 23.1296 11.0005 23.1296 15.493C23.1296 19.9856 19.4856 23.6296 14.993 23.6296H11.5648V30.4861H14.993C23.2718 30.4861 29.9861 23.7718 29.9861 15.493C29.9861 7.21426 23.2718 0.5 14.993 0.5Z" fill="#EB0028"/></svg>',
};
const backgrounds: Record<string, string> = {
  paypal: "#F3F7FF",
  revolut: "#191C1F",
  wise: "#9FE870",
  binance: "#181A20",
  n26: "#FFFFFF",
  bybit: "#FFFFFF",
  wirex: "#FFFFFF",
  redotpay: "#FFF0F3",
  custom: "#EAF1ED",
};

export function AppLogo({ name, size = 56 }: { name: string; size?: number }) {
  const id = appCatalogId(name);
  const glyphSize = size * 0.54;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${id === "custom" ? "Custom app" : name} logo`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        overflow: "hidden",
        backgroundColor: backgrounds[id],
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {vectors[id] ? (
        <SvgXml xml={vectors[id]} width={glyphSize} height={glyphSize} />
      ) : id === "n26" ? (
        <Image
          source={require("../../assets/app-logos/n26.png")}
          style={{ width: size, height: size }}
        />
      ) : id === "wirex" ? (
        <Image
          source={require("../../assets/app-logos/wirex.png")}
          style={{ width: size, height: size }}
        />
      ) : id === "bybit" ? (
        <View
          style={{ width: size * 0.82, height: size * 0.3, overflow: "hidden" }}
        >
          <Image
            source={require("../../assets/app-logos/bybit.jpg")}
            style={{
              position: "absolute",
              width: size * 1.78,
              height: size * 1.067,
              left: -size * 0.475,
              top: -size * 0.171,
            }}
          />
        </View>
      ) : (
        <Ionicons name="apps-outline" size={glyphSize} color="#567367" />
      )}
    </View>
  );
}

export default AppLogo;
