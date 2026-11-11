import useNotifications from "./useNotifications";
import { NotificationCentre, Profile, Pantry } from "./V12Panels";
import { localDate, monthlySpending, missingIngredients } from "./v12-utils";
import AuthGate from "./AuthGate";
import { supabase } from "./supabase";
import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
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
  Search,
  Smile,
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
  ["Pantry & Fridge", ShoppingBasket],
  ["Profile", UserRound],
];
const uid = () => crypto.randomUUID();
function App() {
  const createHousehold = async () => {
    const { error } = await supabase.rpc("create_my_household", {
      household_name: "Our Home",
    });

    if (error) {
      alert("Error: " + error.message);
      return false;
    }

    return true;
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
  const [inventory, setInventory] = useState([]);
  const [quickAdd, setQuickAdd] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatToolsOpen, setChatToolsOpen] = useState(false);
  const [todoFilter, setTodoFilter] = useState("All");
  const [expenseMonth, setExpenseMonth] = useState(localDate().slice(0,7));
  const [groceryFilter, setGroceryFilter] = useState("All");
  const [pushState, setPushState] = useState("checking");
  const [pushError, setPushError] = useState("");
  const pushSupported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  const urlBase64ToUint8Array = (base64String) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const raw = atob((base64String + padding).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (char) => char.charCodeAt(0));
  };
  useEffect(() => {
    if (!pushSupported) { setPushState("unsupported"); return; }
    let live = true;
    navigator.serviceWorker.register("/sw.js").then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      if (live) setPushState(existing ? "enabled" : Notification.permission === "denied" ? "blocked" : "ready");
    }).catch((error) => { if (live) {setPushError(error.message);setPushState("error");} });
    return () => {live = false;};
  }, []);
  const enablePush = async () => {
    if (!pushSupported) {setPushError("Install OurSpace from Safari Add to Home Screen on iPhone (iOS 16.4+).");return;}
    if (!vapidPublicKey) {setPushError("VITE_VAPID_PUBLIC_KEY is missing from your build environment.");return;}
    if (!householdId || !currentUserId) {setPushError("Log in and join a household first.");return;}
    setPushState("saving");setPushError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {setPushState(permission === "denied" ? "blocked" : "ready");return;}
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(vapidPublicKey)});
      const json = subscription.toJSON();
      const {error} = await supabase.from("push_subscriptions").upsert({
        endpoint:subscription.endpoint,user_id:currentUserId,household_id:householdId,
        p256dh:json.keys.p256dh,auth:json.keys.auth,user_agent:navigator.userAgent
      },{onConflict:"endpoint"});
      if (error) throw error;
      setPushState("enabled");
    } catch(error) {setPushError(error.message);setPushState("error");}
  };
  const disablePush = async () => {
    setPushError("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const {error} = await supabase.from("push_subscriptions").delete().eq("endpoint",sub.endpoint);
        if (error) throw error;
        await sub.unsubscribe();
      }
      setPushState("ready");
    } catch(error) {setPushError(error.message);}
  };
  const [householdId, setHouseholdId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const chatMessagesRef = useRef(null);
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
      createdAt: m.created_at,
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
    const rows = missingIngredients(ingredients, groceryItems, inventory).map((name) => ({
      household_id: householdId,
      created_by: currentUserId,
      name: String(name).trim(),
      estimated_price: 0,
      purchased: false,
    }));
    if (!rows.length) { alert("These ingredients already match your grocery list or available inventory. Check quantities before cooking."); return; }
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
  const [recipeSearch, setRecipeSearch] = useState("");
  const [recipeFilter, setRecipeFilter] = useState("All");
  const [recipeSort, setRecipeSort] = useState("Newest");
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeComposer, setRecipeComposer] = useState(false);
  const [recipeFavorites, setRecipeFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ourspace-recipe-favorites") || "[]"); }
    catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem("ourspace-recipe-favorites", JSON.stringify(recipeFavorites));
  }, [recipeFavorites]);
  const toggleRecipeFavorite = (id) => setRecipeFavorites((items) =>
    items.includes(id) ? items.filter((x) => x !== id) : [...items, id]
  );
  const recipeCategory = (recipe) => {
    const t = recipe.name.toLowerCase();
    if (/ayam|chicken/.test(t)) return "Chicken";
    if (/daging|beef|steak/.test(t)) return "Beef";
    if (/ikan|fish|salmon/.test(t)) return "Fish";
    if (/udang|prawn|shrimp|sotong|seafood/.test(t)) return "Seafood";
    if (/kek|cake|dessert|puding|biskut/.test(t)) return "Dessert";
    if (/nasi|rice|mee|noodle|pasta/.test(t)) return "Rice & noodles";
    return "Others";
  };
  const filteredRecipes = recipeItems.filter((r) => {
    const term = recipeSearch.trim().toLowerCase();
    const haystack = [r.name, r.source, ...(r.ingredients || []), ...(r.steps || [])].join(" ").toLowerCase();
    const matches = !term || haystack.includes(term);
    const filterMatches = recipeFilter === "All" ||
      (recipeFilter === "Favorites" && recipeFavorites.includes(r.id)) ||
      (recipeFilter === "With steps" && r.steps.length > 0) ||
      (recipeFilter === "Saved links" && r.source?.startsWith("http")) ||
      recipeCategory(r) === recipeFilter;
    return matches && filterMatches;
  }).sort((a, b) => {
    if (recipeSort === "A–Z") return a.name.localeCompare(b.name);
    if (recipeSort === "Favorites first") return Number(recipeFavorites.includes(b.id)) - Number(recipeFavorites.includes(a.id));
    return 0;
  });


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
      purchased_on: form.date || localDate(),
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
        spent_on: form.date || localDate(),
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
    if (receiptFile && (!receiptFile.type.startsWith("image/") || receiptFile.size > 5 * 1024 * 1024)) {
      alert("Choose a receipt image under 5 MB."); return;
    }
    setExpenseSaving(true);
    setExpenseError("");
    let receiptId = null;
    let imagePath = null;
    if (receiptFile) {
      const ext = (receiptFile.name.split(".").pop() || "jpg").toLowerCase();
      imagePath = `${householdId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("receipt-images")
        .upload(imagePath, receiptFile, { contentType: receiptFile.type, upsert: false });
      if (uploadError) { setExpenseError(uploadError.message); setExpenseSaving(false); return; }
      const { data: receipt, error: receiptError } = await supabase.from("receipts").insert({
        household_id: householdId, created_by: currentUserId, merchant: description,
        purchased_on: form.spent_on || localDate(), total: amount, image_path: imagePath, items: []
      }).select("id").single();
      if (receiptError) {
        await supabase.storage.from("receipt-images").remove([imagePath]);
        setExpenseError(receiptError.message); setExpenseSaving(false); return;
      }
      receiptId = receipt.id;
    }
    const { error } = await supabase.from("expenses").insert({
      household_id: householdId,
      created_by: currentUserId,
      description,
      amount,
      category: form.category || "Other",
      spent_on: form.spent_on || localDate(),
      paid_by: form.payer === "Me" ? currentUserId : null,
      payment_method: null,
      receipt_id: receiptId,
    });
    setExpenseSaving(false);
    if (error) {
      // Keep the receipt if the expense insert fails, so the uploaded image is not lost.
      setExpenseError("Expense wasn't saved. " + error.message);
      return;
    }
    setReceiptFile(null);
    setForm({});
    await refreshExpenses(householdId);
    if (receiptId) await refreshReceipts(householdId);
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

  // Household-synced mockup features.
  const [extra, setExtra] = useState({meals:[],wishlist:[],love:[]});
  const [extraModal, setExtraModal] = useState("");
  const [extraDraft, setExtraDraft] = useState({});
  const [extraBusy, setExtraBusy] = useState(false);
  const [extraError, setExtraError] = useState("");
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState("");
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [editingCalendarId, setEditingCalendarId] = useState(null);
  const [calendarDate, setCalendarDate] = useState(() => localDate());
  const [calendarMonth, setCalendarMonth] = useState(() => localDate().slice(0,7));
  const [mealWeek, setMealWeek] = useState(0);
  const [wishlistFilter, setWishlistFilter] = useState("All");
  const [loveOpened, setLoveOpened] = useState(null);
  const [synced, setSynced] = useState({goals:[],contributions:[],commitments:[],payments:[],cards:[],transactions:[],todos:[]});
  const [syncError, setSyncError] = useState("");
  const [syncStatus, setSyncStatus] = useState({});
  const tableMap = {meals:"meal_plans",wishlist:"wishlist_items",love:"love_notes",goals:"savings_goals",contributions:"savings_contributions",commitments:"commitments",payments:"commitment_payments",cards:"credit_cards",transactions:"credit_transactions",todos:"todos"};
  const reloadAll = async (homeId) => {
    const keys = Object.keys(tableMap);
    const results = await Promise.all(keys.map(k=>supabase.from(tableMap[k]).select("*").eq("household_id",homeId)));
    const errors = results.map((r,i)=>r.error ? `${tableMap[keys[i]]}: ${r.error.message}` : null).filter(Boolean);
    setSyncError(errors.join(" | "));
    setSyncStatus(Object.fromEntries(keys.map((k,i)=>[k,results[i].error ? 'error' : 'ready'])));
    setExtra(previous=>({...previous,...Object.fromEntries(keys.slice(0,3).filter((k)=>!results[keys.indexOf(k)].error).map(k=>[k,results[keys.indexOf(k)].data||[]]))}));
    setSynced(previous=>({...previous,...Object.fromEntries(keys.slice(3).filter((k)=>!results[keys.indexOf(k)].error).map(k=>[k,results[keys.indexOf(k)].data||[]]))}));
  };
  useEffect(()=>{
    if(!householdId) return;
    reloadAll(householdId);
    const channels=Object.values(tableMap).map(t=>supabase.channel(`ourspace-${t}-${householdId}`)
      .on("postgres_changes",{event:"*",schema:"public",table:t,filter:`household_id=eq.${householdId}`},()=>reloadAll(householdId)).subscribe());
    return ()=>channels.forEach(c=>supabase.removeChannel(c));
  },[householdId]);
  const mutate = async (key, op, payload, id) => {
    if(!householdId||!currentUserId) {alert("Household is not ready yet.");return false;}
    const table=tableMap[key];
    if(!table) return false;
    let query;
    if(op==="insert") query=supabase.from(table).insert({household_id:householdId,...payload});
    if(op==="update") query=supabase.from(table).update(payload).eq("id",id).eq("household_id",householdId);
    if(op==="delete") query=supabase.from(table).delete().eq("id",id).eq("household_id",householdId);
    const {error}=await query;
    if(error){setSyncError(`${table}: ${error.message}`);alert(`${table}: ${error.message}`);return false;}
    await reloadAll(householdId);
    return true;
  };
  const extraItems = key => extra[key] || [];
  const saveExtra = async (key, data) => {
    if(extraBusy)return;
    setExtraBusy(true);
    let payload;
    if(key==="meals")payload={created_by:currentUserId,title:(data.title||"").trim(),date:data.date,type:data.type||"Dinner"};
    if(key==="wishlist")payload={created_by:currentUserId,title:(data.title||"").trim(),price:Number(data.price||0),category:data.category||"Home",url:data.url||null};
    if(key==="love")payload={created_by:currentUserId,note:(data.note||"").trim(),open_date:data.open_date||null};
    if(!payload || !(payload.title||payload.note) || (key==="meals"&&!payload.date)) {alert("Please fill the required fields.");setExtraBusy(false);return;}
    const ok=await mutate(key,"insert",payload);
    setExtraBusy(false);
    if(ok){setExtraDraft({});setExtraModal("");}
  };
  const deleteExtra = async (key,id) => {if(window.confirm("Delete this item?"))await mutate(key,"delete",null,id);};
  const addSavingsGoal=async()=>{
    if(!form.name?.trim()||!(Number(form.target)>0))return alert("Enter a goal and target amount.");
    const ok=await mutate("goals","insert",{created_by:currentUserId,title:form.name.trim(),target_amount:Number(form.target)});
    if(ok){const initial=Number(form.saved||0);setForm({});if(initial>0)alert("Goal created. Use Add savings to record the starting balance.");}
  };
  const addContribution=async(goal)=>{
    const raw=prompt("Amount to add (RM)");if(raw===null)return;
    const amount=Number(raw);if(!Number.isFinite(amount)||amount<=0)return alert("Enter a valid amount.");
    await mutate("contributions","insert",{goal_id:goal.id,contributed_by:currentUserId,amount});
  };
  const addCommitment=async()=>{
    if(!form.name?.trim()||!Number.isFinite(Number(form.amount))||Number(form.amount)<0)return alert("Enter a commitment and amount.");
    const ok=await mutate("commitments","insert",{created_by:currentUserId,title:form.name.trim(),amount:Number(form.amount),start_date:(form.start||month)+"-01",total_months:Math.max(1,Number(form.months)||12),due_day:Math.max(1,Math.min(31,Number(form.dueDay)||1))});
    if(ok)setForm({});
  };
  const toggleCommitmentMonth=async(c,m,i)=>{
    const payment=synced.payments.find(p=>p.commitment_id===c.id&&p.installment_number===i+1);
    if(payment)await mutate("payments","update",{paid_at:payment.paid_at?null:new Date().toISOString(),paid_amount:payment.paid_at?null:Number(c.amount),paid_by:payment.paid_at?null:currentUserId},payment.id);
    else await mutate("payments","insert",{commitment_id:c.id,installment_number:i+1,due_date:`${m}-${String(Math.min(c.due_day,new Date(Number(m.slice(0,4)),Number(m.slice(5)),0).getDate())).padStart(2,"0")}`,paid_at:new Date().toISOString(),paid_amount:Number(c.amount),paid_by:currentUserId});
  };
  const addCard=async()=>{
    if(!form.cardLabel?.trim())return alert("Enter card name.");
    if(form.lastFour && !/^\d{4}$/.test(form.lastFour))return alert("Enter exactly four digits, or leave it empty.");
    const ok=await mutate("cards","insert",{created_by:currentUserId,label:form.cardLabel.trim(),last_four:form.lastFour||null});
    if(ok)setForm({});
  };
  const addTransaction=async()=>{
    if(!form.name?.trim()||!form.cardId||!Number.isFinite(Number(form.amount))||Number(form.amount)<0||!form.amount)return alert("Choose a card and enter purchase and amount.");
    const ok=await mutate("transactions","insert",{created_by:currentUserId,card_id:form.cardId,description:form.name.trim(),amount:Number(form.amount),responsibility:form.who==="Personal"?"personal":"shared",responsible_user:form.who==="Personal"?currentUserId:null});
    if(ok)setForm({});
  };
  const addTodo=async()=>{
    if(!form.name?.trim())return;
    const ok=await mutate("todos","insert",{created_by:currentUserId,title:form.name.trim(),due_at:form.due?new Date(form.due+"T12:00:00").toISOString():null});
    if(ok)setForm({});
  };
  const loadCalendarEvents = async (homeId) => {
    const { data, error } = await supabase.from("calendar_events")
      .select("id, household_id, created_by, title, date, time, category, created_at")
      .eq("household_id", homeId).order("date", { ascending: true });
    if (error) setCalendarError(error.message);
    else { setCalendarEvents(data || []); setCalendarError(""); }
    setCalendarLoading(false);
  };
  useEffect(() => {
    if (!householdId) { setCalendarEvents([]); setCalendarLoading(false); return; }
    setCalendarLoading(true);
    loadCalendarEvents(householdId);
    const channel = supabase.channel(`calendar-events-${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events", filter: `household_id=eq.${householdId}` },
        () => loadCalendarEvents(householdId)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [householdId]);
  const openCalendarEditor = (event = null) => {
    setEditingCalendarId(event?.id || null);
    setExtraDraft(event ? {title:event.title,date:event.date,time:event.time || "",category:event.category || "Date"} : {date:calendarDate,category:"Date"});
    setExtraModal("event");
  };
  const saveCalendarEvent = async () => {
    const title = (extraDraft.title || "").trim();
    const date = extraDraft.date || calendarDate;
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { alert("Enter event title and date."); return; }
    if (!householdId || !currentUserId || calendarSaving) return;
    setCalendarSaving(true);
    const payload = { title, date, time: extraDraft.time || null, category: extraDraft.category || "Date" };
    const {error} = editingCalendarId
      ? await supabase.from("calendar_events").update(payload).eq("id",editingCalendarId).eq("household_id",householdId)
      : await supabase.from("calendar_events").insert({...payload, household_id:householdId, created_by:currentUserId});
    setCalendarSaving(false);
    if (error) { setCalendarError(error.message); alert("Calendar error: " + error.message); return; }
    setExtraModal(""); setExtraDraft({}); setEditingCalendarId(null);
    await loadCalendarEvents(householdId);
  };
  const deleteCalendarEvent = async (id) => {
    if (!window.confirm("Delete this event?")) return;
    const {error} = await supabase.from("calendar_events").delete().eq("id",id).eq("household_id",householdId);
    if (error) { alert("Calendar error: " + error.message); return; }
    await loadCalendarEvents(householdId);
  };
  const calendarRemindersForDate = date => reminders.filter(r => r.remind_at && localDate(r.remind_at) === date);
  const extraField = (key, label, type="text") => <label className="os-field"><span>{label}</span><input type={type} value={extraDraft[key] || ""} onChange={e=>setExtraDraft(v=>({...v,[key]:e.target.value}))} /></label>;
  const openExtra = type => {setExtraDraft({});setExtraModal(type);};
  const goTab = (name, target = null) => {
    if (!sections.some(([section]) => section === name)) return;
    setTab(name);setMenu(false);setForm({});setSelectedRecipe(null);
    const url = new URL(window.location.href); url.searchParams.set("tab", name);
    if (target) url.searchParams.set("item", target); else url.searchParams.delete("item");
    window.history.pushState({}, "", url);
    if (target) requestAnimationFrame(() => document.getElementById(`item-${target}`)?.scrollIntoView({ block: "center" }));
  };
  const monthTitle = new Date(calendarMonth+"-01T12:00:00").toLocaleDateString("en-MY",{month:"long",year:"numeric"});
  const shiftCalendar = n => {const d=new Date(calendarMonth+"-01T12:00:00");d.setMonth(d.getMonth()+n);setCalendarMonth(localDate(d).slice(0,7));setCalendarDate(localDate(d));};
  const weekStart = () => {const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7+mealWeek*7);return d;};
  const mealDays = Array.from({length:7},(_,i)=>{const d=weekStart();d.setDate(d.getDate()+i);return {iso:localDate(d), day:d.toLocaleDateString("en-MY",{weekday:"short"}), date:d.getDate()};});
  const [chatText, setChatText] = useState(""),
    [replyTo, setReplyTo] = useState(null),
    [tab, setTab] = useState(() => { const requested = new URLSearchParams(location.search).get("tab"); return sections.some(([name]) => name === requested) ? requested : "Dashboard"; }),
    [menu, setMenu] = useState(false),
    
    [draft, setDraft] = useState(""),
    [form, setForm] = useState({}),
    [month, setMonth] = useState(localDate().slice(0, 7));
  useEffect(
    () => localStorage.setItem("ourspace-v1", JSON.stringify(db)),
    [db],
  );
  useEffect(() => {
    document.documentElement.classList.toggle("os-chat-active", tab === "OurChat");
    document.body.classList.toggle("os-chat-active", tab === "OurChat");
    return () => {
      document.documentElement.classList.remove("os-chat-active");
      document.body.classList.remove("os-chat-active");
    };
  }, [tab]);
    // Keep the latest message visible whenever Chat opens or a message arrives.
  useLayoutEffect(() => {
    if (tab !== "OurChat") return;
    const el = chatMessagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [tab, chatMessages, chatSearchOpen]);

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
      aria-label={placeholder}
      min={type === "number" ? 0 : undefined}
      step={type === "number" ? "any" : undefined}
      placeholder={placeholder}
      type={type}
      value={form[key] ?? ""}
      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
    />
  );
  const btn = (label, fn) => <button onClick={fn}>{label}</button>;
  const heading = (name) => <div className="heading"><h2>{name}</h2></div>;
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
      return localDate(d).slice(0, 7);
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
    return saved;
  };
  const list = (key, render) => (
    <div className="stack">
      {(key === "grocery" ? groceryItems : key === "recipes" ? recipeItems : db[key]).length ? (
        (key === "grocery" ? groceryItems.filter(x=>groceryFilter==="All"||(groceryFilter==="Purchased"?x.done:!x.done)) : key === "recipes" ? recipeItems : db[key]).map((x) => (
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
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const back = () => { const name = new URLSearchParams(location.search).get("tab"); setTab(sections.some(([section])=>section===name) ? name : "Dashboard"); };
    window.addEventListener("popstate", back); return () => window.removeEventListener("popstate", back);
  }, []);
  useEffect(() => {
    const target = new URLSearchParams(location.search).get("item");
    if (target) document.getElementById(`item-${target}`)?.scrollIntoView({block:"center"});
  }, [tab, chatMessages, reminders, synced.todos]);
  useEffect(() => {
    if (!householdId || import.meta.env.VITE_PANTRY_ENABLED !== 'true') return;
    let active = true;
    const load = async () => { const {data,error}=await supabase.from('pantry_items').select('*').eq('household_id',householdId); if(active && !error)setInventory(data||[]); };
    load();
    const channel=supabase.channel(`inventory-summary-${householdId}`).on('postgres_changes',{event:'*',schema:'public',table:'pantry_items',filter:`household_id=eq.${householdId}`},load).subscribe();
    return ()=>{active=false;supabase.removeChannel(channel);};
  },[householdId]);
  const today = localDate(clock);
  const currentMonth = today.slice(0,7);
  const todaysEvents = calendarEvents.filter(x=>x.date===today);
  const dinners = extra.meals.filter(x=>x.date===today && x.type==='Dinner');
  const pendingTasks = synced.todos.filter(x=>!x.completed);
  const dueCommitments = synced.commitments.flatMap(c=>{
    if (!c.start_date) return [];
    const index=(Number(currentMonth.slice(0,4))-Number(c.start_date.slice(0,4)))*12+Number(currentMonth.slice(5))-Number(c.start_date.slice(5,7));
    if(index<0 || index>=Number(c.total_months||12) || synced.payments.some(p=>p.commitment_id===c.id && p.installment_number===index+1 && p.paid_at))return [];
    const due=`${currentMonth}-${String(Math.min(Number(c.due_day)||1,new Date(Number(currentMonth.slice(0,4)),Number(currentMonth.slice(5)),0).getDate())).padStart(2,'0')}`;
    return [{key:`commitment:${c.id}:${currentMonth}`,group:'Commitments',tab:'Commitments',title:c.title,body:`${fmt(c.amount)} due ${due}`,at:new Date(due+'T00:00:00').getTime()}];
  });
  const notificationEvents = [
    ...chatMessages.filter(x=>x.senderId!==currentUserId).map(x=>({key:`chat:${x.id}`,group:'OurChat',tab:'OurChat',target:x.id,title:'A message from home',body:x.text,at:new Date(x.createdAt).getTime()})),
    ...reminders.filter(x=>!x.completed).map(x=>({key:`reminder:${x.id}`,group:'Reminders',tab:'Reminders',target:x.id,title:x.title,body:'Your reminder is due',at:new Date(x.remind_at).getTime()})),
    ...pendingTasks.filter(x=>x.due_at).map(x=>({key:`todo:${x.id}`,group:'To-do',tab:'To-do',target:x.id,title:x.title,body:'This task is due',at:new Date(x.due_at).getTime()})),
    ...todaysEvents.map(x=>({key:`event:${x.id}`,group:'OurCalendar',tab:'OurCalendar',target:x.id,title:x.title,body:`Today · ${x.time?.slice(0,5)||'All day'}`,at:new Date(x.date+'T'+(x.time||'00:00:00')).getTime()})),
    ...dueCommitments,
  ];
  const notifications = useNotifications(currentUserId,householdId,notificationEvents);
  const badgeCount = name => notifications.unread.filter(x=>x.tab===name).length;
  const pushPanel = <section className="os-push-panel" aria-label="Push notifications">
    <div><strong>Phone notifications</strong><p>{pushState === "enabled" ? "Notifications are enabled on this device." : pushState === "unsupported" ? "On iPhone, open OurSpace from the Home Screen icon (iOS 16.4+)." : pushState === "blocked" ? "Notifications blocked. Allow them in your phone settings." : "Get OurChat messages and due reminders, even when OurSpace is closed."}</p>{pushError && <small role="alert">{pushError}</small>}</div>
    {pushState === "enabled" ? <button onClick={disablePush}>Turn off</button> : <button disabled={pushState === "saving" || pushState === "checking" || !pushSupported} onClick={enablePush}>{pushState === "saving" ? "Enabling..." : "Enable notifications"}</button>}
  </section>;
  return (
    <div className={tab === "OurChat" ? "app app-chat" : "app"}>
      {menu&&<button className="menu-backdrop" aria-label="Close feature menu" onClick={()=>setMenu(false)}/>}
      <aside className={menu ? "open" : ""}>
        <div className="brand"><span className="os-brand-mark">⌂</span> OurSpace ♡<small>our little space, for life together</small></div>
        <nav aria-label="Feature navigation">{sections.map(([name, Icon]) => <button className={tab === name ? "active" : ""} onClick={()=>goTab(name)} key={name}><Icon size={19}/>{name}{badgeCount(name)>0&&<b className="nav-badge">{badgeCount(name)}</b>}</button>)}</nav>
        <p className="asidefoot">Made for our little home ♡</p>
      </aside>
      <main className={tab === "OurChat" ? "main-chat" : ""}>
        {tab !== "OurChat" && <header className="os-topbar">
          <button aria-label="Toggle feature menu" aria-expanded={menu} className="mobilemenu ghost" onClick={()=>setMenu(!menu)}><Menu /></button>
          <span className="os-top-title">⌂ OurSpace ♡</span>
          <div className="v12-actions"><button className="ghost header-updates" aria-label={`Updates, ${notifications.unread.length} unread`} onClick={()=>goTab("Updates")}><Bell size={20}/>{notifications.unread.length>0&&<b className="nav-badge">{notifications.unread.length}</b>}</button><button className="avatar" onClick={()=>goTab("Profile")}>Our Home ♡</button></div>
        </header>}
        <div className={tab === "OurChat" ? "content content-chat" : "content"}>
          {tab === "Dashboard" && <section className="os-home v12-dashboard">
            <div className="dashboard-welcome"><div><span className="eyebrow">{new Date(clock).toLocaleDateString('en-MY',{weekday:'long',day:'numeric',month:'long'})}</span><h1>Good {new Date(clock).getHours()<12?'morning':new Date(clock).getHours()<18?'afternoon':'evening'}, home.</h1></div><span className="home-illustration" aria-hidden="true">⌂</span></div>
            {!householdId && <div className="panel"><h3>Let’s find your home</h3><p>{chatError || 'Loading your household…'}</p><button onClick={async()=>{if(await createHousehold())window.location.reload();}}>Create Our Home</button></div>}
            <div className="dashboard-grid">
              <section className="panel dashboard-events"><div className="v12-section-head"><h3><CalendarDays size={18}/> Today, together</h3><button className="ghost" onClick={()=>{setCalendarDate(today);setCalendarMonth(currentMonth);goTab('OurCalendar');}}>Calendar →</button></div>
                {calendarError ? <p role="alert">Events unavailable: {calendarError}</p> : calendarLoading ? <p>Loading events…</p> : todaysEvents.length ? todaysEvents.map(x=><div className="dashboard-event" key={x.id}><span>{x.time?.slice(0,5)||'All day'}</span><b>{x.title}</b></div>) : <p className="muted">A little room to breathe. No events today.</p>}
              </section>
              <section className="panel dashboard-dinner"><span className="eyebrow">ON THE TABLE TONIGHT</span><h3><UtensilsCrossed size={20}/> {dinners.length ? dinners.map(x=>x.title).join(' & ') : 'What’s for dinner?'}</h3><p>{syncStatus.meals==='error'?'Meal plan unavailable. Check the sync message below.':syncStatus.meals!=='ready'?'Loading your meal plan…':dinners.length ? 'Something lovely to look forward to.' : 'Let’s plan something delicious together.'}</p><button onClick={()=>{goTab('Meal Planner');setMealWeek(0);if(!dinners.length){openExtra('meal');setExtraDraft({date:today,type:'Dinner'});}}}>{dinners.length?'View meal plan':'Plan dinner'} →</button></section>
              <button className="panel dashboard-stat" onClick={()=>goTab('To-do')}><ListTodo/><span>Pending tasks</span><strong>{syncStatus.todos==='ready'?pendingTasks.length:'—'}</strong><small>{syncStatus.todos==='error'?'Tasks unavailable':syncStatus.todos!=='ready'?'Loading…':`${pendingTasks.filter(x=>x.due_at&&localDate(x.due_at)<=today).length} due today or overdue`}</small></button>
              <button className="panel dashboard-stat" onClick={()=>goTab('Grocery')}><ShoppingBasket/><span>Grocery to buy</span><strong>{groceryItems.filter(x=>!x.done).length}</strong><small>{groceryError?'Could not load grocery':groceryLoading?'Loading…':`${groceryItems.filter(x=>x.done).length} already picked up`}</small></button>
              <button className="panel dashboard-stat" onClick={()=>{setExpenseMonth(currentMonth);goTab('Expenses');}}><Wallet/><span>This month’s spending</span><strong>{fmt(monthlySpending(expenses,receipts,currentMonth))}</strong><small>{expenseError||receiptError?'Some spending data unavailable':expenseLoading||receiptLoading?'Loading…':'Receipts counted once'}</small></button>
            </div>
            <div className="v12-section-head"><h2>Our little essentials</h2><span className="muted">Everything has a place</span></div>
            <div className="os-menu-grid">{sections.filter(([name])=>!['Dashboard','Profile','Updates'].includes(name)).map(([name,Icon])=><button key={name} className="os-menu-tile" onClick={()=>goTab(name)}><Icon size={25} strokeWidth={1.6}/><span>{name}</span>{badgeCount(name)>0&&<b className="shortcut-badge" aria-label={`${badgeCount(name)} unread`}>{badgeCount(name)}</b>}</button>)}</div>
          </section>}
          {tab === 'Updates' && <NotificationCentre notifications={notifications} navigate={(name,target)=>{if(name==='OurCalendar'){setCalendarDate(today);setCalendarMonth(currentMonth);}goTab(name,target);}} />}
          {tab === 'Profile' && <Profile notifications={notifications} pushPanel={pushPanel} ready={!!householdId} />}
          {tab === 'Pantry & Fridge' && <Pantry householdId={householdId} userId={currentUserId} supabase={supabase} addGrocery={addGrocery} onInventory={setInventory} />}
          {quickAdd && <div className="os-modal-overlay" onClick={()=>setQuickAdd(false)}><section className="os-modal" role="dialog" aria-modal="true" aria-label="Quick Add" onClick={e=>e.stopPropagation()}><div className="v12-section-head"><h2>Add a little something</h2><button className="ghost" aria-label="Close Quick Add" onClick={()=>setQuickAdd(false)}><X/></button></div><div className="quick-add-grid">{[['Grocery',ShoppingBasket],['To-do',ListTodo],['Reminders',Bell],['OurCalendar',CalendarDays],['Meal Planner',UtensilsCrossed],['Expenses',Wallet],['Recipes',ChefHat],['Pantry & Fridge',ShoppingBasket]].map(([name,Icon])=><button key={name} onClick={()=>{setQuickAdd(false);goTab(name);if(name==='OurCalendar')openCalendarEditor();if(name==='Meal Planner'){openExtra('meal');setExtraDraft({date:today,type:'Dinner'});}if(name==='Recipes')setRecipeComposer(true);}}><Icon size={22}/>{name}</button>)}</div></section></div>}
          {tab === "Recipes" && (
            <section className="recipe-page">
              <div className="recipe-hero">
                <div className="recipe-hero-copy">
                  <span className="recipe-eyebrow">OUR LITTLE COOKBOOK</span>
                  <h2>What shall we cook today?</h2>
                  <p>All our favourite meals, little kitchen discoveries and recipes worth keeping.</p>
                  <div className="recipe-stats"><span>{recipeItems.length} saved recipes</span><span>{recipeFavorites.length} favourites</span></div>
                </div>
                <div className="recipe-hero-art" aria-hidden="true">🍲<span>♡</span></div>
              </div>
              <div className="recipe-toolbar">
                <label className="recipe-search">
                  <span aria-hidden="true">⌕</span>
                  <input aria-label="Search recipes" placeholder="Search dishes, ingredients, or cooking steps..." value={recipeSearch} onChange={(e) => setRecipeSearch(e.target.value)} />
                  {recipeSearch && <button type="button" aria-label="Clear search" onClick={() => setRecipeSearch("")}>×</button>}
                </label>
                <button className="recipe-add-btn" onClick={() => setRecipeComposer(true)}><Plus size={18}/> Add recipe</button>
              </div>
              <div className="recipe-filters" aria-label="Recipe filters">
                {["All", "Favorites", "Chicken", "Beef", "Fish", "Seafood", "Rice & noodles", "Dessert", "Others", "With steps", "Saved links"].map((filter) =>
                  <button key={filter} className={recipeFilter === filter ? "selected" : ""} onClick={() => setRecipeFilter(filter)}>
                    {filter === "Favorites" ? "♡ " : ""}{filter}
                  </button>
                )}
              </div>
              <div className="recipe-results-head">
                <div><h3>Recipe collection</h3><p>{filteredRecipes.length} {filteredRecipes.length === 1 ? "recipe" : "recipes"} found</p></div>
                <select aria-label="Sort recipes" value={recipeSort} onChange={(e) => setRecipeSort(e.target.value)}>
                  <option>Newest</option><option>A–Z</option><option>Favorites first</option>
                </select>
              </div>
              {recipeLoading && <p className="recipe-empty">Loading your recipes...</p>}
              {recipeError && <p className="recipe-empty">Couldn't load recipes: {recipeError}</p>}
              {!recipeLoading && !recipeError && (filteredRecipes.length ? (
                <div className="recipe-grid">
                  {filteredRecipes.map((r) => (
                    <article className="recipe-card" key={r.id}>
                      <button className="recipe-card-cover" onClick={() => setSelectedRecipe(r)} aria-label={`View ${r.name}`}>
                        <span className="recipe-food-art" aria-hidden="true">{({Chicken:"🍗",Beef:"🥩",Fish:"🐟",Seafood:"🍤","Rice & noodles":"🍜",Dessert:"🍰",Others:"🍽️"})[recipeCategory(r)]}</span>
                        <span className="recipe-cover-label">{recipeCategory(r)}</span>
                      </button>
                      <button className={"recipe-heart" + (recipeFavorites.includes(r.id) ? " is-favorite" : "")} title="Toggle favourite" aria-label={`Favorite ${r.name}`} onClick={() => toggleRecipeFavorite(r.id)}>{recipeFavorites.includes(r.id) ? "♥" : "♡"}</button>
                      <div className="recipe-card-body">
                        <h4>{r.name}</h4>
                        <p>{r.ingredients.length ? `${r.ingredients.length} ingredients` : "Saved inspiration"} · {r.steps.length ? `${r.steps.length} steps` : "Video / link"}</p>
                        <button onClick={() => setSelectedRecipe(r)}>View recipe <span>→</span></button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="recipe-empty"><div>🍵</div><h3>No recipes found</h3><p>Try another keyword or category, or add your first recipe.</p><button onClick={() => {setRecipeSearch("");setRecipeFilter("All");}}>Show all recipes</button></div>
              ))}
              {selectedRecipe && <div className="os-modal-overlay" onClick={() => setSelectedRecipe(null)}>
                <div className="os-modal recipe-detail-modal" role="dialog" aria-modal="true" aria-label={selectedRecipe.name} onClick={(e) => e.stopPropagation()}>
                  <div className="recipe-detail-top"><span>{recipeCategory(selectedRecipe)} · Our cookbook</span><button aria-label="Close" onClick={() => setSelectedRecipe(null)}>×</button></div>
                  <div className="recipe-detail-banner" aria-hidden="true">{({Chicken:"🍗",Beef:"🥩",Fish:"🐟",Seafood:"🍤","Rice & noodles":"🍜",Dessert:"🍰",Others:"🍽️"})[recipeCategory(selectedRecipe)]}</div>
                  <h2>{selectedRecipe.name}</h2>
                  <p className="recipe-detail-sub">{selectedRecipe.ingredients.length} ingredients · {selectedRecipe.steps.length} cooking steps</p>
                  {selectedRecipe.source?.startsWith("http") && <a className="recipe-source-link" href={selectedRecipe.source} target="_blank" rel="noopener noreferrer">Open original video / recipe ↗</a>}
                  {selectedRecipe.ingredients.length > 0 && <section className="recipe-detail-section"><h3>Ingredients</h3><ul>{selectedRecipe.ingredients.map((item,i) => <li key={i}>{item}</li>)}</ul>
                    <p className="muted">Matching names already on your list or in stock are skipped. Check quantities and ingredient wording before shopping.</p><button className="recipe-grocery-btn" onClick={() => addRecipeIngredientsToGrocery(selectedRecipe.ingredients)}>+ Add missing ingredients to grocery</button><button className="ghost" onClick={()=>{goTab("Meal Planner");openExtra("meal");setExtraDraft({title:selectedRecipe.name,date:today,type:"Dinner"});}}>Plan this meal</button>
                  </section>}
                  {selectedRecipe.steps.length > 0 && <section className="recipe-detail-section"><h3>How to make it</h3><ol>{selectedRecipe.steps.map((item,i) => <li key={i}>{item}</li>)}</ol></section>}
                  {!selectedRecipe.steps.length && !selectedRecipe.ingredients.length && <p className="muted">This recipe is saved as a link. Open the original source for instructions.</p>}
                  <div className="recipe-detail-actions">
                    <button onClick={() => toggleRecipeFavorite(selectedRecipe.id)}>{recipeFavorites.includes(selectedRecipe.id) ? "♥ Saved favourite" : "♡ Save favourite"}</button>
                    <button onClick={() => {if(window.confirm("Delete this recipe?")){deleteRecipe(selectedRecipe.id);setSelectedRecipe(null);}}}>Delete recipe</button>
                  </div>
                </div>
              </div>}
              {recipeComposer && <div className="os-modal-overlay" onClick={() => setRecipeComposer(false)}>
                <div className="os-modal recipe-compose-modal" role="dialog" aria-modal="true" aria-label="Add recipe" onClick={(e) => e.stopPropagation()}>
                  <div className="recipe-detail-top"><strong>Add to our cookbook</strong><button aria-label="Close" onClick={() => setRecipeComposer(false)}>×</button></div>
                  <h3>Paste a recipe</h3>
                  <p className="muted">Paste from ChatGPT. Use “Bahan:” and “Cara:” headings so ingredients and steps are organised automatically.</p>
                  <textarea rows="8" placeholder={"Ayam Masak Lemak\nBahan:\n- Ayam 500g\n- Santan 200ml\nCara:\n1. Tumis bahan\n2. Masak hingga siap"} value={draft} onChange={(e) => setDraft(e.target.value)}/>
                  <button className="recipe-full-btn" disabled={recipeSaving || !draft.trim()} onClick={async () => {const saved = await parseRecipe(); if(saved) setRecipeComposer(false);}}>Save pasted recipe</button>
                  <div className="recipe-compose-divider">or save a recipe link</div>
                  <div className="form">{field("recipeName", "Recipe name")}{field("url", "TikTok or recipe URL")}
                    <button className="recipe-full-btn" disabled={recipeSaving} onClick={async () => {
                      if (!form.recipeName?.trim() || !/^https?:\/\//i.test(form.url || "")) {alert("Enter a recipe name and valid URL."); return;}
                      const saved = await saveRecipe({name:form.recipeName,source:form.url,ingredients:[],steps:[]});
                      if(saved){setForm({});setRecipeComposer(false);}
                    }}>{recipeSaving ? "Saving..." : "Save recipe link"}</button>
                  </div>
                </div>
              </div>}
            </section>
          )}
          {tab === "Grocery" && (
            <>
              {heading("Grocery List", "Tick items while shopping.")}
              <div className="panel form">
                {field("name", "Item e.g. Telur 30 biji")}
                {field("quantity", "Quantity e.g. 2 kg")}
                {field("price", "Estimated price (RM)", "number")}
                {btn(
                  "Add item",
                  async () => {
                    if (grocerySaving || !form.name?.trim()) return;
                    const saved = await addGrocery(form.name, form.price, form.quantity);
                    if (saved) setForm({});
                  },
                )}
              </div>
              {tile(
                "Estimated total",
                fmt(groceryItems.reduce((a, x) => a + Number(x.price || 0), 0)),
                "Based on entered prices",
              )}
              <div className="v12-tabs">{["All","To buy","Purchased"].map(x=><button key={x} aria-pressed={groceryFilter===x} onClick={()=>setGroceryFilter(x)}>{x}</button>)}</div>
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
                  <span className={x.done ? "done" : ""}>{x.name}<small>{x.quantity}</small></span>
                  <b>{fmt(x.price)}</b>
                </label>
              ))}
            </>
          )}
          {tab === "Expenses" && (
            <>
              {heading("Expenses", "Track household spending, synced with Supabase.")}
              <div className="panel form expense-entry-form">
                {field("name", "Expense name")}
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
                <label className="receipt-file-field expense-receipt-field">
                  <span>Receipt (optional, max 5 MB)</span>
                  <input type="file" accept="image/*" onChange={e=>setReceiptFile(e.target.files?.[0] || null)} />
                  {receiptFile && <small className="receipt-file-name">{receiptFile.name}</small>}
                </label>
                <button onClick={addExpense} disabled={expenseSaving || !householdId}>
                  {expenseSaving ? "Saving..." : "Save"}
                </button>
              </div>
              {expenseError && <p className="muted">Expense error: {expenseError}</p>}
              {expenseLoading && <p className="muted">Loading expenses...</p>}
              <label className="os-field">Spending month<input type="month" value={expenseMonth} onChange={e=>setExpenseMonth(e.target.value)} /></label>
              {tile("Monthly spending", fmt(monthlySpending(expenses,receipts,expenseMonth)), "Includes unlinked receipts once")}
              {tile("Total logged", fmt(expenseTotal), "Expenses across all months; excludes unlinked receipts")}
              {receipts.some(r=>!expenses.some(e=>e.receipt_id===r.id)) && <details className="panel legacy-receipts">
                <summary>Previous receipts ({receipts.filter(r=>!expenses.some(e=>e.receipt_id===r.id)).length})</summary>
                {receipts.filter(r=>!expenses.some(e=>e.receipt_id===r.id)).map(r=><div className="item" key={r.id}><div className="grow"><b>{r.merchant} · {fmt(r.total)}</b><small>{r.purchased_on}</small>{r.image_path&&receiptUrls[r.image_path]&&<a className="expense-receipt-link" href={receiptUrls[r.image_path]} target="_blank" rel="noreferrer">View receipt</a>}</div></div>)}
              </details>}
              <div className="stack">
                {!expenseLoading && !expenseError && expenses.length === 0 &&
                  <p className="muted">No expenses yet.</p>}
                {expenses.filter(x=>x.spent_on?.startsWith(expenseMonth)).map((x) => (
                  <div className="item" key={x.id}>
                    <div className="grow">
                      <b>{x.description} · {fmt(x.amount)}</b>
                      <small>{x.spent_on} · {x.category} · {x.paid_by ? (x.paid_by === currentUserId ? "You" : "Partner") : "Shared"}</small>
                      {x.receipt_id && (()=>{const receipt=receipts.find(r=>r.id===x.receipt_id);return receipt?.image_path && receiptUrls[receipt.image_path] ? <a className="expense-receipt-link" href={receiptUrls[receipt.image_path]} target="_blank" rel="noreferrer">View receipt</a> : null;})()}
                    </div>
                    <button className="ghost" title="Delete" onClick={() => deleteExpense(x.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "Savings" && <>
            {heading("Savings Goals","Our shared milestones, synced on every device.")}
            <div className="panel form">{field("name","Goal name")}{field("target","Target RM","number")}<button onClick={addSavingsGoal}>Create goal</button></div>
            {synced.goals.map(g=>{const saved=synced.contributions.filter(x=>x.goal_id===g.id).reduce((a,x)=>a+Number(x.amount),0);return <div className="panel" key={g.id}><h3>{g.title}</h3><p>{fmt(saved)} / {fmt(g.target_amount)}</p><p className="muted">{saved>=Number(g.target_amount)?"Goal reached ♡":`${fmt(Math.max(0,Number(g.target_amount)-saved))} to go`} · {Math.round(saved/Math.max(1,Number(g.target_amount))*100)}% saved</p><progress value={saved} max={Math.max(1,Number(g.target_amount))}/><div className="form inline"><button onClick={()=>addContribution(g)}>+ Add savings</button><button className="ghost" onClick={()=>mutate("goals","delete",null,g.id)}>Delete</button></div></div>})}
            {!synced.goals.length&&<p className="muted">No savings goals yet.</p>}
          </>}
          {tab === "Commitments" && <>
            {heading("Commitments & Loans","Track monthly instalments together.")}
            <div className="panel form">{field("name","Commitment name")}{field("amount","Monthly payment RM","number")}{field("start","Start month","month")}{field("months","Duration in months","number")}{field("dueDay","Due day (1-31)","number")}<button onClick={addCommitment}>Add commitment</button></div>
            {synced.commitments.map(c=><div className="panel" key={c.id}><h3>{c.title} <span className="amount">{fmt(c.amount)}/mo</span></h3><p className="muted">Due day {c.due_day} · {c.total_months||12} instalments · {synced.payments.filter(p=>p.commitment_id===c.id&&p.paid_at).length} paid</p><p className="muted">Remaining scheduled: {fmt(Math.max(0,(c.total_months||12)-synced.payments.filter(p=>p.commitment_id===c.id&&p.paid_at).length)*Number(c.amount))}</p><div className="monthlist">{monthsOf(c.start_date.slice(0,7),Math.min(c.total_months||12,240)).map((m,i)=>{const paid=!!synced.payments.find(p=>p.commitment_id===c.id&&p.installment_number===i+1&&p.paid_at);return <label key={m} className="month"><input type="checkbox" checked={paid} onChange={()=>toggleCommitmentMonth(c,m,i)}/><span>{i+1}. {m}</span><b>{paid?"Paid":"Unpaid"}</b></label>})}</div><button className="ghost" onClick={()=>mutate("commitments","delete",null,c.id)}>Delete commitment</button></div>)}
            {!synced.commitments.length&&<p className="muted">No commitments yet. Add existing loans here once.</p>}
          </>}
          {tab === "Shared CC" && <>
            {heading("Shared Credit Card","Manual tracking, not connected to the bank.")}
            <div className="panel form">{field("cardLabel","Card name (e.g. UOB)")}{field("lastFour","Last four digits (optional)")}<button onClick={addCard}>Add card</button></div>
            <div className="panel form">{field("name","Purchase description")}{field("amount","Amount RM","number")}<select value={form.cardId||""} onChange={e=>setForm(v=>({...v,cardId:e.target.value}))}><option value="">Select card</option>{synced.cards.map(c=><option key={c.id} value={c.id}>{c.label} {c.last_four?`•••• ${c.last_four}`:""}</option>)}</select><select value={form.who||"Shared"} onChange={e=>setForm(v=>({...v,who:e.target.value}))}><option>Shared</option><option>Personal</option></select><button onClick={addTransaction}>Add transaction</button></div>
            {synced.cards.map(c=><div className="panel" key={c.id}><h3>{c.label} {c.last_four?`•••• ${c.last_four}`:""}</h3><p className="muted">Total recorded: {fmt(synced.transactions.filter(t=>t.card_id===c.id).reduce((n,t)=>n+Number(t.amount),0))}</p>{synced.transactions.filter(t=>t.card_id===c.id).map(t=><div className="item" key={t.id}><div className="grow"><b>{t.description} · {fmt(t.amount)}</b><small>{t.transaction_date} · {t.responsibility}</small></div><button className="ghost" onClick={()=>mutate("transactions","delete",null,t.id)}><Trash2 size={16}/></button></div>)}<button className="ghost" onClick={()=>{if(window.confirm("Delete this card and all its transactions?"))mutate("cards","delete",null,c.id);}}>Delete card</button></div>)}
          </>}
          {tab === "OurChat" && (
            <>
              <div className="chat-shell">
                <div className="chat-top chat-top-v12">
                  <button type="button" className="ghost chat-back" aria-label="Back to Home" onClick={()=>goTab("Dashboard")}><ArrowLeft size={22}/></button>
                  <div className="chat-icon"><Heart size={20}/></div>
                  <div className="chat-identity"><b>OurChat</b><small>Our household</small></div>
                  <button type="button" className="ghost chat-search-button" aria-label="Search messages" aria-expanded={chatSearchOpen} onClick={()=>{setChatSearchOpen(v=>!v);setChatSearch("");}}><Search size={21}/></button>
                </div>
                {chatSearchOpen && <label className="os-field chat-search"><input autoFocus type="search" value={chatSearch} onChange={e=>setChatSearch(e.target.value)} placeholder="Search messages" aria-label="Search messages" /></label>}
                <div className="chat-messages" ref={chatMessagesRef}>
                  {chatLoading && <p className="muted">Loading messages...</p>}
                  {chatError && <p className="muted">Chat error: {chatError}</p>}
                  {!chatLoading && !chatError && chatMessages.length === 0 && (
                    <div className="chat-empty">
                      <MessageCircle size={34} />
                      <h3>No messages yet</h3>
                    </div>
                  )}
                  {chatMessages.filter(msg => msg.text.toLowerCase().includes(chatSearch.toLowerCase())).map((msg) => (
                    <div
                      key={msg.id}
                      id={`item-${msg.id}`}
                      className={
                        "chat-row " + (msg.senderId === currentUserId ? "mine" : "theirs")
                      }
                    >
                      <div className="bubble">
                        {msg.reply && (
                          <div className="chat-quoted">↳ {msg.reply}</div>
                        )}
                        <div>{msg.text}</div>
                        <small className="chat-meta">
                          {msg.senderId !== currentUserId && <span>{msg.who} · </span>}{msg.time}
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
                          onClick={async () => {
                            if (await mutate("todos", "insert", { title: msg.text, created_by: currentUserId })) alert("Added to To-do");
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
                  {chatToolsOpen && <div className="chat-toolbox">
                    <button type="button" onClick={()=>{setChatToolsOpen(false);goTab("Grocery");}}><ShoppingBasket size={17}/> Grocery</button>
                    <button type="button" onClick={()=>{setChatToolsOpen(false);goTab("To-do");}}><ListTodo size={17}/> To-do</button>
                    <button type="button" onClick={()=>{setChatToolsOpen(false);goTab("OurCalendar");}}><CalendarDays size={17}/> Calendar</button>
                  </div>}
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    sendChatMessage();
                  }}>
                    <button type="button" className="chat-compose-tool" aria-label="More options" aria-expanded={chatToolsOpen} onClick={()=>setChatToolsOpen(v=>!v)}><Plus size={22}/></button>
                    <input
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value)}
                      placeholder="Type a message..."
                    />
                    <button type="button" className="chat-compose-emoji" aria-label="Add heart emoji" onClick={()=>setChatText(v=>v+"♡")}><Smile size={20}/></button>
                    <button type="submit" aria-label="Send message" disabled={chatSending || !householdId || !chatText.trim()}>
                      <Send size={18} />
                    </button>
                  </form>

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
                  <div className="item" key={item.id} id={`item-${item.id}`}>
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
              <p className="muted">Reminders sync in real time. Enable phone notifications from the Home screen to receive alerts while OurSpace is closed.</p>
            </>
          )}
          {tab === "OurCalendar" && <div className="os-feature">
            <div className="os-page-heading"><CalendarDays/><h2>OurCalendar ♡</h2></div>
            <div className="os-month-nav"><button className="ghost" onClick={()=>shiftCalendar(-1)}>‹</button><b>{monthTitle}</b><button className="ghost" onClick={()=>shiftCalendar(1)}>›</button></div>
            <div className="os-calendar">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(x=><div className="os-weekday" key={x}>{x}</div>)}{Array.from({length:(new Date(calendarMonth+"-01T12:00:00").getDay()+6)%7},(_,i)=><div key={'blank'+i}/>)}{Array.from({length:new Date(Number(calendarMonth.slice(0,4)),Number(calendarMonth.slice(5)),0).getDate()},(_,i)=>{const day=calendarMonth+"-"+String(i+1).padStart(2,"0");return <button key={day} className={'os-day '+(calendarDate===day?'selected':'')} onClick={()=>setCalendarDate(day)}>{i+1}{(calendarEvents.some(x=>x.date===day)||calendarRemindersForDate(day).length>0)&&<i/>}</button>})}</div>
            <div className="os-section-row"><h3>{new Date(calendarDate+"T12:00:00").toLocaleDateString('en-MY',{weekday:'long',day:'numeric',month:'short',year:'numeric'})}</h3><button onClick={()=>openCalendarEditor()}>+ Add Event</button></div>
            {calendarError && <p className="muted" role="alert">Calendar: {calendarError}. Ask the household administrator to check the existing calendar setup.</p>}
            {calendarLoading && <p className="muted">Loading events...</p>}
            <div className="os-list">
              {calendarEvents.filter(x=>x.date===calendarDate).map(x=><div className="os-list-card" key={x.id} id={`item-${x.id}`}><CalendarDays/><div><b>{x.title}</b><small>{x.category||'Event'} · {x.time ? x.time.slice(0,5) : 'All day'}</small></div><button className="ghost" title="Edit event" onClick={()=>openCalendarEditor(x)}>Edit</button><button className="ghost" title="Delete event" onClick={()=>deleteCalendarEvent(x.id)}><Trash2 size={17}/></button></div>)}
              {calendarRemindersForDate(calendarDate).map(x=><div className="os-list-card" key={'reminder-'+x.id}><Bell/><div><b>{x.title}</b><small>Reminder · {new Date(x.remind_at).toLocaleTimeString('en-MY',{hour:'2-digit',minute:'2-digit'})}{x.completed?' · Completed':''}</small></div><button className="ghost" onClick={()=>goTab('Reminders')}>View</button></div>)}
              {!calendarLoading && !calendarEvents.some(x=>x.date===calendarDate) && !calendarRemindersForDate(calendarDate).length && <p className="muted">No events yet for this day ♡</p>}
            </div>
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
            <div className="os-list">{extraItems('wishlist').filter(x=>wishlistFilter==='All'||x.category===wishlistFilter).map(x=><div className="os-list-card" key={x.id}><div className="os-wish-icon">{x.category==='Travel'?'✈️':x.category==='Gift'?'🎁':'🛋️'}</div><div><b>{x.title}</b><small>{fmt(x.price)} · {x.category||'Home'}</small>{x.url&&/^https?:\/\//i.test(x.url)&&<a href={x.url} target="_blank" rel="noreferrer">View link</a>}</div><button className="ghost" onClick={()=>deleteExtra('wishlist',x.id)}><Trash2 size={17}/></button></div>)}{!extraItems('wishlist').some(x=>wishlistFilter==='All'||x.category===wishlistFilter)&&<p className="muted">Your wishlist is waiting ♡</p>}</div>
            <button className="os-primary-wide" onClick={()=>openExtra('wish')}>+ Add to Wishlist</button><div className="os-cats-footer">🐈 🛒 ♡ 🐱</div>
          </div>}
          {tab === "Love Jar" && <div className="os-feature os-love">
            <div className="os-page-heading"><Heart/><h2>Love Jar ♡</h2></div><p>A little jar of love, notes and appreciation for each other ♡</p>
            <div className="os-jar-art"><div className="os-jar-lid"/><div className="os-jar-body"><span>♡</span><div>💌 💌 💌</div></div><div className="os-jar-cats">🐱　🐈</div></div>
            <button className="os-primary-wide" onClick={()=>{const visible=extraItems('love').filter(x=>!x.open_date||x.open_date<=localDate());if(!visible.length){alert('No notes ready to open yet ♡');return;}setLoveOpened(visible[Math.floor(Math.random()*visible.length)]);}}>Open a Note ♡</button>
            <div className="os-love-actions"><button onClick={()=>openExtra('love')}><span>✎</span>Add a Note</button><button onClick={()=>{openCalendarEditor();setExtraDraft({date:calendarDate,category:'Date'});}}><span>♡</span>Surprise Date</button></div>
            <div className="os-section-row"><h3>Recent Notes ♡</h3><small>{extraItems('love').length} notes</small></div>
            {extraItems('love').slice(0,4).map(x=><div className="os-list-card" key={x.id}><Heart size={18}/><div><b>{x.open_date&&x.open_date>localDate()?'Sealed until '+x.open_date:x.note}</b><small>{new Date(x.created_at).toLocaleDateString('en-MY')}</small></div><button className="ghost" onClick={()=>deleteExtra('love',x.id)}><Trash2 size={16}/></button></div>)}
            {loveOpened&&<div className="os-modal-overlay" onClick={()=>setLoveOpened(null)}><div className="os-modal" onClick={e=>e.stopPropagation()}><h2>♡ A note for you</h2><p>{loveOpened.note}</p><button className="os-primary-wide" onClick={()=>setLoveOpened(null)}>Done ♡</button></div></div>}
          </div>}
          {tab === "To-do" && <>
            {heading("Shared To-do","A little less to remember.")}
            <div className="panel form">{field("name","New task")}{field("due","Due date","date")}<button onClick={addTodo}>Add task</button></div>
            <div className="v12-tabs">{["All","Pending","Done"].map(x=><button key={x} aria-pressed={todoFilter===x} onClick={()=>setTodoFilter(x)}>{x}</button>)}</div>
            <div className="stack">{synced.todos.filter(t=>todoFilter==="All"||(todoFilter==="Done"?t.completed:!t.completed)).sort((a,b)=>Number(a.completed)-Number(b.completed)||String(a.due_at||"z").localeCompare(String(b.due_at||"z"))).map(t=><div className="item" key={t.id} id={`item-${t.id}`}><label className="check grow"><input type="checkbox" checked={!!t.completed} onChange={()=>mutate("todos","update",{completed:!t.completed},t.id)}/><span className={t.completed?"done":""}>{t.title}<small>{t.due_at?new Date(t.due_at).toLocaleDateString("en-MY"):"No due date"}</small></span></label><button className="ghost" onClick={()=>mutate("todos","delete",null,t.id)}><Trash2 size={16}/></button></div>)}{!synced.todos.length&&<p className="muted">No tasks yet.</p>}</div>
          </>}
          {syncError && <p className="muted" role="alert">Supabase sync: {syncError}</p>}
          {extraModal && <div className="os-modal-overlay" onClick={()=>setExtraModal('')}><div className="os-modal" onClick={e=>e.stopPropagation()}><div className="os-modal-title"><h2>{extraModal==='event'?(editingCalendarId?'♡ Edit Event':'♡ Add Event'):extraModal==='meal'?'🍽 Add Meal':extraModal==='wish'?'🎁 Add to Wishlist':'♡ Add a Love Note'}</h2><button className="ghost" onClick={()=>setExtraModal('')}><X/></button></div><form onSubmit={async e=>{e.preventDefault();if(extraModal==='event')await saveCalendarEvent();if(extraModal==='meal')await saveExtra('meals',extraDraft);if(extraModal==='wish')await saveExtra('wishlist',extraDraft);if(extraModal==='love')await saveExtra('love',extraDraft);}}>
            {extraModal==='event'&&<>{extraField('title','Event title')}{extraField('date','Date','date')}{extraField('time','Time','time')}<label className="os-field"><span>Category</span><select value={extraDraft.category||'Date'} onChange={e=>setExtraDraft(v=>({...v,category:e.target.value}))}>{['Date','Appointment','Birthday','Others'].map(x=><option key={x}>{x}</option>)}</select></label></>}
            {extraModal==='meal'&&<>{extraField('title','Meal name')}{extraField('date','Date','date')}<label className="os-field"><span>Meal type</span><select value={extraDraft.type||'Dinner'} onChange={e=>setExtraDraft(v=>({...v,type:e.target.value}))}>{['Breakfast','Lunch','Dinner'].map(x=><option key={x}>{x}</option>)}</select></label></>}
            {extraModal==='wish'&&<>{extraField('title','Item name')}{extraField('price','Price (RM)','number')}<label className="os-field"><span>Category</span><select value={extraDraft.category||'Home'} onChange={e=>setExtraDraft(v=>({...v,category:e.target.value}))}>{['Home','Travel','Gift'].map(x=><option key={x}>{x}</option>)}</select></label>{extraField('url','Link (optional)','url')}</>}
            {extraModal==='love'&&<><label className="os-field"><span>Your note</span><textarea required maxLength={500} value={extraDraft.note||''} onChange={e=>setExtraDraft(v=>({...v,note:e.target.value}))} placeholder="Thank you for always being there for me. ♡"/></label>{extraField('open_date','Open on a specific date (optional)','date')}</>}
            <div className="os-modal-actions"><button type="button" className="os-cancel" onClick={()=>setExtraModal('')}>Cancel</button><button type="submit" disabled={calendarSaving||extraBusy}>{(calendarSaving||extraBusy) ? "Saving..." : "Save ♡"}</button></div></form></div></div>}
          {tab !== "OurChat" && <footer>OurSpace v1.2</footer>}
        </div>
        {tab !== "OurChat" && <nav className="os-bottom-nav" aria-label="Mobile navigation">{[["Dashboard",House,"Home"],["OurChat",MessageCircle,"Chat"],["Quick Add",Plus,"Add"],["Expenses",Wallet,"Expenses"],["Profile",UserRound,"Profile"]].map(([name,Icon,label])=><button key={name} aria-label={label} aria-current={tab===name?'page':undefined} className={tab===name?'active':''} onClick={()=>name==='Quick Add'?setQuickAdd(true):goTab(name)}><Icon size={21}/><span>{label}</span>{name==='Updates'&&notifications.unread.length>0&&<b className="nav-badge">{notifications.unread.length}</b>}</button>)}</nav>}
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(
  <AuthGate>
    <App />
  </AuthGate>,
);
