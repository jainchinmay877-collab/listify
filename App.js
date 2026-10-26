import React, { useEffect, useState } from "react";
import { AppState, View, ActivityIndicator, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { supabase, configured } from "./src/supabase";
import AuthScreen from "./src/AuthScreen";
import ListingScreen from "./src/ListingScreen";
import { C } from "./src/ui";

export default function App() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!configured) { setReady(true); return; }
    supabase.auth.getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => {})
      .finally(() => setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    const appSub = AppState.addEventListener("change", (st) => {
      if (st === "active") supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh();
    });
    return () => { sub.subscription.unsubscribe(); appSub.remove(); };
  }, []);

  let screen;
  if (!configured) {
    screen = (
      <View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: C.bg }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: C.ink }}>App is not configured</Text>
        <Text style={{ marginTop: 8, color: C.muted }}>
          Create a .env file with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart with: npx expo start -c
        </Text>
      </View>
    );
  } else if (!ready) {
    screen = <View style={{ flex: 1, justifyContent: "center", backgroundColor: C.bg }}><ActivityIndicator color={C.ink} /></View>;
  } else if (!session || recovery) {
    screen = <AuthScreen onRecovery={setRecovery} />;
  } else {
    screen = <ListingScreen email={session.user?.email ?? ""} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {screen}
    </SafeAreaProvider>
  );
}
