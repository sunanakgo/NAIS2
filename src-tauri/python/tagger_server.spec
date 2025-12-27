"""
PyInstaller spec file for NAIS2 Tagger Server Sidecar (Lightweight)

Build command:
    pyinstaller tagger_server.spec --clean --noconfirm

This creates a lightweight EXE that includes:
- WD14 Tagger (ONNX Runtime CPU-only)
- FastAPI server with uvicorn

Background removal is handled via cloud API (Hugging Face) instead.
"""

# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_data_files

block_cipher = None

# Collect ONNX runtime data files only
datas = []
datas += collect_data_files('onnxruntime')
datas += collect_data_files('rembg')

# Hidden imports for dynamic loading (minimal set)
hiddenimports = [
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'onnxruntime',
    'pandas',
    'PIL',
    'numpy',
    'huggingface_hub',
    'rembg',
    'scipy',
    'skimage',
    'filetype',
]

# Exclude heavy libraries that we don't need (rembg, torch, etc.)
excludes = [
    'torch',
    'torchvision', 
    'torchaudio',
    # 'rembg', 
    # 'scipy',
    # 'scikit-learn',
    # 'sklearn',
    'matplotlib',
    # 'cv2',
    # 'opencv-python',
    'transformers',
    'tensorflow',
    'keras',
    'librosa',
    'soundfile',
    'onnxruntime_providers_cuda',
    'onnxruntime_providers_tensorrt',
]

a = Analysis(
    ['tagger_server.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='tagger-server-x86_64-pc-windows-msvc',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # Hide console window - run in background
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='../icons/icon.ico',  # Use NAIS icon
)
