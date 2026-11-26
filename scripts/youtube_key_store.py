"""Store the browser preview's YouTube key with Windows user-level DPAPI."""

import ctypes
from ctypes import wintypes
import os
from pathlib import Path
import re
from tempfile import NamedTemporaryFile


MAX_BLOB = 8192
CRYPTPROTECT_UI_FORBIDDEN = 1


class DataBlob(ctypes.Structure):
    _fields_ = [("size", wintypes.DWORD), ("data", ctypes.c_void_p)]


def key_path():
    local = os.environ.get("LOCALAPPDATA")
    if os.name == "nt" and local and Path(local).is_absolute():
        return Path(local) / "SmartBot" / "youtube-api-key.dpapi"
    return None


def valid_key(value):
    return re.fullmatch(r"[A-Za-z0-9_-]{20,128}", value) is not None


def protect_data(data, encrypt):
    crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    transform = crypt32.CryptProtectData if encrypt else crypt32.CryptUnprotectData
    blob_pointer = ctypes.POINTER(DataBlob)
    # Both functions accept NULL for their optional description argument.
    transform.argtypes = [
        blob_pointer, ctypes.c_void_p, blob_pointer, ctypes.c_void_p,
        ctypes.c_void_p, wintypes.DWORD, blob_pointer,
    ]
    transform.restype = wintypes.BOOL
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p
    source = ctypes.create_string_buffer(data)
    source_blob = DataBlob(len(data), ctypes.addressof(source))
    output = DataBlob()

    try:
        if not transform(ctypes.byref(source_blob), None, None, None, None,
                         CRYPTPROTECT_UI_FORBIDDEN, ctypes.byref(output)):
            raise ctypes.WinError(ctypes.get_last_error())
        return ctypes.string_at(output.data, output.size)
    finally:
        ctypes.memset(source_blob.data, 0, source_blob.size)
        if output.data:
            ctypes.memset(output.data, 0, output.size)
            kernel32.LocalFree(output.data)


def load_key():
    path = key_path()
    if path is None:
        return ""
    try:
        with path.open("rb") as file:
            blob = file.read(MAX_BLOB + 1)
        if 0 < len(blob) <= MAX_BLOB:
            key = protect_data(blob, encrypt=False).decode("ascii")
            if valid_key(key):
                return key
    except (OSError, UnicodeDecodeError):
        pass
    return ""


def save_key(path, key):
    if not key:
        path.unlink(missing_ok=True)
        return

    blob = protect_data(key.encode("ascii"), encrypt=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile(dir=path.parent, prefix=".youtube-api-key-", delete=False) as file:
        temp = Path(file.name)
        try:
            file.write(blob)
            file.close()
            temp.replace(path)
        finally:
            file.close()
            temp.unlink(missing_ok=True)
