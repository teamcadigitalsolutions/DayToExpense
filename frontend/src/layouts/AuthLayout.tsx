import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { ArrowRight, Wallet } from 'lucide-react';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#12101a] text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans selection:bg-purple-600 selection:text-white">
      {/* Container Card */}
      <div className="w-full max-w-[1000px] bg-[#1a1726] rounded-[24px] border border-[#2a253b] shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[600px]">
        
        {/* Left Visual Panel */}
        <div className="hidden md:flex md:col-span-5 p-8 flex-col justify-between relative overflow-hidden bg-gradient-to-b from-[#322765] via-[#211a47] to-[#16122e]">
          {/* Subtle background image/gradient overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />
          
          {/* Decorative mountain dune lines SVG */}
          <svg
            className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay pointer-events-none"
            viewBox="0 0 400 600"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M-50 400 Q100 250 250 350 T550 200 L550 650 L-50 650 Z" fill="#4c3b8f" />
            <path d="M-50 480 Q150 320 300 420 T600 300 L600 650 L-50 650 Z" fill="#2b2055" />
          </svg>

          {/* Top Bar */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="font-bold tracking-tight text-white text-lg">DayToExpense</span>
            </div>

            <Link
              to="/"
              className="text-xs font-medium text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-sm transition-all flex items-center gap-1.5"
            >
              Back to website <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Bottom Hero Text & Carousel Dots */}
          <div className="relative z-10 space-y-4">
            <h2 className="text-2xl lg:text-3xl font-semibold text-white leading-tight tracking-tight">
              Capturing Finances,<br />Creating Wealth
            </h2>

            <div className="flex items-center gap-2 pt-2">
              <div className="w-6 h-1 rounded-full bg-white" />
              <div className="w-4 h-1 rounded-full bg-white/30" />
              <div className="w-4 h-1 rounded-full bg-white/30" />
            </div>
          </div>
        </div>

        {/* Right Form Container */}
        <div className="col-span-1 md:col-span-7 p-8 sm:p-12 lg:p-14 flex flex-col justify-center bg-[#1a1726]">
          <Outlet />
        </div>

      </div>
    </div>
  );
}
