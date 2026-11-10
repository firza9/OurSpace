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
  Gift, CalendarDays, UtensilsCrossed, Star, X, ArrowLeft, Home, UserRound,
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
  ["OurCalendar", CalendarDays],
  ["Meal Planner", UtensilsCrossed],
  ["OurWishlist", Gift],
  ["Love Jar", Heart],
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
  const [receipts, setReceipts] = useState([]);
  const [receiptLoading, setReceiptLoading] = useState(true);
  const [receiptError, setReceiptError] = useState("");
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptUrls, setReceiptUrls] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [expenseLoading, setExpenseLoading] = useState(true);
  const [expenseError, setExpenseError] = useState("");
  const [expenseSaving, setExpenseSaving] = useState(false);
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

  // Receipts: private Supabase Storage files and household-scoped database rows.
  const refreshReceipts = async (homeId) => {
    const { data, error } = await supabase.from("receipts")
      .select("id, household_id, created_by, merchant, purchased_on, total, image_path, items, created_at")
      .eq("household_id", homeId)
      .order("purchased_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) { setReceiptError(error.message); setReceiptLoading(false); return; }
    setReceipts(data || []);
    setReceiptError("");
    setReceiptLoading(false);
  };

  useEffect(() => {
    if (!householdId) return;
    let active = true;
    const refresh = () => { if (active) refreshReceipts(householdId); };
    refresh();
    const channel = supabase.channel(`receipts-${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "receipts",
        filter: `household_id=eq.${householdId}` }, refresh).subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [householdId]);

  useEffect(() => {
    let active = true;
    const paths = receipts.filter((x) => x.image_path).map((x) => x.image_path);
    if (!paths.length) { setReceiptUrls({}); return; }
    (async () => {
      const pairs = await Promise.all(paths.map(async (path) => {
        const { data, error } = await supabase.storage.from("receipt-images")
          .createSignedUrl(path, 60 * 30);
        return [path, error ? null : data?.signedUrl];
      }));
      if (active) setReceiptUrls(Object.fromEntries(pairs));
    })();
    return () => { active = false; };
  }, [receipts]);

  const addReceipt = async () => {
    const merchant = (form.store || "").trim();
    const total = Number(form.total);
    if (!merchant || form.total === undefined || form.total === "" || !Number.isFinite(total) || total < 0) {
      alert("Enter a shop name and valid total."); return;
    }
    if (!householdId || !currentUserId || receiptSaving) return;
    if (receiptFile && (!receiptFile.type.startsWith("image/") || receiptFile.size > 5 * 1024 * 1024)) {
      alert("Choose an image smaller than 5 MB."); return;
    }
    setReceiptSaving(true);
    setReceiptError("");
    let imagePath = null;
    if (receiptFile) {
      const ext = (receiptFile.name.split(".").pop() || "jpg").toLowerCase();
      imagePath = `${householdId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("receipt-images")
        .upload(imagePath, receiptFile, { contentType: receiptFile.type, upsert: false });
      if (uploadError) { setReceiptError(uploadError.message); setReceiptSaving(false); return; }
    }
    const items = (form.items || "").split("\n").map((line) => line.trim()).filter(Boolean)
      .map((line) => { const [name, amount] = line.split("|"); return { name: name.trim(), amount: Number(amount || 0) }; });
    const { data: saved, error } = await supabase.from("receipts").insert({
      household_id: householdId, created_by: currentUserId, merchant,
      purchased_on: form.date || new Date().toLocaleDateString("en-CA"),
      total, image_path: imagePath, items
    }).select("id").single();
    if (error) {
      if (imagePath) await supabase.storage.from("receipt-images").remove([imagePath]);
      setReceiptError(error.message); setReceiptSaving(false); return;
    }
    if (form.createExpense) {
      const { error: expenseError } = await supabase.from("expenses").insert({
        household_id: householdId, created_by: currentUserId,
        description: merchant, amount: total, category: "Groceries",
        spent_on: form.date || new Date().toLocaleDateString("en-CA"),
        paid_by: currentUserId, receipt_id: saved.id
      });
      if (expenseError) setReceiptError(`Receipt saved, but expense failed: ${expenseError.message}`);
      else await refreshExpenses(householdId);
    }
    setReceiptFile(null);
    setForm({});
    setReceiptSaving(false);
    await refreshReceipts(householdId);
  };

  const deleteReceipt = async (receipt) => {
    if (!householdId || !window.confirm("Delete this receipt?")) return;
    const { error } = await supabase.from("receipts").delete()
      .eq("id", receipt.id).eq("household_id", householdId);
    if (error) { setReceiptError(error.message); return; }
    if (receipt.image_path) {
      const { error: storageError } = await supabase.storage.from("receipt-images").remove([receipt.image_path]);
      if (storageError) setReceiptError(`Receipt deleted, but image cleanup failed: ${storageError.message}`);
    }
    await refreshReceipts(householdId);
    await refreshExpenses(householdId);
  };

  // Expenses are stored in Supabase, scoped to the signed-in household.
  const refreshExpenses = async (homeId) => {
    const { data, error } = await supabase.from("expenses")
      .select("id, household_id, created_by, description, category, amount, spent_on, paid_by, payment_method, receipt_id, created_at")
      .eq("household_id", homeId)
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) { setExpenseError(error.message); setExpenseLoading(false); return; }
    setExpenses(data || []);
    setExpenseError("");
    setExpenseLoading(false);
  };

  useEffect(() => {
    if (!householdId) return;
    let active = true;
    const refresh = () => { if (active) refreshExpenses(householdId); };
    refresh();
    const channel = supabase.channel(`expenses-${householdId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "expenses",
        filter: `household_id=eq.${householdId}`
      }, refresh).subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [householdId]);

  const addExpense = async () => {
    const description = (form.name || "").trim();
    const amount = Number(form.amount);
    if (!description || form.amount === undefined || form.amount === "" || !Number.isFinite(amount) || amount < 0) {
      alert("Enter an expense description and valid amount."); return;
    }
    if (!householdId || !currentUserId || expenseSaving) return;
    setExpenseSaving(true);
    const { error } = await supabase.from("expenses").insert({
      household_id: householdId,
      created_by: currentUserId,
      description,
      amount,
      category: form.category || "Other",
      spent_on: form.spent_on || new Date().toLocaleDateString("en-CA"),
      paid_by: form.payer === "Me" ? currentUserId : null,
      payment_method: null,
    });
    setExpenseSaving(false);
    if (error) { setExpenseError(error.message); alert("Expense error: " + error.message); return; }
    setForm({});
    await refreshExpenses(householdId);
  };

  const deleteExpense = async (id) => {
    if (!householdId) return;
    const { error } = await supabase.from("expenses")
      .delete().eq("id", id).eq("household_id", householdId);
    if (error) { setExpenseError(error.message); alert("Expense error: " + error.message); return; }
    await refreshExpenses(householdId);
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

  // New mockup features: local-first until Supabase tables/policies are confirmed.
  const [extra, setExtra] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ourspace-extras-v1") || "{}"); }
    catch { return {}; }
  });
  const [extraModal, setExtraModal] = useState("");
  const [extraDraft, setExtraDraft] = useState({});
  const [calendarDate, setCalendarDate] = useState(() => new Date().toISOString().slice(0,10));
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0,7));
  const [mealWeek, setMealWeek] = useState(0);
  const [wishlistFilter, setWishlistFilter] = useState("All");
  const [loveOpened, setLoveOpened] = useState(null);
  useEffect(() => localStorage.setItem("ourspace-extras-v1", JSON.stringify(extra)), [extra]);
  const extraItems = key => extra[key] || [];
  const saveExtra = (key, data) => {
    setExtra(v => ({...v, [key]: [{id:uid(), created_at:new Date().toISOString(), ...data}, ...(v[key] || [])]}));
    setExtraDraft({}); setExtraModal("");
  };
  const deleteExtra = (key, id) => setExtra(v => ({...v, [key]:(v[key] || []).filter(x => x.id !== id)}));
  const extraField = (key, label, type="text") => <label className="os-field"><span>{label}</span><input type={type} value={extraDraft[key] || ""} onChange={e=>setExtraDraft(v=>({...v,[key]:e.target.value}))} /></label>;
  const openExtra = type => {setExtraDraft({});setExtraModal(type);};
  const goTab = name => {setTab(name);setMenu(false);setForm({});};
  const monthTitle = new Date(calendarMonth+"-01T12:00:00").toLocaleDateString("en-MY",{month:"long",year:"numeric"});
  const shiftCalendar = n => {const d=new Date(calendarMonth+"-01T12:00:00");d.setMonth(d.getMonth()+n);setCalendarMonth(d.toISOString().slice(0,7));};
  const weekStart = () => {const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7+mealWeek*7);return d;};
  const mealDays = Array.from({length:7},(_,i)=>{const d=weekStart();d.setDate(d.getDate()+i);return {iso:d.toISOString().slice(0,10), day:d.toLocaleDateString("en-MY",{weekday:"short"}), date:d.getDate()};});
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
  const expenseTotal = expenses.reduce(
    (a, x) => a + Number(x.amount || 0),
    0,
  );
  const linkedReceiptIds = new Set(expenses.map((x) => x.receipt_id).filter(Boolean));
  const receiptsTotal = receipts.reduce(
    (a, x) => a + (linkedReceiptIds.has(x.id) ? 0 : Number(x.total || 0)),
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
        <div className="brand"><span className="os-brand-mark">⌂</span> OurSpace ♡<small>our little space, for life together</small></div>
        <nav>{sections.map(([name, Icon]) => <button className={tab === name ? "active" : ""} onClick={()=>goTab(name)} key={name}><Icon size={19}/>{name}</button>)}</nav>
        <p className="asidefoot">Made for our little home ♡</p>
      </aside>
      <main>
        <header className="os-topbar">
          <button className="mobilemenu ghost" onClick={()=>setMenu(!menu)}><Menu /></button>
          <span className="os-top-title">⌂ OurSpace ♡</span>
          <span className="avatar">Our Home ♡</span>
        </header>
        <div className="content">
          {tab === "Dashboard" && (
            <div className="os-home">
              <div className="os-hero"><div className="os-hero-heading">⌂ OurSpace ♡</div><p>Our little space<br/>for life together ♡</p><div className="os-cats"><span>🐱</span><span>🐈</span></div><div className="os-hero-bottom"><strong>Good {new Date().getHours()<12?"morning":new Date().getHours()<18?"afternoon":"evening"}! ♡</strong><span>Here's our space today. ☾</span></div></div>
              <div className="os-menu-grid">{[
                ["OurChat",MessageCircle],["Grocery",ShoppingBasket],["Recipes",ChefHat],
                ["Reminders",Bell],["Expenses",Wallet],["Receipts",Receipt],
                ["Savings",PiggyBank],["Commitments",ListTodo],["Shared CC",CreditCard],
                ["OurCalendar",CalendarDays],["Meal Planner",UtensilsCrossed],["OurWishlist",Gift],["Love Jar",Heart],["To-do",CheckCircle2]
              ].map(([name,Icon])=><button key={name} className="os-menu-tile" onClick={()=>goTab(name)}><Icon size={26} strokeWidth={1.7}/><span>{name}</span></button>)}</div>
              <div className="os-home-summary"><div><small>Expenses recorded</small><b>{fmt(expenseTotal+receiptsTotal)}</b></div><div><small>Grocery to buy</small><b>{groceryItems.filter(x=>!x.done).length}</b></div><div><small>Reminders pending</small><b>{reminders.filter(x=>!x.completed).length}</b></div></div>
            </div>
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
              {heading("Receipt Vault", "Save photos and receipt breakdowns, synced across devices.")}
              <div className="panel">
                <h3>Add receipt</h3>
                <div className="form">
                  {field("store", "Shop name")}
                  {field("date", "Purchase date", "date")}
                  {field("total", "Total (RM)", "number")}
                  <textarea placeholder={"Items (one per line):\nAyam | 15.90\nTelur | 13.50"}
                    value={form.items || ""}
                    onChange={(e) => setForm((f) => ({ ...f, items: e.target.value }))} />
                  <label>Receipt photo (optional, max 5 MB)
                    <input type="file" accept="image/*" capture="environment"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
                  </label>
                  <label><input type="checkbox" checked={!!form.createExpense}
                    onChange={(e) => setForm((f) => ({ ...f, createExpense: e.target.checked }))} />
                    Also add to Expenses</label>
                  <button disabled={receiptSaving || !householdId} onClick={addReceipt}>
                    {receiptSaving ? "Saving..." : "Save receipt"}
                  </button>
                </div>
                <p className="muted">Receipt images are stored privately. Item breakdown is entered manually; OCR isn't enabled yet.</p>
              </div>
              {receiptError && <p className="muted">Receipt error: {receiptError}</p>}
              {receiptLoading && <p className="muted">Loading receipts...</p>}
              <div className="stack">
                {!receiptLoading && !receiptError && receipts.length === 0 && <p className="muted">No receipts yet.</p>}
                {receipts.map((x) => (
                  <div className="item" key={x.id}>
                    <div className="grow">
                      <b>{x.merchant || "Unknown shop"} · {fmt(x.total)}</b>
                      <small>{x.purchased_on || "No date"}</small>
                      {x.image_path && receiptUrls[x.image_path] &&
                        <a href={receiptUrls[x.image_path]} target="_blank" rel="noreferrer">
                          <img src={receiptUrls[x.image_path]} alt={`Receipt from ${x.merchant || "shop"}`}
                            style={{ maxWidth: 180, maxHeight: 220, objectFit: "contain", borderRadius: 10, marginTop: 8 }} />
                        </a>}
                      {Array.isArray(x.items) && x.items.length > 0 && <details>
                        <summary>View item breakdown</summary>
                        {x.items.map((v, i) => <p key={i}>{v.name} — {fmt(v.amount)}</p>)}
                      </details>}
                    </div>
                    <button className="ghost" title="Delete" onClick={() => deleteReceipt(x)}><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "Expenses" && (
            <>
              {heading("Expenses", "Track household spending, synced with Supabase.")}
              <div className="panel form">
                {field("name", "Expense description")}
                {field("amount", "Amount (RM)", "number")}
                {field("spent_on", "Expense date", "date")}
                <select value={form.category || "Other"}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  {["Other", "Food", "Groceries", "Transport", "Bills", "Home", "Shopping", "Health"].map((c) => <option key={c}>{c}</option>)}
                </select>
                <select value={form.payer || "Shared"}
                  onChange={(e) => setForm((f) => ({ ...f, payer: e.target.value }))}>
                  <option value="Shared">Shared / not specified</option>
                  <option value="Me">Paid by me</option>
                </select>
                <button onClick={addExpense} disabled={expenseSaving || !householdId}>
                  {expenseSaving ? "Saving..." : "Add expense"}
                </button>
              </div>
              {expenseError && <p className="muted">Expense error: {expenseError}</p>}
              {expenseLoading && <p className="muted">Loading expenses...</p>}
              {tile("Total logged", fmt(expenseTotal), "Excludes receipts")}
              <div className="stack">
                {!expenseLoading && !expenseError && expenses.length === 0 &&
                  <p className="muted">No expenses yet.</p>}
                {expenses.map((x) => (
                  <div className="item" key={x.id}>
                    <div className="grow">
                      <b>{x.description} · {fmt(x.amount)}</b>
                      <small>{x.spent_on} · {x.category} · {x.paid_by ? (x.paid_by === currentUserId ? "Paid by you" : "Paid by partner") : "Shared / not specified"}</small>
                    </div>
                    <button className="ghost" title="Delete" onClick={() => deleteExpense(x.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
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
          {tab === "OurCalendar" && <div className="os-feature">
            <div className="os-page-heading"><CalendarDays/><h2>OurCalendar ♡</h2></div>
            <div className="os-month-nav"><button className="ghost" onClick={()=>shiftCalendar(-1)}>‹</button><b>{monthTitle}</b><button className="ghost" onClick={()=>shiftCalendar(1)}>›</button></div>
            <div className="os-calendar">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(x=><div className="os-weekday" key={x}>{x}</div>)}{Array.from({length:(new Date(calendarMonth+"-01T12:00:00").getDay()+6)%7},(_,i)=><div key={'blank'+i}/>)}{Array.from({length:new Date(Number(calendarMonth.slice(0,4)),Number(calendarMonth.slice(5)),0).getDate()},(_,i)=>{const day=calendarMonth+"-"+String(i+1).padStart(2,"0");return <button key={day} className={'os-day '+(calendarDate===day?'selected':'')} onClick={()=>setCalendarDate(day)}>{i+1}{extraItems('events').some(x=>x.date===day)&&<i/>}</button>})}</div>
            <div className="os-section-row"><h3>{new Date(calendarDate+"T12:00:00").toLocaleDateString('en-MY',{weekday:'long',day:'numeric',month:'short',year:'numeric'})}</h3><button onClick={()=>openExtra('event')}>+ Add Event</button></div>
            <div className="os-list">{extraItems('events').filter(x=>x.date===calendarDate).map(x=><div className="os-list-card" key={x.id}><CalendarDays/><div><b>{x.title}</b><small>{x.category||'Event'} · {x.time||'All day'}</small></div><button className="ghost" onClick={()=>deleteExtra('events',x.id)}><Trash2 size={17}/></button></div>)}{!extraItems('events').some(x=>x.date===calendarDate)&&<p className="muted">No events yet for this day ♡</p>}</div>
            <div className="os-cats-footer">🐱 ♡ 🐈</div>
          </div>}
          {tab === "Meal Planner" && <div className="os-feature">
            <div className="os-page-heading"><UtensilsCrossed/><h2>Meal Planner ♡</h2></div>
            <div className="os-pills"><span className="selected">Plan</span><button onClick={()=>goTab('Recipes')}>Recipes</button><button onClick={()=>goTab('Grocery')}>Grocery List</button></div>
            <div className="os-month-nav"><button className="ghost" onClick={()=>setMealWeek(v=>v-1)}>‹</button><b>{mealDays[0].iso} — {mealDays[6].iso}</b><button className="ghost" onClick={()=>setMealWeek(v=>v+1)}>›</button></div>
            <div className="os-meal-list">{mealDays.map(day=><div className="os-meal-row" key={day.iso}><div className="os-meal-date"><b>{day.day}</b><strong>{day.date}</strong></div><div className="os-meal-detail">{extraItems('meals').filter(x=>x.date===day.iso).map(x=><div key={x.id} className="os-meal-entry"><span>🍽️</span><div><b>{x.title}</b><small>{x.type||'Dinner'}</small></div><button className="ghost" onClick={()=>deleteExtra('meals',x.id)}><X size={15}/></button></div>)}{!extraItems('meals').some(x=>x.date===day.iso)&&<span className="muted">No meal planned</span>}</div><button className="ghost" onClick={()=>{openExtra('meal');setExtraDraft({date:day.iso,type:'Dinner'});}}><Plus size={19}/></button></div>)}</div>
            <button className="os-primary-wide" onClick={()=>openExtra('meal')}>+ Plan Meal</button>
          </div>}
          {tab === "OurWishlist" && <div className="os-feature">
            <div className="os-page-heading"><Gift/><h2>OurWishlist ♡</h2></div>
            <div className="os-pills">{['All','Home','Travel','Gift'].map(x=><button key={x} className={wishlistFilter===x?'selected':''} onClick={()=>setWishlistFilter(x)}>{x}</button>)}</div>
            <div className="os-list">{extraItems('wishlist').filter(x=>wishlistFilter==='All'||x.category===wishlistFilter).map(x=><div className="os-list-card" key={x.id}><div className="os-wish-icon">{x.category==='Travel'?'✈️':x.category==='Gift'?'🎁':'🛋️'}</div><div><b>{x.title}</b><small>{fmt(x.price)} · {x.category||'Home'}</small>{x.url&&<a href={x.url} target="_blank" rel="noreferrer">View link</a>}</div><button className="ghost" onClick={()=>deleteExtra('wishlist',x.id)}><Trash2 size={17}/></button></div>)}{!extraItems('wishlist').some(x=>wishlistFilter==='All'||x.category===wishlistFilter)&&<p className="muted">Your wishlist is waiting ♡</p>}</div>
            <button className="os-primary-wide" onClick={()=>openExtra('wish')}>+ Add to Wishlist</button><div className="os-cats-footer">🐈 🛒 ♡ 🐱</div>
          </div>}
          {tab === "Love Jar" && <div className="os-feature os-love">
            <div className="os-page-heading"><Heart/><h2>Love Jar ♡</h2></div><p>A little jar of love, notes and appreciation for each other ♡</p>
            <div className="os-jar-art"><div className="os-jar-lid"/><div className="os-jar-body"><span>♡</span><div>💌 💌 💌</div></div><div className="os-jar-cats">🐱　🐈</div></div>
            <button className="os-primary-wide" onClick={()=>{const visible=extraItems('love').filter(x=>!x.open_date||x.open_date<=new Date().toISOString().slice(0,10));if(!visible.length){alert('No notes ready to open yet ♡');return;}setLoveOpened(visible[Math.floor(Math.random()*visible.length)]);}}>Open a Note ♡</button>
            <div className="os-love-actions"><button onClick={()=>openExtra('love')}><span>✎</span>Add a Note</button><button onClick={()=>{openExtra('event');setExtraDraft({category:'Date'});}}><span>♡</span>Surprise Date</button></div>
            <div className="os-section-row"><h3>Recent Notes ♡</h3><small>{extraItems('love').length} notes</small></div>
            {extraItems('love').slice(0,4).map(x=><div className="os-list-card" key={x.id}><Heart size={18}/><div><b>{x.open_date&&x.open_date>new Date().toISOString().slice(0,10)?'Sealed until '+x.open_date:x.note}</b><small>{new Date(x.created_at).toLocaleDateString('en-MY')}</small></div><button className="ghost" onClick={()=>deleteExtra('love',x.id)}><Trash2 size={16}/></button></div>)}
            {loveOpened&&<div className="os-modal-overlay" onClick={()=>setLoveOpened(null)}><div className="os-modal" onClick={e=>e.stopPropagation()}><h2>♡ A note for you</h2><p>{loveOpened.note}</p><button className="os-primary-wide" onClick={()=>setLoveOpened(null)}>Done ♡</button></div></div>}
          </div>}
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
          {extraModal && <div className="os-modal-overlay" onClick={()=>setExtraModal('')}><div className="os-modal" onClick={e=>e.stopPropagation()}><div className="os-modal-title"><h2>{extraModal==='event'?'♡ Add Event':extraModal==='meal'?'🍽 Add Meal':extraModal==='wish'?'🎁 Add to Wishlist':'♡ Add a Love Note'}</h2><button className="ghost" onClick={()=>setExtraModal('')}><X/></button></div><form onSubmit={e=>{e.preventDefault();if(extraModal==='event')saveExtra('events',{...extraDraft,date:extraDraft.date||calendarDate});if(extraModal==='meal')saveExtra('meals',extraDraft);if(extraModal==='wish')saveExtra('wishlist',extraDraft);if(extraModal==='love')saveExtra('love',extraDraft);}}>
            {extraModal==='event'&&<>{extraField('title','Event title')}{extraField('date','Date','date')}{extraField('time','Time','time')}<label className="os-field"><span>Category</span><select value={extraDraft.category||'Date'} onChange={e=>setExtraDraft(v=>({...v,category:e.target.value}))}>{['Date','Appointment','Birthday','Others'].map(x=><option key={x}>{x}</option>)}</select></label></>}
            {extraModal==='meal'&&<>{extraField('title','Meal name')}{extraField('date','Date','date')}<label className="os-field"><span>Meal type</span><select value={extraDraft.type||'Dinner'} onChange={e=>setExtraDraft(v=>({...v,type:e.target.value}))}>{['Breakfast','Lunch','Dinner'].map(x=><option key={x}>{x}</option>)}</select></label></>}
            {extraModal==='wish'&&<>{extraField('title','Item name')}{extraField('price','Price (RM)','number')}<label className="os-field"><span>Category</span><select value={extraDraft.category||'Home'} onChange={e=>setExtraDraft(v=>({...v,category:e.target.value}))}>{['Home','Travel','Gift'].map(x=><option key={x}>{x}</option>)}</select></label>{extraField('url','Link (optional)','url')}</>}
            {extraModal==='love'&&<><label className="os-field"><span>Your note</span><textarea required maxLength={500} value={extraDraft.note||''} onChange={e=>setExtraDraft(v=>({...v,note:e.target.value}))} placeholder="Thank you for always being there for me. ♡"/></label>{extraField('open_date','Open on a specific date (optional)','date')}</>}
            <div className="os-modal-actions"><button type="button" className="os-cancel" onClick={()=>setExtraModal('')}>Cancel</button><button type="submit">Save ♡</button></div></form></div></div>}
          <footer>
            OurSpace v0.6 · Chat, Grocery, Recipes, Reminders & Expenses on Supabase · Other features stored locally
          </footer>
        </div>
        <div className="os-bottom-nav">{[["Dashboard",House,"Home"],["OurChat",MessageCircle,"Chat"],["Meal Planner",Plus,"Plan"],["Reminders",Bell,"Alerts"],["Love Jar",Heart,"Love"]].map(([name,Icon,label])=><button key={name} className={tab===name?'active':''} onClick={()=>goTab(name)}><Icon size={21}/><span>{label}</span></button>)}</div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(
  <AuthGate>
    <App />
  </AuthGate>,
);
