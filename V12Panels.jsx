import React, { useState } from 'react';
import { inventoryStatus } from './v12-utils';

export function NotificationCentre({ notifications: n, navigate }) {
  const [filter, setFilter] = useState('All');
  const [showSnoozed, setShowSnoozed] = useState(false);
  const shown = n.items.filter(x => (showSnoozed || !x.snoozed) && (filter !== 'Unread' || !x.read_at) && (filter !== 'Reminders' || x.group === 'Reminders')).sort((a, b) => b.at - a.at);
  return <section className="v12-page">
    <div className="heading"><span className="eyebrow">A LITTLE LESS TO REMEMBER</span><h2>Notification Centre</h2><p>{n.unread.length} unread · {n.quiet ? 'Quiet hours active' : 'You’re up to date with home'}</p></div>
    <div className="v12-toolbar"><div className="v12-tabs">{['All', 'Unread', 'Reminders'].map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}</div>
      <button disabled={n.busy || !n.unread.length} onClick={() => n.changeStates(n.unread.map(x => x.key), { read_at: new Date().toISOString() })}>Mark all read</button></div>
    <label className="v12-toggle"><input type="checkbox" checked={showSnoozed} onChange={e => setShowSnoozed(e.target.checked)} /> Show snoozed</label>
    {n.error && <p role="alert">{n.error}</p>}
    {!shown.length && <div className="panel v12-empty"><h3>All clear for now ♡</h3><p>No notifications in this view.</p></div>}
    {['OurChat', 'Reminders', 'To-do', 'OurCalendar', 'Commitments'].map(group => {
      const items = shown.filter(x => x.group === group);
      return items.length > 0 && <section key={group} className="notification-group"><h3>{group} <small>{items.length}</small></h3>{items.map(item => <article key={item.key} className={`panel notification ${item.read_at ? '' : 'unread'}`}>
        <div className="grow"><button className="notification-link" onClick={() => { n.changeStates([item.key], { read_at: new Date().toISOString() }); navigate(item.tab, item.target); }}>{item.title}<span aria-hidden="true"> ↗</span></button><p>{item.body}</p><small>{new Date(item.at).toLocaleString()}{item.snoozed ? ` · Snoozed until ${new Date(item.snoozed_until).toLocaleString()}` : ''}</small></div>
        <div className="notification-actions"><button className="ghost" disabled={n.busy} onClick={() => n.changeStates([item.key], { read_at: item.read_at ? null : new Date().toISOString() })}>{item.read_at ? 'Mark unread' : 'Mark read'}</button>
          <button className="ghost" disabled={n.busy} onClick={() => n.changeStates([item.key], { snoozed_until: item.snoozed ? null : new Date(Date.now() + 3600000).toISOString() })}>{item.snoozed ? 'Unsnooze' : 'Snooze 1h'}</button></div>
      </article>)}</section>;
    })}
    <p className="muted">{n.cloud ? 'Read status and preferences sync to your account.' : 'Read status and snooze are private to your account on this browser.'} Notifications reflect loaded messages and due items; completing or deleting an item removes its alert.</p>
  </section>;
}

