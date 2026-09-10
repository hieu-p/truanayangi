import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const temp = mkdtempSync(tmpdir() + '/counter-test-');
try {
  buildSync({entryPoints:['lib/global-counter.ts'],outfile:temp+'/counter.cjs',bundle:true,platform:'node',format:'cjs'});
  const {parseCounter,mergeCounter}=createRequire(import.meta.url)(temp+'/counter.cjs');
  const now=Date.now();
  let anchor=parseCounter({count:150000,savedAt:now-1000});
  anchor=mergeCounter(anchor,parseCounter({count:150800,savedAt:now}));
  anchor=mergeCounter(anchor,parseCounter({count:150200,savedAt:now}));
  assert.equal(anchor.count,150800,'late GET cannot rewind a newer POST');
  assert.deepEqual(parseCounter(JSON.parse(JSON.stringify(anchor))),anchor,'reload preserves confirmed total without projection');
  assert.equal(mergeCounter(anchor,parseCounter({count:150100,savedAt:now-500})).count,150800,'older tab cannot rewind');
  assert.equal(mergeCounter(anchor,null).count,150800);
  for(const count of [-1,NaN,Infinity,1.5,'150000']) assert.equal(parseCounter({count,savedAt:now}),null);
  assert.equal(parseCounter({count:1,savedAt:now+100000}),null);
  console.log('PASS: late responses, reload, cross-tab merge, invalid input, no extrapolation.');
} finally {rmSync(temp,{recursive:true,force:true});}
