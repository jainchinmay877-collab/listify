import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "./supabase";
import { C, Button } from "./ui";

const TITLES = { signin: "Sign in", signup: "Create account", forgot: "Reset password", reset: "Set a new password" };

export default function AuthScreen({ onRecovery }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const goto = (m) => { setMode(m); setErr(""); setMsg(""); };
  const cleanEmail = email.trim().toLowerCase();

  const run = async (fn) => {
    setBusy(true); setErr(""); setMsg("");
    try { await fn(); } catch (e) { setErr(e?.message || "Something went wrong."); }
    finally { setBusy(false); }
  };

  const submit = () => run(async () => {
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) throw new Error("Enter a valid email address.");

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) throw error;
    } else if (mode === "signup") {
      if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
      const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password });
      if (error) throw error;
      if (!data.session) setMsg("Check your email to confirm your account, then sign in.");
    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
      if (error) throw error;
      setMode("reset");
      setMsg("We emailed you a code. Enter it below with a new password.");
    } else if (mode === "reset") {
      if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
      if (!code.trim()) throw new Error("Enter the code from your email.");
      onRecovery(true); // keep this screen up while the temporary session exists
      const { error: e1 } = await supabase.auth.verifyOtp({ email: cleanEmail, token: code.trim(), type: "recovery" });
      if (e1) { onRecovery(false); throw e1; }
      const { error: e2 } = await supabase.auth.updateUser({ password });
      if (e2) throw e2; // stay on this screen so the user can retry
      onRecovery(false);
    }
  });

  const cancelReset = async () => {
    await supabase.auth.signOut({ scope: "local" });
    onRecovery(false);
    goto("signin");
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Text style={s.brand}>Listify</Text>
          <Text style={s.sub}>Photo in, listing out.</Text>
          <Text style={s.title}>{TITLES[mode]}</Text>

          <TextInput style={s.input} placeholder="Email" autoCapitalize="none" autoCorrect={false}
            keyboardType="email-address" textContentType="emailAddress" value={email} onChangeText={setEmail}
            editable={mode !== "reset"} />
          {mode === "reset" && (
            <TextInput style={s.input} placeholder="Code from email" keyboardType="number-pad"
              value={code} onChangeText={setCode} />
          )}
          {mode !== "forgot" && (
            <TextInput style={s.input} placeholder={mode === "reset" ? "New password (8+ characters)" : "Password"}
              secureTextEntry textContentType={mode === "signin" ? "password" : "newPassword"}
              value={password} onChangeText={setPassword} />
          )}

          {!!err && <Text style={s.err}>{err}</Text>}
          {!!msg && <Text style={s.msg}>{msg}</Text>}

          <View style={{ marginTop: 8 }}>
            <Button title={mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Email me a code" : "Save new password"}
              onPress={submit} busy={busy} />
          </View>

          <View style={s.links}>
            {mode === "signin" && (<>
              <TouchableOpacity onPress={() => goto("signup")}><Text style={s.link}>Create an account</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => goto("forgot")}><Text style={s.link}>Forgot password?</Text></TouchableOpacity>
            </>)}
            {(mode === "signup" || mode === "forgot") && (
              <TouchableOpacity onPress={() => goto("signin")}><Text style={s.link}>Back to sign in</Text></TouchableOpacity>
            )}
            {mode === "reset" && (
              <TouchableOpacity onPress={cancelReset}><Text style={s.link}>Cancel</Text></TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  body: { padding: 24, paddingTop: 48 },
  brand: { fontSize: 34, fontWeight: "900", color: C.ink },
  sub: { color: C.muted, marginBottom: 32, marginTop: 2 },
  title: { fontSize: 20, fontWeight: "800", color: C.ink, marginBottom: 14 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 12 },
  err: { color: C.err, marginBottom: 6 },
  msg: { color: C.ok, marginBottom: 6 },
  links: { marginTop: 20, gap: 14, alignItems: "center" },
  link: { color: C.link, fontWeight: "700", fontSize: 15 },
});
