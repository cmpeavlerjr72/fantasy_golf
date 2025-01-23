import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LeagueSelector.css';

const LeagueSelector = () => {
  const [leagueId, setLeagueId] = useState('');
  const [showNewLeagueDialog, setShowNewLeagueDialog] = useState(false);
  const [newLeagueTeams, setNewLeagueTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [newLeagueId, setNewLeagueId] = useState(null);
  const navigate = useNavigate();

  const API_BASE_URL = 'https://golf-server-0fea.onrender.com';

  const handleAccessLeague = async (e) => {
    e.preventDefault();
    if (leagueId.trim()) {
      try {
        const response = await fetch(`${API_BASE_URL}/leagues/${leagueId.trim()}`);
        if (!response.ok) {
          throw new Error('League not found.');
        }
        localStorage.setItem('selectedLeague', leagueId.trim());
        navigate('/home');
      } catch (error) {
        alert(error.message);
      }
    } else {
      alert('Please enter a valid league ID.');
    }
  };

  const handleStartNewLeague = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/leagues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams: [], teamNames: [] }),
      });
      if (!response.ok) {
        throw new Error('Failed to create a new league.');
      }
      const data = await response.json();
      setNewLeagueId(data.leagueId);
      setShowNewLeagueDialog(true);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleAddTeam = () => {
    if (newTeamName.trim() === '') return;
    setNewLeagueTeams([...newLeagueTeams, newTeamName.trim()]);
    setNewTeamName('');
  };

  const handleCompleteNewLeague = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/leagues/${newLeagueId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teams: newLeagueTeams.map(() => []),
          teamNames: newLeagueTeams,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to save the new league.');
      }

      // Save the selected league ID to localStorage
      localStorage.setItem('selectedLeague', newLeagueId);

      // Navigate to the Home page
      setShowNewLeagueDialog(false);
      setNewLeagueTeams([]);
      navigate('/home');
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="league-selector-wrapper">
      <form onSubmit={handleAccessLeague} className="league-selector-form">
        <h3 className="text-center mb-3 text-white">Enter League ID</h3>
        <div className="mb-3">
          <input
            type="text"
            className="form-control"
            placeholder="League ID"
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary w-100 mb-2">
          Access League
        </button>
        <button
          type="button"
          className="btn btn-secondary w-100"
          onClick={handleStartNewLeague}
        >
          Start New League
        </button>
      </form>

      {showNewLeagueDialog && (
        <div className="new-league-dialog">
          <div className="dialog-content">
            <h4>New League ID: {newLeagueId}</h4>
            <div className="mb-3">
              <input
                type="text"
                className="form-control"
                placeholder="Enter Team Name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
              <button
                className="btn btn-success mt-2"
                onClick={handleAddTeam}
              >
                Add Team
              </button>
            </div>
            <ul className="list-group mb-3">
              {newLeagueTeams.map((team, index) => (
                <li key={index} className="list-group-item">
                  {team}
                </li>
              ))}
            </ul>
            <button
              className="btn btn-primary"
              onClick={handleCompleteNewLeague}
            >
              Complete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeagueSelector;
