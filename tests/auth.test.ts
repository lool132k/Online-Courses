import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trustedOrigin, validateAuth } from '../lib/auth-validation.ts';
import { validateProfile } from '../lib/profile-validation.ts';
import { validRecoveryToken, validateNewPassword } from '../lib/recovery-validation.ts';
test('registration normalizes email and name, never accepts role fields', () => {
  const result=validateAuth('signup',{email:' Student@Example.COM ',name:'  Студент  ',password:'a'.repeat(12),is_admin:true});
  assert.deepEqual(result,{email:'student@example.com',name:'Студент',password:'a'.repeat(12),errors:{}});
});
test('invalid and missing fields fail without throwing', () => {
  for(const body of [{},{email:12,password:[],name:null},{email:'a@b',password:'short',name:'x'}]) {
    assert.deepEqual(Object.keys(validateAuth('signup',body).errors).sort(),['email','name','password']);
  }
});
test('password boundaries are inclusive and whitespace is preserved',()=>{
  for(const length of [12,128]) assert.equal(validateAuth('login',{email:'a@b.com',password:' '.repeat(length)}).errors.password,undefined);
  for(const length of [11,129]) assert.ok(validateAuth('login',{email:'a@b.com',password:'a'.repeat(length)}).errors.password);
});
test('resend does not require name/password; signup checks long names',()=>{
  assert.deepEqual(validateAuth('resend',{email:'a@b.com'}).errors,{});
  assert.ok(validateAuth('signup',{email:'a@b.com',name:'a'.repeat(81),password:'a'.repeat(12)}).errors.name);
});
test('mutations reject missing, foreign, deceptive and malformed origins',()=>{
  for(const origin of [null,'null','https://evil.com','https://courses.example.evil.com','http://courses.example']) assert.equal(trustedOrigin(origin,'https://courses.example'),false);
  assert.equal(trustedOrigin('https://courses.example','https://courses.example/path'),true);
  assert.equal(trustedOrigin('http://localhost:3000','http://localhost:3000'),true);
  assert.equal(trustedOrigin('http://localhost:3001','http://localhost:3000'),false);
  assert.equal(trustedOrigin('https://courses.example','not-a-url'),false);
});

test('profile edits normalize names and reject malformed input or role injection',()=>{
  assert.deepEqual(validateProfile({ name: '  Новое имя  ' }), { name: 'Новое имя', error: null });
  for (const body of [null, [], 'name', {}, {name: 12}, {name:' '}, {name:'x'}, {name:'x'.repeat(81)},
    {name:'Студент',is_admin:true}, {name:'Студент',id:'someone-else'}, {name:'Студент',blocked:false}]) {
    assert.ok(validateProfile(body).error);
  }
  for (const length of [2,80]) assert.equal(validateProfile({name:'x'.repeat(length)}).error,null);
});

test('recovery requests validate email without requiring a password',()=>{
  assert.deepEqual(validateAuth('recover',{email:' Student@Example.COM '}).errors,{});
  assert.equal(validateAuth('recover',{email:' Student@Example.COM '}).email,'student@example.com');
  assert.ok(validateAuth('recover',{email:'bad'}).errors.email);
});

test('password reset rejects mismatches, malformed input, extra fields and preserves spaces',()=>{
  for(const value of [null,[],{}, {password:'short',confirmation:'short'}, {password:'a'.repeat(12),confirmation:'b'.repeat(12)}, {password:'a'.repeat(129),confirmation:'a'.repeat(129)}, {password:'a'.repeat(12),confirmation:'a'.repeat(12),is_admin:true}]) assert.ok(validateNewPassword(value));
  assert.equal(validateNewPassword({password:' '.repeat(12),confirmation:' '.repeat(12)}),null);
});

test('recovery tickets reject missing, oversized and unsafe URL values',()=>{
  for(const value of [null,undefined,'','a'.repeat(19),'a'.repeat(257),'<script>alert(1)</script>','a'.repeat(20)+'\n']) assert.equal(validRecoveryToken(value),false);
  assert.equal(validRecoveryToken('ab'.repeat(32)),true);
});
