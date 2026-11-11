const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
fs.mkdirSync('test-results',{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const user='00000000-0000-4000-8000-000000000001', home='00000000-0000-4000-8000-000000000002';
 const today=new Date().toLocaleDateString('en-CA');
 let pantryRequests=0;
 const data={notification_states:[],user_preferences:[],household_members:[{household_id:home}],chat_messages:[{id:'chat1',sender_id:'partner',body:'Can we get eggs?',created_at:new Date().toISOString(),pinned:false}],grocery_items:[{id:'g1',name:'Rice',quantity:'2 kg',estimated_price:12,purchased:false}],expenses:[{id:'e1',description:'Groceries',amount:12,spent_on:today,category:'Groceries',receipt_id:'r1'}],receipts:[{id:'r1',merchant:'Shop',total:12,purchased_on:today}],reminders:[{id:'rem1',title:'Take vitamins',remind_at:new Date(Date.now()-60000).toISOString(),completed:false}],todos:[{id:'todo1',title:'Water plants',completed:false}],calendar_events:[{id:'event1',title:'Dinner together',date:today,time:'19:00',category:'Date'}],meal_plans:[{id:'meal1',title:'Chicken soup',date:today,type:'Dinner'}],recipes:[{id:'rec1',title:'Eggs on toast',ingredients:['Eggs','Bread','Rice'],steps:['Toast bread'],created_at:new Date().toISOString()}],pantry_items:[{id:'pan1',name:'Eggs',location:'Fridge',quantity:2,unit:'pcs',low_stock_threshold:1,expiry_date:today}],savings_goals:[],savings_contributions:[],commitments:[],commitment_payments:[],credit_cards:[],credit_transactions:[],wishlist_items:[],love_notes:[]};
 await page.addInitScript(({user})=>{
  localStorage.setItem('sb-ourspace-test-auth-token',JSON.stringify({access_token:'test-access-token',refresh_token:'test-refresh-token',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:user,email:'test@example.com',aud:'authenticated',role:'authenticated'}}));
 },{user});
 await page.route('https://ourspace-test.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname==='/auth/v1/user')return route.fulfill({json:{id:user,email:'test@example.com'}});
  const table=url.pathname.split('/').pop();
  if(table==='pantry_items')pantryRequests++;
  if(!data[table])return route.fulfill({json:[]});
  if(req.method()==='POST'){
   const payload=req.postDataJSON(); const rows=(Array.isArray(payload)?payload:[payload]).map((x,i)=>({...x,id:x.id||`new-${table}-${data[table].length+i}`,created_at:new Date().toISOString()}));if(table==='user_preferences'||table==='notification_states'){
    for(const row of rows){data[table]=data[table].filter(x=>!(x.user_id===row.user_id && (table==='user_preferences'||x.event_key===row.event_key))); data[table].push(row);}
   }else data[table].push(...rows);return route.fulfill({status:201,json:rows});
  }
  if(req.method()==='PATCH'){const id=url.searchParams.get('id')?.replace('eq.','');data[table]=data[table].map(x=>x.id===id?{...x,...req.postDataJSON()}:x);return route.fulfill({json:[]});}
  if(req.method()==='DELETE'){const id=url.searchParams.get('id')?.replace('eq.','');data[table]=data[table].filter(x=>x.id!==id);return route.fulfill({json:[]});}
  const columns=url.searchParams.get('select');
  const result=columns && columns!=='*'?data[table].map(row=>Object.fromEntries(columns.split(',').map(k=>k.trim()).filter(k=>k in row).map(k=>[k,row[k]]))):data[table];
  return route.fulfill({json:result});
 });
 await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:''}));
 await page.goto(process.env.TEST_BASE_URL || 'http://localhost:5173');
 await page.getByRole('heading',{name:/Good .*home/}).waitFor();
 await page.getByText('Chicken soup',{exact:true}).waitFor();
 assert.equal(await page.getByText('Latest Updates',{exact:true}).count(),0);
 assert.equal(await page.locator('.dashboard-stat').last().locator('strong').innerText(),'RM 12.00');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'test-results/mobile-home.png',fullPage:true});
 if(process.env.TEST_PANTRY_DISABLED==='true'){
  await page.getByRole('button',{name:'Pantry & Fridge',exact:true}).last().click();
  await page.getByRole('heading',{name:'Your kitchen inventory is coming next'}).waitFor();
  assert.equal(pantryRequests,0);
  assert.deepEqual(errors,[]);
  console.log('PASS: default flags render gated inventory and make no pantry queries.');
  await browser.close();return;
 }
 await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('button',{name:'Updates',exact:true}).click();
 await page.getByRole('heading',{name:'Notification Centre'}).waitFor();
 await page.getByRole('button',{name:'Snooze 1h'}).first().click();
 await page.getByLabel('Show snoozed').check();
 await page.getByRole('button',{name:'Unsnooze'}).waitFor();
 await page.getByLabel('Show snoozed').uncheck();
 await page.getByRole('button',{name:'Mark all read'}).click();
 await page.getByRole('button',{name:'Unread',exact:true}).click();
 await page.getByRole('heading',{name:'All clear for now ♡'}).waitFor();
 await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('button',{name:'Profile',exact:true}).click();
 await page.getByRole('button',{name:'☾ Dark Mode'}).click();
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 await page.reload(); await page.getByRole('heading',{name:'Your profile'}).waitFor();
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 await page.screenshot({path:'test-results/mobile-dark-profile.png',fullPage:true});
 await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('button',{name:'Quick Add',exact:true}).click();
 await page.getByRole('dialog',{name:'Quick Add'}).getByRole('button',{name:'Pantry & Fridge',exact:true}).click();
 await page.getByRole('heading',{name:'Eggs',exact:true}).waitFor();
 await page.getByRole('button',{name:'+ Add item'}).click();
 await page.getByLabel('Item name',{exact:true}).fill('Milk');
 await page.getByRole('button',{name:'Save item'}).click();
 await page.getByRole('heading',{name:'Milk',exact:true}).waitFor();
 await page.getByRole('article').filter({has:page.getByRole('heading',{name:'Milk',exact:true})}).getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByLabel('Quantity',{exact:true}).fill('3');await page.getByRole('button',{name:'Save item'}).click();
 await page.getByRole('article').filter({has:page.getByRole('heading',{name:'Milk',exact:true})}).getByText('3 pcs · Pantry',{exact:true}).waitFor();
 await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('button',{name:'Chat',exact:true}).click();
 await page.getByTitle('Add to to-do').click();await page.waitForTimeout(300);
 assert.equal(data.todos.some(x=>x.title==='Can we get eggs?'),true);
 await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('navigation',{name:'Feature navigation'}).getByRole('button',{name:'Dashboard',exact:true}).click();
 await page.screenshot({path:'test-results/desktop-dark-home.png',fullPage:true});
 await page.getByRole('navigation',{name:'Feature navigation'}).getByRole('button',{name:'Recipes',exact:true}).click();
 await page.getByRole('button',{name:'View Eggs on toast',exact:true}).click();
 await page.getByRole('button',{name:'+ Add missing ingredients to grocery'}).click();
 await page.getByRole('heading',{name:'Grocery List',exact:true}).waitFor();
 assert.equal(data.grocery_items.filter(x=>x.name==='Rice').length,1);
 assert.equal(data.grocery_items.filter(x=>x.name==='Bread').length,1);
 assert.equal(data.grocery_items.filter(x=>x.name==='Eggs').length,0);
 assert.deepEqual(errors,[]);
 if(process.env.TEST_NOTIFICATION_SYNC==='true'){assert.equal(data.user_preferences[0]?.appearance,'dark');assert.ok(data.notification_states.some(x=>x.read_at));}
 console.log('PASS: mobile dashboard, totals, notification filters/read/snooze, dark preference reload, Quick Add, pantry create/edit, chat-to-task, desktop, recipe/grocery deduplication; no page errors.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
