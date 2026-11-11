import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDate, monthlySpending, isQuietHours, inventoryStatus, missingIngredients } from '../src/v12-utils.js';

test('monthly totals count linked receipts once, including links across months', () => {
  const expenses = [{amount:10,spent_on:'2026-11-01',receipt_id:'a'},{amount:20,spent_on:'2026-10-31',receipt_id:'b'}];
  const receipts = [{id:'a',total:10,purchased_on:'2026-11-01'},{id:'b',total:20,purchased_on:'2026-11-01'},{id:'c',total:7,purchased_on:'2026-11-02'},{id:'d',total:50,purchased_on:'2026-10-01'}];
  assert.equal(monthlySpending(expenses,receipts,'2026-11'),17);
});
test('quiet hours handle overnight, boundaries and user timezone', () => {
  const prefs = {quiet_enabled:true,quiet_start:'22:00:00',quiet_end:'07:00:00',timezone:'Asia/Kuala_Lumpur'};
  assert.equal(isQuietHours(prefs,new Date('2026-11-11T14:00:00Z')),true);
  assert.equal(isQuietHours(prefs,new Date('2026-11-11T22:59:00Z')),true);
  assert.equal(isQuietHours(prefs,new Date('2026-11-11T23:00:00Z')),false);
  assert.equal(isQuietHours({...prefs,quiet_enabled:false}),false);
  assert.equal(isQuietHours({...prefs,quiet_start:'07:00'},new Date()),true);
});
test('daytime quiet hours and DST use the configured timezone',()=>{
  const prefs={quiet_enabled:true,quiet_start:'09:00',quiet_end:'17:00',timezone:'America/New_York'};
  assert.equal(isQuietHours(prefs,new Date('2026-11-11T14:00:00Z')),true);
  assert.equal(isQuietHours(prefs,new Date('2026-07-11T13:00:00Z')),true);
  assert.equal(isQuietHours(prefs,new Date('2026-11-11T22:00:00Z')),false);
});
test('expiry and low stock boundaries',()=>{
  assert.equal(inventoryStatus({quantity:0,low_stock_threshold:1,expiry_date:'2026-11-10'},'2026-11-11'),'Expired');
  assert.equal(inventoryStatus({quantity:2,low_stock_threshold:1,expiry_date:'2026-11-14'},'2026-11-11'),'Use soon');
  assert.equal(inventoryStatus({quantity:1,low_stock_threshold:1},'2026-11-11'),'Low stock');
  assert.equal(inventoryStatus({quantity:2,low_stock_threshold:1},'2026-11-11'),'In stock');
});
test('grocery integration avoids exact duplicates but does not guess quantities',()=>{
  const list=[{name:'Rice',done:false},{name:'Milk',done:true}];
  const pantry=[{name:'Eggs',quantity:2,low_stock_threshold:1},{name:'Bread',quantity:0}];
  assert.deepEqual(missingIngredients(['rice',' Eggs ','Milk','Bread','milk','200g rice'],list,pantry),['Milk','Bread','200g rice']);
});
test('local dates retain calendar day',()=>{ assert.equal(localDate(new Date(2026,10,11,23,59)),'2026-11-11'); });
