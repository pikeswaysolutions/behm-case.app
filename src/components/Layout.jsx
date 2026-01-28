import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  FileText,
  Users,
  UserCog,
  Settings,
  BarChart3,
  Upload,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Building2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';

const Layout = ({ children }) => {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/cases', label: 'Cases', icon: FileText },
    { path: '/reports', label: 'Reports', icon: BarChart3 },
  ];

  const adminNavItems = [
    { path: '/directors', label: 'Directors', icon: Users },
    { path: '/users', label: 'Users', icon: UserCog },
    { path: '/service-types', label: 'Service Types', icon: Settings },
    { path: '/sale-types', label: 'Sale Types', icon: Settings },
    { path: '/import', label: 'Import Data', icon: Upload },
  ];

  const NavLink = ({ item, onClick }) => {
    const isActive = location.pathname === item.path;
    const Icon = item.icon;
    
    return (
      <Link
        to={item.path}
        onClick={onClick}
        className={`sidebar-link ${isActive ? 'active' : ''}`}
        data-testid={`nav-${item.path.replace('/', '')}`}
      >
        <Icon className="w-5 h-5" strokeWidth={1.5} />
        <span className="font-medium">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-navy to-navy-dark transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-white/10">
            <Link to="/dashboard" className="flex items-center gap-3" data-testid="logo-link">
              <div className="w-10 h-10 bg-gold rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-navy" />
              </div>
              <div>
                <h1 className="text-white font-playfair font-semibold text-lg">Behm Funeral</h1>
                <p className="text-slate-400 text-xs">Management System</p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <p className="px-4 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
              Main
            </p>
            {navItems.map((item) => (
              <NavLink key={item.path} item={item} onClick={() => setSidebarOpen(false)} />
            ))}

            {isAdmin && (
              <>
                <p className="px-4 py-2 mt-6 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Administration
                </p>
                {adminNavItems.map((item) => (
                  <NavLink key={item.path} item={item} onClick={() => setSidebarOpen(false)} />
                ))}
              </>
            )}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center">
                <span className="text-gold font-medium text-sm">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{user?.name}</p>
                <p className="text-slate-400 text-xs capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="flex items-center justify-between px-4 lg:px-8 h-16">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900"
              data-testid="mobile-menu-btn"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex-1" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="flex items-center gap-2"
                  data-testid="user-menu-btn"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-medium text-sm">
                      {user?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-slate-700">
                    {user?.name}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="text-red-600 cursor-pointer"
                  data-testid="logout-btn"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
