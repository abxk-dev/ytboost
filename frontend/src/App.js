import "@/App.css";
import { useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { MessageCircle } from "lucide-react";

// Contexts
import { AuthProvider } from "./context/AuthContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { SettingsProvider, useSettings } from "./context/SettingsContext";

// Layouts
const DashboardLayout = lazy(() => import("./components/DashboardLayout"));
const AdminLayout = lazy(() => import("./components/AdminLayout"));

// Auth Pages
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));

// Public Pages
import Home from "./pages/Home";
const Services = lazy(() => import("./pages/Services"));

// User Dashboard Pages
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const Orders = lazy(() => import("./pages/dashboard/Orders"));
const AddOrder = lazy(() => import("./pages/dashboard/AddOrder"));
const Transactions = lazy(() => import("./pages/dashboard/Transactions"));
const AddFunds = lazy(() => import("./pages/dashboard/AddFunds"));
const PaymentSession = lazy(() => import("./pages/dashboard/PaymentSession"));
const Account = lazy(() => import("./pages/dashboard/Account"));
const ChangePassword = lazy(() => import("./pages/dashboard/ChangePassword"));
const ApiAccess = lazy(() => import("./pages/dashboard/ApiAccess"));
const Support = lazy(() => import("./pages/dashboard/Support"));
const SupportTicket = lazy(() => import("./pages/dashboard/SupportTicket"));
const Referral = lazy(() => import("./pages/dashboard/Referral"));
const Analytics = lazy(() => import("./pages/dashboard/Analytics"));

// Admin Pages
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminServices = lazy(() => import("./pages/admin/AdminServices"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminUserServices = lazy(() => import("./pages/admin/AdminUserServices"));
const AdminFundRequests = lazy(() => import("./pages/admin/AdminFundRequests"));
const AdminCryptoSettings = lazy(() => import("./pages/admin/AdminCryptoSettings"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminApiProviders = lazy(() => import("./pages/admin/AdminApiProviders"));
const AdminWorkflows = lazy(() => import("./pages/admin/AdminWorkflows"));
const AdminFinanceRevenue = lazy(() => import("./pages/admin/AdminFinanceRevenue"));
const AdminFinanceTransactions = lazy(() => import("./pages/admin/AdminFinanceTransactions"));
const AdminFinanceRefunds = lazy(() => import("./pages/admin/AdminFinanceRefunds"));
const AdminSupport = lazy(() => import("./pages/admin/AdminSupport"));
const AdminSupportTicket = lazy(() => import("./pages/admin/AdminSupportTicket"));
const AdminAccount = lazy(() => import("./pages/admin/AdminAccount"));
const AdminActivityLog = lazy(() => import("./pages/admin/AdminActivityLog"));
const AdminAdmins = lazy(() => import("./pages/admin/AdminAdmins"));
const AdminEmailBlast = lazy(() => import("./pages/admin/AdminEmailBlast"));
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
  const title = "Ytboost.shop - #1 YouTube Service provider";
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
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]"><div className="w-8 h-8 rounded-full border-2 border-[#7c3aed] border-t-transparent animate-spin" role="status" aria-label="Loading" /></div>}>
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
            </Suspense>
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
