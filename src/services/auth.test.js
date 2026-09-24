import { describe, it, expect, vi } from 'vitest';
import {
  signUp, signIn, signOut, getCurrentUser, onAuthStateChange, onPasswordRecovery,
  sendPasswordReset, updatePassword, resendConfirmation, deleteMyAccount,
  getProfile, updateDisplayName, friendlyAuthError
} from './auth';

const makeFakeClient = (authOverrides = {}, tableOverrides = {}) => ({
  auth: {
    signUp: vi.fn(() => Promise.resolve({ data: { user: { id: 'u1' } }, error: null })),
    signInWithPassword: vi.fn(() => Promise.resolve({ data: { user: { id: 'u1' } }, error: null })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    getSession: vi.fn(() => Promise.resolve({ data: { session: { user: { id: 'u1' } } }, error: null })),
    onAuthStateChange: vi.fn((cb) => {
      cb('SIGNED_IN', { user: { id: 'u1' } });
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    resetPasswordForEmail: vi.fn(() => Promise.resolve({ error: null })),
    updateUser: vi.fn(() => Promise.resolve({ error: null })),
    resend: vi.fn(() => Promise.resolve({ error: null })),
    ...authOverrides
  },
  rpc: vi.fn(() => Promise.resolve({ error: null })),
  from: vi.fn(() => {
    const chain = {
      select: vi.fn(() => chain),
      update: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve({ data: { id: 'u1', display_name: 'Test' }, error: null })),
      ...tableOverrides
    };
    return chain;
  })
});

describe('signUp', () => {
  it('calls supabase auth.signUp with email/password/display name and returns the data', async () => {
    const client = makeFakeClient();
    const result = await signUp(client, 'a@b.com', 'hunter2', 'Zed');
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'hunter2',
      options: { data: { display_name: 'Zed' } }
    });
    expect(result.user.id).toBe('u1');
  });

  it('omits a display name rather than sending an empty string, so the server falls back to the email', async () => {
    const client = makeFakeClient();
    await signUp(client, 'a@b.com', 'hunter2', '');
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'hunter2',
      options: { data: { display_name: undefined } }
    });
  });

  it('throws the underlying error rather than swallowing it', async () => {
    const client = makeFakeClient({ signUp: vi.fn(() => Promise.resolve({ data: null, error: new Error('email taken') })) });
    await expect(signUp(client, 'a@b.com', 'hunter2', 'Zed')).rejects.toThrow('email taken');
  });
});

describe('signIn', () => {
  it('calls supabase auth.signInWithPassword and returns the data', async () => {
    const client = makeFakeClient();
    const result = await signIn(client, 'a@b.com', 'hunter2');
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'hunter2' });
    expect(result.user.id).toBe('u1');
  });

  it('throws on invalid credentials', async () => {
    const client = makeFakeClient({ signInWithPassword: vi.fn(() => Promise.resolve({ data: null, error: new Error('invalid credentials') })) });
    await expect(signIn(client, 'a@b.com', 'wrong')).rejects.toThrow('invalid credentials');
  });
});

describe('signOut', () => {
  it('calls supabase auth.signOut', async () => {
    const client = makeFakeClient();
    await signOut(client);
    expect(client.auth.signOut).toHaveBeenCalled();
  });

  it('throws the underlying error rather than swallowing it', async () => {
    const client = makeFakeClient({ signOut: vi.fn(() => Promise.resolve({ error: new Error('network error') })) });
    await expect(signOut(client)).rejects.toThrow('network error');
  });
});

describe('getCurrentUser', () => {
  it('returns the session user when signed in', async () => {
    const client = makeFakeClient();
    await expect(getCurrentUser(client)).resolves.toEqual({ id: 'u1' });
  });

  it('returns null rather than throwing when there is no session', async () => {
    const client = makeFakeClient({ getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })) });
    await expect(getCurrentUser(client)).resolves.toBeNull();
  });
});

