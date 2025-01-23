import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LeagueSelector from './pages/LeagueSelector';
import Home from './pages/Home';
import Draft from './pages/Draft';
import Scoreboard from './pages/Scoreboard';
import Navbar from './components/Navbar'; // Assuming you have a Navbar component

const App = () => {
  return (
    <Router>
      <Navbar />
      <Routes>
        {/* League Selector Page (Default) */}
        <Route path="/fantasy_golf" element={<LeagueSelector />} />

        {/* Home Page */}
        <Route path="/home" element={<Home />} />

        {/* Draft Page */}
        <Route path="/draft" element={<Draft />} />

        {/* Scoreboard Page */}
        <Route path="/scoreboard" element={<Scoreboard />} />
      </Routes>
    </Router>
  );
};

export default App;








