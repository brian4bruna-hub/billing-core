import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import './TransactionList.css';

function TransactionList({ projectId }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (projectId) {
      fetchTransactions();
    }
  }, [projectId, filter]);

  async function fetchTransactions() {
    setLoading(true);
    try {
      let query = supabase
        .from('transactions')
        .select(`
          *,
          customers (name, email)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="list-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="transaction-list">
      <div className="list-header">
        <h2>All Transactions</h2>
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === 'succeeded' ? 'active' : ''}`}
            onClick={() => setFilter('succeeded')}
          >
            Succeeded
          </button>
          <button
            className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pending
          </button>
          <button
            className={`filter-btn ${filter === 'failed' ? 'active' : ''}`}
            onClick={() => setFilter('failed')}
          >
            Failed
          </button>
        </div>
      </div>

      <div className="list-content">
        {transactions.length === 0 ? (
          <div className="empty-state-card">
            <p>No transactions found</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Fee</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      {new Date(transaction.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                    <td>
                      <div className="customer-cell">
                        <div className="customer-name">
                          {transaction.customers?.name || 'Unknown'}
                        </div>
                        <div className="customer-email">
                          {transaction.customers?.email}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="type-badge">
                        {transaction.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge status-${transaction.status}`}>
                        {transaction.status}
                      </span>
                    </td>
                    <td className="amount-cell">
                      ${(transaction.amount / 100).toFixed(2)}
                    </td>
                    <td className="fee-cell">
                      ${(transaction.fee_amount / 100).toFixed(2)}
                    </td>
                    <td className="net-cell">
                      ${(transaction.net_amount / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default TransactionList;
