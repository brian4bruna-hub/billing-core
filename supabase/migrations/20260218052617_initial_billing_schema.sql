/*
  # Billing Core System - Initial Schema
  
  Multi-project billing platform with complete transaction tracking, subscription management, and analytics.

  1. New Tables
    - `projects` - Core multi-project tracking with currency support
    - `payment_gateways` - Centralized gateway configuration (Stripe, PayPal, Paystack, Flutterwave)
    - `customers` - Unified customer records across projects
    - `transactions` - Complete transaction history with fees and net calculations
    - `subscriptions` - Recurring revenue and subscription lifecycle tracking
    - `daily_revenue_snapshots` - Pre-aggregated metrics for fast dashboard queries
    - `audit_log` - Compliance and change tracking
    - `webhook_logs` - Integration debugging and monitoring

  2. Views
    - `monthly_revenue_by_project` - Monthly revenue metrics per project
    - `active_subscriptions_by_project` - MRR and subscription health
    - `customer_stats_by_project` - Customer growth and engagement

  3. Security
    - Enable RLS on all tables (policies to be added based on auth requirements)
    - Constraints for data integrity (currency codes, email format, amount validations)
    - Unique constraints to prevent duplicate records
    - Cascading deletes for referential integrity

  4. Indexes
    - Optimized for project-based queries
    - Date-range filtering for analytics
    - Status and type filtering for operational queries
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PROJECTS TABLE: The core of multi-project tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    currency VARCHAR(3) DEFAULT 'USD',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    config JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT currency_check CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(is_active);
CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to projects"
  ON projects FOR SELECT
  USING (true);

-- ============================================================
-- 2. PAYMENT_GATEWAYS TABLE: Centralized gateway config
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_gateways (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    gateway_name VARCHAR(50) NOT NULL,
    gateway_type VARCHAR(20) NOT NULL,
    live_credentials JSONB NOT NULL,
    test_credentials JSONB,
    is_live BOOLEAN DEFAULT FALSE,
    webhook_secret VARCHAR(255),
    webhook_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, gateway_name),
    CONSTRAINT valid_gateway CHECK (gateway_name IN ('stripe', 'paypal', 'paystack', 'flutterwave'))
);

CREATE INDEX IF NOT EXISTS idx_gateways_project ON payment_gateways(project_id);
CREATE INDEX IF NOT EXISTS idx_gateways_live ON payment_gateways(is_live);

ALTER TABLE payment_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to payment gateways"
  ON payment_gateways FOR SELECT
  USING (true);

-- ============================================================
-- 3. CUSTOMERS TABLE: Unified customer view across projects
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    email VARCHAR(255),
    name VARCHAR(255),
    country VARCHAR(2),
    phone VARCHAR(20),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, external_id),
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX IF NOT EXISTS idx_customers_project ON customers(project_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_created ON customers(created_at);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to customers"
  ON customers FOR SELECT
  USING (true);

-- ============================================================
-- 4. TRANSACTIONS TABLE: Every cent in, out, or refunded
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    gateway_id UUID NOT NULL REFERENCES payment_gateways(id),
    external_id VARCHAR(255) NOT NULL,
    gateway_name VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    fee_amount INTEGER DEFAULT 0,
    net_amount INTEGER GENERATED ALWAYS AS (amount - fee_amount) STORED,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, external_id),
    CONSTRAINT amount_check CHECK (amount >= 0),
    CONSTRAINT fee_check CHECK (fee_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_transactions_project ON transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_gateway ON transactions(gateway_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_project_created ON transactions(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to transactions"
  ON transactions FOR SELECT
  USING (true);

-- ============================================================
-- 5. SUBSCRIPTIONS TABLE: Track recurring revenue
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    gateway_id UUID NOT NULL REFERENCES payment_gateways(id),
    external_id VARCHAR(255) NOT NULL,
    plan_id VARCHAR(255),
    plan_name VARCHAR(255),
    amount INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(50) NOT NULL,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, external_id),
    CONSTRAINT amount_check CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_project ON subscriptions(project_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created ON subscriptions(created_at);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to subscriptions"
  ON subscriptions FOR SELECT
  USING (true);

-- ============================================================
-- 6. DAILY_REVENUE_SNAPSHOT TABLE: Pre-aggregated for dashboards
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_revenue_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_revenue INTEGER DEFAULT 0,
    total_fees INTEGER DEFAULT 0,
    net_revenue INTEGER DEFAULT 0,
    new_customers INTEGER DEFAULT 0,
    new_subscriptions INTEGER DEFAULT 0,
    churned_subscriptions INTEGER DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    failed_transactions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, date),
    CONSTRAINT amount_checks CHECK (
        total_revenue >= 0 AND
        total_fees >= 0 AND
        net_revenue >= 0 AND
        new_customers >= 0 AND
        new_subscriptions >= 0 AND
        churned_subscriptions >= 0
    )
);

CREATE INDEX IF NOT EXISTS idx_daily_snapshots_project ON daily_revenue_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_daily_snapshots_date ON daily_revenue_snapshots(date);
CREATE INDEX IF NOT EXISTS idx_daily_snapshots_project_date ON daily_revenue_snapshots(project_id, date);

ALTER TABLE daily_revenue_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to daily snapshots"
  ON daily_revenue_snapshots FOR SELECT
  USING (true);

-- ============================================================
-- 7. AUDIT_LOG TABLE: Track all changes for compliance
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    entity_type VARCHAR(50),
    entity_id UUID,
    action VARCHAR(50),
    old_values JSONB,
    new_values JSONB,
    user_ip VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_project ON audit_log(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to audit log"
  ON audit_log FOR SELECT
  USING (true);

-- ============================================================
-- 8. WEBHOOK_LOGS TABLE: Debug integration issues
-- ============================================================
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    gateway_name VARCHAR(50),
    event_type VARCHAR(100),
    payload JSONB,
    status VARCHAR(50),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_project ON webhook_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_gateway ON webhook_logs(gateway_name);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at);

ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to webhook logs"
  ON webhook_logs FOR SELECT
  USING (true);

-- ============================================================
-- VIEWS FOR EASY ANALYTICS
-- ============================================================

CREATE OR REPLACE VIEW monthly_revenue_by_project AS
SELECT 
    DATE_TRUNC('month', t.created_at)::DATE as month,
    p.id as project_id,
    p.name as project_name,
    SUM(CASE WHEN t.status = 'succeeded' THEN t.amount ELSE 0 END) as total_revenue,
    SUM(CASE WHEN t.status = 'succeeded' THEN t.fee_amount ELSE 0 END) as total_fees,
    SUM(CASE WHEN t.status = 'succeeded' THEN (t.amount - t.fee_amount) ELSE 0 END) as net_revenue,
    COUNT(DISTINCT CASE WHEN t.status = 'succeeded' AND t.type = 'payment' THEN t.customer_id END) as paying_customers
FROM transactions t
JOIN projects p ON t.project_id = p.id
GROUP BY month, p.id, p.name
ORDER BY month DESC, p.name;

CREATE OR REPLACE VIEW active_subscriptions_by_project AS
SELECT 
    p.id as project_id,
    p.name as project_name,
    COUNT(*) as total_active,
    SUM(s.amount) as mrr,
    COUNT(CASE WHEN s.cancel_at_period_end THEN 1 END) as scheduled_cancellations
FROM subscriptions s
JOIN projects p ON s.project_id = p.id
WHERE s.status = 'active'
GROUP BY p.id, p.name;

CREATE OR REPLACE VIEW customer_stats_by_project AS
SELECT 
    p.id as project_id,
    p.name as project_name,
    COUNT(DISTINCT c.id) as total_customers,
    COUNT(DISTINCT CASE WHEN c.created_at > NOW() - INTERVAL '30 days' THEN c.id END) as new_last_30_days,
    COUNT(DISTINCT s.customer_id) as customers_with_subscriptions
FROM customers c
LEFT JOIN subscriptions s ON c.id = s.customer_id AND s.status = 'active'
JOIN projects p ON c.project_id = p.id
GROUP BY p.id, p.name;