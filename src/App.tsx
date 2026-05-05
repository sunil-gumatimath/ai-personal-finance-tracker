import { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { PreferencesProvider } from '@/contexts/PreferencesContext'
import { ThemeProvider } from '@/components/ui/theme-provider'
import { MainLayout } from '@/components/layout'
import {
  Dashboard,
  Transactions,
  Budgets,
  Categories,
  Accounts,
  Goals,
  Debts,
  Settings,
  Login,
  Signup,
  ForgotPassword,
  Calendar,
} from '@/pages'
import { Toaster } from '@/components/ui/sonner'

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Public Route wrapper (redirect to dashboard if already logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// Shared loading fallback for lazy-loaded pages
const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
)

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />

      {/* Protected Routes — lazy-loaded with Suspense */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
        <Route path="/transactions" element={<Suspense fallback={<PageLoader />}><Transactions /></Suspense>} />
        <Route path="/calendar" element={<Suspense fallback={<PageLoader />}><Calendar /></Suspense>} />
        <Route path="/budgets" element={<Suspense fallback={<PageLoader />}><Budgets /></Suspense>} />
        <Route path="/goals" element={<Suspense fallback={<PageLoader />}><Goals /></Suspense>} />
        <Route path="/debts" element={<Suspense fallback={<PageLoader />}><Debts /></Suspense>} />
        <Route path="/categories" element={<Suspense fallback={<PageLoader />}><Categories /></Suspense>} />
        <Route path="/accounts" element={<Suspense fallback={<PageLoader />}><Accounts /></Suspense>} />
        <Route path="/settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
      </Route>

      {/* Catch all - redirect to dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <PreferencesProvider>
            <div className="min-h-screen font-sans antialiased">
              <AppRoutes />
              <Toaster />
            </div>
          </PreferencesProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
