import { describe, it, expect, vi } from 'vitest';
import { signUp, signIn, signOut, getCurrentUser, onAuthStateChange } from './auth';

const makeFakeClient = (authOverrides = {}) => ({
  auth: {
    signUp: vi.fn(() => Promise.resolve({ data: { user: { id: 'u1' } }, error: null })),
    signInWithPassword: vi.fn(() => Promise.resolve({ data: { user: { id: 'u1' } }, error: null })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    getSession: vi.fn(() => Promise.resolve({ data: { session: { user: { id: 'u1' } } }, error: null })),
    onAuthStateChange: vi.fn((cb) => {
      cb('SIGNED_IN', { user: { id: 'u1' } });
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    ...authOverrides
  }
});

describe('signUp', () => {
  it('calls supabase auth.signUp with email/password and returns the data', async () => {
    const client = makeFakeClient();
    const result = await signUp(client, 'a@b.com', 'hunter2');
    expect(client.auth.signUp).toHaveBeenCalledWith({ email: 'a@b.com', password: 'hunter2' });
    expect(result.user.id).toBe('u1');
  });

  it('throws the underlying error rather than swallowing it', async () => {
    const client = makeFakeClient({ signUp: vi.fn(() => Promise.resolve({ data: null, error: new Error('email taken') })) });
    await expect(signUp(client, 'a@b.com', 'hunter2')).rejects.toThrow('email taken');
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
