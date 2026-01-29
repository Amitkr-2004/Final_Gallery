/**
 * Filter Panel Component
 * Filters and sorting controls for gallery
 */

import React, { useState, useEffect } from 'react';
import Card from './Card';
import Button from './Button';
import './FilterPanel.css';

const { electronAPI } = window;

function FilterPanel({ filters, sortBy, onFilterChange, onSortChange }) {
  const [persons, setPersons] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadPersons();
  }, []);

  const loadPersons = async () => {
    try {
      const personsData = await electronAPI.processing.getPersons();
      setPersons(personsData);
    } catch (error) {
      console.error('Failed to load persons:', error);
    }
  };

  const handleFacesFilterChange = (value) => {
    onFilterChange({
      ...filters,
      hasFaces: value === 'all' ? null : value === 'with-faces'
    });
  };

  const handlePersonChange = (personId) => {
    onFilterChange({
      ...filters,
      personId: personId === 'all' ? null : parseInt(personId)
    });
  };

  const handleClearFilters = () => {
    onFilterChange({
      eventId: null,
      personId: null,
      hasFaces: null,
      dateFrom: null,
      dateTo: null
    });
  };

  const hasActiveFilters = filters.eventId || filters.personId || filters.hasFaces !== null;

  return (
    <Card className="filter-panel" padding="md">
      <div className="filter-header">
        <div className="filter-title">
          <h4>Filters & Sort</h4>
          {hasActiveFilters && (
            <Button
              variant="text"
              size="sm"
              onClick={handleClearFilters}
            >
              Clear All
            </Button>
          )}
        </div>
        <button
          className="expand-button"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="filter-content">
          {/* Sort By */}
          <div className="filter-group">
            <label className="filter-label">Sort By</label>
            <select
              className="filter-select"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
            >
              <option value="date-desc">Date (Newest First)</option>
              <option value="date-asc">Date (Oldest First)</option>
              <option value="faces-desc">Most Faces</option>
              <option value="faces-asc">Least Faces</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
            </select>
          </div>

          {/* Faces Filter */}
          <div className="filter-group">
            <label className="filter-label">Faces</label>
            <select
              className="filter-select"
              value={
                filters.hasFaces === null
                  ? 'all'
                  : filters.hasFaces
                  ? 'with-faces'
                  : 'no-faces'
              }
              onChange={(e) => handleFacesFilterChange(e.target.value)}
            >
              <option value="all">All Images</option>
              <option value="with-faces">With Faces</option>
              <option value="no-faces">No Faces</option>
            </select>
          </div>

          {/* Person Filter */}
          {persons.length > 0 && (
            <div className="filter-group">
              <label className="filter-label">Person</label>
              <select
                className="filter-select"
                value={filters.personId || 'all'}
                onChange={(e) => handlePersonChange(e.target.value)}
              >
                <option value="all">All Persons</option>
                {persons.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} ({person.face_count})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default FilterPanel;
