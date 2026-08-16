import React, { useEffect, useRef, useState } from 'react';
import { Video, VideoOff, Mic, MicOff, SkipForward, LogOut, Send, Flag } from 'lucide-react';

const VideoChat = ({ onQuit, interests = [], mode = 'video', question = '' }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);

  const [status, setStatus] = useState('idle'); // idle, waiting, connected
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isStrangerTyping, setIsStrangerTyping] = useState(false);
  const [commonInterests, setCommonInterests] = useState([]);
  const [userCount, setUserCount] = useState(1);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [spyState, setSpyState] = useState(null);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(true);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const iceServersRef = useRef([{ urls: 'stun:stun.l.google.com:19302' }]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Connected banner timer
  useEffect(() => {
    if (status === 'connected') {
      setShowBanner(true);
      const timer = setTimeout(() => setShowBanner(false), 4000);
      return () => clearTimeout(timer);
    } else {
      setShowBanner(false);
    }
  }, [status]);

  // Initialize WebRTC and Signaling
  const fetchTurnServers = async () => {
    try {
      const response = await fetch('https://myapp.metered.live/api/v1/turn/credentials?apiKey=YOUR_KEY');
      if (!response.ok) throw new Error('Failed to fetch TURN credentials');
      const data = await response.json();
      
      iceServersRef.current = [
        { urls: 'stun:stun.l.google.com:19302' },
        ...data
      ];
    } catch (err) {
      console.warn("Could not fetch TURN servers, falling back to STUN only:", err);
    }
  };

  const init = async () => {
    await fetchTurnServers();

    if (mode === 'video') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        connectSignaling();
      } catch (err) {
        console.error("Failed to access camera/mic", err);
        setStatus('error');
      }
    } else {
      setIsVideoEnabled(false);
      setIsAudioEnabled(false);
      connectSignaling();
    }
  };

  const connectSignaling = () => {
    const wsUrl = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onopen = () => {
      findStranger();
    };

    socketRef.current.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'waiting':
          setStatus('waiting');
          break;
        case 'matched':
          setStatus('connected');
          setCommonInterests(message.commonInterests || []);
          if (message.isSpy || message.isSpyStranger) {
            setSpyState({
              isSpy: message.isSpy,
              isSpyStranger: message.isSpyStranger,
              question: message.question,
              peerId: message.peerId
            });
          }
          // The spy doesn't establish WebRTC, strangers still can (or just use WS for text)
          if (!message.isSpy) {
            setupPeerConnection(message.initiator);
            // Send initial media state
            socketRef.current.send(JSON.stringify({
              type: 'mediaState',
              videoEnabled: isVideoEnabled,
              audioEnabled: isAudioEnabled
            }));
          }
          break;
        case 'offer':
          await handleOffer(message);
          break;
        case 'answer':
          await handleAnswer(message);
          break;
        case 'ice-candidate':
          await handleIceCandidate(message);
          break;
        case 'peer_left':
          handlePeerLeft();
          break;
        case 'mediaState':
          if (message.videoEnabled !== undefined) setRemoteVideoEnabled(message.videoEnabled);
          if (message.audioEnabled !== undefined) setRemoteAudioEnabled(message.audioEnabled);
          break;
        case 'chat':
          setIsStrangerTyping(false);
          setMessages(prev => [...prev, { text: message.text, isSent: false, senderId: message.senderId }]);
          break;
        case 'typing':
          setIsStrangerTyping(message.isTyping);
          break;
        case 'userCount':
          setUserCount(message.count);
          break;
        default:
          break;
      }
    };
  };

  const setupPeerConnection = async (isInitiator) => {
    const configuration = {
      iceServers: iceServersRef.current
    };
    
    peerConnectionRef.current = new RTCPeerConnection(configuration);

    // Add local stream tracks to PC
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote stream
    peerConnectionRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Handle ICE candidates
    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate
        }));
      }
    };

    if (isInitiator) {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      socketRef.current.send(JSON.stringify({
        type: 'offer',
        offer: offer
      }));
    }
  };

  const handleOffer = async (message) => {
    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(message.offer));
    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);
    socketRef.current.send(JSON.stringify({
      type: 'answer',
      answer: answer
    }));
  };

  const handleAnswer = async (message) => {
    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(message.answer));
  };

  const handleIceCandidate = async (message) => {
    try {
      if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(message.candidate));
      }
    } catch (e) {
      console.error('Error adding received ice candidate', e);
    }
  };

  const handlePeerLeft = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setMessages([]);
    setIsStrangerTyping(false);
    setCommonInterests([]);
    setShowReportModal(false);
    setSpyState(null);
    setRemoteVideoEnabled(true);
    setRemoteAudioEnabled(true);
    setStatus('disconnected');
  };

  const findStranger = () => {
    setStatus('idle');
    setMessages([]);
    setIsStrangerTyping(false);
    setCommonInterests([]);
    setShowReportModal(false);
    setSpyState(null);
    setRemoteVideoEnabled(true);
    setRemoteAudioEnabled(true);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    socketRef.current.send(JSON.stringify({ type: 'leave' }));
    setTimeout(() => {
      socketRef.current.send(JSON.stringify({ type: 'join', tags: interests, mode, question }));
    }, 100);
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        if (socketRef.current && status === 'connected') {
          socketRef.current.send(JSON.stringify({
            type: 'mediaState',
            videoEnabled: videoTrack.enabled,
            audioEnabled: isAudioEnabled
          }));
        }
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
        if (socketRef.current && status === 'connected') {
          socketRef.current.send(JSON.stringify({
            type: 'mediaState',
            audioEnabled: audioTrack.enabled,
            videoEnabled: isVideoEnabled
          }));
        }
      }
    }
  };

  const handleChatInputChange = (e) => {
    setChatInput(e.target.value);
    
    if (status !== 'connected') return;

    if (!typingTimeoutRef.current) {
      socketRef.current.send(JSON.stringify({ type: 'typing', isTyping: true }));
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current.send(JSON.stringify({ type: 'typing', isTyping: false }));
      typingTimeoutRef.current = null;
    }, 300);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || status !== 'connected') return;
    
    socketRef.current.send(JSON.stringify({ type: 'chat', text: chatInput }));
    setMessages(prev => [...prev, { text: chatInput, isSent: true }]);
    setChatInput("");

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
      socketRef.current.send(JSON.stringify({ type: 'typing', isTyping: false }));
    }
  };

  const submitReport = (reason) => {
    if (socketRef.current && status === 'connected') {
      socketRef.current.send(JSON.stringify({ type: 'report', reason }));
    }
    setShowReportModal(false);
    findStranger();
  };

  useEffect(() => {
    init();
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  return (
    <div className="flex flex-col md:flex-row w-full h-[100dvh] bg-xblack overflow-hidden relative">
      
      {/* Video Area (Left) */}
      {mode === 'video' && (
        <div className="relative h-[60%] md:h-full md:flex-1 flex items-center justify-center shrink-0 bg-black">
          {/* Remote Video Background */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`absolute inset-0 w-full h-full object-cover ${!remoteVideoEnabled ? 'hidden' : ''}`}
          />
          {!remoteVideoEnabled && status === 'connected' && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
               <div className="w-32 h-32 md:w-48 md:h-48 bg-gray-600 rounded-full flex items-center justify-center">
                  <VideoOff size={48} className="text-gray-400" />
               </div>
            </div>
          )}

        {/* Overlay Status: Waiting */}
        {status === 'waiting' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10 backdrop-blur-md">
            <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mb-6"></div>
            <h2 className="text-white text-lg font-medium tracking-wide">Looking for strangers...</h2>
          </div>
        )}

        {/* Overlay Status: Connected Banner */}
        {showBanner && status === 'connected' && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md border border-white/10 text-white text-sm py-2 px-6 rounded-full font-medium z-10 shadow-lg animate-fade-in-down">
            You're now chatting with a stranger
          </div>
        )}

        {/* Overlay Status: Disconnected */}
        {status === 'disconnected' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10 backdrop-blur-md transition-opacity duration-300">
            <h2 className="text-white text-xl font-medium mb-6">Stranger has disconnected</h2>
            <button 
              onClick={findStranger}
              className="bg-white text-black hover:bg-gray-200 px-6 py-3 rounded-full font-medium transition-colors shadow-lg"
            >
              Find new stranger
            </button>
          </div>
        )}
        
        {status === 'error' && (
          <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center z-10 text-white font-bold p-8 text-center">
            <h2>Could not access Camera or Microphone. Please check permissions.</h2>
          </div>
        )}

        {/* Report Button */}
        {status === 'connected' && (
          <button
            onClick={() => setShowReportModal(true)}
            className="absolute bottom-6 left-6 z-30 bg-red-500/20 hover:bg-red-500/40 text-red-500 border border-red-500/30 rounded-full px-4 py-2 flex items-center gap-2 transition-colors backdrop-blur-md text-sm font-bold shadow-sm"
          >
            <Flag size={16} />
            Report
          </button>
        )}

        {/* Local Video PIP */}
        <div className="absolute bottom-4 right-4 md:bottom-24 md:right-6 w-24 sm:w-32 md:w-48 aspect-[3/4] bg-gray-900 rounded-xl md:rounded-2xl overflow-hidden border-2 border-white shadow-xl z-20">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100" // Mirror local video
          />
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="w-12 h-12 md:w-20 md:h-20 bg-gray-600 rounded-full flex items-center justify-center">
                <VideoOff className="text-white opacity-50 w-6 h-6 md:w-10 md:h-10" />
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="fixed md:absolute bottom-0 md:bottom-8 left-0 md:left-1/2 md:-translate-x-1/2 w-full md:w-auto flex justify-center items-center gap-3 md:gap-4 z-[60] bg-[#111] md:bg-black/50 p-3 md:p-3 md:rounded-full md:backdrop-blur-md border-t md:border-t-0 md:border border-white/10">
          <button 
            onClick={toggleAudio}
            className={`p-3 md:p-4 rounded-full transition-colors ${isAudioEnabled ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
          >
            {isAudioEnabled ? <Mic size={20} className="md:w-6 md:h-6" /> : <MicOff size={20} className="md:w-6 md:h-6" />}
          </button>
          
          <button 
            onClick={toggleVideo}
            className={`p-3 md:p-4 rounded-full transition-colors ${isVideoEnabled ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
          >
            {isVideoEnabled ? <Video size={20} className="md:w-6 md:h-6" /> : <VideoOff size={20} className="md:w-6 md:h-6" />}
          </button>

          <div className="w-px h-6 md:h-8 bg-white/20 mx-1 md:mx-2"></div>

          <button 
            onClick={findStranger}
            className="bg-primary hover:bg-primary-dark text-black font-bold p-3 md:p-4 rounded-full flex items-center gap-2 transition-transform hover:scale-105 shadow-[0_4px_0_0_#111]"
          >
            <SkipForward size={20} className="md:w-6 md:h-6" fill="currentColor" />
            <span className="hidden sm:inline pr-2 tracking-wide uppercase">Next</span>
          </button>

          <div className="w-px h-6 md:h-8 bg-white/20 mx-1 md:mx-2"></div>

          <button 
            onClick={onQuit}
            className="bg-red-600 hover:bg-red-700 text-white font-bold p-3 md:p-4 rounded-full flex items-center gap-2 transition-transform hover:scale-105 shadow-[0_4px_0_0_#111]"
          >
            <LogOut size={20} className="md:w-6 md:h-6" />
            <span className="hidden sm:inline pr-2 tracking-wide uppercase">Quit</span>
          </button>
        </div>

        {/* Logo */}
        <div className="absolute top-4 left-4 md:top-6 md:left-6 z-20">
          <h1 className="text-primary text-2xl md:text-3xl font-black tracking-tighter drop-shadow-lg">MeetStrangers.</h1>
          
          {status === 'connected' && commonInterests.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 items-center">
              <span className="text-white/80 text-sm font-medium mr-1 shadow-sm">You both like:</span>
              {commonInterests.map((interest, i) => (
                <span key={i} className="bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs px-3 py-1.5 rounded-full shadow-sm capitalize">
                  {interest}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* User Count */}
        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-3 py-1 md:px-4 md:py-1.5 flex items-center gap-2 shadow-sm">
          <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-white text-xs md:text-sm font-medium">{userCount} <span className="hidden sm:inline">people</span> online</span>
        </div>

        {/* Remote Mic Off Indicator */}
        {!remoteAudioEnabled && status === 'connected' && (
          <div className="absolute top-14 right-4 md:top-16 md:right-6 bg-black/50 backdrop-blur-md border border-white/10 rounded-full p-2 z-20 shadow-sm" title="Stranger is muted">
            <MicOff size={16} className="text-red-500 md:w-5 md:h-5" />
          </div>
        )}

        {/* Report Modal */}
        {showReportModal && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-white/10 rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-fade-in-up">
              <h3 className="text-white text-xl font-bold mb-3 flex items-center gap-2">
                <Flag size={20} className="text-red-500" />
                Report Stranger
              </h3>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                Why are you reporting this user? We will immediately disconnect you and log this report for review.
              </p>
              <div className="flex flex-col gap-3">
                {['Nudity', 'Harassment', 'Spam'].map(reason => (
                  <button
                    key={reason}
                    onClick={() => submitReport(reason)}
                    className="bg-gray-800 hover:bg-gray-700 hover:bg-red-900/40 hover:text-red-400 hover:border-red-900/50 text-white font-medium py-3.5 rounded-xl transition-colors border border-white/5 shadow-sm"
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setShowReportModal(false)}
                className="mt-6 w-full text-gray-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-wider"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        </div>
      )}

      {/* Chat Area (Right or Full Width) */}
      <div className={`${(mode === 'video' && !spyState?.isSpy) ? 'w-full md:w-80 lg:w-96 md:border-l md:flex-none' : 'w-full'} bg-[#111] border-t md:border-t-0 border-white/10 flex flex-col flex-1 md:h-full shrink-0 relative ${mode === 'video' ? 'pb-[72px] md:pb-0' : ''}`}>
        <div className="p-4 border-b border-white/10 bg-[#1a1a1a] flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3">
              {(mode === 'text' || spyState?.isSpy) ? (
                <h1 className="text-primary text-xl font-black tracking-tighter">MeetStrangers.</h1>
              ) : (
                <h2 className="text-white font-bold text-lg">Live Chat</h2>
              )}
              {(mode === 'text' || mode === 'spy' || spyState?.isSpy) && (
                <div className="bg-white/10 border border-white/20 rounded-full px-3 py-1 flex items-center gap-2 shadow-sm">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-white text-xs font-medium">{userCount} people online</span>
                </div>
              )}
            </div>
            {(mode === 'text' || mode === 'spy' || spyState?.isSpy) && status === 'connected' && commonInterests.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5 items-center">
                <span className="text-gray-400 text-xs font-medium mr-1">You both like:</span>
                {commonInterests.map((interest, i) => (
                  <span key={i} className="bg-white/5 border border-white/10 text-gray-300 text-[10px] px-2 py-0.5 rounded-full capitalize shadow-sm">
                    {interest}
                  </span>
                ))}
              </div>
            )}
            
            {status === 'connected' && spyState?.question && (
              <div className="mt-2 flex flex-col">
                <span className="text-primary text-[10px] font-bold uppercase tracking-wider mb-0.5">
                  {spyState.isSpy ? 'You asked:' : 'Spy Question:'}
                </span>
                <p className="text-white text-sm font-medium bg-white/5 px-3 py-2 rounded-lg border border-white/10">
                  "{spyState.question}"
                </p>
                {spyState.isSpyStranger && (
                  <span className="text-gray-400 text-xs mt-1">You are Stranger {spyState.peerId}</span>
                )}
              </div>
            )}
          </div>
          
          {(mode === 'text' || mode === 'spy' || spyState?.isSpy) && (
            <div className="flex gap-2">
              <button onClick={() => setShowReportModal(true)} className="bg-red-500/20 hover:bg-red-500/40 text-red-500 border border-red-500/30 font-bold px-3 py-1.5 rounded-full flex items-center gap-1 text-xs transition-colors">
                <Flag size={14} /> Report
              </button>
              <button onClick={findStranger} className="bg-primary hover:bg-primary-dark text-black font-bold px-4 py-1.5 rounded-full flex items-center gap-1 text-sm shadow-sm transition-transform hover:scale-105">
                <SkipForward size={16} fill="currentColor" /> Next
              </button>
              <button onClick={onQuit} className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-1.5 rounded-full flex items-center gap-1 text-sm shadow-sm transition-transform hover:scale-105">
                <LogOut size={16} /> Quit
              </button>
            </div>
          )}
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {(mode === 'text' || mode === 'spy' || spyState?.isSpy) && status === 'waiting' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-sm font-medium tracking-wide uppercase">Looking for strangers...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              {mode === 'spy' || spyState?.isSpy ? 'Waiting for strangers to chat...' : 'Say hi to your stranger!'}
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.isSent ? 'items-end' : 'items-start'}`}>
                {msg.senderId && (
                  <span className="text-[10px] text-gray-400 mb-0.5 font-medium ml-1">
                    {msg.senderId}
                  </span>
                )}
                <div 
                  className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                    msg.isSent 
                      ? 'bg-blue-600 text-white rounded-br-sm' 
                      : 'bg-gray-700 text-white rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))
          )}
          
          {isStrangerTyping && (
            <div className="flex gap-1 items-center px-4 py-2 bg-gray-700 text-white self-start rounded-2xl rounded-bl-sm max-w-[80%]">
              <span className="text-xs text-gray-300 italic mr-2">Stranger is typing</span>
              <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-4 bg-[#1a1a1a] border-t border-white/10">
          <form onSubmit={sendMessage} className="flex gap-2">
            <input 
              type="text" 
              value={chatInput}
              onChange={handleChatInputChange}
              placeholder={spyState?.isSpy ? "You are spying (read-only)" : status === 'connected' ? "Type a message..." : "Waiting for connection..."}
              disabled={status !== 'connected' || spyState?.isSpy}
              className="flex-1 bg-black border border-white/20 rounded-full px-4 py-2 text-white text-sm focus:outline-none focus:border-primary disabled:opacity-50"
            />
            <button 
              type="submit"
              disabled={status !== 'connected' || !chatInput.trim() || spyState?.isSpy}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-black hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VideoChat;
