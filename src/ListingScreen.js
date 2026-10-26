import React, { useRef, useState } from "react";
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "./supabase";
import { generateListing, deleteAccount } from "./api";
import { C, Button } from "./ui";

const PLATFORMS = ["eBay", "Vinted", "Etsy", "Facebook"];

// Shrinks big photos so uploads are fast and stay under the server limit.
async function prepare(asset) {
  try {
    if (!asset.width || asset.width <= 1280) return { uri: asset.uri, base64: asset.base64 };
    const ctx = ImageManipulator.manipulate(asset.uri);
    ctx.resize({ width: 1280 });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.6, base64: true });
    return { uri: out.uri, base64: out.base64 };
  } catch {
    return { uri: asset.uri, base64: asset.base64 }; // fall back to the original
  }
}

export default function ListingScreen({ email }) {
  const [image, setImage] = useState(null);
  const [platform, setPlatform] = useState("eBay");
  const [loading, setLoading] = useState(false);
  const [listing, setListing] = useState(null);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(null);
  const [showAccount, setShowAccount] = useState(false);
  const reqId = useRef(0);

  const onPicked = async (result) => {
    if (result.canceled || !result.assets?.[0]) return;
    reqId.current += 1; // invalidates any request still in flight
    setLoading(false); setListing(null); setError("");
    const p = await prepare(result.assets[0]);
    if (!p.base64) { setError("Could not read that photo. Try another."); return; }
    setImage({ uri: p.uri, base64: p.base64, mediaType: "image/jpeg" });
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Camera access needed", "Allow camera access in Settings to photograph items."); return; }
    onPicked(await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7, base64: true }));
  };
  const pickPhoto = async () =>
    onPicked(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, base64: true }));

  const generate = async () => {
    if (!image || loading) return;
    const id = ++reqId.current;
    setLoading(true); setError(""); setListing(null);
    try {
      const data = await generateListing(image.base64, image.mediaType, platform);
      if (id !== reqId.current) return; // photo changed meanwhile
      setListing(data);
      if (typeof data.remaining === "number") setRemaining(data.remaining);
    } catch (e) {
      if (id === reqId.current) setError(e?.message || "Something went wrong.");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  };

  const copy = async (label, text) => { await Clipboard.setStringAsync(text); Alert.alert("Copied", `${label} copied.`); };

  const confirmDelete = () =>
    Alert.alert("Delete account?", "This permanently deletes your account and data. It cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try { await deleteAccount(); await supabase.auth.signOut({ scope: "local" }); }
          catch (e) { Alert.alert("Could not delete", e?.message || "Try again."); }
      } },
    ]);

  const hasPrice = listing && listing.price_low != null && listing.price_high != null;
  const fullText = listing ? `${listing.title}\n\n${listing.description}\n\nTags: ${(listing.tags || []).join(", ")}` : "";

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <View>
          <Text style={s.brand}>Listify</Text>
          <Text style={s.sub}>{remaining != null ? `${remaining} free listing${remaining === 1 ? "" : "s"} left today` : "Photo in, listing out."}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowAccount((v) => !v)}><Text style={s.account}>Account</Text></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {showAccount && (
          <View style={s.card}>
            <Text style={s.small}>Signed in as</Text>
            <Text style={s.email}>{email}</Text>
            <View style={{ marginTop: 12, gap: 10 }}>
              <Button kind="ghost" title="Sign out" onPress={() => supabase.auth.signOut()} />
              <Button kind="ghost" title="Delete my account" onPress={confirmDelete} />
            </View>
          </View>
        )}

        <View style={s.photoBox}>
          {image ? <Image source={{ uri: image.uri }} style={s.photo} resizeMode="cover" />
                 : <Text style={s.placeholder}>Add a clear photo of the item</Text>}
        </View>
        <View style={s.row}>
          <View style={{ flex: 1 }}><Button kind="ghost" title="Take photo" onPress={takePhoto} /></View>
          <View style={{ flex: 1 }}><Button kind="ghost" title="Choose photo" onPress={pickPhoto} /></View>
        </View>

        <Text style={s.label}>Where are you selling?</Text>
        <View style={s.chips}>
          {PLATFORMS.map((p) => (
            <TouchableOpacity key={p} style={[s.chip, platform === p && s.chipOn]} onPress={() => setPlatform(p)}>
              <Text style={[s.chipText, platform === p && { color: "#fff" }]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ marginTop: 20 }}>
          <Button title="Create listing" onPress={generate} busy={loading} disabled={!image} />
        </View>
        <Text style={s.note}>Your photo is sent to an AI service (Google) to write the listing.</Text>
        {!!error && <Text style={s.err}>{error}</Text>}

        {listing && (
          <View style={[s.card, { marginTop: 20 }]}>
            {hasPrice && (
              <View style={s.priceTag}>
                <Text style={s.priceText}>{listing.currency_symbol}{listing.price_low} – {listing.currency_symbol}{listing.price_high}</Text>
                <Text style={s.priceNote}>AI estimate. Compare with recent sold listings.</Text>
              </View>
            )}
            <Text style={s.fieldLabel}>Title</Text>
            <Text style={s.title} selectable>{listing.title}</Text>
            <TouchableOpacity onPress={() => copy("Title", listing.title)}><Text style={s.copy}>Copy title</Text></TouchableOpacity>

            <Text style={s.fieldLabel}>Description</Text>
            <Text style={s.desc} selectable>{listing.description}</Text>
            <TouchableOpacity onPress={() => copy("Description", listing.description)}><Text style={s.copy}>Copy description</Text></TouchableOpacity>

            {!!listing.tags?.length && (<>
              <Text style={s.fieldLabel}>Tags</Text>
              <View style={s.chips}>{listing.tags.map((t, i) => <View key={i} style={s.tagChip}><Text style={s.tagText}>{t}</Text></View>)}</View>
            </>)}

            {!!listing.check_before_posting && (<>
              <Text style={s.fieldLabel}>Check before posting</Text>
              <Text style={s.desc}>{listing.check_before_posting}</Text>
            </>)}
            <View style={{ marginTop: 16 }}><Button title="Copy full listing" onPress={() => copy("Listing", fullText)} /></View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.ink, paddingHorizontal: 20, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { color: "#fff", fontSize: 24, fontWeight: "800" },
  sub: { color: C.tag, fontSize: 13, marginTop: 2 },
  account: { color: "#fff", fontWeight: "700", fontSize: 15 },
  body: { padding: 16, paddingBottom: 48 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.line, marginBottom: 14 },
  small: { color: C.muted, fontSize: 13 },
  email: { color: C.ink, fontWeight: "700", fontSize: 16 },
  photoBox: { height: 260, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, borderStyle: "dashed", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  photo: { width: "100%", height: "100%" },
  placeholder: { color: C.muted, fontSize: 15 },
  row: { flexDirection: "row", gap: 10, marginTop: 12 },
  label: { marginTop: 20, marginBottom: 8, color: C.ink, fontWeight: "700", fontSize: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { color: C.ink, fontWeight: "600" },
  note: { color: C.muted, fontSize: 12, marginTop: 10, textAlign: "center" },
  err: { color: C.err, marginTop: 14, fontSize: 14 },
  priceTag: { backgroundColor: C.tag, borderRadius: 10, padding: 14, alignItems: "center", marginBottom: 8 },
  priceText: { color: C.ink, fontSize: 28, fontWeight: "900" },
  priceNote: { color: C.ink, fontSize: 12, marginTop: 2 },
  fieldLabel: { marginTop: 16, color: C.muted, fontWeight: "700", fontSize: 13 },
  title: { color: C.ink, fontSize: 18, fontWeight: "700", marginTop: 4 },
  desc: { color: C.ink, fontSize: 15, lineHeight: 22, marginTop: 4 },
  copy: { color: C.link, fontWeight: "700", marginTop: 6 },
  tagChip: { backgroundColor: C.bg, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10 },
  tagText: { color: C.ink, fontSize: 13 },
});
