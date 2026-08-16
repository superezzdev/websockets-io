const EmptyState = () => (
  <div className="h-full flex flex-col items-center justify-center text-center p-8">
    <div className="w-20 h-20 bg-primary border-thick border-xblack rounded-full flex items-center justify-center mb-6 shadow-[0_4px_0_0_#111]">
      {/* Video Icon */}
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 10L20.5701 6.81702C21.4395 6.3202 22.5 6.94691 22.5 7.94902V16.051C22.5 17.0531 21.4395 17.6798 20.5701 17.183L15 14M4.5 20.5H13.5C14.8807 20.5 16 19.3807 16 18V6C16 4.61929 14.8807 3.5 13.5 3.5H4.5C3.11929 3.5 2 4.61929 2 6V18C2 19.3807 3.11929 20.5 4.5 20.5Z" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
    <h3 className="text-2xl font-black text-xblack mb-3">No Match Selected</h3>
    <p className="text-muted font-medium max-w-[250px] mx-auto text-base">
      Select a match from the list to view live commentary and real-time updates.
    </p>
  </div>
);

const LiveMatchPanel = ({ selectedMatch }) => {
  return (
    <div className="bg-[#fcfcfc] border-thick border-xblack border-dashed rounded-[32px] w-full min-h-[600px] h-[calc(100vh-140px)] p-6 sm:p-8 flex flex-col relative overflow-hidden">
      {!selectedMatch ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col h-full overflow-y-auto w-full">
          {/* Top Status */}
          <div className="flex items-center gap-2 mb-6">
            <span className="font-bold text-live tracking-wide">LIVE</span>
            <span className="w-2.5 h-2.5 rounded-full bg-live animate-pulse"></span>
          </div>

          {/* Teams and Score */}
          <div className="flex justify-between items-center bg-xwhite border-thick border-xblack rounded-2xl p-4 sm:p-6 mb-6 shadow-[0_4px_0_0_#111]">
            <div className="flex-1 min-w-0">
              <div className="font-bold text-lg sm:text-xl truncate text-xblack mb-1">{selectedMatch.homeTeam}</div>
              <div className="font-bold text-lg sm:text-xl truncate text-xblack">{selectedMatch.awayTeam}</div>
            </div>
            
            <div className="flex flex-col items-center justify-center gap-1 ml-4 px-4 py-2 bg-xbg rounded-xl border-2 border-border">
              <span className="font-black text-xl sm:text-2xl">{selectedMatch.homeScore}</span>
              <span className="w-4 h-0.5 bg-xblack"></span>
              <span className="font-black text-xl sm:text-2xl">{selectedMatch.awayScore}</span>
            </div>
          </div>

          {/* Video Placeholder */}
          <div className="w-full aspect-video bg-xblack rounded-2xl border-thick border-xblack overflow-hidden relative mb-8 shadow-[0_6px_0_0_#111]">
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto text-white opacity-20 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-white font-bold tracking-widest opacity-30 uppercase text-sm">LIVE VIDEO</span>
              </div>
            </div>
          </div>

          {/* Commentary Section */}
          <div className="flex-1 flex flex-col">
            <h4 className="font-bold text-xl text-xblack mb-4">Live Commentary</h4>
            
            <div className="flex-1 bg-xwhite border-thick border-xblack rounded-2xl p-4 sm:p-5 shadow-[0_4px_0_0_#111] overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-start gap-4 pb-4 border-b-2 border-dashed border-gray-100">
                  <span className="font-bold text-sm text-muted whitespace-nowrap mt-1">03:39 PM</span>
                  <p className="text-sm sm:text-base font-medium">Attack building up in the center...</p>
                </div>
                <div className="flex items-start gap-4">
                  <span className="font-bold text-sm text-muted whitespace-nowrap mt-1">03:38 PM</span>
                  <p className="text-sm sm:text-base font-medium">Match started. Both teams looking aggressive early on.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMatchPanel;
