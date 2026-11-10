import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Sparkles } from 'lucide-react';
import { UpdateInfo, recordUpdateAcknowledged } from '../utils/updateChecker';
import { ModalPortal } from './Modals';

interface AppUpdateModalProps {
  isOpen: boolean;
  updateInfo: UpdateInfo | null;
  onClose: () => void;
  lang?: 'en' | 'bn';
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({
  isOpen,
  updateInfo,
  onClose,
  lang = 'bn'
}) => {
  if (!isOpen || !updateInfo) return null;

  const handleUpdateNow = () => {
    recordUpdateAcknowledged(updateInfo.latestSha);
    const targetUrl = updateInfo.releaseUrl || updateInfo.actionsUrl || 'https://github.com/Abujar287/hatkhoroc/releases';
    try {
      window.open(targetUrl, '_blank');
    } catch {}
    // Automatically reload app to fetch latest version
    window.location.reload();
  };

  return (
    <ModalPortal>
      <AnimatePresence>
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="w-full max-w-xs sm:max-w-sm bg-gradient-to-b from-[#062E2B] to-[#031B19] text-[#F0FDFA] rounded-3xl p-5 sm:p-6 shadow-2xl border border-emerald-500/50 text-center relative overflow-hidden space-y-4"
          >
            {/* Glow effect */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />

            {/* App Icon + Title */}
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="relative">
                <img
                  src="/logo.png"
                  alt="হাত খরচ"
                  className="w-16 h-16 rounded-2xl object-contain shadow-lg border border-teal-400/60 p-1 bg-[#062423]"
                />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-2 border-[#042422] flex items-center justify-center shadow-md">
                  <Sparkles className="w-3 h-3 text-slate-950" />
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight pt-1">
                হাত খরচ — App Update
              </h2>
              <p className="text-xs text-teal-200/90 font-medium">
                নতুন আপডেট চলে এসেছে। আপডেট করতে নিচের বাটনে চাপ দিন।
              </p>
            </div>

            {/* SINGLE BIG BUTTON ONLY */}
            <button
              type="button"
              onClick={handleUpdateNow}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/30 active:scale-95 transition-all cursor-pointer border border-emerald-300/40 uppercase tracking-wide"
            >
              <RefreshCw className="w-4 h-4 text-slate-950 animate-spin" style={{ animationDuration: '4s' }} />
              <span>Please Update New Version</span>
            </button>
          </motion.div>
        </div>
      </AnimatePresence>
    </ModalPortal>
  );
};
