import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export default React.forwardRef((props, ref) => {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);

    React.useImperativeHandle(ref, () => ({
        write: (data) => {
            xtermRef.current?.write(data);
        },
        writeln: (data) => {
            xtermRef.current?.writeln(data);
        },
        clear: () => {
            xtermRef.current?.clear();
        }
    }));

    useEffect(() => {
        const term = new XTerm({
            theme: {
                background: '#1e1e1e',
                foreground: '#d4d4d4',
            },
            fontFamily: 'monospace',
            fontSize: 14,
            convertEol: true,
            rows: 20,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalRef.current);

        // Initial fit might fail if container is hidden/animating
        try {
            fitAddon.fit();
        } catch (e) {
            console.warn('Initial fit failed', e);
        }

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Use ResizeObserver for robust responsiveness
        const resizeObserver = new ResizeObserver(() => {
            try {
                fitAddon.fit();
            } catch (e) {
                // Ignore fit errors during resize (e.g. if hidden)
            }
        });

        if (terminalRef.current) {
            resizeObserver.observe(terminalRef.current);
        }

        const handleResize = () => {
            try {
                fitAddon.fit();
            } catch (e) { }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            resizeObserver.disconnect();
            term.dispose();
        };
    }, []);

    return <div ref={terminalRef} className="w-full h-full bg-black rounded-lg overflow-hidden" />;
});
