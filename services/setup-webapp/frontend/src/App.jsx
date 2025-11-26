import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Terminal from './components/Terminal';
import ConfigForm from './components/ConfigForm';
import { motion, AnimatePresence } from 'framer-motion';

const socket = io('http://localhost:3005');

function App() {
  const [step, setStep] = useState('config'); // config, running, finished
  const [pairingCode, setPairingCode] = useState(null);
  const terminalRef = useRef(null);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to backend');
    });

    socket.on('log', (data) => {
      terminalRef.current?.write(data);
      const codeMatch = data.match(/Code: ([A-Z0-9]{8})/);
      if (codeMatch) {
        setPairingCode(codeMatch[1]);
      }
    });

    socket.on('status', (data) => {
      if (data.state === 'finished') {
        // setStep('finished'); 
      }
    });

    return () => {
      socket.off('connect');
      socket.off('log');
      socket.off('status');
    };
  }, []);

  const handleStart = () => {
    setStep('running');
    fetch('http://localhost:3005/api/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flags: [] }),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-text font-sans selection:bg-primary selection:text-white overflow-hidden relative">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <header className="relative z-10 pt-12 pb-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary mb-3 tracking-tight">
            WhatsApp Bot Scanner
          </h1>
          <p className="text-subtext text-lg font-light tracking-wide">Automated Setup Wizard</p>
        </motion.div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 pb-12">
        <AnimatePresence mode="wait">
          {step === 'config' && (
            <motion.div
              key="config"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              transition={{ duration: 0.4 }}
            >
              <ConfigForm onSave={() => { }} onStart={handleStart} />
            </motion.div>
          )}

          {step === 'running' && (
            <motion.div
              key="running"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {pairingCode && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-surface/80 backdrop-blur-xl border border-primary/30 p-8 rounded-2xl text-center shadow-2xl shadow-primary/10 max-w-2xl mx-auto"
                >
                  <h3 className="text-2xl text-primary font-semibold mb-4">WhatsApp Pairing Code</h3>
                  <div className="text-6xl font-mono font-bold tracking-[0.2em] text-white select-all drop-shadow-[0_0_15px_rgba(37,211,102,0.5)]">
                    {pairingCode}
                  </div>
                  <p className="text-subtext mt-6 text-sm font-medium">
                    Open WhatsApp &gt; Linked Devices &gt; Link a Device &gt; Link with phone number
                  </p>
                </motion.div>
              )}

              <div className="flex flex-col h-[calc(100vh-250px)]">
                <div className="bg-black/80 backdrop-blur-md rounded-xl shadow-2xl overflow-hidden border border-gray-800 flex-grow flex flex-col ring-1 ring-white/5">
                  <div className="bg-gray-900/90 px-5 py-3 border-b border-gray-800 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex space-x-2 mr-4">
                        <div className="w-3 h-3 rounded-full bg-red-500/80 shadow-sm"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80 shadow-sm"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/80 shadow-sm"></div>
                      </div>
                      <span className="text-sm text-gray-400 font-mono flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        setup-wizard.mjs
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {pairingCode ? (
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                        </span>
                      ) : (
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                      )}
                      <span className={`text-xs font-mono font-bold ${pairingCode ? 'text-yellow-500' : 'text-green-500'}`}>
                        {pairingCode ? 'WAITING FOR PAIRING' : 'RUNNING...'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-grow relative bg-black/50">
                    <div className="absolute inset-0 p-4">
                      <Terminal ref={terminalRef} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
