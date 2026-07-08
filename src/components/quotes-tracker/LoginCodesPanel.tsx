"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/utils/supabase";
import { LoginCode } from "@/types";
import {
  Search,
  X,
  Copy,
  Check,
  Plus,
  Trash2,
  Edit,
  Key,
  User,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const DEFAULT_LOGIN_CODES: LoginCode[] = [
  { login_id: "SR616", code: "i", name: "Rifat boss" },
  { login_id: "Santu", code: "d", name: null },
  { login_id: "Razib", code: "h", name: null },
  { login_id: "Mithun", code: "t", name: null },
  { login_id: "SM1119", code: "L", name: "Soikot Mollik" },
  { login_id: "MD1019", code: "t", name: null },
  { login_id: "Riyad", code: "y", name: null },
  { login_id: "JH", code: "v", name: null },
  { login_id: "Ramin", code: "b", name: null },
  { login_id: "AR619", code: "v/y", name: null },
  { login_id: "SD919", code: "d", name: null },
  { login_id: "SE419", code: "e", name: "Sanjid Shanjid" },
  { login_id: "FI", code: "k", name: null },
  { login_id: "To720", code: "o", name: null },
  { login_id: "Aziz", code: "y", name: null },
  { login_id: "Juel", code: "m / w", name: null },
  { login_id: "MF720", code: "f", name: null },
  { login_id: "Rifat/Shohan", code: "i, e, s,", name: null },
  { login_id: "MH122", code: "h", name: null },
  { login_id: "MR720", code: "r", name: null },
  { login_id: "NS720", code: "s", name: null },
  { login_id: "MK820", code: "k", name: null },
  { login_id: "YK920", code: "k", name: null },
  { login_id: "KB222", code: "b", name: null },
  { login_id: "AH222", code: "h", name: null },
  { login_id: "MN822", code: "n", name: null },
  { login_id: "JC723", code: "c", name: null },
  { login_id: "PD720", code: "d", name: null },
  { login_id: "HD1022", code: "d", name: null },
  { login_id: "SM1022", code: "m", name: null },
  { login_id: "NZ720", code: "z", name: null },
  { login_id: "YZ123", code: "Z", name: null },
  { login_id: "RA123", code: "A", name: null },
  { login_id: "NC723", code: "c", name: null },
  { login_id: "SC723", code: "s", name: null },
  { login_id: "MD823", code: "d", name: null },
  { login_id: "PN 1223", code: "n", name: null },
  { login_id: "OD1221", code: "o", name: null },
  { login_id: "SD1221", code: "U", name: null },
  { login_id: "NE1123", code: "e", name: null },
  { login_id: "JT1123", code: "t", name: null },
  { login_id: "RC1123", code: "c", name: null },
  { login_id: "IC1123", code: "i", name: null },
  { login_id: "AN1223", code: "n", name: null },
  { login_id: "SI1223", code: "i", name: null },
  { login_id: "BD0124", code: "d", name: null },
  { login_id: "HM0224", code: "m", name: "Md Habib Ullah Meheraz" },
  { login_id: "RS0224", code: "s", name: "Rubayet Hossen Sifat" },
  { login_id: "AP0124", code: "p", name: "A.H provat" },
  { login_id: "SU0224", code: "u", name: "Md Sharif Uddin" },
  { login_id: "TM0224", code: "m", name: "Tahsin Habib Mahin" },
  { login_id: "RI224", code: "i", name: "Rakibul Islam" },
  { login_id: "AA1223", code: "a", name: "Asraful Arfin" },
  { login_id: "RU0224", code: "r", name: "Rasel Uddin" },
  { login_id: "RAA324", code: "a", name: "Ramjan Ali Arif" },
  { login_id: "SA424", code: "a", name: "Shamim Ahmed Asadulllah" },
  { login_id: "SH1024", code: "h", name: "Shahed Hossain" },
  { login_id: "MI924", code: "i", name: "Mominul Islam" },
  { login_id: "RT623", code: "T", name: "Rehunuma Akhter tanz" },
  { login_id: "ST425", code: "t", name: "Sabbir Alam Tuhin" },
  { login_id: "KAMRUL", code: "k", name: "Kamrul Islam – IT" },
  { login_id: "KK525", code: "k", name: "Kapil Karmakar" },
  { login_id: "AAN425", code: "N", name: "Md Ali Akbor Hossain Newton" },
  { login_id: "OS525", code: "S", name: "Md Omar Faruque Sunny" },
];

interface LoginCodesPanelProps {
  canEdit: boolean;
  isOnline: boolean;
  showToast: (type: "success" | "error", text: string) => void;
}

export const LoginCodesPanel: React.FC<LoginCodesPanelProps> = ({
  canEdit,
  isOnline,
  showToast,
}) => {
  const [loginCodes, setLoginCodes] = useState<LoginCode[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);

  // Form Dialog States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formLoginId, setFormLoginId] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [itemToDelete, setItemToDelete] = useState<LoginCode | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    codeItem: LoginCode;
  } | null>(null);

  const contextMenuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch from database or fallback to localStorage / DEFAULT_LOGIN_CODES
  const fetchLoginCodes = useCallback(async () => {
    setLoading(true);
    const delayPromise = new Promise((resolve) => setTimeout(resolve, 450));
    try {
      const dbPromise = supabase
        .from("login_codes")
        .select("*")
        .order("login_id", { ascending: true });

      const [dbResult] = await Promise.all([dbPromise, delayPromise]);
      const { data, error } = dbResult;

      if (error) throw error;
      if (data && data.length > 0) {
        const filtered = data.filter((item: any) => item.login_id !== "__asitis_causality_template__");
        setLoginCodes(filtered);
      } else {
        setLoginCodes(DEFAULT_LOGIN_CODES);
      }
    } catch (err) {
      console.warn(
        "Could not load login codes from database, falling back to local list:",
        err,
      );
      const stored = localStorage.getItem("local_login_codes");
      if (stored) {
        setLoginCodes(JSON.parse(stored));
      } else {
        setLoginCodes(DEFAULT_LOGIN_CODES);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoginCodes();
  }, [fetchLoginCodes]);

  // Handle outside click to close context menu
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (contextMenu) {
          setContextMenu(null);
        } else if (isFormOpen) {
          setIsFormOpen(false);
        } else if (itemToDelete) {
          setItemToDelete(null);
        }
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isFormOpen, itemToDelete, contextMenu]);

  // Save / Update Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLoginId.trim() || !formCode.trim()) {
      showToast("error", "Login ID and Code are required.");
      return;
    }

    const payload = {
      login_id: formLoginId.trim(),
      code: formCode.trim(),
      name: formName.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let savedInDB = false;
    try {
      const { error } = await supabase.from("login_codes").upsert(payload);

      if (!error) {
        savedInDB = true;
      } else {
        throw error;
      }
    } catch (err) {
      console.error(
        "Failed to save login code to database, saving locally:",
        err,
      );
    }

    setLoginCodes((prev) => {
      let next;
      if (isEditing) {
        next = prev.map((item) =>
          item.login_id === payload.login_id ? payload : item,
        );
      } else {
        next = [
          ...prev.filter((item) => item.login_id !== payload.login_id),
          payload,
        ];
      }
      next.sort((a, b) => a.login_id.localeCompare(b.login_id));
      localStorage.setItem("local_login_codes", JSON.stringify(next));
      return next;
    });

    if (savedInDB) {
      showToast("success", "Login code saved to database.");
    } else {
      showToast("success", "Saved locally (DB table not configured).");
    }

    setIsFormOpen(false);
    setContextMenu(null);
  };

  // Delete Handler
  const handleDelete = async () => {
    if (!itemToDelete) return;

    let deletedInDB = false;
    try {
      const { error } = await supabase
        .from("login_codes")
        .delete()
        .eq("login_id", itemToDelete.login_id);

      if (!error) {
        deletedInDB = true;
      } else {
        throw error;
      }
    } catch (err) {
      console.error("Failed to delete from database, deleting locally:", err);
    }

    setLoginCodes((prev) => {
      const next = prev.filter(
        (item) => item.login_id !== itemToDelete.login_id,
      );
      localStorage.setItem("local_login_codes", JSON.stringify(next));
      return next;
    });

    if (deletedInDB) {
      showToast("success", "Login code deleted from database.");
    } else {
      showToast("success", "Deleted locally (DB table not configured).");
    }

    setItemToDelete(null);
    setContextMenu(null);
  };

  // Open Form for Adding
  const openAdd = () => {
    setIsEditing(false);
    setFormLoginId("");
    setFormCode("");
    setFormName("");
    setIsFormOpen(true);
  };

  // Open Form for Editing
  const openEdit = (item: LoginCode) => {
    setIsEditing(true);
    setFormLoginId(item.login_id);
    setFormCode(item.code);
    setFormName(item.name || "");
    setIsFormOpen(true);
    setContextMenu(null);
  };

  // Copy code utility
  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Right Click Trigger
  const handleContextMenuTrigger = (e: React.MouseEvent, item: LoginCode) => {
    if (!canEdit) return;
    e.preventDefault();
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const menuWidth = 144;
      const menuHeight = 80;
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const x = Math.min(clickX, rect.width - menuWidth - 8);
      const y = Math.min(clickY, rect.height - menuHeight - 8);
      setContextMenu({ x, y, codeItem: item });
    }
  };

  // Reset page when filtering
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Filtering
  const filteredCodes = loginCodes.filter(
    (item) =>
      item.login_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.name &&
        item.name.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  // Pagination calculations
  const totalPages = Math.ceil(filteredCodes.length / itemsPerPage);
  const startIndex =
    filteredCodes.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, filteredCodes.length);
  const paginatedCodes = filteredCodes.slice(
    (currentPage - 1) * itemsPerPage,
    (currentPage - 1) * itemsPerPage + itemsPerPage,
  );

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const renderPageNumbers = () => {
    const pageNumbers = [];
    const maxVisible = 5;

    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pageNumbers.push(
        <button
          key={i}
          onClick={() => setCurrentPage(i)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
            currentPage === i
              ? "bg-linear-to-r from-purple-600 to-indigo-600 border-purple-500 text-white shadow-md shadow-purple-900/30"
              : "border-slate-800 bg-slate-900/40 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          {i}
        </button>,
      );
    }
    return pageNumbers;
  };

  return (
    <div
      ref={containerRef}
      className="bg-slate-955/20 border border-slate-850 rounded-2xl p-5 space-y-6 relative flex flex-col min-h-[60vh] overflow-hidden"
      style={{
        fontFamily: "'Noto Sans Bengali', 'Hind Siliguri', 'Inter', sans-serif",
      }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b border-slate-900 gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-md font-bold text-white">
              Login Codes Directory
            </h3>
            <p className="text-[11px] text-slate-450 mt-0.5">
              Copy user codes or manage logins
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-slate-900/40 border border-slate-850/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search user login ID or name..."
            className="w-full bg-slate-955 border border-slate-850 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 rounded-xl py-2 pl-10 pr-4 text-xs placeholder-slate-600 transition-all duration-250 outline-none text-white animate-fade-in"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {canEdit && (
          <button
            onClick={openAdd}
            className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-linear-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 shadow-md shadow-purple-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-955"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Code
          </button>
        )}
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/10 border border-slate-900/40 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-800/40" />
                  <div className="flex flex-col gap-1.5">
                    <div className="w-16 h-3.5 bg-slate-800/50 rounded-md" />
                    <div className="w-24 h-2 bg-slate-800/25 rounded" />
                  </div>
                </div>
                <div className="w-16 h-7 bg-slate-850/40 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredCodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-500">
            <AlertCircle className="h-8 w-8 text-slate-700" />
            <span className="text-xs font-medium">
              No login codes match your search.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 animate-fade-in">
            {paginatedCodes.map((item) => (
              <div
                key={item.login_id}
                onContextMenu={(e) => handleContextMenuTrigger(e, item)}
                className="group flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/30 hover:bg-slate-900/60 border border-slate-900/60 hover:border-slate-800/80 transition-all duration-200 select-none relative overflow-hidden"
                title={
                  canEdit
                    ? "Right-click to Edit or Delete"
                    : "Hover to copy code"
                }
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-800/40 border border-slate-800/60 text-slate-400 group-hover:text-blue-400 group-hover:bg-blue-500/5 group-hover:border-blue-500/10 transition-all duration-300">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors duration-200">
                      {item.login_id}
                    </span>
                    {item.name ? (
                      <span className="text-[10px] text-slate-450 mt-0.5 max-w-[180px] truncate">
                        {item.name}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-600 italic mt-0.5">
                        Unnamed user
                      </span>
                    )}
                  </div>
                </div>

                {/* Copy code interactive container */}
                <div
                  onClick={() => handleCopy(item.code, item.login_id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-850 hover:border-blue-500/35 hover:bg-blue-600/5 text-slate-355 hover:text-white transition-all duration-200 cursor-pointer text-xs font-semibold group/btn"
                >
                  <span className="font-mono tracking-wider text-slate-300 group-hover/btn:text-blue-400">
                    {item.code}
                  </span>
                  <span className="text-[9px] text-slate-500 font-normal border-l border-slate-800 pl-1.5 group-hover/btn:text-blue-500 transition-colors">
                    {copiedId === item.login_id ? (
                      <Check className="h-3 w-3 text-emerald-500 animate-scale-up" />
                    ) : (
                      <Copy className="h-3 w-3 opacity-60 group-hover/btn:opacity-100 transition-opacity" />
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {filteredCodes.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 bg-slate-900/35 border border-slate-850/60 rounded-2xl text-xs font-semibold select-none">
          <div className="text-slate-400 font-medium">
            Showing{" "}
            <span className="font-semibold text-slate-200">{startIndex}</span>{" "}
            to <span className="font-semibold text-slate-200">{endIndex}</span>{" "}
            of{" "}
            <span className="font-semibold text-slate-200">
              {filteredCodes.length}
            </span>{" "}
            entries
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Show per page selector dropdown */}
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-950 border border-slate-850 text-slate-200 rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs cursor-pointer hover:bg-slate-900"
              >
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>entries</span>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                {/* First Page */}
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-slate-800 bg-slate-900/40 hover:bg-slate-800 hover:text-white text-slate-400 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="First Page"
                >
                  <ChevronsLeft className="h-4.5 w-4.5" />
                </button>

                {/* Previous Page */}
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-slate-800 bg-slate-900/40 hover:bg-slate-800 hover:text-white text-slate-400 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft className="h-4.5 w-4.5" />
                </button>

                <div className="flex items-center gap-1">
                  {renderPageNumbers()}
                </div>

                {/* Next Page */}
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-slate-800 bg-slate-900/40 hover:bg-slate-800 hover:text-white text-slate-400 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight className="h-4.5 w-4.5" />
                </button>

                {/* Last Page */}
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 border border-slate-800 bg-slate-900/40 hover:bg-slate-800 hover:text-white text-slate-400 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Last Page"
                >
                  <ChevronsRight className="h-4.5 w-4.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer info/legend */}
      <div className="pt-4 border-t border-slate-900 text-[10px] text-slate-500 flex justify-between items-center z-10 select-none">
        <span>Total logins: {loginCodes.length}</span>
        {canEdit && (
          <span className="text-blue-500/80">
            💡 Tip: Right-click on any row to edit or delete it.
          </span>
        )}
      </div>

      {/* ─── ADD/EDIT OVERLAY MODAL ─── */}
      {isFormOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-40 flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl relative">
            <button
              onClick={() => setIsFormOpen(false)}
              className="absolute right-4 top-4 text-slate-450 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-1.5">
              {isEditing ? (
                <Edit className="h-4 w-4 text-blue-500" />
              ) : (
                <Plus className="h-4 w-4 text-blue-500" />
              )}
              {isEditing ? "Edit User Code" : "Add User Code"}
            </h3>
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Login ID (Codename)
                </label>
                <input
                  type="text"
                  required
                  disabled={isEditing}
                  placeholder="e.g. SR616"
                  value={formLoginId}
                  onChange={(e) => setFormLoginId(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white placeholder-slate-700 disabled:opacity-50 disabled:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. i"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white placeholder-slate-700"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rifat boss"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white placeholder-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3.5 py-2 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-lg bg-linear-to-r from-purple-600 to-indigo-650 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold cursor-pointer shadow-md shadow-purple-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-955"
                >
                  {isEditing ? "Save Changes" : "Add Code"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRM OVERLAY ─── */}
      {itemToDelete && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-45 flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-xs shadow-2xl">
            <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
              <AlertCircle className="h-4.5 w-4.5 text-red-500" />
              Delete Login Code?
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Are you sure you want to delete the login code for{" "}
              <strong className="text-white">{itemToDelete.login_id}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-3.5 py-2 rounded-lg bg-slate-850 hover:bg-slate-850/80 text-slate-300 font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold cursor-pointer transition-colors shadow-md shadow-red-950/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── FLOATING CONTEXT MENU ─── */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="absolute bg-slate-900 border border-slate-800 rounded-lg shadow-2xl py-1 w-36 z-[60] text-xs animate-fade-in"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => openEdit(contextMenu.codeItem)}
            className="w-full text-left px-3.5 py-2 hover:bg-slate-800 text-slate-200 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Edit className="h-3.5 w-3.5 text-blue-500" />
            Edit Code
          </button>
          <button
            onClick={() => {
              setItemToDelete(contextMenu.codeItem);
              setContextMenu(null);
            }}
            className="w-full text-left px-3.5 py-2 hover:bg-slate-800 text-red-400 hover:text-red-300 flex items-center gap-2 cursor-pointer border-t border-slate-800 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
            Delete Code
          </button>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent !important;
          background-color: transparent !important;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.15) !important;
          border-radius: 9999px;
          transition: background 0.2s ease;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3) !important;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.45) !important;
        }
      `,
        }}
      />
    </div>
  );
};
