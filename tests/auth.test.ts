import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trustedOrigin, validateAuth } from '../lib/auth-validation.ts';
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
