import { lazy } from 'react'

// Eagerly loaded — needed on first render
export { Login } from './Login'
export { Signup } from './Signup'
export { ForgotPassword } from './ForgotPassword'

// Lazy-loaded — only fetched when the user navigates to these routes
// This reduces the initial bundle size significantly (bundle-dynamic-imports)
export const Dashboard = lazy(() => import('./Dashboard').then(m => ({ default: m.Dashboard })))
export const Transactions = lazy(() => import('./Transactions').then(m => ({ default: m.Transactions })))
export const Budgets = lazy(() => import('./Budgets').then(m => ({ default: m.Budgets })))
export const Categories = lazy(() => import('./Categories').then(m => ({ default: m.Categories })))
export const Accounts = lazy(() => import('./Accounts').then(m => ({ default: m.Accounts })))
export const Goals = lazy(() => import('./Goals').then(m => ({ default: m.Goals })))
export const Debts = lazy(() => import('./Debts').then(m => ({ default: m.Debts })))
export const Settings = lazy(() => import('./Settings').then(m => ({ default: m.Settings })))
export const Calendar = lazy(() => import('./Calendar').then(m => ({ default: m.Calendar })))
