import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Mic, Volume2, AlertCircle, Sparkles } from 'lucide-react';

const VivaldiQuickCreateModal = ({
    show,
    onClose,
    onCreate,
    speakers,
    loading
}) => {
    const [form, setForm] = useState({
        contenuto: '',
        speaker: 'Giulia',
        priorita: 'Media'
    });

    if (!show) return null;

    const handleSubmit = () => {
        if (!form.contenuto.trim()) return;
        onCreate({
            ...form,
            velocita: 1.0,
            tono: 1.0,
            tipo: 'testuale'
        });
        setForm({ ...form, contenuto: '' });
        onClose();
    };

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-end sm:items-center justify-center z-[9999] animate-fade-in">
            <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden animate-slideUp sm:animate-slideIn relative">

                {/* Decorative Header Background */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-blue-600 to-purple-600 opacity-10 pointer-events-none"></div>

                {/* Header */}
                <div className="p-5 flex items-center justify-between relative z-10">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <Sparkles className="text-blue-600" size={20} />
                            Nuovo Annuncio
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">Creazione rapida</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 pt-0 space-y-5 relative z-10">

                    {/* Text Area */}
                    <div className="space-y-2">
                        <textarea
                            value={form.contenuto}
                            onChange={(e) => setForm({ ...form, contenuto: e.target.value })}
                            placeholder="Cosa vuoi annunciare?"
                            className="w-full h-32 p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none text-slate-800 placeholder-slate-400 text-lg leading-relaxed shadow-inner"
                            autoFocus
                        />
                    </div>

                    {/* Options Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <Volume2 size={12} /> Speaker
                            </label>
                            <select
                                value={form.speaker}
                                onChange={(e) => setForm({ ...form, speaker: e.target.value })}
                                className="w-full p-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none"
                            >
                                {speakers.map(s => (
                                    <option key={s.id || s.name} value={s.name || s}>
                                        {s.name || s} {s.isPlus ? '⭐' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <AlertCircle size={12} /> Priorità
                            </label>
                            <select
                                value={form.priorita}
                                onChange={(e) => setForm({ ...form, priorita: e.target.value })}
                                className="w-full p-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none"
                            >
                                <option value="Bassa">Bassa</option>
                                <option value="Media">Media</option>
                                <option value="Alta">Alta</option>
                                <option value="Urgente">Urgente</option>
                            </select>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !form.contenuto.trim()}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></span>
                        ) : (
                            <>
                                <Send size={20} />
                                Pubblica Ora
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default VivaldiQuickCreateModal;
