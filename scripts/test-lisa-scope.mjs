import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {screeningScopeNote,retrieveLisaContext,cleanLisaOutput}=await import(pathToFileURL(process.argv[2]).href);
for(const question of [
  'Can my ECHO report tell me whether I have hearing loss?',
  'Do I have severe hearing loss?',
  'Does this audiogram diagnose sensorineural hearing loss?',
  'Is my hearing normal?',
])assert.match(screeningScopeNote(question),/cannot determine/);
for(const question of ['How can I protect my hearing?','How does the game work?','Explain my report'])assert.equal(screeningScopeNote(question),null);
assert.equal(retrieveLisaContext('How can I protect my hearing? And during a loud commute?')[0].id,'who');
assert.equal(cleanLisaOutput('<think>private reasoning</think>Take listening breaks.'),'Take listening breaks.');
console.log('PASS: 9 Lisa scope, reference-selection, and output-display checks.');
