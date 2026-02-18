import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import './SubscriptionList.css';

function SubscriptionList({ projectId }) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (projectId) {
      fetchSubscriptions();
    }
  }, [projectId, filter]);

  async function fetchSubscriptions() {
    setLoading(true);
    try {
      let query = supabase
        .from('subscriptions')
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
      setSubscriptions(data || []);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
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
    <div className="subscription-list">
      <div className="list-header">
        <h2>All Subscriptions</h2>
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button
            className={`filter-btn ${filter === 'past_due' ? 'active' : ''}`}
            onClick={() => setFilter('past_due')}
          >
            Past Due
          </button>
          <button
            className={`filter-btn ${filter === 'canceled' ? 'active' : ''}`}
            onClick={() => setFilter('canceled')}
          >
            Canceled
          </button>
        </div>
      </div>

      <div className="list-content">
        {subscriptions.length === 0 ? (
          <div className="empty-state-card">
            <p>No subscriptions found</p>
          </div>
        ) : (
          <div className="subscription-cards">
            {subscriptions.map((subscription) => (
              <div key={subscription.id} className="subscription-card">
                <div className="subscription-header">
                  <div className="subscription-customer">
                    <div className="customer-name-large">
                      {subscription.customers?.name || 'Unknown'}
                    </div>
                    <div className="customer-email-small">
                      {subscription.customers?.email}
                    </div>
                  </div>
                  <span className={`subscription-status status-${subscription.status}`}>
                    {subscription.status}
                  </span>
                </div>

                <div className="subscription-body">
                  <div className="subscription-plan">
                    <div className="plan-name">{subscription.plan_name}</div>
                    <div className="plan-amount">
                      ${(subscription.amount / 100).toFixed(2)}/mo
                    </div>
                  </div>

                  <div className="subscription-dates">
                    <div className="date-item">
                      <span className="date-label">Current Period</span>
                      <span className="date-value">
                        {subscription.current_period_start &&
                          new Date(subscription.current_period_start).toLocaleDateString()}
                        {' - '}
                        {subscription.current_period_end &&
                          new Date(subscription.current_period_end).toLocaleDateString()}
                      </span>
                    </div>

                    {subscription.cancel_at_period_end && (
                      <div className="cancellation-notice">
                        Cancels at period end
                      </div>
                    )}
                  </div>

                  <div className="subscription-footer">
                    <div className="created-date">
                      Created: {new Date(subscription.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SubscriptionList;
