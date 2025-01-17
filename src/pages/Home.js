import React, { useState, useEffect } from 'react';
import './Home.css'; // Import the CSS file for styling

const Home = () => {
  const [teams, setTeams] = useState([]);
  const [teamNames, setTeamNames] = useState([]);
  const [leagueId, setLeagueId] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Helper function to normalize names for consistent comparison
  const normalizeName = (name) => name?.toLowerCase().trim();

  useEffect(() => {
    const selectedLeague = localStorage.getItem('selectedLeague');
    if (selectedLeague) {
      setLeagueId(selectedLeague);

      // Fetch league data
      fetch(`http://localhost:5000/leagues/${selectedLeague}`)
        .then((response) => response.json())
        .then((data) => {
          setTeams(data.teams);
          setTeamNames(data.teamNames);
        })
        .catch((error) => console.error('Error fetching league data:', error));

      // Fetch live tournament stats
      fetch('http://localhost:5000/tournament-stats')
        .then((response) => response.json())
        .then((data) => {
          if (data.live_stats && Array.isArray(data.live_stats)) {
            const normalizedLeaderboard = data.live_stats.map((player) => ({
              name: normalizeName(player.player_name),
              scoreToPar: parseFloat(player.total) || 0, // Use `total` as score-to-par
            }));
            setLeaderboard(normalizedLeaderboard);
          }
        })
        .catch((error) => console.error('Error fetching live tournament stats:', error));
    }
  }, []);

  // Calculate the total score for each team
  const calculateTeamScores = () => {
    return teamNames.map((teamName, index) => {
      const team = teams[index];
      const teamScore = team
        .map((player) => {
          const name = leaderboard.find(
            (entry) => normalizeName(entry.name) === normalizeName(player.name)
          );
          return name ? name.scoreToPar : null;
        })
        .filter((score) => score !== null) // Exclude players without scores
        .reduce((total, score) => total + score, 0); // Sum the scores
      return { teamName, score: teamScore };
    });
  };

  // Handle team card click
  const handleCardClick = (teamIndex) => {
    setSelectedTeam(selectedTeam === teamIndex ? null : teamIndex);
  };

  const sortedScores = calculateTeamScores().sort((a, b) => a.score - b.score);

  return (
    <div className="container">
      <h2>Welcome to League {leagueId}</h2>

      {/* Leaderboard */}
      <h4 className="mt-4">Team Leaderboard</h4>
      <table className="table table-striped table-bordered">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team Name</th>
            <th>Total Score</th>
          </tr>
        </thead>
        <tbody>
          {sortedScores.map((team, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>{team.teamName}</td>
              <td>{team.score}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Team Cards */}
      <h4 className="mt-4">Teams</h4>
      <div className="row">
        {teams.map((team, index) => (
          <div className="col-md-4 mb-4" key={index}>
            <div
              className={`card ${selectedTeam === index ? 'bg-light' : ''}`}
              onClick={() => handleCardClick(index)}
              style={{ cursor: 'pointer' }}
            >
              <div className="card-body">
                <h5 className="card-title">{teamNames[index]}</h5>
                <p className="card-text">Click to view golfers</p>
              </div>
            </div>
            {selectedTeam === index && (
              <div className="mt-2">
                <ul className="list-group">
                  {team.map((player, playerIndex) => {
                    const name = leaderboard.find(
                      (entry) => normalizeName(entry.name) === normalizeName(player.name)
                    );
                    if (!name) {
                      console.warn(`No match found for player: ${player.golfer}`);
                    }
                    return (
                      <li key={playerIndex} className="list-group-item">
                        {player.name} - Score: {name ? name.scoreToPar : 'N/A'}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;









