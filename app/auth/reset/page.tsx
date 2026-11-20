import { Suspense } from 'react';
import { ResetForm } from './ui';
export default function ResetPage(){return <Suspense fallback={<p>Загрузка…</p>}><ResetForm/></Suspense>;}
