import AuthGate from "./AuthGate";
import { supabase } from "./supabase";
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  House,
  ChefHat,
  ShoppingBasket,
  Receipt,
  Wallet,
  PiggyBank,
  CalendarClock,
  CreditCard,
  ListTodo,
  Bell,
  Plus,
  Trash2,
  CheckCircle2,
  Copy,
  Link,
  Menu,
  ChevronRight,
  MessageCircle,
  Send,
  CornerUpLeft,
  Pin,
  Heart,
} from "lucide-react";
import "./style.css";
const fmt = (n) => "RM " + Number(n || 0).toFixed(2);
const seed = {
  recipes: [],
  grocery: [],
  receipts: [],
  expenses: [],
  savings: [],
  tasks: [],
  cards: [],
  chat: [],
  commitments: [
    {
      id: "car",
      name: "Jaecoo J5 Car Loan",
      amount: 1154,
      months: 108,
      start: "2026-10",
      dueDay: 15,
      paid: {},
    },
  ],
};
const sections = [
  ["Dashboard", House],
  ["Recipes", ChefHat],
  ["Grocery", ShoppingBasket],
  ["Receipts", Receipt],
  ["Expenses", Wallet],
  ["Savings", PiggyBank],
  ["Commitments", CalendarClock],
  ["Shared CC", CreditCard],
  ["To-do", ListTodo],
  ["OurChat", MessageCircle],
  ["Reminders", Bell],
];
const uid = () => crypto.randomUUID();
function App() {
  const createHousehold = async () => {
    const { data, error } = await supabase.rpc("create_my_household", {
      household_name: "Our Home",
    });

    if (error) {
      alert("Error: " + error.message);
      return;
    }

    alert("Our Home created successfully!");
    console.log("Household ID:", data);
  };
  const [db, setDb] = useState(() => {
    try {
      return {
        ...seed,
        ...JSON.parse(localStorage.getItem("ourspace-v1") || "{}"),
      };
    } catch {
      return seed;
    }
  });
  const [householdId, setHouseholdId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatError, setChatError] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [reminderLoading, setReminderLoading] = useState(true);
  const [reminderError, setReminderError] = useState("");
  const [reminderSaving, setReminderSaving] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [reminderDraft, setReminderDraft] = useState({ title: "", remind_at: "" });


  useEffect(() => {
    let active = true;
    const loadIdentity = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (userError || !user) {
        setChatError(userError?.message || "Please log in to use OurChat.");
        setChatLoading(false);
        return;
      }
      setCurrentUserId(user.id);
      const { data: membership, error } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (error || !membership) {
        setChatError(error?.message || "No household found. Create Our Home first.");
        setChatLoading(false);
        return;
      }
      setHouseholdId(membership.household_id);
    };
    loadIdentity();
    return () => { active = false; };
  }, []);

  const loadChatMessages = async (homeId, userId) => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, household_id, sender_id, body, reply_to, pinned, created_at")
      .eq("household_id", homeId)
      .order("created_at", { ascending: true });
    if (error) {
      setChatError(error.message);
      setChatLoading(false);
      return;
    }
    const messages = data || [];
    const byId = new Map(messages.map((m) => [m.id, m]));
    setChatMessages(messages.map((m) => ({
      id: m.id,
      text: m.body,
      senderId: m.sender_id,
      who: m.sender_id === userId ? "You" : "Partner",
      time: new Date(m.created_at).toLocaleTimeString("en-MY", {
        hour: "2-digit", minute: "2-digit"
      }),
      pinned: m.pinned,
      reply: byId.get(m.reply_to)?.body || null,
    })));
    setChatError("");
    setChatLoading(false);
  };

  useEffect(() => {
    if (!householdId || !currentUserId) return;
    let active = true;
    const refresh = () => {
      if (active) loadChatMessages(householdId, currentUserId);
    };
    refresh();
    const channel = supabase
      .channel(`ourchat-${householdId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "chat_messages",
        filter: `household_id=eq.${householdId}`
      }, refresh)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [householdId, currentUserId]);

  const sendChatMessage = async () => {
    if (!chatText.trim() || chatSending) return;
    if (!householdId || !currentUserId) {
      alert("Household not ready. Check OurChat status.");
      return;
    }
    setChatSending(true);
    const { error } = await supabase.from("chat_messages").insert({
      household_id: householdId,
      sender_id: currentUserId,
      body: chatText.trim(),
      reply_to: replyTo?.id || null,
    });
    setChatSending(false);
    if (error) {
      setChatError(error.message);
      alert("Failed to send: " + error.message);
      return;
    }
    setChatText("");
    setReplyTo(null);
    await loadChatMessages(householdId, currentUserId);
  };

  const toggleChatPin = async (msg) => {
    const { error } = await supabase.from("chat_messages")
      .update({ pinned: !msg.pinned })
      .eq("id", msg.id)
      .eq("household_id", householdId);
    if (error) {
      alert("Failed to pin: " + error.message);
      return;
    }
    await loadChatMessages(householdId, currentUserId);
  };

  // Grocery uses Supabase as its source of truth, not browser localStorage.
  const [groceryItems, setGroceryItems] = useState([]);
  const [groceryLoading, setGroceryLoading] = useState(true);
  const [groceryError, setGroceryError] = useState("");
  const [grocerySaving, setGrocerySaving] = useState(false);

  const loadGrocery = async (homeId) => {
    const { data, error } = await supabase
      .from("grocery_items")
      .select("id, name, quantity, estimated_price, purchased, created_at")
      .eq("household_id", homeId)
      .order("created_at", { ascending: false });
    if (error) {
      setGroceryError(error.message);
    } else {
      setGroceryItems((data || []).map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity || "",
        price: Number(item.estimated_price || 0),
        done: item.purchased,
      })));
      setGroceryError("");
    }
    setGroceryLoading(false);
  };

  useEffect(() => {
    if (!householdId) return;
    let active = true;
    const refresh = () => { if (active) loadGrocery(householdId); };
    refresh();
    const channel = supabase
      .channel(`grocery-${householdId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "grocery_items",
        filter: `household_id=eq.${householdId}`,
      }, refresh)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [householdId]);

  const addGrocery = async (name, price = 0, quantity = "") => {
    if (!name?.trim()) return false;
    if (!householdId || !currentUserId) {
      alert("Household not ready yet.");
      return false;
    }
    setGrocerySaving(true);
    const { error } = await supabase.from("grocery_items").insert({
      household_id: householdId,
      created_by: currentUserId,
      name: name.trim(),
      quantity: quantity || null,
      estimated_price: Number(price) || 0,
      purchased: false,
    });
    setGrocerySaving(false);
    if (error) {
      setGroceryError(error.message);
      alert("Failed to add grocery: " + error.message);
      return false;
    }
    await loadGrocery(householdId);
    return true;
  };

  const toggleGrocery = async (item) => {
    if (!householdId) return;
    const { error } = await supabase.from("grocery_items")
      .update({ purchased: !item.done })
      .eq("id", item.id)
      .eq("household_id", householdId);
    if (error) alert("Failed to update grocery: " + error.message);
    else await loadGrocery(householdId);
  };

  const deleteGrocery = async (id) => {
    if (!householdId) return;
    const { error } = await supabase.from("grocery_items")
      .delete().eq("id", id).eq("household_id", householdId);
    if (error) alert("Failed to delete grocery: " + error.message);
    else await loadGrocery(householdId);
  };

  const addRecipeIngredientsToGrocery = async (ingredients) => {
    if (!householdId || !currentUserId) {
      alert("Household not ready yet.");
      return;
    }
    const rows = ingredients.filter((v) => String(v).trim()).map((name) => ({
      household_id: householdId,
      created_by: currentUserId,
      name: String(name).trim(),
      estimated_price: 0,
      purchased: false,
    }));
    if (!rows.length) return;
    const { error } = await supabase.from("grocery_items").insert(rows);
    if (error) {
      alert("Failed to add ingredients: " + error.message);
      return;
    }
    await loadGrocery(householdId);
    setTab("Grocery");
  };

  // Recipes are shared through Supabase, with household-scoped access.
  const [recipeItems, setRecipeItems] = useState([]);
  const [recipeLoading, setRecipeLoading] = useState(true);
  const [recipeError, setRecipeError] = useState("");
  const [recipeSaving, setRecipeSaving] = useState(false);

  const loadRecipes = async (homeId) => {
    const { data, error } = await supabase.from("recipes")
      .select("id, title, source_url, ingredients, steps, notes, created_at")
      .eq("household_id", homeId)
      .order("created_at", { ascending: false });
    if (error) {
      setRecipeError(error.message);
    } else {
      setRecipeItems((data || []).map((r) => ({
        id: r.id,
        name: r.title,
        source: r.source_url || (r.notes === "ChatGPT / pasted text" ? r.notes : ""),
        ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
        steps: Array.isArray(r.steps) ? r.steps : [],
      })));
      setRecipeError("");
    }
    setRecipeLoading(false);
  };

  useEffect(() => {
    if (!householdId) return;
    let active = true;
    const refresh = () => { if (active) loadRecipes(householdId); };
    refresh();
    const channel = supabase.channel(`recipes-${householdId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "recipes",
        filter: `household_id=eq.${householdId}`,
      }, refresh)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [householdId]);

  const saveRecipe = async ({ name, source = "", ingredients = [], steps = [] }) => {
    if (!name?.trim() || recipeSaving) return false;
    if (!householdId || !currentUserId) {
      alert("Household not ready yet.");
      return false;
    }
    setRecipeSaving(true);
    const { error } = await supabase.from("recipes").insert({
      household_id: householdId,
      created_by: currentUserId,
      title: name.trim(),
      source_url: source.startsWith("http") ? source.trim() : null,
      ingredients,
      steps,
      notes: source.startsWith("http") ? null : source || null,
    });
    setRecipeSaving(false);
    if (error) {
      setRecipeError(error.message);
      alert("Failed to save recipe: " + error.message);
      return false;
    }
    await loadRecipes(householdId);
    return true;
  };

  const deleteRecipe = async (id) => {
    if (!householdId) return;
    const { error } = await supabase.from("recipes")
      .delete().eq("id", id).eq("household_id", householdId);
    if (error) alert("Failed to delete recipe: " + error.message);
    else await loadRecipes(householdId);
  };

  // Reminders are stored in Supabase, not localStorage.
  const refreshReminders = async (homeId) => {
    const { data, error } = await supabase.from("reminders")
      .select("id, household_id, created_by, title, remind_at, completed, created_at")
      .eq("household_id", homeId)
      .order("remind_at", { ascending: true });
    if (error) { setReminderError(error.message); setReminderLoading(false); return; }
    setReminders(data || []);
    setReminderError("");
    setReminderLoading(false);
  };

  useEffect(() => {
    if (!householdId) return;
    let active = true;
    const refresh = () => { if (active) refreshReminders(householdId); };
    refresh();
    const channel = supabase.channel(`reminders-${householdId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "reminders",
        filter: `household_id=eq.${householdId}`
      }, refresh).subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [householdId]);

  const saveReminder = async () => {
    const title = reminderDraft.title.trim();
    const date = new Date(reminderDraft.remind_at);
    if (!title || !reminderDraft.remind_at || Number.isNaN(date.getTime())) {
      alert("Enter a reminder title and valid date/time."); return;
    }
    if (!householdId || !currentUserId || reminderSaving) return;
    setReminderSaving(true);
    const values = { title, remind_at: date.toISOString() };
    const { error } = editingReminder
      ? await supabase.from("reminders").update(values).eq("id", editingReminder).eq("household_id", householdId)
      : await supabase.from("reminders").insert({ ...values, household_id: householdId, created_by: currentUserId });
    setReminderSaving(false);
    if (error) { setReminderError(error.message); alert("Reminder error: " + error.message); return; }
    setReminderDraft({ title: "", remind_at: "" });
    setEditingReminder(null);
    await refreshReminders(householdId);
  };

  const toggleReminder = async (item) => {
    const { error } = await supabase.from("reminders")
      .update({ completed: !item.completed }).eq("id", item.id).eq("household_id", householdId);
    if (error) { alert("Reminder error: " + error.message); return; }
    await refreshReminders(householdId);
  };

  const deleteReminder = async (id) => {
    const { error } = await supabase.from("reminders")
      .delete().eq("id", id).eq("household_id", householdId);
    if (error) { alert("Reminder error: " + error.message); return; }
    if (editingReminder === id) {
      setEditingReminder(null); setReminderDraft({ title: "", remind_at: "" });
    }
    await refreshReminders(householdId);
  };

  const editReminder = (item) => {
    const d = new Date(item.remind_at);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditingReminder(item.id);
    setReminderDraft({ title: item.title, remind_at: local });
  };

  const [chatText, setChatText] = useState(""),
    [replyTo, setReplyTo] = useState(null),
    [tab, setTab] = useState("Dashboard"),
    [menu, setMenu] = useState(false),
    [draft, setDraft] = useState(""),
    [form, setForm] = useState({}),
    [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  useEffect(
    () => localStorage.setItem("ourspace-v1", JSON.stringify(db)),
    [db],
  );
  const update = (key, val) =>
    setDb((d) => ({
      ...d,
      [key]: typeof val === "function" ? val(d[key]) : val,
    }));
  const add = (key, item) => {
    update(key, (arr) => [{ id: uid(), ...item }, ...arr]);
    setForm({});
  };
  const del = (key, id) => update(key, (arr) => arr.filter((x) => x.id !== id));
  const field = (key, placeholder, type = "text") => (
    <input
      placeholder={placeholder}
      type={type}
      value={form[key] ?? ""}
      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
    />
  );
  const btn = (label, fn) => <button onClick={fn}>{label}</button>;
  const heading = (name, desc) => (
    <div className="heading">
      <h2>{name}</h2>
      <p>{desc}</p>
    </div>
  );
  const tile = (name, value, sub) => (
    <div className="tile">
      <small>{name}</small>
      <strong>{value}</strong>
      <span>{sub}</span>
    </div>
  );
  const expenseTotal = db.expenses.reduce(
    (a, x) => a + Number(x.amount || 0),
    0,
  );
  const receiptsTotal = db.receipts.reduce(
    (a, x) => a + Number(x.total || 0),
    0,
  );
  const car = db.commitments.find((x) => x.id === "car");
  const paidCount = car
    ? Object.values(car.paid || {}).filter(Boolean).length
    : 0;
  const monthsOf = (start, count) => {
    let [y, m] = start.split("-").map(Number);
    return Array.from({ length: count }, (_, i) => {
      let d = new Date(y, m - 1 + i, 1);
      return d.toISOString().slice(0, 7);
    });
  };
  const togglePaid = (id, key) =>
    update("commitments", (a) =>
      a.map((x) =>
        x.id === id ? { ...x, paid: { ...x.paid, [key]: !x.paid?.[key] } } : x,
      ),
    );
  const parseRecipe = async () => {
    const lines = draft
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!lines.length) return;
    const ingredients = [],
      steps = [];
    let mode = "";
    for (const line of lines.slice(1)) {
      if (/^(ingredients|bahan)/i.test(line)) {
        mode = "ing";
        continue;
      }
      if (/^(steps|cara|method|instructions|langkah)/i.test(line)) {
        mode = "steps";
        continue;
      }
      (mode === "steps" ? steps : ingredients).push(
        line.replace(/^[-•\d.)\s]+/, ""),
      );
    }
    const saved = await saveRecipe({
      name: lines[0].replace(/^#+\s*/, ""),
      ingredients,
      steps,
      source: "ChatGPT / pasted text",
    });
    if (saved) setDraft("");
  };
  const list = (key, render) => (
    <div className="stack">
      {(key === "grocery" ? groceryItems : key === "recipes" ? recipeItems : db[key]).length ? (
        (key === "grocery" ? groceryItems : key === "recipes" ? recipeItems : db[key]).map((x) => (
          <div className="item" key={x.id}>
            <div className="grow">{render(x)}</div>
            <button
              className="ghost"
              title="Delete"
              onClick={() => key === "grocery" ? deleteGrocery(x.id) : key === "recipes" ? deleteRecipe(x.id) : del(key, x.id)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))
      ) : (
        <p className="muted">Belum ada data. Add yang pertama dekat atas.</p>
      )}
    </div>
  );
  return (
    <div className="app">
      <aside className={menu ? "open" : ""}>
        <div className="brand">
          ✳ OurSpace <small>our little home</small>
        </div>
        <nav>
          {sections.map(([name, Icon]) => (
            <button
              className={tab === name ? "active" : ""}
              onClick={() => {
                setTab(name);
                setMenu(false);
                setForm({});
              }}
              key={name}
            >
              <Icon size={19} />
              {name}
            </button>
          ))}
        </nav>
        <p className="asidefoot">Free starter · local demo</p>
      </aside>
      <main>
        <header>
          <button className="mobilemenu ghost" onClick={() => setMenu(!menu)}>
            <Menu />
          </button>
          <span>Shared home dashboard</span>
          <span className="avatar">N + H</span>
        </header>
        <div className="content">
          {tab === "Dashboard" && (
            <>
              {heading(
                "Welcome home ♡",
                "Everything for your home, in one place.",
              )}
                  <button onClick={createHousehold}>
      Create Our Home
    </button>
              <div className="tiles">
                {tile(
                  "Recorded expenses",
                  fmt(expenseTotal + receiptsTotal),
                  "Expenses + scanned receipts",
                )}
                {tile(
                  "Grocery items",
                  groceryItems.filter((x) => !x.done).length,
                  "Still to buy",
                )}
                {tile(
                  "Loan instalments paid",
                  paidCount + " / 108",
                  "Jaecoo J5",
                )}
                {tile(
                  "Tasks pending",
                  db.tasks.filter((x) => !x.done).length,
                  "Shared to-do",
                )}
              </div>
              <div className="panel">
                <h3>Quick access</h3>
                <div className="quick">
                  {[
                    "Recipes",
                    "Grocery",
                    "Receipts",
                    "Commitments",
                    "OurChat",
                  ].map((x) => (
                    <button onClick={() => setTab(x)} key={x}>
                      {x}
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="panel">
                <h3>Upcoming commitments</h3>
                {db.commitments.map((c) => (
                  <div className="item" key={c.id}>
                    <span className="grow">
                      <b>{c.name}</b>
                      <small>
                        Due day {c.dueDay || "—"} · {month}
                      </small>
                    </span>
                    <b>{fmt(c.amount)}</b>
                    <input
                      type="checkbox"
                      checked={!!c.paid?.[month]}
                      onChange={() => togglePaid(c.id, month)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "Recipes" && (
            <>
              {heading(
                "Recipe Book",
                "Paste recipes from ChatGPT, or save TikTok links.",
              )}
              <div className="panel">
                <h3>Paste recipe</h3>
                <textarea
                  rows="7"
                  placeholder={
                    "Ayam Masak Lemak\nBahan:\n- Ayam 500g\n- Santan 200ml\nCara:\n1. Tumis bahan\n2. Masak hingga siap"
                  }
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                {btn("Parse & save recipe", parseRecipe)}
                <p className="muted">
                  Text parser works best with Bahan: and Cara: headings. Review
                  results after importing.
                </p>
              </div>
              <div className="panel">
                <h3>Save TikTok link</h3>
                <div className="form">
                  {field("recipeName", "Recipe name")}
                  {field("url", "TikTok URL")}
                  {btn(recipeSaving ? "Saving..." : "Save link", async () => {
                    if (!form.recipeName?.trim() || !form.url?.trim()) return;
                    const saved = await saveRecipe({
                      name: form.recipeName,
                      source: form.url,
                      ingredients: [],
                      steps: [],
                    });
                    if (saved) setForm({});
                  })}
                </div>
              </div>
              {recipeLoading && <p className="muted">Loading recipes...</p>}
              {recipeError && <p className="muted">Recipe error: {recipeError}</p>}
              {!recipeLoading && !recipeError && list("recipes", (x) => (
                <>
                  <b>{x.name}</b>
                  <small>
                    {x.source?.startsWith("http") ? (
                      <a href={x.source} target="_blank">
                        Open TikTok video
                      </a>
                    ) : (
                      x.source
                    )}
                  </small>
                  {x.ingredients?.length > 0 && (
                    <details>
                      <summary>Ingredients ({x.ingredients.length})</summary>
                      {x.ingredients.map((v, i) => (
                        <p key={i}>{v}</p>
                      ))}
                      <button
                        onClick={() => {
                          addRecipeIngredientsToGrocery(x.ingredients);
                        }}
                      >
                        Add ingredients to grocery
                      </button>
                    </details>
                  )}
                  {x.steps?.length > 0 && (
                    <details>
                      <summary>Cooking steps</summary>
                      {x.steps.map((v, i) => (
                        <p key={i}>{v}</p>
                      ))}
                    </details>
                  )}
                </>
              ))}
            </>
          )}
          {tab === "Grocery" && (
            <>
              {heading("Grocery List", "Tick items while shopping.")}
              <div className="panel form">
                {field("name", "Item e.g. Telur 30 biji")}
                {field("price", "Estimated price (RM)", "number")}
                {btn(
                  "Add item",
                  async () => {
                    if (grocerySaving || !form.name?.trim()) return;
                    const saved = await addGrocery(form.name, form.price);
                    if (saved) setForm({});
                  },
                )}
              </div>
              {tile(
                "Estimated total",
                fmt(groceryItems.reduce((a, x) => a + Number(x.price || 0), 0)),
                "Based on entered prices",
              )}
              {groceryLoading && <p className="muted">Loading grocery...</p>}
              {groceryError && <p className="muted">Grocery error: {groceryError}</p>}
              {!groceryLoading && !groceryError && list("grocery", (x) => (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={!!x.done}
                    onChange={() =>
                      toggleGrocery(x)
                    }
                  />
                  <span className={x.done ? "done" : ""}>{x.name}</span>
                  <b>{fmt(x.price)}</b>
                </label>
              ))}
            </>
          )}
          {tab === "Receipts" && (
            <>
              {heading(
                "Receipt Vault",
                "Store receipt breakdowns by month and shop.",
              )}
              <div className="panel">
                <h3>Add receipt breakdown</h3>
                <div className="form">
                  {field("store", "Shop name")}
                  {field("date", "Purchase date", "date")}
                  {field("total", "Total (RM)", "number")}
                  <textarea
                    placeholder={
                      "Items (one per line):\nAyam | 15.90\nTelur | 13.50"
                    }
                    value={form.items || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, items: e.target.value }))
                    }
                  />
                  {btn(
                    "Save receipt",
                    () =>
                      form.store &&
                      add("receipts", {
                        store: form.store,
                        date:
                          form.date || new Date().toISOString().slice(0, 10),
                        total: Number(form.total || 0),
                        items: (form.items || "")
                          .split("\n")
                          .filter(Boolean)
                          .map((s) => {
                            let [name, amount] = s.split("|");
                            return { name, amount: Number(amount || 0) };
                          }),
                      }),
                  )}
                </div>
                <p className="muted">
                  V1 supports manual breakdown. Camera OCR and private
                  receipt-image upload need further integration.
                </p>
              </div>
              {list("receipts", (x) => (
                <>
                  <b>
                    {x.store} · {fmt(x.total)}
                  </b>
                  <small>{x.date}</small>
                  <details>
                    <summary>View item breakdown</summary>
                    {x.items.map((v, i) => (
                      <p key={i}>
                        {v.name} — {fmt(v.amount)}
                      </p>
                    ))}
                  </details>
                </>
              ))}
            </>
          )}
          {tab === "Expenses" && (
            <>
              {heading("Expenses", "Track who paid and where the money went.")}
              <div className="panel form">
                {field("name", "Expense description")}
                {field("amount", "Amount (RM)", "number")}
                <select
                  value={form.payer || "Shared"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, payer: e.target.value }))
                  }
                >
                  <option>Shared</option>
                  <option>Nana</option>
                  <option>Husband</option>
                </select>
                {btn(
                  "Add expense",
                  () =>
                    form.name &&
                    add("expenses", {
                      name: form.name,
                      amount: Number(form.amount || 0),
                      payer: form.payer || "Shared",
                    }),
                )}
              </div>
              {tile("Total logged", fmt(expenseTotal), "Excludes receipts")}
              {list("expenses", (x) => (
                <>
                  <b>
                    {x.name} · {fmt(x.amount)}
                  </b>
                  <small>Paid by {x.payer}</small>
                </>
              ))}
            </>
          )}
          {tab === "Savings" && (
            <>
              {heading("Savings Goals", "Save for your next milestone.")}
              <div className="panel form">
                {field("name", "Goal e.g. Emergency Fund")}
                {field("target", "Target RM", "number")}
                {field("saved", "Saved so far RM", "number")}
                {btn(
                  "Create goal",
                  () =>
                    form.name &&
                    add("savings", {
                      name: form.name,
                      target: Number(form.target || 0),
                      saved: Number(form.saved || 0),
                    }),
                )}
              </div>
              {list("savings", (x) => (
                <>
                  <b>{x.name}</b>
                  <small>
                    {fmt(x.saved)} / {fmt(x.target)}
                  </small>
                  <progress value={x.saved} max={Math.max(1, x.target)} />
                  <div className="form inline">
                    <button
                      onClick={() => {
                        let n = prompt("Amount to add (RM)");
                        if (n !== null && Number(n) > 0)
                          update("savings", (a) =>
                            a.map((y) =>
                              y.id === x.id
                                ? { ...y, saved: y.saved + Number(n) }
                                : y,
                            ),
                          );
                      }}
                    >
                      + Add savings
                    </button>
                  </div>
                </>
              ))}
            </>
          )}
          {tab === "Commitments" && (
            <>
              {heading(
                "Commitments & Loans",
                "Recurring instalments with paid/unpaid tracking.",
              )}
              <div className="panel form">
                {field("name", "Commitment name")}
                {field("amount", "Monthly payment RM", "number")}
                {field("start", "Start month", "month")}
                {field("months", "Duration (months)", "number")}
                {field("dueDay", "Due day (1-28)", "number")}
                {btn(
                  "Add recurring commitment",
                  () =>
                    form.name &&
                    add("commitments", {
                      name: form.name,
                      amount: Number(form.amount || 0),
                      start: form.start || month,
                      months: Number(form.months || 12),
                      dueDay: Number(form.dueDay || 1),
                      paid: {},
                    }),
                )}
              </div>
              <div className="panel">
                <label>
                  View month{" "}
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                </label>
              </div>
              {db.commitments.map((c) => (
                <div className="panel" key={c.id}>
                  <h3>
                    {c.name} <span className="amount">{fmt(c.amount)}/mo</span>
                  </h3>
                  <p className="muted">
                    {c.months} instalments · Due day {c.dueDay} ·{" "}
                    {Object.values(c.paid || {}).filter(Boolean).length} marked
                    paid
                  </p>
                  <div className="monthlist">
                    {monthsOf(c.start, c.months).map((m, i) => (
                      <label key={m} className="month">
                        <input
                          type="checkbox"
                          checked={!!c.paid?.[m]}
                          onChange={() => togglePaid(c.id, m)}
                        />
                        <span>
                          {i + 1}. {m}
                        </span>
                        <b>{c.paid?.[m] ? "Paid" : "Unpaid"}</b>
                      </label>
                    ))}
                  </div>
                  {c.id !== "car" && (
                    <button
                      className="danger"
                      onClick={() => del("commitments", c.id)}
                    >
                      Delete commitment
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
          {tab === "Shared CC" && (
            <>
              {heading(
                "Shared Credit Card",
                "Log purchases by owner, not bank-connected yet.",
              )}
              <div className="panel form">
                {field("name", "Transaction / purchase")}
                {field("amount", "Amount RM", "number")}
                <select
                  value={form.who || "Shared"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, who: e.target.value }))
                  }
                >
                  <option>Shared</option>
                  <option>Nana</option>
                  <option>Husband</option>
                </select>
                {btn(
                  "Add CC transaction",
                  () =>
                    form.name &&
                    add("cards", {
                      name: form.name,
                      amount: Number(form.amount || 0),
                      who: form.who || "Shared",
                      paid: false,
                    }),
                )}
              </div>
              <div className="tiles">
                {["Nana", "Husband", "Shared"].map((w) =>
                  tile(
                    w,
                    fmt(
                      db.cards
                        .filter((x) => x.who === w)
                        .reduce((a, x) => a + Number(x.amount), 0),
                    ),
                    "Tracked transactions",
                  ),
                )}
              </div>
              {list("cards", (x) => (
                <>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={!!x.paid}
                      onChange={() =>
                        update("cards", (a) =>
                          a.map((y) =>
                            y.id === x.id ? { ...y, paid: !y.paid } : y,
                          ),
                        )
                      }
                    />
                    <span>
                      {x.name}
                      <small>
                        {x.who} · {x.paid ? "Settled" : "Unsettled"}
                      </small>
                    </span>
                    <b>{fmt(x.amount)}</b>
                  </label>
                </>
              ))}
            </>
          )}
          {tab === "OurChat" && (
            <>
              {heading("OurChat ♡", "A little corner for the two of you.")}
              <div className="chat-shell">
                <div className="chat-top">
                  <div className="chat-icon">
                    <Heart size={19} />
                  </div>
                  <div>
                    <b>Nana & Husband</b>
                    <small>Private household conversation · Supabase</small>
                  </div>
                </div>
                <div className="chat-messages">
                  {chatLoading && <p className="muted">Loading messages...</p>}
                  {chatError && <p className="muted">Chat error: {chatError}</p>}
                  {!chatLoading && !chatError && chatMessages.length === 0 && (
                    <div className="chat-empty">
                      <MessageCircle size={34} />
                      <h3>Your little chat starts here ♡</h3>
                      <p>
                        Send a message, pin it, or turn it into a grocery item
                        or task.
                      </p>
                    </div>
                  )}
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={
                        "chat-row " + (msg.senderId === currentUserId ? "mine" : "theirs")
                      }
                    >
                      <div className="bubble">
                        {msg.reply && (
                          <div className="chat-quoted">↳ {msg.reply}</div>
                        )}
                        <div>{msg.text}</div>
                        <small>
                          {msg.who} · {msg.time}
                          {msg.pinned ? " · 📌" : ""}
                        </small>
                      </div>
                      <div className="chat-actions">
                        <button title="Reply" onClick={() => setReplyTo(msg)}>
                          <CornerUpLeft size={14} />
                        </button>
                        <button
                          title="Pin"
                          onClick={() => toggleChatPin(msg)}
                        >
                          <Pin size={14} />
                        </button>
                        <button
                          title="Add to grocery"
                          onClick={() => {
                            addGrocery(msg.text).then((saved) => {
                              if (saved) alert("Added to Grocery List");
                            });
                          }}
                        >
                          <ShoppingBasket size={14} />
                        </button>
                        <button
                          title="Add to to-do"
                          onClick={() => {
                            add("tasks", {
                              name: msg.text,
                              owner: "Both",
                              done: false,
                            });
                            alert("Added to To-do");
                          }}
                        >
                          <ListTodo size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="chat-compose">
                  {replyTo && (
                    <div className="reply-preview">
                      Replying to {replyTo.who}: {replyTo.text.slice(0, 70)}{" "}
                      <button
                        className="ghost"
                        onClick={() => setReplyTo(null)}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    sendChatMessage();
                  }}>
                    <input
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value)}
                      placeholder="Type a message..."
                    />
                    <button type="submit" aria-label="Send message" disabled={chatSending || !householdId}>
                      <Send size={18} />
                    </button>
                  </form>
                  <p className="muted">
                    Chat messages are saved in Supabase. Other features still use local storage.
                  </p>
                </div>
              </div>
            </>
          )}
          {tab === "Reminders" && (
            <>
              {heading("Reminders", "Your household reminders, synced across devices.")}
              <div className="panel form">
                <h3>{editingReminder ? "Edit reminder" : "Add reminder"}</h3>
                <input placeholder="Reminder title" value={reminderDraft.title}
                  onChange={(e) => setReminderDraft((d) => ({ ...d, title: e.target.value }))} />
                <input type="datetime-local" value={reminderDraft.remind_at}
                  onChange={(e) => setReminderDraft((d) => ({ ...d, remind_at: e.target.value }))} />
                <button onClick={saveReminder} disabled={reminderSaving || !householdId}>
                  {reminderSaving ? "Saving..." : editingReminder ? "Save changes" : "Add reminder"}
                </button>
                {editingReminder && <button className="ghost" onClick={() => {
                  setEditingReminder(null); setReminderDraft({ title: "", remind_at: "" });
                }}>Cancel edit</button>}
              </div>
              {reminderLoading && <p className="muted">Loading reminders...</p>}
              {reminderError && <p className="muted">Reminder error: {reminderError}</p>}
              {!reminderLoading && !reminderError && reminders.length === 0 &&
                <p className="muted">No reminders yet.</p>}
              <div className="stack">
                {reminders.map((item) => (
                  <div className="item" key={item.id}>
                    <div className="grow">
                      <label className="check">
                        <input type="checkbox" checked={item.completed} onChange={() => toggleReminder(item)} />
                        <span className={item.completed ? "done" : ""}>
                          <b>{item.title}</b>
                          <small>{new Date(item.remind_at).toLocaleString("en-MY", {
                            dateStyle: "medium", timeStyle: "short"
                          })}</small>
                        </span>
                      </label>
                    </div>
                    <button className="ghost" onClick={() => editReminder(item)}>Edit</button>
                    <button className="ghost" title="Delete" onClick={() => deleteReminder(item.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="muted">Reminders sync in real time. Phone push notifications are not enabled yet.</p>
            </>
          )}
          {tab === "To-do" && (
            <>
              {heading("Shared To-do", "A little less to remember.")}
              <div className="panel form">
                {field("name", "New task")}
                {field("due", "Due date", "date")}
                <select
                  value={form.owner || "Both"}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, owner: e.target.value }))
                  }
                >
                  <option>Both</option>
                  <option>Nana</option>
                  <option>Husband</option>
                </select>
                {btn(
                  "Add task",
                  () =>
                    form.name &&
                    add("tasks", {
                      name: form.name,
                      due: form.due,
                      owner: form.owner || "Both",
                      done: false,
                    }),
                )}
              </div>
              {list("tasks", (x) => (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={!!x.done}
                    onChange={() =>
                      update("tasks", (a) =>
                        a.map((y) =>
                          y.id === x.id ? { ...y, done: !y.done } : y,
                        ),
                      )
                    }
                  />
                  <span className={x.done ? "done" : ""}>
                    {x.name}
                    <small>
                      {x.owner} {x.due ? "· " + x.due : ""}
                    </small>
                  </span>
                </label>
              ))}
            </>
          )}
          <footer>
            OurSpace v0.5 · Chat, Grocery, Recipes & Reminders on Supabase · Other features stored locally
          </footer>
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(
  <AuthGate>
    <App />
  </AuthGate>,
);
