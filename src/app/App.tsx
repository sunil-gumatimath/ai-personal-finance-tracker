import { Suspense, useEffect } from "react";
import {
	BrowserRouter,
	Routes,
	Route,
	Navigate,
	useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { ThemeProvider } from "@/components/system/theme-provider";
import { ErrorBoundary } from "@/components/system/ErrorBoundary";
import { FullScreenLoader } from "@/components/system/FullScreenLoader";
import { MainLayout } from "@/components/layout";
import {
	APP_BRAND,
	APP_TITLE,
	ROUTE_TITLES,
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
	SystemLogs,
	Reports,
} from "@/pages";
import { Toaster } from "@/components/ui/sonner";

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
	const { user, initializing } = useAuth();
	// Gate ONLY on the initial session bootstrap; sign-in/up actions own their
	// pending state at the page level.
	const booted = initializing ?? false;

	if (booted) {
		return <FullScreenLoader label="Checking your session…" />;
	}

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	return <>{children}</>;
}

// Public Route wrapper (redirect to dashboard if already logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
	const { user, initializing } = useAuth();
	const booted = initializing ?? false;

	if (booted) {
		return <FullScreenLoader label="Checking your session…" />;
	}

	if (user) {
		return <Navigate to="/" replace />;
	}

	return <>{children}</>;
}

/** Keeps the browser tab title in sync with the active route. */
function DocumentTitle() {
	const location = useLocation();

	useEffect(() => {
		const title = ROUTE_TITLES[location.pathname];
		document.title = title ? `${title} · ${APP_BRAND}` : APP_TITLE;
	}, [location.pathname]);

	return null;
}

/** Path → lazily-loaded page, protected by MainLayout. */
const PROTECTED_ROUTES: Array<[string, React.ComponentType]> = [
	["/", Dashboard],
	["/transactions", Transactions],
	["/reports", Reports],
	["/calendar", Calendar],
	["/budgets", Budgets],
	["/goals", Goals],
	["/debts", Debts],
	["/categories", Categories],
	["/accounts", Accounts],
	["/settings", Settings],
	["/system-logs", SystemLogs],
];

function AppRoutes() {
	return (
		<>
			<DocumentTitle />
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

				{/* Protected Routes — lazy-loaded with Suspense. The second
				    ErrorBoundary contains crashes to the routed area so a broken
				    page can never blank out the whole app shell. */}
				<Route
					element={
						<ProtectedRoute>
							<ErrorBoundary>
								<MainLayout />
							</ErrorBoundary>
						</ProtectedRoute>
					}
				>
					{PROTECTED_ROUTES.map(([path, Page]) => (
						<Route
							key={path}
							path={path}
							element={
								<Suspense fallback={<FullScreenLoader />}>
									<Page />
								</Suspense>
							}
						/>
					))}
				</Route>

				{/* Catch all - redirect to dashboard */}
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</>
	);
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
	);
}

export default App;
