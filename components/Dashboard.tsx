
import React, { useState } from 'react';
import { UserRole } from '../types';
import { LogOut, Menu, X, LayoutDashboard, Settings, Package, BadgeDollarSign } from 'lucide-react';
import ReceivingPage from '../pages/Receiving';
import ProcessingPage from '../pages/Processing';
import PackingPage from '../pages/Packing';
import FinancePage from '../pages/Finance';
import InventoryPage from '../pages/Inventory';
import OverviewPage from '../pages/Overview';
import SettingsPage from '../pages/Settings';

interface DashboardProps {
  userRole: UserRole;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ userRole, onLogout }) => {
  // Set default tab based on role, but prioritize Overview for Admin
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (userRole === UserRole.ADMIN) return 'overview';
    if (userRole === UserRole.PROCESSING_WORKER) return 'receiving';
    if (userRole === UserRole.PACKING_STAFF) return 'packing';
    if (userRole === UserRole.FINANCE_CLERK) return 'finance';
    return 'overview';
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewPage />;
      case 'receiving':
        return <ReceivingPage />;
      case 'processing':
        return <ProcessingPage />;
      case 'packing':
        return <PackingPage />;
      case 'inventory':
        return <InventoryPage />;
      case 'finance':
        return <FinancePage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <OverviewPage />;
    }
  };

  const NavButton = ({ id, label, roleRequired, icon }: { id: string, label: string, roleRequired?: UserRole[], icon?: React.ReactNode }) => {
    // If role is ADMIN, they see everything. Otherwise check specific role.
    if (roleRequired && !roleRequired.includes(userRole) && userRole !== UserRole.ADMIN) return null;
    
    return (
      <button
        onClick={() => {
          setActiveTab(id);
          setIsSidebarOpen(false);
        }}
        className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors flex items-center ${
          activeTab === id
            ? 'bg-nature-600 text-white shadow-md'
            : 'text-earth-300 hover:bg-earth-800 hover:text-white'
        }`}
      >
        {icon && <span className="mr-3">{icon}</span>}
        {label}
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:relative z-30 w-64 h-full bg-earth-900 text-white flex flex-col transition-transform duration-300 ease-in-out shadow-xl
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-earth-800 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight">ShroomTrack</h1>
            <p className="text-xs text-earth-400 mt-1">{userRole}</p>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-earth-400">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {/* Main Dashboard Link */}
          <NavButton 
            id="overview" 
            label="Main Dashboard" 
            icon={<LayoutDashboard size={18} />}
          />

          <div className="text-xs font-semibold text-earth-500 uppercase tracking-wider mb-2 px-4 mt-4">Operations</div>
          <NavButton 
            id="receiving" 
            label="Receiving Log" 
            roleRequired={[UserRole.PROCESSING_WORKER]} 
          />
          <NavButton 
            id="processing" 
            label="Processing Floor" 
            roleRequired={[UserRole.PROCESSING_WORKER]} 
          />
          
          <div className="text-xs font-semibold text-earth-500 uppercase tracking-wider mb-2 px-4 mt-6">Fulfillment</div>
          <NavButton 
            id="packing" 
            label="Packing Station" 
            roleRequired={[UserRole.PACKING_STAFF]} 
          />
          <NavButton 
            id="inventory" 
            label="Inventory" 
            icon={<Package size={18} />}
            roleRequired={[UserRole.PACKING_STAFF, UserRole.FINANCE_CLERK]} 
          />
          
          <div className="text-xs font-semibold text-earth-500 uppercase tracking-wider mb-2 px-4 mt-6">Management</div>
          <NavButton 
            id="finance" 
            label="Finance" 
            icon={<BadgeDollarSign size={18} />}
            roleRequired={[UserRole.FINANCE_CLERK]} 
          />
        </nav>

        <div className="p-4 border-t border-earth-800 space-y-2">
          {/* Settings Link - Only for Admin */}
          {userRole === UserRole.ADMIN && (
            <button
              onClick={() => {
                setActiveTab('settings');
                setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors flex items-center ${
                activeTab === 'settings'
                  ? 'bg-earth-800 text-white'
                  : 'text-earth-400 hover:text-white hover:bg-earth-800'
              }`}
            >
              <Settings size={20} className="mr-3" />
              Settings
            </button>
          )}

          <button
            onClick={onLogout}
            className="flex items-center w-full px-4 py-3 text-earth-300 hover:text-white hover:bg-earth-800 rounded-lg transition-colors"
          >
            <LogOut size={20} className="mr-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full w-full overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shadow-sm z-10">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <Menu size={24} />
          </button>
          <div className="text-sm font-medium text-slate-500">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-nature-500 animate-pulse"></div>
            <span className="text-xs text-slate-500 font-medium">System Online</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 bg-slate-50">
          <div className="max-w-7xl mx-auto h-full">
            {renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
