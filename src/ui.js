import React from "react";
import { Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";

export const C = {
  ink: "#14213D", tag: "#FFD60A", bg: "#F4F6F8", card: "#FFFFFF",
  muted: "#6B7280", line: "#E1E5EA", err: "#B3261E", ok: "#1F7A4D", link: "#2557D6",
};

export function Button({ title, onPress, kind = "main", busy, disabled }) {
  const off = disabled || busy;
  return (
    <TouchableOpacity
      style={[s.btn, kind === "main" ? s.main : s.ghost, off && { opacity: 0.45 }]}
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
    >
      {busy ? <ActivityIndicator color={C.ink} /> : (
        <Text style={kind === "main" ? s.mainText : s.ghostText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center", minHeight: 50 },
  main: { backgroundColor: C.tag },
  ghost: { borderWidth: 1.5, borderColor: C.ink, backgroundColor: C.card },
  mainText: { color: C.ink, fontWeight: "800", fontSize: 16 },
  ghostText: { color: C.ink, fontWeight: "700", fontSize: 15 },
});
