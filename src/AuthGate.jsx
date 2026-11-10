import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setSession(data?.session ?? null);
      if (error) setMessage(error.message);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) { setSession(nextSession); setLoading(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const credentials = { email: email.trim(), password };
      const { data, error } = mode === 'signup'
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);
      if (error) throw error;
      if (mode === 'signup' && !data.session) {
        setMessage('Account created. Check your email to confirm, then log in.');
      }
    } catch (err) {
      setMessage(err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    if (error) setMessage(error.message);
    setBusy(false);
  }

  if (loading) return <div style={styles.center}>Loading OurSpace...</div>;

  if (session) return <>
    <div style={styles.sessionBar}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Signed in: {session.user.email}</span>
      <button type="button" onClick={logout} disabled={busy} style={styles.logout}>Log out</button>
    </div>
    {message && <p role="alert" style={styles.notice}>{message}</p>}
    {children}
  </>;

  return <div style={styles.center}>
    <div style={styles.card}>
      <div style={styles.logo}>✳ OurSpace</div>
      <p style={styles.sub}>our little home ♡</p>
      <h2 style={styles.heading}>{mode === 'login' ? 'Welcome home' : 'Create your account'}</h2>
      <form onSubmit={submit} style={styles.form}>
        <label style={styles.label}>Email</label>
        <input style={styles.input} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
        <label style={styles.label}>Password</label>
        <input style={styles.input} type="password" minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
        <button style={styles.submit} type="submit" disabled={busy}>{busy ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Sign up'}</button>
      </form>
      {message && <p role="alert" style={styles.notice}>{message}</p>}
      <button type="button" style={styles.switch} onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); }}>
        {mode === 'login' ? 'New here? Create account' : 'Already have an account? Log in'}
      </button>
    </div>
  </div>;
}

const styles = {
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#f6f0e9', color: '#2c2520', fontFamily: 'inherit' },
  card: { width: '100%', maxWidth: 410, padding: 32, background: '#fffaf5', border: '1px solid #e8ddd1', borderRadius: 22, boxShadow: '0 16px 50px #5d47331a' },
  logo: { fontWeight: 800, fontSize: 25, letterSpacing: '-.6px' },
  sub: { color: '#8b7766', margin: '4px 0 26px' },
  heading: { fontSize: 22, marginBottom: 20 },
  form: { display: 'flex', flexDirection: 'column', gap: 9 },
  label: { fontSize: 13, fontWeight: 650, marginTop: 6 },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid #dacfc3', borderRadius: 10, padding: '13px 12px', background: 'white', color: '#2c2520', fontSize: 15 },
  submit: { marginTop: 16, padding: 13, background: '#382b25', color: 'white', border: 0, borderRadius: 10, fontWeight: 700, cursor: 'pointer' },
  switch: { display: 'block', margin: '20px auto 0', border: 0, background: 'transparent', color: '#665040', textDecoration: 'underline', cursor: 'pointer' },
  notice: { color: '#8a422f', fontSize: 13, lineHeight: 1.5 },
  sessionBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 18px', background: '#e9dfd3', color: '#382b25', fontSize: 12 },
  logout: { border: '1px solid #bcae9f', background: '#fffaf5', borderRadius: 8, padding: '6px 12px', color: '#382b25', cursor: 'pointer' },
};