describe('onAuthStateChange', () => {
  it('fires the callback with the user and returns an unsubscribe function', () => {
    const client = makeFakeClient();
    const callback = vi.fn();
    const unsubscribe = onAuthStateChange(client, callback);
    expect(callback).toHaveBeenCalledWith({ id: 'u1' });
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });

  it('fires the callback with null on sign-out', () => {
    const client = makeFakeClient({
      onAuthStateChange: vi.fn((cb) => {
        cb('SIGNED_OUT', null);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      })
    });
    const callback = vi.fn();
    onAuthStateChange(client, callback);
    expect(callback).toHaveBeenCalledWith(null);
  });
});

describe('onPasswordRecovery', () => {
  it('fires only on the PASSWORD_RECOVERY event, with no argument', () => {
    const client = makeFakeClient({
      onAuthStateChange: vi.fn((cb) => {
        cb('SIGNED_IN', { user: { id: 'u1' } });
        cb('PASSWORD_RECOVERY', { user: { id: 'u1' } });
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      })
    });
    const callback = vi.fn();
    onPasswordRecovery(client, callback);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith();
  });
});

describe('sendPasswordReset', () => {
  it('calls resetPasswordForEmail with the redirect url', async () => {
    const client = makeFakeClient();
    await sendPasswordReset(client, 'a@b.com', 'https://example.com/reset');
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.com', { redirectTo: 'https://example.com/reset' });
  });

  it('throws the underlying error rather than swallowing it', async () => {
    const client = makeFakeClient({ resetPasswordForEmail: vi.fn(() => Promise.resolve({ error: new Error('rate limit') })) });
    await expect(sendPasswordReset(client, 'a@b.com', 'https://example.com')).rejects.toThrow('rate limit');
  });
});

describe('updatePassword', () => {
  it('calls updateUser with the new password', async () => {
    const client = makeFakeClient();
    await updatePassword(client, 'newHunter2!');
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: 'newHunter2!' });
  });
});

describe('resendConfirmation', () => {
  it('calls resend with type signup', async () => {
    const client = makeFakeClient();
    await resendConfirmation(client, 'a@b.com');
    expect(client.auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.com' });
  });
});

describe('deleteMyAccount', () => {
  it('calls the delete_my_account RPC and signs out', async () => {
    const client = makeFakeClient();
    await deleteMyAccount(client);
    expect(client.rpc).toHaveBeenCalledWith('delete_my_account');
    expect(client.auth.signOut).toHaveBeenCalled();
  });

  it('throws the underlying error and does not sign out on failure', async () => {
    const client = makeFakeClient();
    client.rpc = vi.fn(() => Promise.resolve({ error: new Error('nope') }));
    await expect(deleteMyAccount(client)).rejects.toThrow('nope');
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });
});

describe('getProfile / updateDisplayName', () => {
  it('getProfile reads the profiles row by id', async () => {
    const client = makeFakeClient();
    const profile = await getProfile(client, 'u1');
    expect(client.from).toHaveBeenCalledWith('profiles');
    expect(profile.id).toBe('u1');
  });

  it('updateDisplayName updates the display_name column', async () => {
    const client = makeFakeClient();
    await updateDisplayName(client, 'NewName');
    const chain = client.from.mock.results[0].value;
    expect(chain.update).toHaveBeenCalledWith({ display_name: 'NewName' });
  });
});

describe('friendlyAuthError', () => {
  it.each([
    ['Invalid login credentials', 'Wrong email or password.'],
    ['Email not confirmed', /Confirm your email/],
    ['User already registered', /already exists/],
    ['Password should be at least 6 characters', 'Password must be at least 8 characters.'],
    ['Email rate limit exceeded', /Too many attempts/],
    ['Failed to fetch: network error', /Network error/]
  ])('maps %s to a friendly message', (raw, expected) => {
    expect(friendlyAuthError(new Error(raw))).toMatch(expected);
  });

  it('passes through an unrecognized message unchanged', () => {
    expect(friendlyAuthError(new Error('something truly novel'))).toBe('something truly novel');
  });
});
