import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

// Contexts
import { AuthProvider } from "./context/AuthContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { SettingsProvider } from "./context/SettingsContext";

// Layouts
import DashboardLayout from "./components/DashboardLayout";
import AdminLayout from "./components/AdminLayout";

// Auth Pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

// User Dashboard Pages
import Dashboard from "./pages/dashboard/Dashboard";
import Orders from "./pages/dashboard/Orders";
import AddOrder from "./pages/dashboard/AddOrder";
import Transactions from "./pages/dashboard/Transactions";
import AddFunds from "./pages/dashboard/AddFunds";
import PaymentSession from "./pages/dashboard/PaymentSession";
import Account from "./pages/dashboard/Account";
import ChangePassword from "./pages/dashboard/ChangePassword";
import ApiAccess from "./pages/dashboard/ApiAccess";

// Admin Pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminServices from "./pages/admin/AdminServices";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserServices from "./pages/admin/AdminUserServices";
import AdminFundRequests from "./pages/admin/AdminFundRequests";
import AdminCryptoSettings from "./pages/admin/AdminCryptoSettings";
import AdminSettings from "./pages/admin/AdminSettings";

function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <AdminAuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* User Dashboard Routes */}
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="orders" element={<Orders />} />
                <Route path="orders/add" element={<AddOrder />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="add-funds" element={<AddFunds />} />
                <Route path="add-funds/pay/:sessionId" element={<PaymentSession />} />
                <Route path="account" element={<Account />} />
                <Route path="account/change-password" element={<ChangePassword />} />
                <Route path="api-access" element={<ApiAccess />} />
              </Route>

              {/* Admin Routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="categories" element={<AdminCategories />} />
                <Route path="services" element={<AdminServices />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="users/:userId/services" element={<AdminUserServices />} />
                <Route path="fund-requests" element={<AdminFundRequests />} />
                <Route path="crypto-settings" element={<AdminCryptoSettings />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster 
            position="top-right" 
            richColors 
            closeButton
            toastOptions={{
              style: {
                borderRadius: '8px',
              },
            }}
          />
        </AdminAuthProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}

export default App;
