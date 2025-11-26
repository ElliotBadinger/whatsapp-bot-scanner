import React, { useState, useEffect } from 'react';

const ConfigForm = ({ onSave, onStart }) => {
    const [config, setConfig] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('http://localhost:3005/api/config')
            .then(res => res.json())
            .then(data => {
                setConfig(data);
            })
            .catch(err => {
                console.error('Failed to fetch config:', err);
                // Fallback to empty config or show error
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    const handleChange = (e) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        fetch('http://localhost:3005/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        })
            .then(() => onSave())
            .catch(err => console.error(err));
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto p-8 bg-surface/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/5">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold text-white tracking-tight">Configuration</h2>
                <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-medium">
                    v1.0.0
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">VirusTotal API Key</label>
                        <input
                            type="text"
                            name="VT_API_KEY"
                            value={config.VT_API_KEY || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-3 rounded-xl bg-black/40 border border-gray-700 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-white placeholder-gray-600"
                            placeholder="Enter API Key"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">Google Safe Browsing Key</label>
                        <input
                            type="text"
                            name="GSB_API_KEY"
                            value={config.GSB_API_KEY || ''}
                            onChange={handleChange}
                            className="w-full px-4 py-3 rounded-xl bg-black/40 border border-gray-700 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-white placeholder-gray-600"
                            placeholder="Enter API Key"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">DeepSource API Token</label>
                    <input
                        type="text"
                        name="DEEPSOURCE_API_TOKEN"
                        value={config.DEEPSOURCE_API_TOKEN || ''}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl bg-black/40 border border-gray-700 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-white placeholder-gray-600"
                        placeholder="Optional Token"
                    />
                </div>

                <div className="border-t border-gray-700/50 pt-6 mt-6">
                    <label className="block text-sm font-medium mb-4 text-gray-300">Authentication Method</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className={`relative flex items-center p-4 rounded-xl border cursor-pointer transition-all ${(config.WA_AUTH_STRATEGY || 'remote') === 'remote'
                            ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(37,211,102,0.1)]'
                            : 'bg-black/20 border-gray-700 hover:bg-black/40'
                            }`}>
                            <input
                                type="radio"
                                name="WA_AUTH_STRATEGY"
                                value="remote"
                                checked={(config.WA_AUTH_STRATEGY || 'remote') === 'remote'}
                                onChange={handleChange}
                                className="sr-only"
                            />
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 ${(config.WA_AUTH_STRATEGY || 'remote') === 'remote' ? 'border-primary' : 'border-gray-500'
                                }`}>
                                {(config.WA_AUTH_STRATEGY || 'remote') === 'remote' && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                                )}
                            </div>
                            <div>
                                <span className="block font-medium text-white">Phone Number</span>
                                <span className="text-xs text-gray-400">Remote Authentication</span>
                            </div>
                        </label>

                        <label className={`relative flex items-center p-4 rounded-xl border cursor-pointer transition-all ${config.WA_AUTH_STRATEGY === 'qr'
                            ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(37,211,102,0.1)]'
                            : 'bg-black/20 border-gray-700 hover:bg-black/40'
                            }`}>
                            <input
                                type="radio"
                                name="WA_AUTH_STRATEGY"
                                value="qr"
                                checked={config.WA_AUTH_STRATEGY === 'qr'}
                                onChange={handleChange}
                                className="sr-only"
                            />
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 ${config.WA_AUTH_STRATEGY === 'qr' ? 'border-primary' : 'border-gray-500'
                                }`}>
                                {config.WA_AUTH_STRATEGY === 'qr' && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                                )}
                            </div>
                            <div>
                                <span className="block font-medium text-white">QR Code</span>
                                <span className="text-xs text-gray-400">Scan with WhatsApp</span>
                            </div>
                        </label>
                    </div>
                </div>

                <AnimatePresence>
                    {(config.WA_AUTH_STRATEGY || 'remote') === 'remote' && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <label className="block text-sm font-medium mb-2 text-gray-300">Phone Number</label>
                            <input
                                type="text"
                                name="WA_REMOTE_AUTH_PHONE_NUMBER"
                                value={config.WA_REMOTE_AUTH_PHONE_NUMBER || ''}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-gray-700 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-white placeholder-gray-600 font-mono"
                                placeholder="+1234567890"
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="pt-8 flex justify-end gap-4">
                    <button
                        type="submit"
                        className="px-6 py-3 rounded-xl bg-gray-800 text-white font-medium hover:bg-gray-700 transition-all border border-gray-700 hover:border-gray-600"
                    >
                        Save Config
                    </button>
                    <button
                        type="button"
                        id="start-setup-btn"
                        onClick={onStart}
                        className="px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold hover:shadow-lg hover:shadow-primary/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                        Start Setup Wizard
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ConfigForm;
