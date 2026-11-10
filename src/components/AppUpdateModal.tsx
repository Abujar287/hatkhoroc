import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RefreshCw, X, Sparkles, ExternalLink, GitCommit, Calendar, ArrowRight } from 'lucide-react';
import { UpdateInfo, recordUpdateDismissed, recordUpdateAcknowledged } from '../utils/updateChecker';
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
  lang = 'en'
}) => {
  if (!isOpen || !updateInfo) return null;

  const handleDownload = () => {
    recordUpdateAcknowledged(updateInfo.latestSha);
    // Prefer direct release download or actions page
    window.open(updateInfo.actionsUrl, '_blank');
  };

  const handleDismiss = () => {
    recordUpdateDismissed();
    onClose();
  };

  const handleReload = () => {
    recordUpdateAcknowledged(updateInfo.latestSha);
    window.location.reload();
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(lang === 'en' ? 'en-US' : 'bn-BD', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <ModalPortal>
      <AnimatePresence>
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="w-full max-w-md bg-gradient-to-b from-[#062E2B] via-[#042422] to-[#021816] text-[#F0FDFA] rounded-3xl p-5 sm:p-6 shadow-2xl border border-teal-500/40 relative overflow-hidden"
          >
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-teal-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-2 text-teal-300/70 hover:text-white bg-teal-950/60 hover:bg-teal-900/80 rounded-full transition-all cursor-pointer border border-teal-700/50"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header: App Logo + Update Badge */}
            <div className="flex items-center gap-3.5 mb-4">
              <div className="relative">
                <img
                  src="/logo.png"
                  alt="হাত খরচ"
                  className="w-14 h-14 rounded-2xl object-contain shadow-lg border border-teal-400/50 p-0.5 bg-[#062423]"
                />
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#042422] flex items-center justify-center shadow-md">
                  <Sparkles className="w-2.5 h-2.5 text-black" />
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/40">
                    নতুন ভার্সন আপডেট
                  </span>
                </div>
                <h2 className="text-lg font-black text-white tracking-tight mt-0.5">
                  হাত খরচ — New Update!
                </h2>
                <p className="text-[11px] text-teal-300/80 font-medium">
                  GitHub-এ নতুন আপডেট প্রকাশ করা হয়েছে
                </p>
              </div>
            </div>

            {/* Update Info Box */}
            <div className="bg-[#031E1C]/80 rounded-2xl p-3.5 border border-teal-800/80 space-y-2.5 mb-5 shadow-inner">
              <div className="flex items-start gap-2">
                <GitCommit className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider block">
                    আপডেটের বিবরণ / Changes
                  </span>
                  <p className="text-xs text-teal-100 font-semibold mt-0.5 leading-relaxed">
                    {updateInfo.commitMessage}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-teal-800/50 text-[10.5px] text-teal-300/80">
                <div className="flex items-center gap-1.5 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-teal-400/80" />
                  <span>{formatDate(updateInfo.commitDate)}</span>
                </div>
                <div className="font-mono text-[10px] text-teal-400/80 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800/60">
                  #{updateInfo.latestSha.substring(0, 7)}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleDownload}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>নতুন APK ডাউনলোড করুন (হাত খরচ.apk)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleReload}
                  className="py-2.5 px-3 rounded-xl bg-[#073633] hover:bg-[#0A4541] text-teal-200 border border-teal-700/70 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>রিলোড দিন</span>
                </button>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="py-2.5 px-3 rounded-xl bg-teal-950/40 hover:bg-teal-900/60 text-teal-300/80 hover:text-teal-200 border border-teal-800/60 font-medium text-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                >
                  <span>পরে দেখব</span>
                </button>
              </div>
            </div>

            {/* Note at bottom */}
            <p className="text-[10px] text-center text-teal-400/60 font-medium mt-3">
              GitHub Actions থেকে <span className="text-teal-300 font-bold">হাত খরচ.apk</span> ফাইলটি স্বয়ংক্রিয়ভাবে ডাউনলোড হবে
            </p>
          </motion.div>
        </div>
      </AnimatePresence>
    </ModalPortal>
  );
};
