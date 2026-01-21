import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Image, Users, TrendingUp, Calendar, RefreshCw } from 'lucide-react';
import { calculateStats, getLast7DaysChartData } from '../utils/statsCalculations';
import './Stats.css';

function Stats() {
  const [statistics, setStatistics] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all required data in parallel
      const [statsResponse, photosResponse, personsResponse] = await Promise.all([
        fetch('/api/statistics/?days=30'),
        fetch('/api/photos/'),
        fetch('/api/persons/')
      ]);

      if (!statsResponse.ok || !photosResponse.ok || !personsResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const [statsData, photosData, personsData] = await Promise.all([
        statsResponse.json(),
        photosResponse.json(),
        personsResponse.json()
      ]);

      setStatistics(statsData);
      setPhotos(photosData);
      setPersons(personsData);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

  // Calculate statistics
  const stats = useMemo(() => {
    return calculateStats(statistics, photos, persons);
  }, [statistics, photos, persons]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return getLast7DaysChartData(statistics);
  }, [statistics]);

  if (loading) {
    return (
      <div className="stats-container">
        <header className="stats-header">
          <h1>Statistics Dashboard</h1>
        </header>
        <div className="stats-loading">
          <div className="loading-spinner"></div>
          <p>Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stats-container">
        <header className="stats-header">
          <h1>Statistics Dashboard</h1>
        </header>
        <div className="stats-error">
          <p>Error loading statistics: {error}</p>
          <button onClick={fetchAllData} className="btn-primary">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="stats-container">
      <header className="stats-header">
        <h1>Statistics Dashboard</h1>
        <button
          onClick={handleRefresh}
          className={`refresh-button ${refreshing ? 'refreshing' : ''}`}
          disabled={refreshing}
          title="Refresh statistics"
        >
          <RefreshCw size={20} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      {/* Stat Cards Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon stat-icon-primary">
            <Image size={28} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Total Photos</p>
            <h2 className="stat-value">{stats.totalPhotos}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-secondary">
            <Users size={28} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Total Persons</p>
            <h2 className="stat-value">{stats.totalPersons}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-success">
            <Calendar size={28} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Uploaded Today</p>
            <h2 className="stat-value">{stats.photosToday}</h2>
            <p className="stat-detail">{stats.facesToday} faces detected</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-warning">
            <TrendingUp size={28} />
          </div>
          <div className="stat-content">
            <p className="stat-label">This Week</p>
            <h2 className="stat-value">{stats.photosThisWeek}</h2>
            <p className="stat-detail">{stats.facesThisWeek} faces detected</p>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="chart-section">
        <h3 className="chart-title">Daily Uploads (Last 7 Days)</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis
                dataKey="dateFormatted"
                stroke="var(--text-secondary)"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="var(--text-secondary)"
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: `1px solid var(--border-color)`,
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)'
                }}
                labelStyle={{ color: 'var(--text-primary)', fontWeight: 'bold' }}
                itemStyle={{ color: 'var(--text-secondary)' }}
              />
              <Bar dataKey="photos" fill="var(--accent-primary)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {chartData.length === 0 && (
          <div className="chart-empty">
            <p>No upload data available for the last 7 days</p>
          </div>
        )}
      </div>

      {/* Recent Daily Stats Table */}
      {statistics.length > 0 && (
        <div className="stats-table-section">
          <h3 className="table-title">Recent Daily Statistics</h3>
          <div className="stats-table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Photos Uploaded</th>
                  <th>Faces Detected</th>
                </tr>
              </thead>
              <tbody>
                {statistics.slice(0, 10).map((stat) => (
                  <tr key={stat.id}>
                    <td>{new Date(stat.date).toLocaleDateString()}</td>
                    <td>{stat.photos_uploaded}</td>
                    <td>{stat.faces_detected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Stats;
