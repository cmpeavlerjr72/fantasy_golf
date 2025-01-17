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
        <Route path="/" element={<LeagueSelector />} />
        <Route path="/home" element={<Home />} />
        <Route path="/draft" element={<Draft />} />
        <Route path="/scoreboard" element={<Scoreboard />} />
      </Routes>
    </Router>
  );
};

export default App;







