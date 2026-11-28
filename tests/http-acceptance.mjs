// Integration runner. Test credentials arrive on stdin and are never written to disk/logs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const input=JSON.parse(readFileSync(0,'utf8'));
const {phase,...state}=input;
const checks=[];
const base=state.base;
function applyCookies(jar,response){for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0];const n=pair.indexOf('=');if(/max-age=0/i.test(cookie))delete jar[pair.slice(0,n)];else jar[pair.slice(0,n)]=pair.slice(n+1);}}
async function request(path,{method='GET',body,jar={},origin=base}={}){
  const response=await fetch(base+path,{method,redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json',Cookie:Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; ')},...(body===undefined?{}:{body:JSON.stringify(body)})});
  applyCookies(jar,response);let data;try{data=await response.json();}catch{data=null;}
  return {response,data,jar};
}
function status(result,expected,label){assert.equal(result.response.status,expected,`${label}: unexpected HTTP status`);checks.push(label);}
const credentials={email:state.email,password:state.password};
try{
if(phase==='signup'){
  const catalog=await request('/api/courses');status(catalog,200,'cloud catalogue');assert.equal(catalog.data.source,'supabase');assert.equal(catalog.data.courses.length,4);assert.ok(catalog.data.courses.every(c=>c.lessons.length===3));
  status(await request('/api/account'),401,'anonymous account denied');
  status(await request('/api/account',{method:'PATCH',body:{name:'Changed'}}),401,'anonymous profile edit denied');
  status(await request('/api/auth/login',{method:'POST',body:credentials,origin:'https://evil.example'}),403,'foreign Origin denied');
  status(await request('/api/auth/login',{method:'POST',body:{email:"' OR 1=1--",password:state.password}}),400,'SQL-like email rejected');
  status(await request('/api/auth/signup',{method:'POST',body:{...credentials,name:'QA temporary student'}}),200,'signup and email request');
}
if(phase==='sessions'){
  const verified=await request('/auth/confirm?type=email&token_hash='+encodeURIComponent(state.confirmation));status(verified,307,'signup callback');assert.ok(verified.response.headers.get('location').includes('confirmed=1'));
  const a={},b={};
  status(await request('/api/auth/login',{method:'POST',body:credentials,jar:a}),200,'confirmed login A');
  const profile=await request('/api/account',{jar:a});status(profile,200,'authenticated account');assert.equal(profile.data.is_admin,false);assert.equal(profile.data.is_teacher,false);
  status(await request('/api/account',{method:'PATCH',body:{name:'QA renamed student'},jar:a}),200,'profile rename');
  status(await request('/api/account',{method:'PATCH',body:{name:'QA',is_admin:true},jar:a}),400,'role injection denied');
  status(await request('/api/account',{method:'POST',jar:a}),201,'teacher request');
  status(await request('/api/account',{method:'POST',jar:a}),409,'duplicate teacher request denied');
  const reload=await request('/api/account',{jar:a});assert.equal(reload.data.name,'QA renamed student');assert.equal(reload.data.request.status,'pending');checks.push('name and request persist');
  status(await request('/api/auth/login',{method:'POST',body:credentials,jar:b}),200,'confirmed login B');
  const oldA={...a};status(await request('/api/auth/logout',{method:'POST',jar:a}),200,'local logout');
  status(await request('/api/account',{jar:oldA}),401,'old cookie cannot reuse revoked session');
  status(await request('/api/account',{jar:b}),200,'other device remains active');
  const names=Object.keys(b).filter(n=>/-auth-token(\.\d+)?$/.test(n)).sort();
  const cookieValue=names.map(n=>decodeURIComponent(b[n])).join('');assert.ok(cookieValue.startsWith('base64-'));
  const session=JSON.parse(Buffer.from(cookieValue.slice(7),'base64url').toString());session.expires_at=1;
  for(const n of names)delete b[n];
  const encoded='base64-'+Buffer.from(JSON.stringify(session)).toString('base64url');
  const root=names[0].replace(/\.\d+$/,'');
  for(let i=0;i<encoded.length;i+=3000)b[root+'.'+(i/3000)]=encoded.slice(i,i+3000);
  const refreshed=await request('/api/account',{jar:b});status(refreshed,200,'expired cached session refresh');assert.ok(refreshed.response.headers.getSetCookie().length>0);checks.push('refresh updates HttpOnly cookies');
  status(await request('/api/auth/reset',{method:'POST',jar:b,body:{password:state.newPassword,confirmation:state.newPassword}}),401,'normal login cannot reset password');
  state.jar=b;
  status(await request('/api/auth/recover',{method:'POST',body:{email:state.email}}),200,'recovery email request');
}
if(phase==='reset'){
  const jar={...state.jar};
  const link=await request('/auth/recovery?type=recovery&token_hash='+encodeURIComponent(state.recovery),{jar});status(link,307,'recovery link strips token from URL');assert.equal(new URL(link.response.headers.get('location')).pathname,'/auth/reset');
  status(await request('/api/auth/reset',{method:'POST',jar,body:{password:state.newPassword,confirmation:'different password'}}),400,'password mismatch preserves link');
  const reset=await request('/api/auth/reset',{method:'POST',jar,body:{password:state.newPassword,confirmation:state.newPassword}});status(reset,200,'new password saved');assert.ok(reset.data.message.includes('Все сеансы завершены'));
  status(await request('/api/account',{jar:state.jar}),401,'password reset revokes previous sessions');
  status(await request('/api/auth/login',{method:'POST',body:credentials}),401,'old password denied');
  const active={};status(await request('/api/auth/login',{method:'POST',body:{email:state.email,password:state.newPassword},jar:active}),200,'new password login');
  await request('/auth/recovery?type=recovery&token_hash='+encodeURIComponent(state.recovery),{jar});
  status(await request('/api/auth/reset',{method:'POST',jar,body:{password:state.newPassword,confirmation:state.newPassword}}),401,'used recovery link denied');
  const second={};status(await request('/api/auth/login',{method:'POST',body:{email:state.email,password:state.newPassword},jar:second}),200,'second device after recovery');
  const previous={...active};status(await request('/api/auth/logout-all',{method:'POST',jar:active}),200,'logout all devices');
  status(await request('/api/account',{jar:previous}),401,'current device revoked');status(await request('/api/account',{jar:second}),401,'other device revoked');
}
if(phase==='expired'){
  const jar={};await request('/auth/recovery?type=recovery&token_hash='+encodeURIComponent(state.expired),{jar});
  status(await request('/api/auth/reset',{method:'POST',jar,body:{password:state.newPassword,confirmation:state.newPassword}}),401,'expired recovery link denied');
  const email=state.limitEmail;
  for(let i=0;i<10;i++)status(await request('/api/auth/login',{method:'POST',body:{email,password:state.password}}),401,`incorrect login ${i+1}`);
  const blocked=await request('/api/auth/login',{method:'POST',body:{email,password:state.password}});status(blocked,429,'login limiter blocks eleventh attempt');assert.ok(Number(blocked.response.headers.get('retry-after'))>0);
}
console.log(JSON.stringify({ok:true,checks,state}));
}catch(error){console.log(JSON.stringify({ok:false,checks,error:error.message,state}));process.exitCode=1;}
