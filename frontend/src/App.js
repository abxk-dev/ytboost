import "@/App.css";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { MessageCircle } from "lucide-react";

// Contexts
import { AuthProvider } from "./context/AuthContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { SettingsProvider, useSettings } from "./context/SettingsContext";

// Layouts
import DashboardLayout from "./components/DashboardLayout";
import AdminLayout from "./components/AdminLayout";

// Auth Pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

// Public Pages
import Home from "./pages/Home";
import Services from "./pages/Services";

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
import Support from "./pages/dashboard/Support";
import SupportTicket from "./pages/dashboard/SupportTicket";
import Referral from "./pages/dashboard/Referral";
import Analytics from "./pages/dashboard/Analytics";

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
import AdminApiProviders from "./pages/admin/AdminApiProviders";
import AdminWorkflows from "./pages/admin/AdminWorkflows";
import AdminFinanceRevenue from "./pages/admin/AdminFinanceRevenue";
import AdminFinanceTransactions from "./pages/admin/AdminFinanceTransactions";
import AdminFinanceRefunds from "./pages/admin/AdminFinanceRefunds";
import AdminSupport from "./pages/admin/AdminSupport";
import AdminSupportTicket from "./pages/admin/AdminSupportTicket";
import AdminAccount from "./pages/admin/AdminAccount";
import AdminActivityLog from "./pages/admin/AdminActivityLog";
import AdminAdmins from "./pages/admin/AdminAdmins";
import AdminEmailBlast from "./pages/admin/AdminEmailBlast";
import { debugHealthCheck } from "./config/apiConfig";
import { API_BASE_URL } from "./config/apiConfig";

function WhatsAppFloatingButton() {
  const { settings } = useSettings();
  const location = useLocation();

  if (location.pathname.startsWith("/admin")) return null;
  if (settings.whatsapp_enabled !== "true") return null;

  const rawNumber = String(settings.whatsapp_number || "");
  const number = rawNumber.replace(/[^\d]/g, "");

  const urlFromSettings = String(settings.whatsapp_link || "").trim();
  const href = urlFromSettings ? urlFromSettings : number ? `https://wa.me/${number}` : "";
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-4 right-4 z-[9999] inline-flex items-center gap-2 rounded-full bg-[#22c55e] px-4 py-3 text-white shadow-lg hover:bg-[#16a34a]"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="font-semibold">WhatsApp</span>
    </a>
  );
}

function GlobalSeoHelmet() {
  const { settings } = useSettings();
  const title = "YTboost.io - #1 YouTube Service provider";
  const description = settings.seo_meta_description || "";
  const keywords = settings.seo_meta_keywords || "";
  const gaId = settings.google_analytics_id || "";
  const pixelId = settings.facebook_pixel_id || "";

  return (
    <Helmet>
      {title ? <title>{title}</title> : null}
      {description ? <meta name="description" content={description} /> : null}
      {keywords ? <meta name="keywords" content={keywords} /> : null}
      {gaId ? (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
          <script>{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}');
          `}</script>
        </>
      ) : null}
      {pixelId ? (
        <script>{`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
          fbq('track', 'PageView');
        `}</script>
      ) : null}
    </Helmet>
  );
}

function App() {
  useEffect(() => {
    try { console.log("API URL:", import.meta.env.VITE_API_URL, "API_BASE_URL:", API_BASE_URL); } catch {}
    debugHealthCheck();
  }, []);

  return (
    <HelmetProvider>
    <SettingsProvider>
      <AuthProvider>
        <AdminAuthProvider>
          <BrowserRouter>
            <GlobalSeoHelmet />
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/services" element={<Services />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* User Dashboard Routes */}
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="orders" element={<Orders />} />
                <Route path="orders/add" element={<AddOrder />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="add-funds" element={<AddFunds />} />
                <Route path="add-funds/pay/:sessionId" element={<PaymentSession />} />
                <Route path="account" element={<Account />} />
                <Route path="account/change-password" element={<ChangePassword />} />
                <Route path="api-access" element={<ApiAccess />} />
                <Route path="support" element={<Support />} />
                <Route path="support/:ticketId" element={<SupportTicket />} />
                <Route path="referral" element={<Referral />} />
              </Route>

              {/* Admin Routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="categories" element={<AdminCategories />} />
                <Route path="services" element={<AdminServices />} />
                <Route path="workflows" element={<AdminWorkflows />} />
                <Route path="api-providers" element={<AdminApiProviders />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="users/:userId/services" element={<AdminUserServices />} />
                <Route path="fund-requests" element={<AdminFundRequests />} />
                <Route path="crypto-settings" element={<AdminCryptoSettings />} />
                <Route path="finance/revenue" element={<AdminFinanceRevenue />} />
                <Route path="finance/transactions" element={<AdminFinanceTransactions />} />
                <Route path="finance/refunds" element={<AdminFinanceRefunds />} />
                <Route path="support" element={<AdminSupport />} />
                <Route path="support/:ticketId" element={<AdminSupportTicket />} />
                <Route path="account" element={<AdminAccount />} />
                <Route path="system/activity-log" element={<AdminActivityLog />} />
                <Route path="system/admins" element={<AdminAdmins />} />
                <Route path="communications/email-blast" element={<AdminEmailBlast />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
            <WhatsAppFloatingButton />
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
    </HelmetProvider>
  );
}

export default App;
