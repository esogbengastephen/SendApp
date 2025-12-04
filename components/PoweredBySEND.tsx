"use client";

export default function PoweredBySEND() {
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
      <span>Powered by</span>
      <div className="bg-primary p-1.5 rounded flex items-center justify-center">
        <span className="text-sm font-bold text-slate-900">/s</span>
      </div>
      <span className="font-medium">SEND</span>
    </div>
  );
}

