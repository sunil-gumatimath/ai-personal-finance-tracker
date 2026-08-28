import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Header } from "./Header";
import { AIAgentChat } from "@/features/dashboard";

export function MainLayout() {
	const location = useLocation();

	// On navigation: snap window scroll back to the top (instant — the html
	// smooth-scroll default would make route changes feel laggy) and move
	// focus to the content region so keyboard/screen-reader users land in
	// the new page instead of staying on the nav they just activated.
	useEffect(() => {
		window.scrollTo({ top: 0, left: 0, behavior: "instant" });
		document
			.getElementById("main-content")
			?.focus({ preventScroll: true });
	}, [location.pathname]);

	return (
		<SidebarProvider>
			{/* First focusable element in the layout — visually hidden until focused */}
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:rounded-md focus:border focus:border-border focus:shadow-md"
			>
				Skip to content
			</a>
			<div className="flex min-h-screen w-full pb-[env(safe-area-inset-bottom)]">
				<AppSidebar />
				{/* SidebarInset renders the single <main> element for the app */}
				<SidebarInset
					id="main-content"
					tabIndex={-1}
					className="flex flex-1 flex-col outline-none"
				>
					<Header />
					<div
						key={location.pathname}
						className="w-full px-4 py-4 md:px-6 md:py-6 motion-safe:animate-fade-in-up"
					>
						<Outlet />
					</div>
				</SidebarInset>
				<AIAgentChat />
			</div>
		</SidebarProvider>
	);
}
