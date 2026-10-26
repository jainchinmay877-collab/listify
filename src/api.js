import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase";

const friendly = (status) =>
  status === 401 ? "Please sign in again."
  : status === 429 ? "Limit reached. Please try again later."
  : status === 413 ? "That photo is too large."
  : "Something went wrong. Please try again.";

async function call(name, body, timeoutMs) {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (!session) throw new Error("Please sign in again.");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body || {}),
      signal: ctrl.signal,
    });
    let payload = null;
    try { payload = await res.json(); } catch { /* non-JSON gateway error */ }
    if (!res.ok) throw new Error(payload?.error || friendly(res.status));
    return payload;
  } catch (e) {
    if (e?.name === "AbortError") throw new Error("This is taking too long. Please try again.");
    if (e?.message === "Network request failed") throw new Error("No connection. Check your internet and try again.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const generateListing = (image, mediaType, platform) =>
  call("generate-listing", { image, mediaType, platform }, 50000);
export const deleteAccount = () => call("delete-account", {}, 20000);
