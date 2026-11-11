// Supabase Edge Function: push-dispatch
// Deploy with JWT verification disabled, and require a separate high-entropy CRON_SECRET header.
import { createClient } from "npm:@supabase/supabase-js@2";
import { isQuietHours } from "../_shared/quiet-hours.js";
import webpush from "npm:web-push@3.6.7";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status,headers:{"content-type":"application/json"}});
Deno.serve(async (request) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) return json({error:"Unauthorized"},401);
  if (request.method !== "POST") return json({error:"POST only"},405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";
  if (![supabaseUrl,serviceKey,vapidPublic,vapidPrivate].every(Boolean)) return json({error:"Missing server secrets"},500);
  webpush.setVapidDetails(vapidSubject,vapidPublic,vapidPrivate);
  const db = createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});
  const now = new Date();
  const since = new Date(now.getTime()-10*60*1000).toISOString();
  const [messages, reminders] = await Promise.all([
    db.from("chat_messages").select("id,household_id,sender_id,body,created_at").gte("created_at",since).lte("created_at",now.toISOString()).order("created_at",{ascending:true}).limit(300),
    db.from("reminders").select("id,household_id,created_by,title,remind_at,completed").eq("completed",false).gte("remind_at",since).lte("remind_at",now.toISOString()).order("remind_at",{ascending:true}).limit(300),
  ]);
  if (messages.error || reminders.error) return json({error:messages.error?.message || reminders.error?.message},500);
  const events = [
    ...(messages.data || []).map(m=>({key:`chat:${m.id}`,household:m.household_id,exclude:m.sender_id,title:"New OurChat message",body:String(m.body).slice(0,100),url:`/?tab=OurChat&item=${encodeURIComponent(m.id)}`})),
    ...(reminders.data || []).map(r=>({key:`reminder:${r.id}`,household:r.household_id,exclude:null,title:"OurSpace reminder",body:String(r.title).slice(0,100),url:`/?tab=Reminders&item=${encodeURIComponent(r.id)}`})),
  ];
  const smarterNotifications = Deno.env.get("OURSPACE_V12_NOTIFICATIONS_ENABLED") === "true";
  let sent = 0,failed = 0, suppressed = 0;
  for (const event of events) {
    const {data:subs,error} = await db.from("push_subscriptions").select("id,endpoint,user_id,p256dh,auth").eq("household_id",event.household);
    if (error) {failed++;continue;}
    for (const sub of subs || []) {
      if (sub.user_id === event.exclude) continue;
      // Opt in only AFTER manual migration 001. Existing dispatch behavior stays intact otherwise.
      if (smarterNotifications) {
        const [prefs, state] = await Promise.all([
          db.from("user_preferences").select("quiet_enabled,quiet_start,quiet_end,timezone").eq("user_id",sub.user_id).maybeSingle(),
          db.from("notification_states").select("read_at,snoozed_until").eq("user_id",sub.user_id).eq("household_id",event.household).eq("event_key",event.key).maybeSingle(),
        ]);
        // Fail closed rather than bypassing a user's preferences when the new schema is unavailable.
        if (prefs.error || state.error) { failed++; continue; }
        try {
          if ((prefs.data && isQuietHours(prefs.data, now)) || state.data?.read_at ||
              (state.data?.snoozed_until && new Date(state.data.snoozed_until) > now)) {
            suppressed++; continue;
          }
        } catch { failed++; continue; }
      }
      const {error:claimError} = await db.from("push_deliveries").insert({subscription_id:sub.id,event_key:event.key});
      if (claimError?.code === "23505") continue;
      if (claimError) {failed++;continue;}
      try {
        await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify({title:event.title,body:event.body,url:event.url,tag:event.key}),{TTL:3600});
        sent++;
      } catch (e) {
        const status = (e as {statusCode?:number}).statusCode;
        if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id",sub.id);
        else await db.from("push_deliveries").delete().eq("subscription_id",sub.id).eq("event_key",event.key);
        failed++;
      }
    }
  }
  return json({events:events.length,sent,failed,suppressed});
});
