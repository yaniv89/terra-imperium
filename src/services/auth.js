// src/services/auth.js
// Phase F: thin wrappers around supabase-js's auth API (v2: signUp, signInWithPassword, signOut,
// getSession, onAuthStateChange), mirroring src/services/cloudSaves.js's pattern — every function
// takes the client explicitly rather than importing getSupabaseClient() itself, so callers decide
// what "not configured" means for their own UI, and these stay trivially testable against a fake
// client with no env vars or network involved.
// displayName goes into auth.user_metadata.display_name, which supabase/migrations/0003's
// handle_new_user trigger reads when it creates the profiles row — falling back to the email's
// local part if displayName is left empty.
export const signUp = async (client, email, password, displayName) => {
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || undefined } }
  });
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

// Same shape as onAuthStateChange, but for the PASSWORD_RECOVERY event Supabase fires when the
// user lands back on the app via a password-reset email link. `callback()` takes no argument —
// there's nothing to pass beyond "show the set-new-password form now".
export const onPasswordRecovery = (client, callback) => {
  const { data } = client.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') callback();
  });
  return () => data.subscription.unsubscribe();
};

// redirectTo must be an allow-listed URL in the Supabase dashboard (supabase/SETUP.md) or the
// link in the email silently fails to return the user to the app.
export const sendPasswordReset = async (client, email, redirectTo) => {
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
};

export const updatePassword = async (client, newPassword) => {
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw error;
};

export const resendConfirmation = async (client, email) => {
  const { error } = await client.auth.resend({ type: 'signup', email });
  if (error) throw error;
};

// Cascades to the profiles/saves rows via their FK's `on delete cascade` (0003's delete_my_account
// function). Signs the client out afterward, since the session it was holding no longer refers to
// an existing user.
export const deleteMyAccount = async (client) => {
  const { error } = await client.rpc('delete_my_account');
  if (error) throw error;
  await signOut(client);
};

export const getProfile = async (client, userId) => {
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
};

export const updateDisplayName = async (client, displayName) => {
  const { data, error } = await client.from('profiles').update({ display_name: displayName }).select().single();
  if (error) throw error;
  return data;
};

// Supabase's raw auth error messages are written for a developer, not a player. This maps the
// ones the account UI can actually run into to something worth showing; anything unrecognized
// falls through to the original message rather than a generic "something went wrong" that would
// hide a real, actionable cause.
export const friendlyAuthError = (error) => {
  const message = error?.message || String(error);
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email first — check your inbox, or resend the confirmation link.';
  if (/user already registered/i.test(message)) return 'An account with that email already exists — try signing in instead.';
  if (/password.*(at least|should be)/i.test(message)) return 'Password must be at least 8 characters.';
  if (/rate limit/i.test(message)) return 'Too many attempts — wait a minute and try again.';
  if (/network/i.test(message)) return 'Network error — check your connection and try again.';
  return message;
};
