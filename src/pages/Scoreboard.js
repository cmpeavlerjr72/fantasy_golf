import React, { useState, useEffect } from 'react';
import './Scoreboard.css'; // Import the CSS file for styling

const Scoreboard = () => {
  const [leaderboard, setLeaderboard] = useState([]); // Player data
  const [error, setError] = useState(null); // Error handling
  const [loading, setLoading] = useState(true); // Loading state
  const [teams, setTeams] = useState({}); // Player-to-team mapping
  const [teamColors, setTeamColors] = useState({}); // Team colors
  const [teamNames, setTeamNames] = useState([]); // Team names
  const [leagueId, setLeagueId] = useState(''); // Current league ID
  const [eventName, setEventName] = useState(''); // Event name
  const [fieldData, setFieldData] = useState([]); // Field data for tee times
  const [holesData, setHolesData] = useState(null); // Holes data for round info

  const API_BASE_URL = 'https://golf-server-0fea.onrender.com';

  useEffect(() => {
    const today = new Date();
    const isWednesday = today.getDay() === 3; // 3 = Wednesday

    const normalizeName = (name) => (name ? name.toLowerCase().trim() : '');

    if (isWednesday) {
      // 🟢 Fetch field data for tee times (Wednesdays)
      console.log('Fetching field data for Wednesday...');
      fetch(`${API_BASE_URL}/field`)
        .then((response) => response.json())
        .then((data) => {
          setFieldData(data.field || []);
          setEventName(data.event_name || 'Golf Tournament');
          setLeaderboard([]); // Clear leaderboard so it doesn't persist on Wednesdays
          setLoading(false);
        })
        .catch((error) => {
          console.error('Error fetching field data:', error);
          setError(error.message);
          setLoading(false);
        });
    } else {
      // 🔵 Fetch tournament stats for live leaderboard (Thursday - Sunday)
      console.log('Fetching tournament stats...');
      fetch(`${API_BASE_URL}/live-stats`)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          return response.json();
        })
        .then((data) => {
          console.log('Fetched tournament stats:', data);
          setEventName(data.event_name || 'Golf Tournament');

          if (!data.live_stats || !Array.isArray(data.live_stats)) {
            throw new Error('Invalid data structure: `live_stats` is missing or not an array.');
          }

          const players = data.live_stats.map((player) => ({
            id: player.dg_id,
            name: player.player_name,
            normalizedName: normalizeName(player.player_name),
            position: player.position || '-',
            scoreToPar: player.total || '-',
            thru: player.thru || '-',
          }));

          setLeaderboard(players);
          setFieldData([]); // Clear field data so it doesn't persist after Wednesday
          setLoading(false);
        })
        .catch((error) => {
          setError(error.message);
          setLoading(false);
        });
    }

    // Fetch holes data
    fetch(`${API_BASE_URL}/holes`)
      .then((response) => response.json())
      .then((data) => setHolesData(data))
      .catch((error) => console.error('Error fetching holes data:', error));

    // Fetch league data
    const selectedLeague = localStorage.getItem('selectedLeague');
    if (selectedLeague) {
      setLeagueId(selectedLeague);
      fetch(`${API_BASE_URL}/leagues/${selectedLeague}`)
        .then((response) => response.json())
        .then((data) => {
          console.log('Fetched league data:', data);
          const playerToTeamMap = {};
          data.teams.forEach((team, teamIndex) => {
            team.forEach((player) => {
              const normalizedPlayerName = normalizeName(player.name);
              playerToTeamMap[normalizedPlayerName] = data.teamNames[teamIndex];
            });
          });
          setTeams(playerToTeamMap);

          const uniqueColors = ['#FF9999', '#99CCFF', '#99FF99', '#FFFF99', '#CC99FF', '#FFCC99'];
          const teamColorsMap = {};
          data.teamNames.forEach((teamName, index) => {
            teamColorsMap[teamName] = uniqueColors[index % uniqueColors.length];
          });
          setTeamColors(teamColorsMap);
          setTeamNames(data.teamNames);
        })
        .catch((error) => console.error('Error fetching league data:', error));
    }
  }, []); // 🛑 Removed dependency on `isWednesday` to prevent unnecessary re-renders

  return (
    <div className="container masters-scoreboard">
      <h2 className="leaderboard-title">{eventName} {fieldData.length > 0 ? 'Field List' : 'Leaderboard'}</h2>
      {loading && <div>Loading data...</div>}
      {error && <div className="alert alert-danger">{`Error: ${error}`}</div>}

      {/* 🟢 Display Field Data on Wednesdays */}
      {!loading && fieldData.length > 0 ? (
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Round 1 Tee Time</th>
            </tr>
          </thead>
          <tbody>
            {fieldData.map((player) => (
              <tr key={player.dg_id}>
                <td>{player.player_name}</td>
                <td>{player.r1_teetime || 'TBD'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        // 🔵 Display Live Leaderboard Thursday - Sunday
        !loading && leaderboard.length > 0 ? (
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Player</th>
                <th>Score to Par</th>
                <th>Thru</th>
                <th>Team</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((player) => {
                const teamName = teams[player.normalizedName];
                const rowStyle = { backgroundColor: teamColors[teamName] || 'white' };
                return (
                  <tr key={player.id} style={rowStyle}>
                    <td>{player.position}</td>
                    <td>{player.name}</td>
                    <td>{player.scoreToPar}</td>
                    <td>{player.thru}</td>
                    <td>{teamName || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          !loading && <div>No data available.</div>
        )
      )}
    </div>
  );
};

export default Scoreboard;
