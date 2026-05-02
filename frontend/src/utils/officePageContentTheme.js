/**
 * UI contenuto pagina Office: tema chiaro (fullscreen) vs dark (dentro Hub tecnico embedded).
 */

const H_INP =
  'w-full rounded-md border border-white/14 bg-black/35 px-3 py-2 text-sm text-white outline-none placeholder:text-white/38 focus:border-[color:var(--hub-accent-border)] focus:ring-1 focus:ring-[color:var(--hub-accent)]';
const L_INP =
  'w-full border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500';

export function getOfficeContentTheme(embedded) {
  if (!embedded) {
    return {
      embed: false,
      loadSpin: 'animate-spin text-blue-600 mx-auto mb-4',
      loadTxt: 'text-gray-600',
      errBoxOuter: 'max-w-2xl mx-auto mt-8',
      errBoxInner: 'bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3',
      errIcon: 'text-red-600 shrink-0 mt-0.5',
      errTitle: 'font-semibold text-red-800 mb-1',
      errMsg: 'text-red-700',
      rowBanner:
        'mb-4 bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3',
      textSingle: 'text-sm text-gray-700',
      hSmBold: 'text-sm font-medium text-gray-900',
      textMutedXs: 'text-xs text-gray-500',
      btnGhostNav:
        'inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors',
      btnGhostSm:
        'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors whitespace-nowrap disabled:opacity-50',
      btnGhostMd:
        'px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors',
      btnGhostWFit:
        'w-fit px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200 transition-colors',
      panelWhite: 'mb-4 bg-white border border-gray-200 rounded-lg p-4',
      panelHeading: 'text-sm font-semibold text-gray-900 mb-3',
      inp: L_INP,
      btnRedGhost:
        'px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50',
      btnDelDanger:
        'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50',
      panelLoading: 'bg-white border border-gray-200 rounded-lg p-6 text-center',
      spinSm: 'animate-spin text-blue-600 mx-auto mb-2',
      msgLoadingSm: 'text-sm text-gray-600',
      errStrip: 'bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700',
      emptyBox: 'bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-500 italic',
      /** @param {boolean} drag */
      listCardDrag: (drag) =>
        `bg-white border rounded-lg p-4 transition-colors ${
          drag ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
        }`,
      titleLink: 'text-sm font-semibold text-gray-900',
      descLink: 'text-xs text-gray-600',
      lblLinkRow: 'text-xs text-gray-700 truncate',
      linkOpenPill:
        'shrink-0 px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors',
      dragBadge:
        'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded',
      inlineErr: 'rounded-lg border border-gray-200 bg-white p-6 text-center shadow-md',
      inlineEmptyMsg: 'text-sm italic text-gray-500',
      pwdChip: 'font-mono text-gray-800 bg-gray-50 px-2 py-0.5 rounded text-xs',
      eyeBtn: 'p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded',
      readNote: 'text-xs text-gray-700 truncate',
      ticketFootText: 'text-xs text-gray-600 truncate min-w-0 flex-1',

      /** @param {boolean} exp */
      fileCardOuter: (exp) =>
        `break-inside-avoid mb-4 rounded-lg shadow-sm border-2 px-4 py-3 transition-colors bg-white ${
          exp ? 'border-red-500 bg-red-50' : 'border-gray-200'
        }`,
      borderBHdr: 'mb-2 pb-2 border-b border-gray-200',
      fileTitle: 'text-base font-bold text-gray-900 truncate',
      labelUpperSm: 'text-[10px] font-medium text-gray-500 uppercase tracking-wide shrink-0',
      valMonoXs: 'text-xs text-gray-900 font-mono',
      valXs: 'text-xs text-gray-900',
      hAttivo: 'text-xs font-semibold text-gray-500 mb-1',
      pMutedItalicXs: 'text-xs text-gray-500 italic',
      pBodySm: 'text-sm text-gray-900',
      pMutedSmItalic: 'text-sm text-gray-400 italic',
      /** @param {boolean} exp */
      rowBorderT: (exp) => `pt-2 border-t ${exp ? 'border-red-300' : 'border-gray-200'}`,
      calendarIcon: (exp) => (exp ? 'text-red-600' : 'text-gray-600'),
      expLabelXs: 'text-xs text-gray-500',
      expDateStrong: (exp) =>
        exp ? 'text-xs font-medium text-red-700' : 'text-xs font-medium text-gray-900',
      /** @param {boolean} exp */
      noteInput: (exp) =>
        `flex-1 min-w-0 text-xs border rounded px-2 py-1 outline-none focus:ring-1 ${
          exp
            ? 'border-red-300 focus:ring-red-400 bg-red-50'
            : 'border-gray-300 focus:ring-blue-400'
        }`,
      footerTicketRow: 'mt-3 pt-3 border-t border-gray-200 flex items-center justify-between gap-3 flex-nowrap'
    };
  }

  return {
    embed: true,
    loadSpin: 'animate-spin text-[color:var(--hub-accent)] mx-auto mb-4',
    loadTxt: 'text-white/60',
    errBoxOuter: 'max-w-2xl mx-auto mt-8',
    errBoxInner: 'rounded-xl border border-red-500/35 bg-red-950/45 p-4 flex items-start gap-3',
    errIcon: 'text-red-400 shrink-0 mt-0.5',
    errTitle: 'font-semibold text-red-200 mb-1',
    errMsg: 'text-red-100',
    rowBanner:
      'mb-4 flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#1E1E1E] px-4 py-3',
    textSingle: 'text-sm text-white/88',
    hSmBold: 'text-sm font-medium text-white/92',
    textMutedXs: 'text-xs text-white/52',
    btnGhostNav:
      'inline-flex items-center gap-1 rounded-lg border border-white/14 bg-black/35 px-3 py-1.5 text-xs font-medium text-white/88 hover:bg-white/[0.08] transition-colors',
    btnGhostSm:
      'inline-flex items-center gap-1 rounded-md border border-white/14 bg-black/35 px-2 py-1 text-xs font-medium text-white/82 hover:bg-white/[0.08] transition-colors whitespace-nowrap disabled:opacity-50',
    btnGhostMd:
      'rounded-lg border border-white/14 bg-black/35 px-3 py-1.5 text-xs font-medium text-white/88 hover:bg-white/[0.08] transition-colors',
    btnGhostWFit:
      'w-fit rounded-lg border border-white/14 bg-black/35 px-3 py-1.5 text-xs font-medium text-white/85 hover:bg-white/[0.08] transition-colors',
    panelWhite: 'mb-4 rounded-xl border border-white/[0.08] bg-[#1E1E1E] p-4',
    panelHeading: 'text-sm font-semibold text-white mb-3',
    inp: H_INP,
    btnRedGhost:
      'rounded-md px-3 py-1.5 text-xs font-medium text-red-200 bg-red-950/50 border border-red-500/40 hover:bg-red-950/65 transition-colors disabled:opacity-50',
    btnDelDanger:
      'inline-flex items-center gap-1 rounded-md border border-red-500/45 bg-red-950/50 px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-950/65 transition-colors disabled:opacity-50',
    panelLoading: 'rounded-xl border border-white/[0.08] bg-[#1E1E1E] p-6 text-center',
    spinSm: 'animate-spin text-[color:var(--hub-accent)] mx-auto mb-2',
    msgLoadingSm: 'text-sm text-white/60',
    errStrip: 'rounded-lg border border-red-500/35 bg-red-950/45 p-3 text-sm text-red-100',
    emptyBox: 'rounded-xl border border-white/[0.08] bg-[#1E1E1E] p-6 text-sm text-white/45 italic',
    listCardDrag: (drag) =>
      `rounded-xl border p-4 transition-colors bg-[#1E1E1E] ${
        drag ? 'border-[color:var(--hub-accent)] bg-[color:var(--hub-accent)]/12' : 'border-white/[0.1]'
      }`,
    titleLink: 'text-sm font-semibold text-white',
    descLink: 'text-xs text-white/55',
    lblLinkRow: 'text-xs text-white/72 truncate',
    linkOpenPill:
      'shrink-0 rounded-md border border-sky-500/35 bg-sky-950/40 px-2 py-1 text-[11px] font-medium text-sky-200 hover:bg-sky-500/15 transition-colors',
    dragBadge:
      'inline-flex items-center gap-1 rounded-md border border-white/12 bg-black/35 px-2 py-1 text-xs font-medium text-white/50',
    inlineErr: 'rounded-xl border border-white/[0.08] bg-[#1E1E1E] p-6 text-center',
    inlineEmptyMsg: 'text-sm text-white/45 italic',
    pwdChip: 'font-mono rounded bg-white/[0.1] px-2 py-0.5 text-xs text-white/92',
    eyeBtn: 'rounded p-1 text-white/45 hover:bg-white/[0.08] hover:text-white',
    readNote: 'text-xs text-white/70 truncate',
    ticketFootText: 'text-xs text-white/58 truncate min-w-0 flex-1',

    fileCardOuter: (exp) =>
      exp
        ? 'break-inside-avoid mb-4 rounded-xl border-2 border-red-500/65 bg-red-950/35 px-4 py-3 shadow-none'
        : 'break-inside-avoid mb-4 rounded-xl border-2 border-white/[0.12] bg-[#1E1E1E] px-4 py-3 shadow-none',
    borderBHdr: 'mb-2 border-b border-white/[0.08] pb-2',
    fileTitle: 'truncate text-base font-bold text-white',
    labelUpperSm: 'shrink-0 text-[10px] font-medium uppercase tracking-wide text-white/42',
    valMonoXs: 'font-mono text-xs text-white/92',
    valXs: 'text-xs text-white/90',
    hAttivo: 'mb-1 text-xs font-semibold text-white/55',
    pMutedItalicXs: 'text-xs italic text-white/45',
    pBodySm: 'text-sm text-white/88',
    pMutedSmItalic: 'text-sm italic text-white/42',
    rowBorderT: (exp) =>
      exp ? 'border-t border-red-500/40 pt-2' : 'border-t border-white/[0.08] pt-2',
    calendarIcon: (exp) => (exp ? 'text-red-400' : 'text-white/55'),
    expLabelXs: 'text-xs text-white/52',
    expDateStrong: (exp) =>
      exp ? 'text-xs font-medium text-red-300' : 'text-xs font-medium text-white',
    noteInput: (exp) =>
      exp
        ? 'flex-1 min-w-0 rounded border border-red-500/45 bg-red-950/35 px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-red-400 placeholder:text-white/38'
        : 'flex-1 min-w-0 rounded border border-white/14 bg-black/35 px-2 py-1 text-xs text-white outline-none focus:border-[color:var(--hub-accent-border)] focus:ring-1 focus:ring-[color:var(--hub-accent)] placeholder:text-white/35',
    footerTicketRow:
      'mt-3 flex flex-nowrap items-center justify-between gap-3 border-t border-white/[0.08] pt-3'
  };
}
