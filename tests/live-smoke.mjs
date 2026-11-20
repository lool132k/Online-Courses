// Read an explicitly authorized disposable test account from stdin. Never log credentials/cookies.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {base,email,newPassword}=JSON.parse(readFileSync(0,'utf8'));
const checks=[];const jar={};
async function req(path,method='GET',body,origin=base){const response=await fetch(base+path,{method,redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json',Cookie:Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; ')},...(body===undefined?{}:{body:JSON.stringify(body)})});for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0],n=pair.indexOf('=');if(/max-age=0/i.test(cookie))delete jar[pair.slice(0,n)];else jar[pair.slice(0,n)]=pair.slice(n+1);}let data;try{data=await response.json();}catch{}return {response,data};}
function status(result,expected,label){assert.equal(result.response.status,expected,label);checks.push(label);}
try{
const catalog=await req('/api/courses');status(catalog,200,'Render cloud catalogue');assert.equal(catalog.data.source,'supabase');assert.equal(catalog.data.courses.length,4);assert.ok(catalog.data.courses.every(c=>c.lessons.length===3));
const login=await req('/api/auth/login','POST',{email,password:newPassword});status(login,200,'Render login');
const cookies=login.response.headers.getSetCookie().filter(c=>c.split(';')[0].includes('-auth-token'));
assert.ok(cookies.length>0);assert.ok(cookies.every(c=>/httponly/i.test(c)&&/secure/i.test(c)&&/samesite=lax/i.test(c)));checks.push('production Secure HttpOnly SameSite cookies');
const profile=await req('/api/account');status(profile,200,'Render profile');assert.equal(profile.data.is_admin,false);assert.equal(profile.data.name,'QA renamed student');
status(await req('/api/account','PATCH',{name:'QA',is_admin:true}),400,'Render role injection denied');
status(await req('/api/account','PATCH',{name:'QA renamed student'},'https://evil.example'),403,'Render foreign Origin denied');
status(await req('/api/auth/reset','POST',{password:newPassword,confirmation:newPassword}),401,'Render ordinary session cannot reset');
const invalid=await req('/auth/recovery?type=email&token_hash='+'a'.repeat(64));status(invalid,307,'Render recovery rejects signup type');assert.ok(invalid.response.headers.get('location').endsWith('/auth/reset?error=link'));
status(await req('/api/auth/logout-all','POST'),200,'Render logout all devices');
status(await req('/api/account'),401,'Render revoked session denied');
console.log(JSON.stringify({ok:true,checks}));
}catch(error){console.log(JSON.stringify({ok:false,checks,error:error.message}));process.exitCode=1;}
