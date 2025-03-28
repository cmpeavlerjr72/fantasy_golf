import React, { useState, useEffect } from 'react';
import './Home.css'; // Import the CSS file for styling
import ANCGImage from '../images/ANCG.jpg'; // Import the background image

const Home = () => {
  const [teams, setTeams] = useState([]);
  const [teamNames, setTeamNames] = useState([]);
  const [leagueId, setLeagueId] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null); // Track the expanded team
  const [selectedPlayer, setSelectedPlayer] = useState(null); // Track the selected player for scorecard
  const [lastUpdateTime, setLastUpdateTime] = useState(null); // Track the last update time
  const [isUpdating, setIsUpdating] = useState(false); // Track the update status

  const API_BASE_URL = 'https://golf-server-0fea.onrender.com';

  // Helper function to normalize names for consistent comparison
  const normalizeName = (name) => name?.toLowerCase().trim();

  useEffect(() => {
    const selectedLeague = localStorage.getItem('selectedLeague');
    if (selectedLeague) {
      setLeagueId(selectedLeague);

      // Fetch league data
      fetch(`${API_BASE_URL}/leagues/${selectedLeague}`)
        .then((response) => response.json())
        .then((data) => {
          setTeams(data.teams);
          setTeamNames(data.teamNames);
        })
        .catch((error) => console.error('Error fetching league data:', error));

      // Fetch live tournament stats
      fetch(`${API_BASE_URL}/live-stats`)
        .then((response) => response.json())
        .then((data) => {
          if (data.live_stats && Array.isArray(data.live_stats)) {
            const normalizedLeaderboard = data.live_stats.map((player) => ({
              name: normalizeName(player.player_name),
              scoreToPar: parseFloat(player.total) || 0,
              thru: player.thru || 'N/A', // Include the "thru" value
            }));
            setLeaderboard(normalizedLeaderboard);
          }
        })
        .catch((error) => console.error('Error fetching live tournament stats:', error));
    }

    // Fetch the last update time
    fetch(`${API_BASE_URL}/last-update`)
      .then((response) => response.json())
      .then((data) => setLastUpdateTime(data.lastUpdate))
      .catch((error) => console.error('Error fetching last update time:', error));
  }, []);

  // Fetch scorecard data when a player is selected
  const fetchScorecardData = (playerName) => {
    fetch(`${API_BASE_URL}/holes`)
      .then((response) => response.json())
      .then((data) => {
        const playerData = data.players.find(
          (player) => normalizeName(player.player_name) === normalizeName(playerName)
        );
        setSelectedPlayer({ ...playerData, name: playerName } || null);
      })
      .catch((error) => console.error('Error fetching scorecard data:', error));
  };

  // Calculate the total score for each team using the 4 best scores
  const calculateTeamScores = () => {
    return teamNames.map((teamName, index) => {
      const team = teams[index];
      const playersWithScores = team
        .map((player) => {
          const playerStats = leaderboard.find(
            (entry) => normalizeName(entry.name) === normalizeName(player.name)
          );
          return {
            ...player,
            scoreToPar: playerStats ? playerStats.scoreToPar : null,
            thru: playerStats ? playerStats.thru : 'N/A', // Include "thru" for each player
          };
        })
        .filter((player) => player.scoreToPar !== null) // Exclude players without scores
        .sort((a, b) => a.scoreToPar - b.scoreToPar); // Sort by score (best to worst)

      // Take the top 4 lowest scores (or fewer if the team has fewer than 4 players)
      const topFourScores = playersWithScores
        .slice(0, 4) // Take the first 4 after sorting (lowest scores)
        .reduce((total, player) => total + player.scoreToPar, 0); // Sum the scores

      return {
        teamName,
        score: topFourScores,
        players: playersWithScores,
      };
    });
  };

  // Handle team row click to expand/collapse
  const handleTeamClick = (teamIndex) => {
    setSelectedTeam(selectedTeam === teamIndex ? null : teamIndex);
    setSelectedPlayer(null); // Reset selected player when team changes
  };

  // Handle player click to fetch scorecard data
  const handlePlayerClick = (playerName) => {
    if (selectedPlayer && selectedPlayer.name === playerName) {
      setSelectedPlayer(null); // Collapse if the same player is clicked again
    } else {
      fetchScorecardData(playerName);
    }
  };

  // Handle updating data via the backend
  const handleUpdateData = () => {
    setIsUpdating(true);
    fetch(`${API_BASE_URL}/update-data`, { method: 'POST' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to update data');
        }
        return response.json();
      })
      .then((data) => {
        setLastUpdateTime(data.lastUpdateTime);
        alert('Data updated successfully!');
        // Refresh leaderboard data after update
        fetch(`${API_BASE_URL}/live-stats`)
          .then((response) => response.json())
          .then((data) => {
            if (data.live_stats && Array.isArray(data.live_stats)) {
              const normalizedLeaderboard = data.live_stats.map((player) => ({
                name: normalizeName(player.player_name),
                scoreToPar: parseFloat(player.total) || 0,
                thru: player.thru || 'N/A', // Include the "thru" value
              }));
              setLeaderboard(normalizedLeaderboard);
            }
          })
          .catch((error) => console.error('Error fetching live tournament stats:', error));
      })
      .catch((error) => alert(error.message))
      .finally(() => setIsUpdating(false));
  };

  // Get styles for scores based on comparison with par
  const getScoreStyle = (score, par) => {
    const styles = {
      display: 'inline-block',
      width: '24px',
      height: '24px',
      lineHeight: '24px',
      textAlign: 'center',
      fontWeight: 'bold',
      borderRadius: '0',
    };

    if (score < par) {
      styles.color = 'red';
      if (score === par - 1) {
        styles.border = '2px solid black';
        styles.borderRadius= '50%';
      } else if (score < par - 1) {
        styles.backgroundColor = 'white';
        styles.borderRadius= '50%';
      }
    } else if (score > par) {
      styles.color = 'green';
      if (score === par + 1) {
        styles.border = '2px solid black';
        styles.borderRadius= '0';
      } else if (score > par + 1) {
        styles.backgroundColor = 'white';
        styles.borderRadius= '0';
      }
    } else if (score === par) {
      styles.color = 'green';
    }

    return styles;
  };

  const sortedScores = calculateTeamScores().sort((a, b) => a.score - b.score);

  return (
    <div
      style={{
        backgroundImage: `url(${ANCGImage})`,
        backgroundSize: 'cover',
        backgroundAttachment: 'fixed',
        backgroundPosition: 'center',
        minHeight: '100vh', // Ensure the background covers the full height
      }}
    >
      <div className="container">
        {/* Navigation Bar */}
        <nav className="navbar navbar-expand-lg navbar-light">
          <div className="container-fluid">
            <a className="navbar-brand" href="/">League 40</a>
            <div className="navbar-nav">
              <a className="nav-link" href="/">Home</a>
              <a className="nav-link" href="/draft">Draft</a>
              <a className="nav-link" href="/stats">Stats</a>
            </div>
          </div>
        </nav>

        <h2>Welcome to League {leagueId}</h2>

        {/* Update Data Button */}
        <div className="text-center mb-4">
          <button
            className="btn btn-primary update-btn"
            onClick={handleUpdateData}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Updating...
              </>
            ) : (
              'Update Data'
            )}
          </button>
          {lastUpdateTime && (
            <p className="mt-2">
              Last updated: <strong>{new Date(lastUpdateTime).toLocaleString()}</strong>
            </p>
          )}
        </div>

        {/* Leaderboard */}
        <h4 className="mt-4">Team Leaderboard</h4>
        <table className="table table-striped table-bordered leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team Name</th>
              <th>Total Score</th>
            </tr>
          </thead>
          <tbody>
            {sortedScores.map((team, index) => (
              <React.Fragment key={index}>
                <tr
                  onClick={() => handleTeamClick(index)}
                  className={selectedTeam === index ? 'table-active' : ''}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{index + 1}</td>
                  <td>{team.teamName}</td>
                  <td className={team.score < 0 ? 'text-danger' : team.score > 0 ? 'text-success' : ''}>
                    {team.score}
                  </td>
                </tr>
                {selectedTeam === index && (
                  <tr>
                    <td colSpan="3" className="expanded-team">
                      <ul className="list-group">
                        {team.players.map((player, playerIndex) => (
                          <li
                            key={playerIndex}
                            className="list-group-item player-item"
                            onClick={() => handlePlayerClick(player.name)}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="d-flex justify-content-between align-items-center">
                              <span>{player.name}</span>
                              <div className="d-flex align-items-center">
                                <span className={player.scoreToPar < 0 ? 'text-danger' : player.scoreToPar > 0 ? 'text-success' : ''}>
                                  {player.scoreToPar}
                                </span>
                                <span className="ms-3 text-muted">
                                  Thru: {player.thru}
                                </span>
                              </div>
                            </div>
                            {selectedPlayer && selectedPlayer.name === player.name && (
                              <div className="mt-2 scorecard-container">
                                <h5>Scorecard for {selectedPlayer.player_name}</h5>
                                <table className="table table-bordered table-striped scorecard">
                                  <thead>
                                    <tr>
                                      <th>Round</th>
                                      {Array.from({ length: 18 }, (_, i) => (
                                        <th key={i + 1}>Hole {i + 1}</th>
                                      ))}
                                      <th>OUT</th>
                                      <th>IN</th>
                                      <th>Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(selectedPlayer.rounds || []).map((round, roundIndex) => {
                                      const outScore = round.scores
                                        .slice(0, 9)
                                        .reduce((sum, hole) => sum + hole.score, 0);
                                      const inScore = round.scores
                                        .slice(9)
                                        .reduce((sum, hole) => sum + hole.score, 0);
                                      const totalScore = outScore + inScore;

                                      return (
                                        <tr key={roundIndex}>
                                          <td>Round {round.round_num}</td>
                                          {round.scores.map((hole, holeIndex) => (
                                            <td key={`hole-${holeIndex}`}>
                                              <span style={getScoreStyle(hole.score, hole.par)}>
                                                {hole.score}
                                              </span>
                                            </td>
                                          ))}
                                          <td>{outScore}</td>
                                          <td>{inScore}</td>
                                          <td>{totalScore}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Home;