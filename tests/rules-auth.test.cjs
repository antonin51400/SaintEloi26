const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8'));
const data = rules.rules.events['saint-eloi-2026'].data;
const evaluate = (formula, auth) => Function('auth', 'return (' + formula + ');')(auth);
const users = [
  ['access2002@sainteloi26-371e3.firebaseapp.com', 'nCNc0JdWznOZ6j4B4GjfvQqWX4K2'],
  ['access9425@sainteloi26-371e3.firebaseapp.com', 'oJnhcgxm4KhnKHN3kFa2u6kYoTf2'],
  ['access3186@sainteloi26-371e3.firebaseapp.com', 'AmCQErej08OtCuGkwvZyC8etGdl1'],
  ['access4279@sainteloi26-371e3.firebaseapp.com', 'A5x97smh01XmZEoOZmLg63Nr2Ig1']
];
assert.equal(rules.rules['.read'], false);
assert.equal(rules.rules['.write'], false);
const participantRule=data.reservations['$id'].participants['$pid']['.validate'];
assert.ok(participantRule.includes("newData.child('arrived').val() === false"), 'arrived must be compared explicitly to a boolean');
assert.ok(participantRule.includes("newData.child('paid').val() === true"), 'arrived guests must have paid');
assert.ok(!participantRule.includes("!newData.child('arrived').val()"), 'Firebase rules do not allow logical NOT on untyped values');
for (const [email, uid] of users) {
  const valid = {provider: 'password', uid, token: {email}};
  assert.equal(evaluate(data['.read'], valid), true, email + ': read');
  assert.equal(evaluate(data['.write'], valid), true, email + ': write');
  assert.equal(evaluate(data['.read'], {...valid, uid: 'unknown-uid'}), false, email + ': wrong uid');
  assert.equal(evaluate(data['.write'], {...valid, token: {email: 'other@example.com'}}), false, email + ': wrong email');
  assert.equal(evaluate(data['.read'], {...valid, provider: 'anonymous'}), false, email + ': anonymous');
}
assert.equal(evaluate(data['.read'], null), false);
assert.equal(evaluate(data['.write'], null), false);
assert.equal(evaluate(data['.read'], {uid:'stranger',provider:'password',token:{email:'hacker@example.com'}}), false);
// Le nouveau système e-mail est préparé mais n'est pas publié tant que
// la création de comptes en libre-service n'a pas été désactivée dans Firebase.
const future=JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database.rules.managed-users.json'),'utf8'));
const event=future.rules.events['saint-eloi-2026'];
assert.equal(future.rules['.read'],false);
assert.equal(future.rules['.write'],false);
assert.match(event.data['.read'],/profiles/);
assert.match(event.data['.write'],/role'\)\.val\(\) === 'admin'/);
assert.match(event.profiles['$uid']['.write'],/auth.uid === \$uid/);
assert.match(event.profiles['$uid']['.write'],/!data.exists\(\)/);
assert.equal(event.profiles['$uid'].firstName['.validate'].includes('isString()'),true);
console.log('PASS: exact four organizer UID and email pairs; unapproved users rejected.');
