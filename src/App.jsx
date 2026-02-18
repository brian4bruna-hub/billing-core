import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import Dashboard from './components/Dashboard';
import ProjectSelector from './components/ProjectSelector';
import TransactionList from './components/TransactionList';
import SubscriptionList from './components/SubscriptionList';
import './App.css';

function App() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProjects(data || []);
      if (data && data.length > 0) {
        setSelectedProject(data[0]);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading billing dashboard...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <h2>No Projects Found</h2>
        <p>Create your first project to get started with billing.</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>Billing Dashboard</h1>
          <ProjectSelector
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
          />
        </div>
      </header>

      <nav className="app-nav">
        <button
          className={`nav-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`nav-button ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          Transactions
        </button>
        <button
          className={`nav-button ${activeTab === 'subscriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('subscriptions')}
        >
          Subscriptions
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'overview' && (
          <Dashboard projectId={selectedProject?.id} />
        )}
        {activeTab === 'transactions' && (
          <TransactionList projectId={selectedProject?.id} />
        )}
        {activeTab === 'subscriptions' && (
          <SubscriptionList projectId={selectedProject?.id} />
        )}
      </main>
    </div>
  );
}

export default App;
