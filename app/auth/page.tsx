import { Suspense } from 'react';
import { AuthForm } from './ui';
export default function AuthPage() { return <Suspense fallback={<p>Загрузка…</p>}><AuthForm/></Suspense>; }
