import assert from 'node:assert/strict';
import { isPhoneGoogleState, phoneGoogleReturn, readPhoneGoogleReturn } from '../packages/core/src/phoneGoogle';

const state = 'a'.repeat(48);
const hash = 'b'.repeat(64);
const url = phoneGoogleReturn(hash, state);
assert.equal(readPhoneGoogleReturn(url, state), hash);
assert.equal(readPhoneGoogleReturn(url, 'c'.repeat(48)), null, 'Reject another login attempt');
assert.equal(readPhoneGoogleReturn(url.replace('linguascript:', 'https:'), state), null);
assert.equal(readPhoneGoogleReturn(url.replace('auth-callback', 'open'), state), null);
assert.equal(readPhoneGoogleReturn(`${url}&access_token=bad`, ''), null);
assert.equal(readPhoneGoogleReturn('linguascript://auth-callback?code=old', state), null);
assert.equal(isPhoneGoogleState('short'), false);
assert.equal(new URL(url).search, '', 'Do not send credentials in query strings');
console.log('Phone Google callback: matching attempt accepted; unrelated, legacy and malformed returns rejected.');