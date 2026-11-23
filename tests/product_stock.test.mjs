import assert from 'node:assert/strict';
import { test } from 'node:test';
import { productIsAvailable } from '../src/lib/productStock.ts';
test('zero stock is unavailable even if the product listing is enabled',()=>{
  assert.equal(productIsAvailable({available:true,quantity:0,extra_units:[]}),false);
});
test('an additional unit can remain available when the main unit runs out',()=>{
  assert.equal(productIsAvailable({available:true,quantity:0,extra_units:[{unit:'box',price:20,quantity:2}]}),true);
});
test('a disabled product stays unavailable even when it has stock',()=>{
  assert.equal(productIsAvailable({available:false,quantity:10,extra_units:[]}),false);
});
