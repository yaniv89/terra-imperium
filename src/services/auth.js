// src/services/auth.js
// Phase F: thin wrappers around supabase-js's auth API (v2: signUp, signInWithPassword, signOut,
// getSession, onAuthStateChange), mirroring src/services/cloudSaves.js's pattern — every function
// takes the client explicitly rather than importing getSupabaseClient() itself, so callers decide
// what "not configured" means for their own UI, and these stay trivially testable against a fake
// client with no env vars or network involved.
export const signUp = async (client, email, password) => {
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;
  return data;
};

export const signIn = async (client, email, password) => {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signOut = async (client) => {
  const { error } = await client.auth.signOut();
  if (error) throw error;
};

// Returns the current session's user, or null if signed out — never throws (a missing/expired
// session is a normal state to check for, not an error).
export const getCurrentUser = async (client) => {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
};

// Subscribes to sign-in/sign-out events; `callback(user | null)` fires immediately on change.
// Returns an unsubscribe function so a React effect can clean up on unmount.
export const onAuthStateChange = (client, callback) => {
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
};
