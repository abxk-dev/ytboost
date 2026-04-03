import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Wallet, ShoppingCart, CheckCircle, Clock, TrendingUp, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/dashboard/stats');
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statusColors = {
    Pending: 'bg-amber-100 text-amber-700 border-amber-200',
    Processing: 'bg-blue-100 text-blue-700 border-blue-200',
    'In Progress': 'bg-blue-100 text-blue-700 border-blue-200',
    Completed: 'bg-green-100 text-green-700 border-green-200',
    Partial: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    Cancelled: 'bg-red-100 text-red-700 border-red-200',
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-white rounded-[12px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="user-dashboard">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#111827]">Dashboard</h1>
        <Link
          to="/dashboard/orders/add"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded-[8px] font-medium transition-colors"
          data-testid="new-order-btn"
        >
          New Order
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border border-[#e5e7eb] rounded-[12px] hover:-translate-y-1 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6b7280] font-medium">Balance</p>
                <p className="text-2xl font-bold text-[#111827] mt-1">${stats?.balance?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="w-12 h-12 bg-[#f5f3ff] rounded-full flex items-center justify-center">
                <Wallet className="w-6 h-6 text-[#7c3aed]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#e5e7eb] rounded-[12px] hover:-translate-y-1 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6b7280] font-medium">Total Orders</p>
                <p className="text-2xl font-bold text-[#111827] mt-1">{stats?.totalOrders || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#e5e7eb] rounded-[12px] hover:-translate-y-1 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6b7280] font-medium">Pending</p>
                <p className="text-2xl font-bold text-[#111827] mt-1">{stats?.pendingOrders || 0}</p>
              </div>
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border border-[#e5e7eb] rounded-[12px] hover:-translate-y-1 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6b7280] font-medium">Total Spent</p>
                <p className="text-2xl font-bold text-[#111827] mt-1">${stats?.totalSpent?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card className="bg-white border border-[#e5e7eb] rounded-[12px]">
        <CardHeader className="border-b border-[#e5e7eb] px-6 py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-[#111827]">Recent Orders</CardTitle>
            <Link
              to="/dashboard/orders"
              className="text-sm text-[#7c3aed] hover:text-[#8b5cf6] font-medium"
            >
              View All
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {stats?.recentOrders?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e5e7eb]">
                    <th className="text-left py-3 px-6 text-xs font-semibold text-[#6b7280] uppercase tracking-wider">Service</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-[#6b7280] uppercase tracking-wider">Quantity</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-[#6b7280] uppercase tracking-wider">Charge</th>
                    <th className="text-left py-3 px-6 text-xs font-semibold text-[#6b7280] uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-[#e5e7eb] last:border-0 hover:bg-[#f9fafb]">
                      <td className="py-4 px-6 text-sm text-[#111827] font-medium">{order.serviceName}</td>
                      <td className="py-4 px-6 text-sm text-[#6b7280]">{order.quantity.toLocaleString()}</td>
                      <td className="py-4 px-6 text-sm text-[#111827] font-medium">${order.charge.toFixed(4)}</td>
                      <td className="py-4 px-6">
                        <Badge className={`${statusColors[order.status]} border text-xs font-medium`}>
                          {order.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-[#6b7280]">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-[#d1d5db]" />
              <p className="font-medium">No orders yet</p>
              <p className="text-sm mt-1">Start by placing your first order</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
