'use client';

import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function getIsStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function getIsIOS(): boolean {
    if (typeof navigator === 'undefined') return false;
    const nav = navigator as Navigator & { maxTouchPoints?: number };
    return /iPad|iPhone|iPod/.test(nav.userAgent)
        || (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);
}

export default function InstallPrompt({ enabled = true }: { enabled?: boolean }) {
    const [showPrompt, setShowPrompt] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isIOS] = useState(getIsIOS);
    const [isStandalone] = useState(getIsStandalone);

    useEffect(() => {
        if (isStandalone || !enabled) {
            return;
        }

        // Check if dismissed before
        const dismissed = localStorage.getItem('pwa-prompt-dismissed');
        if (dismissed) return;

        let promptTimer: number | null = null;
        const schedulePrompt = () => {
            if (promptTimer !== null) window.clearTimeout(promptTimer);
            promptTimer = window.setTimeout(() => setShowPrompt(true), 15000);
        };

        if (isIOS) {
            // Show iOS instructions after a delay
            schedulePrompt();
            return () => {
                if (promptTimer !== null) window.clearTimeout(promptTimer);
            };
        }

        // Listen for install prompt (Chrome/Android)
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            schedulePrompt();
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            if (promptTimer !== null) window.clearTimeout(promptTimer);
        };
    }, [enabled, isIOS, isStandalone]);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setShowPrompt(false);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        localStorage.setItem('pwa-prompt-dismissed', 'true');
    };

    if (!enabled || !showPrompt || isStandalone) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up">
            <div className="bg-slate-800/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-700/50 max-w-md mx-auto">
                <button
                    onClick={handleDismiss}
                    className="absolute top-3 right-3 p-1 text-slate-400 hover:text-white transition-colors"
                    aria-label="Dismiss"
                >
                    <X size={18} />
                </button>

                <div className="flex items-start gap-3 pr-6">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shrink-0">
                        <Download size={20} className="text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium text-sm mb-1">
                            Use Photo Grouper Offline
                        </h3>

                        {isIOS ? (
                            <p className="text-slate-400 text-xs leading-relaxed">
                                Tap <Share size={12} className="inline-block mx-0.5 -mt-0.5" /> then <span className="text-slate-300">&quot;Add to Home Screen&quot;</span> to install
                            </p>
                        ) : (
                            <p className="text-slate-400 text-xs leading-relaxed">
                                Install for quick access and offline use
                            </p>
                        )}
                    </div>

                    {!isIOS && deferredPrompt && (
                        <button
                            onClick={handleInstall}
                            className="shrink-0 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-xl transition-colors"
                        >
                            Install
                        </button>
                    )}
                </div>
            </div>

            <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-slide-up { animation: none; }
        }
      `}</style>
        </div>
    );
}
