import { Outlet } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { Header } from './Header'
import { AIAgentChat } from '@/components/dashboard'

export function MainLayout() {
    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full">
                <AppSidebar />
                <SidebarInset className="flex flex-1 flex-col">
                    <Header />
                    <main className="flex-1 overflow-auto p-4 md:p-6">
                        <Outlet />
                    </main>
                </SidebarInset>
                <AIAgentChat />
            </div>
        </SidebarProvider>
    )
}
