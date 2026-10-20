import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, createAuth } from './auth.mjs';

describe('scrypt password hashing', () => {
  it('hash → verify roundtrip', () => {
    const h = hashPassword('monMotDePasse');
    expect(h.startsWith('scrypt:')).toBe(true);
    expect(verifyPassword('monMotDePasse', h)).toBe(true);
    expect(verifyPassword('mauvais', h)).toBe(false);
  });

  it('deux hashs du même mot de passe diffèrent (sel aléatoire)', () => {
    expect(hashPassword('abc123')).not.toBe(hashPassword('abc123'));
  });

  it('vérifie les mots de passe legacy en clair (migration douce)', () => {
    expect(verifyPassword('admin123', 'admin123')).toBe(true);
    expect(verifyPassword('autre', 'admin123')).toBe(false);
  });
});

describe('createAuth — login flow', () => {
  const mkStore = users => {
    let db = { users, sessions: [] };
    return {
      load: async () => db,
      save: async next => {
        db = { ...db, users: next.users, sessions: next.sessions };
      },
      dump: () => db
    };
  };

  it('login OK retourne un token et l\'utilisateur sans mot de passe', async () => {
    const store = mkStore([
      { id: 'u1', username: 'admin', password: 'admin123', name: 'Admin', role: 'Administrateur' }
    ]);
    const auth = createAuth(store);
    const res = await auth.login('admin', 'admin123');
    expect(res.token).toBeTruthy();
    expect(res.user.username).toBe('admin');
    expect(res.user.password).toBeUndefined();
    expect(res.user.passwordHash).toBeUndefined();
    // Le mot de passe en clair a été migré vers un hash
    expect(store.dump().users[0].password).toBeUndefined();
    expect(store.dump().users[0].passwordHash.startsWith('scrypt:')).toBe(true);
  });

  it('mauvais mot de passe / utilisateur inconnu → erreur', async () => {
    const auth = createAuth(
      mkStore([{ id: 'u1', username: 'admin', password: 'admin123', name: 'A', role: 'Administrateur' }])
    );
    expect((await auth.login('admin', 'wrong')).error).toBeTruthy();
    expect((await auth.login('ghost', 'x')).error).toBeTruthy();
  });

  it('compte désactivé → refus de connexion', async () => {
    const auth = createAuth(
      mkStore([
        { id: 'u1', username: 'old', password: 'x', name: 'Old', role: 'Caissier', active: false }
      ])
    );
    const res = await auth.login('old', 'x');
    expect(res.error).toMatch(/désactivé/i);
  });

  it('resolveToken retrouve la session, logout la révoque', async () => {
    const store = mkStore([
      { id: 'u1', username: 'admin', passwordHash: hashPassword('pw'), name: 'A', role: 'Gérant' }
    ]);
    const auth = createAuth(store);
    const { token } = await auth.login('admin', 'pw');
    expect((await auth.resolveToken(token)).user.id).toBe('u1');
    await auth.logout(token);
    expect(await auth.resolveToken(token)).toBeNull();
  });

  it('token inconnu ou absent → null', async () => {
    const auth = createAuth(mkStore([]));
    expect(await auth.resolveToken('bidon')).toBeNull();
    expect(await auth.resolveToken('')).toBeNull();
  });
});
