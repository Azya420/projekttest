import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const enabled = Boolean(url && key && !url.includes("YOUR-"));
const supabase = enabled ? createClient(url, key) : null;

const localKey = "ashfall-character-v1";

export const account = {
  enabled,

  async session() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  async signIn(email, password) {
    if (!supabase) return { ok: false, message: "Najpierw skonfiguruj zmienne Supabase." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { ok: false, message: error.message } : { ok: true, message: "Zalogowano." };
  },

  async signUp(email, password) {
    if (!supabase) return { ok: false, message: "Najpierw skonfiguruj zmienne Supabase." };
    const { error } = await supabase.auth.signUp({ email, password });
    return error
      ? { ok: false, message: error.message }
      : { ok: true, message: "Konto utworzone. Sprawdź pocztę." };
  },

  async load() {
    const local = JSON.parse(localStorage.getItem(localKey) || "null");
    if (!supabase) return local;
    const user = await this.session();
    if (!user) return local;
    const { data } = await supabase.from("characters").select("state").eq("user_id", user.id).maybeSingle();
    return data?.state || local;
  },

  async save(state) {
    localStorage.setItem(localKey, JSON.stringify(state));
    if (!supabase) return;
    const user = await this.session();
    if (!user) return;
    await supabase.from("characters").upsert({
      user_id: user.id,
      name: state.player.name,
      vocation: state.player.vocation,
      level: state.player.level,
      state,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
  }
};
