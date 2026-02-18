import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

function Dashboard({ projectId }) {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalFees: 0,
    netRevenue: 0,
    totalTransactions: 0,
    totalCustomers: 0,
    activeSubscriptions: 0,
    mrr: 0
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      fetchDashboardData();
    }
  }, [projectId]);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchRecentTransactions(),
        fetchChartData()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, fee_amount, status')
      .eq('project_id', projectId);

    const { data: customers } = await supabase
      .from('customers')
      .select('id')
      .eq('project_id', projectId);

    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('amount, status')
      .eq('project_id', projectId)
      .eq('status', 'active');

    const succeededTransactions = transactions?.filter(t => t.status === 'succeeded') || [];
    const totalRevenue = succeededTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalFees = succeededTransactions.reduce((sum, t) => sum + t.fee_amount, 0);
    const mrr = subscriptions?.reduce((sum, s) => sum + s.amount, 0) || 0;

    setStats({
      totalRevenue,
      totalFees,
      netRevenue: totalRevenue - totalFees,
      totalTransactions: transactions?.length || 0,
      totalCustomers: customers?.length || 0,
      activeSubscriptions: subscriptions?.length || 0,
      mrr
    });
  }

  async function fetchRecentTransactions() {
    const { data } = await supabase
      .from('transactions')
      .select(`
        *,
        customers (name, email)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(5);

    setRecentTransactions(data || []);
  }

  async function fetchChartData() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data } = await supabase
      .from('transactions')
      .select('created_at, amount, status')
      .eq('project_id', projectId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    const groupedByDay = {};
    data?.forEach(transaction => {
      const date = new Date(transaction.created_at).toLocaleDateString();
      if (!groupedByDay[date]) {
        groupedByDay[date] = { date, revenue: 0 };
      }
      if (transaction.status === 'succeeded') {
        groupedByDay[date].revenue += transaction.amount / 100;
      }
    });

    setChartData(Object.values(groupedByDay).slice(-14));
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Revenue</div>
          <div className="stat-value">${(stats.totalRevenue / 100).toFixed(2)}</div>
          <div className="stat-change positive">Gross earnings</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Net Revenue</div>
          <div className="stat-value">${(stats.netRevenue / 100).toFixed(2)}</div>
          <div className="stat-change">After fees</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">MRR</div>
          <div className="stat-value">${(stats.mrr / 100).toFixed(2)}</div>
          <div className="stat-change positive">{stats.activeSubscriptions} active</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Transactions</div>
          <div className="stat-value">{stats.totalTransactions}</div>
          <div className="stat-change">{stats.totalCustomers} customers</div>
        </div>
      </div>

      <div className="charts-section">
        <div className="chart-card">
          <h3>Revenue Trend (Last 14 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#718096" />
              <YAxis stroke="#718096" />
              <Tooltip
                contentStyle={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#667eea"
                strokeWidth={2}
                dot={{ fill: '#667eea', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="recent-transactions">
        <h3>Recent Transactions</h3>
        <div className="transactions-list">
          {recentTransactions.length === 0 ? (
            <div className="empty-message">No transactions yet</div>
          ) : (
            recentTransactions.map((transaction) => (
              <div key={transaction.id} className="transaction-item">
                <div className="transaction-info">
                  <div className="transaction-customer">
                    {transaction.customers?.name || transaction.customers?.email || 'Unknown'}
                  </div>
                  <div className="transaction-type">{transaction.type}</div>
                </div>
                <div className="transaction-details">
                  <div className={`transaction-status status-${transaction.status}`}>
                    {transaction.status}
                  </div>
                  <div className="transaction-amount">
                    ${(transaction.amount / 100).toFixed(2)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
