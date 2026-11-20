import { NextResponse } from 'next/server';
import { publicSupabase } from '../../../lib/public-supabase';
export const dynamic='force-dynamic';
export async function GET(){
  try {
    const {data,error}=await publicSupabase().from('courses').select('id,title,category,level,author,description,cover,color,ink,lessons(position,title,body)').eq('status','published').order('created_at').order('id').limit(100);
    if(error)throw error;
    const courses=(data||[]).map(c=>({...c,lessons:c.lessons.sort((a,b)=>a.position-b.position).map(l=>[l.title,l.body])}));
    return NextResponse.json({courses,source:'supabase'},{headers:{'Cache-Control':'no-store'}});
  } catch {return NextResponse.json({message:'Не удалось загрузить курсы. Попробуйте позже.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