export function Profile({ notifications: n, pushPanel, ready }) {
  const p = n.preferences;
  return <section className="v12-page"><div className="heading"><span className="eyebrow">MAKE YOURSELF AT HOME</span><h2>Your profile</h2><p>Your own preferences, your shared home.</p></div>
    <div className="panel"><h3>Appearance</h3><div className="v12-tabs">{['light', 'dark'].map(mode => <button key={mode} disabled={!ready || n.busy} aria-pressed={p.appearance === mode} onClick={() => n.savePreferences({ appearance: mode })}>{mode === 'light' ? '☀ Light Mode' : '☾ Dark Mode'}</button>)}</div></div>
    <form className="panel" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); n.savePreferences({ quiet_enabled: data.has('enabled'), quiet_start: data.get('start'), quiet_end: data.get('end'), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }); }} key={`${p.quiet_enabled}-${p.quiet_start}-${p.quiet_end}`}>
      <h3>Quiet hours</h3><label className="v12-toggle"><input name="enabled" type="checkbox" defaultChecked={p.quiet_enabled} /> Pause alerts overnight</label>
      <div className="form"><label className="os-field">From<input name="start" aria-label="Quiet hours start" type="time" required defaultValue={p.quiet_start?.slice(0, 5)} /></label><label className="os-field">Until<input name="end" aria-label="Quiet hours end" type="time" required defaultValue={p.quiet_end?.slice(0, 5)} /></label><button disabled={!ready || n.busy}>Save quiet hours</button></div>
      <p className="muted">Timezone: {p.timezone}. {n.cloud ? 'Push quiet hours apply after the updated push dispatcher is deployed and enabled.' : 'Saved on this browser. Push quiet hours require account sync and the updated dispatcher.'} Notifications remain in the centre. Equal start and end pauses alerts all day.</p>
    </form>
    {n.error && <p role="alert">{n.error}</p>}{pushPanel}
    <p className="muted">OurSpace 1.2 · {n.cloud ? 'Account preferences sync enabled' : 'Preferences saved on this browser'}</p>
  </section>;
}

