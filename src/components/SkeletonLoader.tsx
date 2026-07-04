import React from 'react';

interface SkeletonLoaderProps {
  variant?: 'table' | 'stats' | 'list' | 'profile-header' | 'leaves-table' | 'staff-table' | 'responses-table' | 'settlements-table' | 'chuti-form' | 'leave-history';
  rows?: number;
  cards?: number;
  className?: string;
  allowOvertime?: boolean;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  variant = 'table',
  rows = 5,
  cards = 4,
  className = '',
  allowOvertime = false,
}) => {
  if (variant === 'leave-history') {
    return (
      <div className={`w-full space-y-6 animate-pulse ${className}`}>
        {/* Top Header Row (Optional back button placeholder) */}
        <div className="flex justify-between items-center">
          <div className="h-9 w-32 bg-slate-800 rounded-lg"></div>
        </div>

        {/* Large Stats Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1 */}
          <div className="bg-slate-900/20 border border-slate-850 rounded-2xl p-6 flex items-center justify-between gap-4 h-[120px]">
            <div className="flex items-center gap-4">
              <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/40 h-14 w-14 shrink-0 flex items-center justify-center">
                <div className="h-6 w-6 bg-slate-800 rounded-md"></div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-36 bg-slate-800 rounded"></div>
                <div className="h-6 w-24 bg-slate-800 rounded"></div>
              </div>
            </div>
          </div>
          {/* Card 2 */}
          <div className="bg-slate-900/20 border border-slate-850 rounded-2xl p-6 flex items-center justify-between gap-4 h-[120px]">
            <div className="flex items-center gap-4">
              <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/40 h-14 w-14 shrink-0 flex items-center justify-center">
                <div className="h-6 w-6 bg-slate-800 rounded-md"></div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-36 bg-slate-800 rounded"></div>
                <div className="h-6 w-20 bg-slate-800 rounded"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Smaller Stats Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-900/20 border border-slate-850 rounded-2xl p-5 flex items-center gap-4 h-[84px]">
              <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/40 h-10 w-10 shrink-0">
                <div className="h-4 w-4 bg-slate-800 rounded-sm mx-auto mt-0.5"></div>
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="h-2.5 w-24 bg-slate-800 rounded"></div>
                <div className="h-4.5 w-20 bg-slate-800 rounded"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter Panel Skeleton */}
        <div className="bg-slate-900/20 border border-slate-850 rounded-2xl p-5 space-y-4">
          <div className="h-4.5 w-40 bg-slate-800 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <div className="h-3 w-16 bg-slate-800 rounded"></div>
              <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-16 bg-slate-800 rounded"></div>
              <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-16 bg-slate-800 rounded"></div>
              <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-10 flex-1 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
              <div className="h-10 flex-1 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
              <div className="h-10 w-10 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
            </div>
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="bg-slate-900/20 border border-slate-850 rounded-2xl overflow-hidden">
          {/* Table Header Section */}
          <div className="px-6 py-4 border-b border-slate-850 bg-slate-900/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1.5">
              <div className="h-4.5 w-44 bg-slate-800 rounded"></div>
              <div className="h-3 w-20 bg-slate-800/60 rounded"></div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="h-9 flex-1 sm:w-60 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
              <div className="h-9 w-24 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
              <div className="h-9 w-16 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
            </div>
          </div>

          {/* Table Headers */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-850">
              <thead className="bg-slate-900/30">
                <tr>
                  <th className="px-6 py-3.5 text-left"><div className="h-3 w-10 bg-slate-800 rounded"></div></th>
                  <th className="px-6 py-3.5 text-left"><div className="h-3 w-10 bg-slate-800 rounded"></div></th>
                  <th className="px-6 py-3.5 text-left"><div className="h-3 w-16 bg-slate-800 rounded"></div></th>
                  <th className="px-6 py-3.5 text-left"><div className="h-3 w-20 bg-slate-800 rounded"></div></th>
                  <th className="px-6 py-3.5 text-left"><div className="h-3 w-16 bg-slate-800 rounded"></div></th>
                  <th className="px-6 py-3.5 text-left"><div className="h-3 w-14 bg-slate-800 rounded"></div></th>
                  <th className="px-6 py-3.5 text-left"><div className="h-3 w-24 bg-slate-800 rounded"></div></th>
                  <th className="px-6 py-3.5 text-right"><div className="h-3 w-12 bg-slate-800 rounded ml-auto"></div></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-20 bg-slate-800 rounded"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-5 w-16 bg-slate-800 rounded-md"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-8 bg-slate-800 rounded"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-24 bg-slate-800 rounded"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-12 bg-slate-800 rounded"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-12 bg-slate-800 rounded"></div></td>
                    <td className="px-6 py-4"><div className="h-4 w-32 bg-slate-800 rounded"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap text-right"><div className="h-5 w-12 bg-slate-800 rounded ml-auto"></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'chuti-form') {
    return (
      <div className={`flex flex-col lg:flex-row gap-6 w-full animate-pulse ${className}`}>
        {/* Left Side: Form */}
        <div className="flex-1 space-y-6">
          <div className="space-y-2">
            <div className="h-5 w-48 bg-slate-800 rounded"></div>
            <div className="h-3.5 w-72 bg-slate-800/60 rounded"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="h-3 w-16 bg-slate-800 rounded"></div>
              <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-20 bg-slate-800 rounded"></div>
              <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="h-3 w-24 bg-slate-800 rounded"></div>
              <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-24 bg-slate-800 rounded"></div>
              <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="h-3 w-36 bg-slate-800 rounded"></div>
            <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
          </div>

          <div className="space-y-2">
            <div className="h-3 w-20 bg-slate-800 rounded"></div>
            <div className="h-20 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
          </div>

          <div className="h-11 w-full bg-purple-900/10 border border-purple-900/20 rounded-xl"></div>
        </div>

        {/* Right Side: Usage Summary card */}
        <div className="w-full lg:w-80 bg-slate-900/20 border border-slate-850 shadow-sm rounded-2xl p-5 flex flex-col gap-4 h-fit">
          <div className="h-4 w-48 bg-slate-800 rounded"></div>
          <div className="border-t border-slate-850/60 my-1"></div>
          <div className="h-24 w-full bg-slate-900/20 border border-slate-850 rounded-xl"></div>
          <div className="h-16 w-full bg-slate-900/20 border border-slate-850 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (variant === 'stats') {
    return (
      <div className={`flex flex-wrap justify-center gap-4 w-full animate-pulse ${className}`}>
        {Array.from({ length: cards }).map((_, idx) => (
          <div
            key={idx}
            className="flex-1 min-w-[250px] max-w-[350px] bg-slate-900/40 border border-slate-900 rounded-2xl p-5 flex items-center justify-between gap-4 min-h-[102px]"
          >
            <div className="flex items-center gap-4 flex-1">
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/20 shrink-0 h-12 w-12 flex items-center justify-center">
                <div className="h-6 w-6 bg-slate-800 rounded-md"></div>
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-3 w-24 bg-slate-800 rounded"></div>
                <div className="h-6 w-16 bg-slate-800 rounded mt-0.5"></div>
                <div className="h-2.5 w-40 bg-slate-850 rounded mt-0.5"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'profile-header') {
    return (
      <div
        className={`bg-slate-900/40 backdrop-blur-xl border border-slate-850 shadow-2xl rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-pulse ${className}`}
      >
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="h-12 w-12 bg-slate-800 rounded-2xl shrink-0"></div>
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-5 w-48 bg-slate-800 rounded"></div>
            <div className="h-3.5 w-32 bg-slate-800 rounded mt-1"></div>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto justify-end mt-2 md:mt-0">
          <div className="h-9 w-28 bg-slate-800 rounded-lg"></div>
          <div className="h-9 w-24 bg-slate-800 rounded-lg"></div>
          <div className="h-9 w-24 bg-slate-800 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (variant === 'leaves-table') {
    return (
      <div className={`w-full flex flex-col gap-4 animate-pulse ${className}`}>
        <div className="overflow-x-auto rounded-xl border border-slate-900 bg-slate-955/20">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-955/60">
              <tr>
                <th className="px-6 py-3 text-left"><div className="h-3 w-12 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3 text-left"><div className="h-3 w-10 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3 text-left"><div className="h-3 w-16 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3 text-left"><div className="h-3 w-20 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3 text-left"><div className="h-3 w-16 bg-slate-800 rounded"></div></th>
                {allowOvertime && <th className="px-6 py-3 text-left"><div className="h-3 w-14 bg-slate-800 rounded"></div></th>}
                <th className="px-6 py-3 text-left"><div className="h-3 w-24 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3 text-left"><div className="h-3 w-12 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3 text-right"><div className="h-3 w-10 bg-slate-800 rounded ml-auto"></div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 bg-slate-900/10">
              {Array.from({ length: rows }).map((_, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-20 bg-slate-800 rounded"></div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="h-5 w-16 bg-slate-800 rounded-md"></div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-12 bg-slate-800 rounded"></div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-24 bg-slate-850 rounded"></div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-16 bg-slate-800 rounded"></div></td>
                  {allowOvertime && <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-12 bg-slate-800 rounded"></div></td>}
                  <td className="px-6 py-4"><div className="h-4 w-48 bg-slate-800 rounded"></div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="flex gap-2"><div className="h-7 w-7 bg-slate-800 rounded-lg"></div><div className="h-7 w-7 bg-slate-800 rounded-lg"></div></div></td>
                  <td className="px-6 py-4 whitespace-nowrap text-right"><div className="h-5 w-14 bg-slate-800 rounded ml-auto"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (variant === 'staff-table') {
    return (
      <div className={`w-full flex flex-col gap-4 animate-pulse ${className}`}>
        <div className="overflow-x-auto rounded-xl border border-slate-900 bg-slate-955/20">
          <table className="min-w-full divide-y divide-slate-850">
            <thead className="bg-slate-955/60">
              <tr>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-16 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-14 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-10 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-16 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-16 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3.5 text-left"><div className="h-3 w-14 bg-slate-800 rounded"></div></th>
                <th className="px-6 py-3.5 text-right"><div className="h-3 w-12 bg-slate-800 rounded ml-auto"></div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 bg-slate-900/10">
              {Array.from({ length: rows }).map((_, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-32 bg-slate-800 rounded"></div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-16 bg-slate-850 rounded font-mono"></div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="h-5 w-16 bg-slate-800 rounded-md"></div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-12 bg-slate-800 rounded"></div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-12 bg-slate-800 rounded"></div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-12 bg-slate-800 rounded"></div></td>
                  <td className="px-6 py-4 whitespace-nowrap text-right"><div className="h-7 w-20 bg-slate-800 rounded-lg ml-auto"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (variant === 'responses-table') {
    return (
      <div className={`w-full space-y-6 animate-pulse ${className}`}>
        {/* Top Header Row (Back Button Placeholder) */}
        <div className="flex justify-between items-center">
          <div className="h-9 w-20 bg-slate-800 rounded-lg"></div>
        </div>

        {/* Main Card Container */}
        <div className="bg-slate-900/20 border border-slate-850 rounded-2xl overflow-hidden">
          {/* Heading & Top Buttons Section */}
          <div className="px-6 py-5 border-b border-slate-850 bg-slate-900/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 bg-slate-800 rounded shrink-0"></div>
                <div className="h-5 w-56 bg-slate-800 rounded"></div>
              </div>
              <div className="h-3 w-80 bg-slate-800/60 rounded"></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-20 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
              <div className="h-9 w-20 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
            </div>
          </div>

          {/* Filter Bar Card inside */}
          <div className="p-6 border-b border-slate-850">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3 space-y-2">
                <div className="h-3 w-48 bg-slate-800 rounded"></div>
                <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-28 bg-slate-800 rounded"></div>
                <div className="flex gap-2">
                  <div className="h-10 flex-1 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
                  <div className="h-10 w-10 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Table Headers */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-850">
              <thead className="bg-slate-900/30">
                <tr>
                  <th className="px-6 py-3.5 text-left"><div className="h-3 w-16 bg-slate-800 rounded"></div></th>
                  <th className="px-6 py-3.5 text-left"><div className="h-3 w-20 bg-slate-800 rounded"></div></th>
                  <th className="px-6 py-3.5 text-left"><div className="h-3 w-24 bg-slate-800 rounded"></div></th>
                  <th className="px-6 py-3.5 text-left"><div className="h-3 w-28 bg-slate-800 rounded"></div></th>
                  <th className="px-6 py-3.5 text-right"><div className="h-3 w-20 bg-slate-800 rounded ml-auto"></div></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-20 bg-slate-800 rounded"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-36 bg-slate-800 rounded"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-4 w-24 bg-slate-800 rounded"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="h-5 w-16 bg-slate-800 rounded-md"></div></td>
                    <td className="px-6 py-4 whitespace-nowrap text-right"><div className="h-4 w-28 bg-slate-800 rounded ml-auto"></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'settlements-table') {
    return (
      <div className={`w-full space-y-6 animate-pulse ${className}`}>
        {/* Top Header Row (Back Button Placeholder) */}
        <div className="flex justify-between items-center">
          <div className="h-9 w-20 bg-slate-800 rounded-lg"></div>
        </div>

        {/* Main Card Container */}
        <div className="bg-slate-900/20 border border-slate-850 rounded-2xl overflow-hidden">
          {/* Heading & Top Buttons Section */}
          <div className="px-6 py-5 border-b border-slate-850 bg-slate-900/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 bg-slate-800 rounded shrink-0"></div>
                <div className="h-5 w-72 bg-slate-800 rounded"></div>
              </div>
              <div className="h-3 w-96 bg-slate-800/60 rounded"></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-20 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
              <div className="h-9 w-20 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
            </div>
          </div>

          {/* Filter Bar Card inside */}
          <div className="p-6 border-b border-slate-850">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <div className="h-3 w-24 bg-slate-800 rounded"></div>
                <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-24 bg-slate-800 rounded"></div>
                <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-24 bg-slate-800 rounded"></div>
                <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
              </div>
              <div className="space-y-2">
                <div className="h-10 w-full bg-slate-900/20 border border-slate-850 rounded-lg"></div>
              </div>
            </div>
          </div>

          {/* Table Headers */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-850">
              <thead className="bg-slate-900/30">
                <tr>
                  <th className="px-6 py-3.5 text-left"><div className="h-3 w-24 bg-slate-800 rounded"></div></th>
                  <th className="px-6 py-3.5 text-left"><div className="h-3 w-28 bg-slate-800 rounded"></div></th>
                  <th className="px-6 py-3.5 text-left"><div className="h-3 w-28 bg-slate-800 rounded"></div></th>
                  <th className="px-6 py-3.5 text-left"><div className="h-3 w-16 bg-slate-800 rounded"></div></th>
                  <th className="px-6 py-3.5 text-right"><div className="h-3 w-14 bg-slate-800 rounded ml-auto"></div></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 w-28 bg-slate-800 rounded"></div>
                      <div className="h-3 w-16 bg-slate-805/60 rounded mt-1.5"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 w-12 bg-slate-800 rounded"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-7 w-28 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-5 w-16 bg-slate-850 rounded-full"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right flex justify-end gap-2 mt-2">
                      <div className="h-8 w-8 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
                      <div className="h-8 w-8 bg-slate-900/20 border border-slate-850 rounded-lg"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={`flex flex-col gap-3 w-full animate-pulse ${className}`}>
        {Array.from({ length: rows }).map((_, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-4 bg-slate-900/20 border border-slate-850/60 rounded-xl"
          >
            <div className="flex items-center gap-3 flex-1">
              <div className="h-4 w-4 bg-slate-800 rounded"></div>
              <div className="h-4 w-2/3 bg-slate-800 rounded"></div>
            </div>
            <div className="h-4 w-16 bg-slate-800 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  // Default: generic table
  return (
    <div className={`w-full flex flex-col gap-4 animate-pulse ${className}`}>
      <div className="overflow-hidden border border-slate-850 bg-slate-900/20 rounded-2xl">
        <div className="px-6 py-4 border-b border-slate-850/80 bg-slate-900/40 flex justify-between items-center gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="h-4 w-28 bg-slate-800 rounded"></div>
            <div className="h-3 w-16 bg-slate-800 rounded"></div>
          </div>
          <div className="h-8 w-24 bg-slate-800 rounded-lg"></div>
        </div>
        <div className="divide-y divide-slate-850">
          {Array.from({ length: rows }).map((_, idx) => (
            <div key={idx} className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="h-4 w-20 bg-slate-800 rounded"></div>
              <div className="h-4 w-24 bg-slate-800 rounded"></div>
              <div className="h-4 w-12 bg-slate-800 rounded"></div>
              <div className="h-4 w-28 bg-slate-800 rounded"></div>
              <div className="h-4 w-16 bg-slate-800 rounded"></div>
              <div className="h-4 w-8 bg-slate-800 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
