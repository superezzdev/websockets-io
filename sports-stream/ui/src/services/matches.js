// Mock match data
let matches = [
  {
    id: 1,
    sport: "cricket",
    homeTeam: "Desert Falcons",
    awayTeam: "Highland Kings",
    homeScore: 0,
    awayScore: 0,
    status: "live",
    startTime: "03:37 PM"
  },
  {
    id: 2,
    sport: "cricket",
    homeTeam: "Aurora XI",
    awayTeam: "Coastal Strikers",
    homeScore: 1,
    awayScore: 0,
    status: "live",
    startTime: "03:37 PM"
  },
  {
    id: 3,
    sport: "football",
    homeTeam: "Rivergate Rovers",
    awayTeam: "Summit Borough",
    homeScore: 1,
    awayScore: 1,
    status: "live",
    startTime: "03:37 PM"
  },
  {
    id: 4,
    sport: "football",
    homeTeam: "Harbor City FC",
    awayTeam: "Metro United",
    homeScore: 1,
    awayScore: 1,
    status: "live",
    startTime: "03:37 PM"
  }
];

// Mock API layer
export const matchService = {
  getMatches: async () => {
    // Simulate network delay
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([...matches]);
      }, 800);
    });
  },
  
  getMatch: async (id) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const match = matches.find(m => m.id === id);
        if (match) resolve({...match});
        else reject(new Error("Match not found"));
      }, 300);
    });
  }
};