export function Pantry({ householdId, userId, supabase, addGrocery, onInventory }) {
  const enabled = import.meta.env.VITE_PANTRY_ENABLED === 'true';
  const [items, setItems] = useState([]), [location, setLocation] = useState('All'), [search, setSearch] = useState('');
  const [draft, setDraft] = useState(null), [busy, setBusy] = useState(false), [loading, setLoading] = useState(enabled), [error, setError] = useState('');
  const load = React.useCallback(async () => {
    if (!enabled || !householdId) return;
    const { data, error } = await supabase.from('pantry_items').select('*').eq('household_id', householdId).order('name');
    if (error) setError('Inventory is unavailable. ' + error.message);
    else { setItems(data || []); onInventory(data || []); setError(''); }
    setLoading(false);
  }, [householdId, enabled, supabase, onInventory]);
  React.useEffect(() => {
    load();
    if (!enabled || !householdId) return;
    const channel = supabase.channel(`pantry-${householdId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'pantry_items', filter: `household_id=eq.${householdId}` }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, enabled, householdId, supabase]);
  const save = async e => {
    e.preventDefault(); if (busy || !householdId || !userId) return;
    setBusy(true); setError('');
    const row = { name: draft.name.trim(), location: draft.location, quantity: Number(draft.quantity), unit: draft.unit.trim(), expiry_date: draft.expiry_date || null, low_stock_threshold: Number(draft.low_stock_threshold) };
    if (!row.name || !row.unit || !Number.isFinite(row.quantity) || row.quantity < 0 || !Number.isFinite(row.low_stock_threshold) || row.low_stock_threshold < 0) { setError('Enter a name, unit and valid quantities.'); setBusy(false); return; }
    const { error } = draft.id ? await supabase.from('pantry_items').update(row).eq('id', draft.id).eq('household_id', householdId) : await supabase.from('pantry_items').insert({ ...row, household_id: householdId, created_by: userId });
    if (error) setError('Could not save inventory: ' + error.message);
    else { setDraft(null); await load(); }
    setBusy(false);
  };
  const remove = async item => {
    if (busy || !window.confirm(`Delete ${item.name} from ${item.location}?`)) return;
    setBusy(true);
    const { error } = await supabase.from('pantry_items').delete().eq('id', item.id).eq('household_id', householdId);
    if (error) setError(error.message); else await load();
    setBusy(false);
  };
  return <section className="v12-page"><div className="heading"><span className="eyebrow">A WELL STOCKED LITTLE HOME</span><h2>Pantry & Fridge</h2><p>Know what’s here. Use it while it’s fresh.</p></div>
    {!enabled ? <div className="panel"><h3>Your kitchen inventory is coming next</h3><p>Shared inventory hasn’t been enabled for this home yet.</p><p className="muted">Pantry, Fridge and Freezer will keep quantities, expiry dates and low-stock items together.</p></div> : <>
      <div className="v12-toolbar"><div className="v12-tabs">{['All', 'Pantry', 'Fridge', 'Freezer'].map(x => <button key={x} aria-pressed={location === x} onClick={() => setLocation(x)}>{x}</button>)}</div><button disabled={!householdId || busy} onClick={() => setDraft({ name: '', location: location === 'All' ? 'Pantry' : location, quantity: 1, unit: 'pcs', expiry_date: '', low_stock_threshold: 1 })}>+ Add item</button></div>
      <label className="os-field">Search inventory<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find an ingredient" /></label>
      {!householdId && <p role="status">Join a household to use shared inventory.</p>}
      {loading && householdId && <p role="status">Loading inventory…</p>}{error && <div role="alert"><p>{error}</p><button onClick={load}>Retry</button></div>}
      <div className="pantry-grid">{items.filter(x => (location === 'All' || x.location === location) && x.name.toLowerCase().includes(search.toLowerCase())).map(item => <article className="panel" key={item.id}>
        <span className={`stock-status ${inventoryStatus(item).replace(' ', '-').toLowerCase()}`}>{inventoryStatus(item)}</span><h3>{item.name}</h3><p>{item.quantity} {item.unit} · {item.location}</p><p className="muted">{item.expiry_date ? `Expiry ${item.expiry_date}` : 'No expiry set'} · Low at {item.low_stock_threshold} {item.unit}</p>
        <div className="v12-actions"><button disabled={busy} onClick={() => setDraft(item)}>Edit</button><button disabled={busy} className="ghost" onClick={async () => { setBusy(true); try { const ok = await addGrocery(item.name, 0, `${Math.max(1, Number(item.low_stock_threshold) + 1 - Number(item.quantity))} ${item.unit}`); if (ok) setError(''); } finally { setBusy(false); } }}>+ Grocery</button><button disabled={busy} className="ghost" onClick={() => remove(item)}>Delete</button></div>
      </article>)}</div>
      {!loading && !error && !items.length && <div className="panel v12-empty">Your shelves are ready for their first item.</div>}
      {draft && <div className="os-modal-overlay"><form className="os-modal" role="dialog" aria-modal="true" aria-label={draft.id ? 'Edit inventory' : 'Add inventory'} onSubmit={save}><h2>{draft.id ? 'Edit item' : 'Stock the kitchen'}</h2>
        {['name', 'quantity', 'unit', 'expiry_date', 'low_stock_threshold'].map(key => <label className="os-field" key={key}>{({ name: 'Item name', quantity: 'Quantity', unit: 'Unit', expiry_date: 'Expiry date (optional)', low_stock_threshold: 'Low-stock threshold' })[key]}<input required={key !== 'expiry_date'} type={key === 'expiry_date' ? 'date' : ['quantity', 'low_stock_threshold'].includes(key) ? 'number' : 'text'} min={['quantity', 'low_stock_threshold'].includes(key) ? 0 : undefined} step="any" value={draft[key] ?? ''} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} /></label>)}
        <label className="os-field">Location<select value={draft.location} onChange={e => setDraft(d => ({ ...d, location: e.target.value }))}>{['Pantry', 'Fridge', 'Freezer'].map(x => <option key={x}>{x}</option>)}</select></label>
        {error && <p role="alert">{error}</p>}<div className="os-modal-actions"><button type="button" disabled={busy} className="os-cancel" onClick={() => setDraft(null)}>Cancel</button><button disabled={busy}>{busy ? 'Saving…' : 'Save item'}</button></div>
      </form></div>}
    </>}
  </section>;
}
