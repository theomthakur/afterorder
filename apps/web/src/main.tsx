import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.tsx';
import './styles.css';

const environmentId = import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID as string | undefined;
const DynamicShell = lazy(() => import('./DynamicShell.tsx').then((module) => ({ default: module.DynamicShell })));
const application = environmentId
  ? <Suspense fallback={<div className="boot">Connecting merchant wallet…</div>}><DynamicShell environmentId={environmentId}><App /></DynamicShell></Suspense>
  : <App />;

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{application}</React.StrictMode>);
