import { useLocation, Link } from "react-router-dom";
import {
	LayoutDashboard,
	Calendar,
	ArrowLeftRight,
	PiggyBank,
	Tags,
	Wallet,
	Target,
	Settings,
	CreditCard,
	ScrollText,
	BarChart3,
	Sparkles,
} from "lucide-react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/system/Logo";
import { getInitials } from "@/lib/initials";

// Canonical short labels — mirrored by ROUTE_TITLES (src/pages/index.ts)
// so sidebar, breadcrumbs and document titles always agree.
const NAV_GROUPS = [
	{
		label: "Overview",
		items: [
			{ title: "Dashboard", icon: LayoutDashboard, path: "/" },
			{ title: "AI Digest", icon: Sparkles, path: "/digest" },
			{ title: "Reports", icon: BarChart3, path: "/reports" },
			{ title: "Calendar", icon: Calendar, path: "/calendar" },
		],
	},
	{
		label: "Money",
		items: [
			{ title: "Transactions", icon: ArrowLeftRight, path: "/transactions" },
			{ title: "Budgets", icon: PiggyBank, path: "/budgets" },
			{ title: "Goals", icon: Target, path: "/goals" },
			{ title: "Debts", icon: CreditCard, path: "/debts" },
			{ title: "Accounts", icon: Wallet, path: "/accounts" },
		],
	},
	{
		label: "Manage",
		items: [
			{ title: "Categories", icon: Tags, path: "/categories" },
			{ title: "System Logs", icon: ScrollText, path: "/system-logs" },
			{ title: "Settings", icon: Settings, path: "/settings" },
		],
	},
];

export function AppSidebar() {
	const location = useLocation();
	const { user } = useAuth();

	return (
		<Sidebar className="border-r border-border/50">
			<SidebarHeader className="border-b border-border/50 p-4">
				<div className="px-2">
					<Logo size="md" showText={true} />
				</div>
			</SidebarHeader>

			<SidebarContent>
				{NAV_GROUPS.map((group) => (
					<SidebarGroup key={group.label}>
						<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{group.items.map((item) => (
									<SidebarMenuItem key={item.title}>
										<SidebarMenuButton
											asChild
											isActive={location.pathname === item.path}
										>
											<Link to={item.path}>
												<item.icon className="h-4 w-4" />
												<span>{item.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>

			{/* Slim account entry point — full identity + sign-out controls live
			    in the header user menu; this just links to settings. */}
			<SidebarFooter className="border-t border-border/50 p-2">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							tooltip="Account settings"
							isActive={location.pathname === "/settings"}
						>
							<Link to="/settings" aria-label="Open account settings">
								<Avatar className="size-6">
									<AvatarImage
										src={user?.user_metadata?.avatar_url || undefined}
									/>
									<AvatarFallback className="bg-primary/10 text-primary text-[10px]">
										{getInitials(
											user?.user_metadata?.full_name || user?.email,
										)}
									</AvatarFallback>
								</Avatar>
								<span>Account settings</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
