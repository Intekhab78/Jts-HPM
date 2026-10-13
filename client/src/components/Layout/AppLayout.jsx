import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import './AppLayout.css';

export default function AppLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className={`app-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="app-main">
                <Navbar onMenuClick={() => setSidebarOpen(true)} />
                <main className="app-content">
                    <Outlet />
                </main>
            </div>
            {sidebarOpen && (
                <div 
                    className="sidebar-backdrop" 
                    onClick={() => setSidebarOpen(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.4)',
                        backdropFilter: 'blur(3px)',
                        WebkitBackdropFilter: 'blur(3px)',
                        zIndex: 999
                    }}
                ></div>
            )}
        </div>
    );
}
