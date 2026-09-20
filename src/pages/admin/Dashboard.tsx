import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  ShoppingBag, 
  Users, 
  Package, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ErrorState } from '../../components/ui/ErrorState';
import { calculateTotalRevenue } from '../../services';
import { fetchAdminVisitorAnalytics } from '../../services/analytics';
import { VisitsChart } from '../../components/admin/VisitsChart';
import type { DailyVisitItem } from '../../types/database';

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
    totalUsers: 0,
    pendingOrders: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Visitor analytics state
  const [currentVisitors, setCurrentVisitors] = useState(0);
  const [dailyVisits, setDailyVisits] = useState<DailyVisitItem[]>([]);
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState(false);
  const activeDaysRef = useRef(analyticsDays);

  activeDaysRef.current = analyticsDays;

  const fetchStats = async () => {
    setLoading(true);
    setError(false);
    try {
      // Fetch Orders count and revenue
      const { data: orders, error: ordersErr } = await supabase.from('orders').select('total, status, payment_method, payment_status');
      if (ordersErr) throw ordersErr;
      
      // Fetch Products count
      const { count: productsCount, error: prodErr } = await supabase.from('products').select('*', { count: 'exact', head: true });
      if (prodErr) throw prodErr;
      
      // Fetch Users count
      const { count: usersCount, error: userErr } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      if (userErr) throw userErr;

      if (orders) {
        const revenue = calculateTotalRevenue(orders);
        const pending = orders.filter(o => o.status === 'pending').length;
        
        setStats({
          totalOrders: orders.length,
          totalRevenue: revenue,
          totalProducts: productsCount || 0,
          totalUsers: usersCount || 0,
          pendingOrders: pending
        });
      }
    } catch (err) {
      console.error('Error fetching admin stats:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = useCallback(async (daysToFetch: number, isInitial = false) => {
    if (isInitial) {
      setAnalyticsLoading(true);
    }
    setAnalyticsError(false);

    try {
      const data = await fetchAdminVisitorAnalytics(daysToFetch);
      setCurrentVisitors(data.current_visitors || 0);
      setDailyVisits(data.daily_visits || []);
    } catch (err) {
      console.error('Error fetching admin visitor analytics:', err);
      setAnalyticsError(true);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const handleDaysChange = (newDays: number) => {
    setAnalyticsDays(newDays);
    loadAnalytics(newDays, true);
  };

  useEffect(() => {
    fetchStats();
    loadAnalytics(7, true);

    // Auto-refresh visitor analytics every 30 seconds while the page is active
    const refreshInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
        loadAnalytics(activeDaysRef.current, false);
      }
    }, 30000);

    return () => {
      clearInterval(refreshInterval);
    };
  }, [loadAnalytics]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <ErrorState onRetry={() => { fetchStats(); loadAnalytics(analyticsDays, true); }} />
      </div>
    );
  }

  const statCards = [
    { 
      label: 'Total Revenue', 
      value: `₹${stats.totalRevenue.toLocaleString()}`, 
      icon: <TrendingUp className="text-green-500" />,
      trend: '+12.5%',
      isPositive: true
    },
    { 
      label: 'Total Orders', 
      value: stats.totalOrders.toString(), 
      icon: <ShoppingBag className="text-blue-500" />,
      trend: '+5.2%',
      isPositive: true
    },
    { 
      label: 'Products', 
      value: stats.totalProducts.toString(), 
      icon: <Package className="text-purple-500" />,
      trend: 'No change',
      isPositive: true
    },
    { 
      label: 'Active Users', 
      value: stats.totalUsers.toString(), 
      icon: <Users className="text-orange-500" />,
      trend: '+2.1%',
      isPositive: true
    },
  ];

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-5xl font-black uppercase tracking-tighter mb-2">Command <span className="text-brand-red">Center</span></h1>
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Real-time overview of the Posterealm ecosystem.</p>
      </header>

      {/* Stats Grid: Current Visitors + Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {/* Live Current Visitors Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="bg-white comic-border p-6 shadow-sm hover:shadow-md transition-shadow relative"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 comic-border border-emerald-100 text-emerald-600">
              <Activity size={20} />
            </div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-[9px] font-black uppercase tracking-widest text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live now
            </div>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Current Visitors</p>
          <p className="text-3xl font-black text-gray-900">
            {analyticsLoading && dailyVisits.length === 0 ? '—' : currentVisitors}
          </p>
        </motion.div>

        {/* Existing Commerce Metric Cards */}
        {statCards.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (idx + 1) * 0.1 }}
            className="bg-white comic-border p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-gray-50 comic-border border-gray-100">
                {stat.icon}
              </div>
              <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${stat.isPositive ? 'text-green-500' : 'text-brand-red'}`}>
                {stat.trend}
                {stat.isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{stat.label}</p>
            <p className="text-3xl font-black">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Visits Per Day Graph Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <VisitsChart
          data={dailyVisits}
          days={analyticsDays}
          onDaysChange={handleDaysChange}
          loading={analyticsLoading}
          error={analyticsError}
          onRetry={() => loadAnalytics(analyticsDays, true)}
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Recent Activity Placeholder */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black uppercase tracking-tight">Recent Activity</h2>
            <button className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-brand-red hover:bg-brand-red/10 rounded-md transition-colors">View All</button>
          </div>
          <div className="bg-white comic-border p-8 text-center border-dashed border-2 border-gray-200">
            <Package size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Activity stream will appear here soon.</p>
          </div>
        </div>

        {/* Notifications / Alerts */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black uppercase tracking-tight">Attention Needed</h2>
          <div className="space-y-4">
            {stats.pendingOrders > 0 ? (
              <div className="bg-orange-50 comic-border border-orange-200 p-6 flex flex-col gap-4">
                <div className="flex gap-4">
                  <AlertCircle className="text-orange-500 shrink-0" size={20} />
                  <div>
                    <p className="font-black uppercase text-xs tracking-tight text-orange-800">Pending Orders</p>
                    <p className="text-xs text-orange-700 mt-1 font-bold">There are {stats.pendingOrders} orders waiting for your attention.</p>
                  </div>
                </div>
                <Link 
                  to="/admin/orders?status=pending"
                  className="w-full py-4 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest text-center comic-border border-white hover:bg-orange-600 transition-all flex items-center justify-center"
                >
                  Take Action
                </Link>
              </div>
            ) : (
              <div className="bg-green-50 comic-border border-green-200 p-4 flex gap-4">
                <AlertCircle className="text-green-500 shrink-0" size={20} />
                <div>
                  <p className="font-black uppercase text-xs tracking-tight">All Caught Up</p>
                  <p className="text-xs text-green-700 mt-1">No pending actions required at this moment.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
