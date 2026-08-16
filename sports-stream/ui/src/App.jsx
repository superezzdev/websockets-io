import { useState, useEffect } from 'react';
import Header from './components/Header';
import MatchSection from './components/MatchSection';
import LiveMatchPanel from './components/LiveMatchPanel';
import { matchService } from './services/matches';

function App() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMatchId, setSelectedMatchId] = useState(null);

  const fetchMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await matchService.getMatches();
      setMatches(data);
    } catch (err) {
      setError("Unable to load matches. Something went wrong while loading live matches.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const handleSelectMatch = (id) => {
    setSelectedMatchId(id);
    // On mobile, scroll to the live panel when a match is selected
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        const panel = document.getElementById('live-panel-mobile');
        if (panel) {
          panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  const selectedMatch = matches.find(m => m.id === selectedMatchId) || null;

  return (
    <div className="min-h-screen pb-12 overflow-x-hidden w-full px-4 sm:px-6 md:px-8">
      <div className="max-w-[1380px] mx-auto w-full">
        <Header />
        
        <main className="mt-8 flex flex-col lg:grid lg:grid-cols-[minmax(0,_2fr)_minmax(320px,_1fr)] gap-8 relative items-start">
          
          <div className="w-full min-w-0">
            <MatchSection 
              matches={matches} 
              loading={loading} 
              error={error} 
              onRetry={fetchMatches}
              onSelectMatch={handleSelectMatch}
              selectedMatchId={selectedMatchId}
            />
            
            {/* Mobile Live Panel appears below matches when screen is small */}
            <div className="block lg:hidden mt-8 w-full" id="live-panel-mobile">
              <LiveMatchPanel selectedMatch={selectedMatch} />
            </div>
          </div>
          
          {/* Desktop Live Panel stays on the right and sticky */}
          <div className="hidden lg:block sticky top-8 w-full">
            <LiveMatchPanel selectedMatch={selectedMatch} />
          </div>
          
        </main>
      </div>
    </div>
  );
}

export default App;
