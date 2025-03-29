import React, { useState, useEffect } from 'react';
import './Home.css'; // Import the CSS file for styling

const Home = () => {
  const [teams, setTeams] = useState([]);
  const [teamNames, setTeamNames] = useState([]);
  const [leagueId, setLeagueId] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [predictions, setPredictions] = useState([]); // New state for predictions data
  const [selectedTeam, setSelectedTeam] = useState(null); // Track the expanded team
  const [selectedPlayer, setSelectedPlayer] = useState(null); // Track the selected player for scorecard
  const [lastUpdateTime, setLastUpdateTime] = useState(null); // Track the last update time
  const [isUpdating, setIsUpdating] = useState(false); // Track the update status

  const API_BASE_URL = 'https://golf-server-0fea.onrender.com';

  // Helper function to normalize names for consistent comparison
  const normalizeName = (name) => name?.toLowerCase().trim();

  // Helper function to get background color based on the ratio of the value to the maximum
  const getBackgroundColor = (value, maxValue) => {
    if (!value || !maxValue) return 'transparent'; // No color if value or max is not available
    // Calculate the ratio (0 to 1) of the value to the maximum
    const ratio = value / maxValue;
    // Interpolate between light green (ratio 0) and dark green (ratio 1)
    const rStart = 240, gStart = 255, bStart = 240; // Light green: rgb(240, 255, 240)
    const rEnd = 34, gEnd = 139, bEnd = 34; // Dark green: rgb(34, 139, 34)
    const r = Math.round(rStart + (rEnd - rStart) * ratio);
    const g = Math.round(gStart + (gEnd - gStart) * ratio);
    const b = Math.round(bStart + (bEnd - bStart) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  };

  useEffect(() => {
    // Log to confirm useEffect is running
    console.log('useEffect running...');

    const selectedLeague = localStorage.getItem('selectedLeague');
    console.log('Selected League from localStorage:', selectedLeague);
    if (selectedLeague) {
      setLeagueId(selectedLeague);

      // Fetch league data
      console.log('Fetching league data from:', `${API_BASE_URL}/leagues/${selectedLeague}`);
      fetch(`${API_BASE_URL}/leagues/${selectedLeague}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to fetch league data: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          setTeams(data.teams);
          setTeamNames(data.teamNames);
        })
        .catch((error) => {
          console.error('Error fetching league data:', error.message);
          alert(`Error fetching league data: ${error.message}`);
        });

      // Fetch live tournament stats
      console.log('Fetching live stats from:', `${API_BASE_URL}/live-stats`);
      fetch(`${API_BASE_URL}/live-stats`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to fetch live stats: ${response.status}`);
          }
          return response.json();
        })
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
        .catch((error) => {
          console.error('Error fetching live tournament stats:', error.message);
          alert(`Error fetching live stats: ${error.message}`);
        });

      // Fetch predictions data
      console.log('Fetching predictions data from:', `${API_BASE_URL}/preds`);
      fetch(`${API_BASE_URL}/preds`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to fetch predictions: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          console.log('Predictions data received:', data);
          if (data.data && Array.isArray(data.data)) {
            const normalizedPredictions = data.data.map((player) => ({
              name: normalizeName(player.player_name),
              win: player.win,
              top_5: player.top_5,
              top_10: player.top_10,
              top_20: player.top_20,
            }));
            setPredictions(normalizedPredictions);
          } else {
            console.error('Predictions data is not in the expected format:', data);
          }
        })
        .catch((error) => {
          console.error('Error fetching predictions data:', error.message);
          alert(`Error fetching predictions: ${error.message}`);
        });

      // Fetch the last update time
      console.log('Fetching last update time from:', `${API_BASE_URL}/last-update`);
      fetch(`${API_BASE_URL}/last-update`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to fetch last update time: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => setLastUpdateTime(data.lastUpdate))
        .catch((error) => {
          console.error('Error fetching last update time:', error.message);
          alert(`Error fetching last update time: ${error.message}`);
        });
    } else {
      console.warn('No selectedLeague found in localStorage. Skipping league-specific fetches.');
    }
  }, []);

  // Fetch scorecard data when a player is selected
  const fetchScorecardData = (playerName) => {
    fetch(`${API_BASE_URL}/holes`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch scorecard data: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        const playerData = data.players.find(
          (player) => normalizeName(player.player_name) === normalizeName(playerName)
        );
        setSelectedPlayer({ ...playerData, name: playerName } || null);
      })
      .catch((error) => {
        console.error('Error fetching scorecard data:', error.message);
        alert(`Error fetching scorecard data: ${error.message}`);
      });
  };

  // Calculate the total score for each team using the 4 best scores
  const calculateTeamScores = () => {
    // Pre-calculate the maximum values for each percentage type across the field
    const winValues = predictions.map((pred) => pred.win).filter((val) => val !== null && val !== undefined);
    const top5Values = predictions.map((pred) => pred.top_5).filter((val) => val !== null && val !== undefined);
    const top10Values = predictions.map((pred) => pred.top_10).filter((val) => val !== null && val !== undefined);
    const top20Values = predictions.map((pred) => pred.top_20).filter((val) => val !== null && val !== undefined);

    const maxWin = winValues.length > 0 ? Math.max(...winValues) : 0;
    const maxTop5 = top5Values.length > 0 ? Math.max(...top5Values) : 0;
    const maxTop10 = top10Values.length > 0 ? Math.max(...top10Values) : 0;
    const maxTop20 = top20Values.length > 0 ? Math.max(...top20Values) : 0;

    return teamNames.map((teamName, index) => {
      const team = teams[index];
      const playersWithScores = team
        .map((player) => {
          const playerStats = leaderboard.find(
            (entry) => normalizeName(entry.name) === normalizeName(player.name)
          );
          const playerPreds = predictions.find(
            (pred) => normalizeName(pred.name) === normalizeName(player.name)
          );
          return {
            ...player,
            scoreToPar: playerStats ? playerStats.scoreToPar : null,
            thru: playerStats ? playerStats.thru : 'N/A',
            win: playerPreds ? playerPreds.win : null,
            top_5: playerPreds ? playerPreds.top_5 : null,
            top_10: playerPreds ? playerPreds.top_10 : null,
            top_20: playerPreds ? playerPreds.top_20 : null,
            // Store the maximum values for use in shading
            maxWin,
            maxTop5,
            maxTop10,
            maxTop20,
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
          throw new Error(`Failed to update data: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        setLastUpdateTime(data.lastUpdateTime);
        alert('Data updated successfully!');

        // Refresh leaderboard data after update
        console.log('Fetching updated live stats from:', `${API_BASE_URL}/live-stats`);
        fetch(`${API_BASE_URL}/live-stats`)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Failed to fetch updated live stats: ${response.status}`);
            }
            return response.json();
          })
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
          .catch((error) => {
            console.error('Error fetching updated live tournament stats:', error.message);
            alert(`Error fetching updated live stats: ${error.message}`);
          });

        // Refresh predictions data after update
        console.log('Fetching updated predictions data from:', `${API_BASE_URL}/preds`);
        fetch(`${API_BASE_URL}/preds`)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Failed to fetch updated predictions: ${response.status}`);
            }
            return response.json();
          })
          .then((data) => {
            console.log('Updated predictions data received:', data);
            if (data.data && Array.isArray(data.data)) {
              const normalizedPredictions = data.data.map((player) => ({
                name: normalizeName(player.player_name),
                win: player.win,
                top_5: player.top_5,
                top_10: player.top_10,
                top_20: player.top_20,
              }));
              setPredictions(normalizedPredictions);
            } else {
              console.error('Updated predictions data is not in the expected format:', data);
            }
          })
          .catch((error) => {
            console.error('Error fetching updated predictions data:', error.message);
            alert(`Error fetching updated predictions: ${error.message}`);
          });
      })
      .catch((error) => {
        console.error('Error updating data:', error.message);
        alert(`Error updating data: ${error.message}`);
      })
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
    <div className="home-wrapper">
      <div className="container">

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
                      {/* Nested table for player details */}
                      <table className="table table-striped table-bordered player-table">
                        <thead>
                          <tr>
                            <th>Player Name</th>
                            <th>Score</th>
                            <th>Thru</th>
                            <th>Win %</th>
                            <th>Top 5 %</th>
                            <th>Top 10 %</th>
                            <th>Top 20 %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {team.players.map((player, playerIndex) => (
                            <React.Fragment key={playerIndex}>
                              <tr
                                onClick={() => handlePlayerClick(player.name)}
                                style={{ cursor: 'pointer' }}
                              >
                                <td>{player.name}</td>
                                <td className={player.scoreToPar < 0 ? 'text-danger' : player.scoreToPar > 0 ? 'text-success' : ''}>
                                  {player.scoreToPar}
                                </td>
                                <td>{player.thru}</td>
                                <td style={{ backgroundColor: getBackgroundColor(player.win, player.maxWin) }}>
                                  {player.win ? (player.win * 100).toFixed(1) : 'N/A'}
                                </td>
                                <td style={{ backgroundColor: getBackgroundColor(player.top_5, player.maxTop5) }}>
                                  {player.top_5 ? (player.top_5 * 100).toFixed(1) : 'N/A'}
                                </td>
                                <td style={{ backgroundColor: getBackgroundColor(player.top_10, player.maxTop10) }}>
                                  {player.top_10 ? (player.top_10 * 100).toFixed(1) : 'N/A'}
                                </td>
                                <td style={{ backgroundColor: getBackgroundColor(player.top_20, player.maxTop20) }}>
                                  {player.top_20 ? (player.top_20 * 100).toFixed(1) : 'N/A'}
                                </td>
                              </tr>
                              {selectedPlayer && selectedPlayer.name === player.name && (
                                <tr>
                                  <td colSpan="7" className="scorecard-container">
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
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
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