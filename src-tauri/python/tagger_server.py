"""
NAIS2 Tagger Server - Lightweight Version
Tag analysis using WD14 Tagger (ONNX Runtime CPU-only)
Background removal is handled via cloud API in the frontend.
"""
import os
import sys
import argparse
import uvicorn
import threading
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io
import numpy as np
import onnxruntime as ort
import pandas as pd
from huggingface_hub import hf_hub_download
from rembg import remove, new_session


# Global download status for UI display
download_status = {
    "is_downloading": False,
    "model_name": "",
    "progress": 0,
    "total": 0,
    "percent": 0,
    "message": ""
}
download_lock = threading.Lock()

def update_download_status(model_name: str, progress: int = 0, total: int = 0, message: str = ""):
    global download_status
    with download_lock:
        download_status["is_downloading"] = total > 0 and progress < total
        download_status["model_name"] = model_name
        download_status["progress"] = progress
        download_status["total"] = total
        download_status["percent"] = int((progress / total) * 100) if total > 0 else 0
        download_status["message"] = message

from contextlib import asynccontextmanager

# AppData path for model storage
APP_DATA_DIR = os.path.join(os.getenv('APPDATA'), 'NAIS', 'models')
os.makedirs(APP_DATA_DIR, exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        load_model()  # Load WD tagger model only
    except Exception as e:
        print(f"Startup error: {e}")
    yield
    # Clean up if needed

app = FastAPI(lifespan=lifespan)

# Allow CORS for local interaction
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model variables
MODEL_REPO = "SmilingWolf/wd-v1-4-convnext-tagger-v2"
MODEL_FILE = "model.onnx"
TAGS_FILE = "selected_tags.csv"
model_session = None
tags_df = None
rembg_session = None

def load_model():
    global model_session, tags_df
    print(f"Loading model from {APP_DATA_DIR}...")
    
    model_path = os.path.join(APP_DATA_DIR, MODEL_FILE)
    tags_path = os.path.join(APP_DATA_DIR, TAGS_FILE)

    # Download if missing
    if not os.path.exists(model_path) or not os.path.exists(tags_path):
        print("Model files not found. Downloading from Hugging Face...")
        update_download_status("WD Tagger", 0, 100, "Downloading WD Tagger model...")
        try:
            model_path = hf_hub_download(repo_id=MODEL_REPO, filename=MODEL_FILE, local_dir=APP_DATA_DIR)
            update_download_status("WD Tagger", 50, 100, "Downloading tags file...")
            tags_path = hf_hub_download(repo_id=MODEL_REPO, filename=TAGS_FILE, local_dir=APP_DATA_DIR)
            update_download_status("WD Tagger", 100, 100, "Download complete")
            print("Download complete.")
        except Exception as e:
            update_download_status("", 0, 0, "")
            print(f"Failed to download model: {e}")
            raise e
        finally:
            update_download_status("", 0, 0, "")

    # Load ONNX Runtime (CPU only for lightweight build)
    print("Loading ONNX model with CPU execution provider...")
    model_session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
    
    print("Loading tags...")
    tags_df = pd.read_csv(tags_path)
    
    print("Initializing rembg session...")
    global rembg_session
    rembg_session = new_session("isnet-general-use") # Default model
    print("Models loaded successfully.")

def preprocess_image(image: Image.Image, size=448):
    # Resize and pad to square
    image = image.convert('RGB')
    w, h = image.size
    
    # Resize keeping aspect ratio
    target_dim = max(w, h)
    scale = size / target_dim
    new_w, new_h = int(w * scale), int(h * scale)
    image = image.resize((new_w, new_h), Image.Resampling.BICUBIC)
    
    # Pad to square (white background)
    new_img = Image.new("RGB", (size, size), (255, 255, 255))
    new_img.paste(image, ((size - new_w) // 2, (size - new_h) // 2))
    
    # Normalize
    img_np = np.array(new_img).astype(np.float32)
    img_np = img_np[..., ::-1] # RGB to BGR
    
    return img_np

@app.post("/tag")
async def tag_image(file: UploadFile = File(...), threshold: float = 0.35):
    if model_session is None:
        return {"error": "Model not loaded"}
    
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Preprocess
        img_input = preprocess_image(image)
        img_input = np.expand_dims(img_input, axis=0) # Batch dimension
        
        # Inference
        input_name = model_session.get_inputs()[0].name
        label_name = model_session.get_outputs()[0].name
        probs = model_session.run([label_name], {input_name: img_input})[0]
        
        # Parse results
        probs = probs[0]
        result_tags = []
        
        for i, p in enumerate(probs):
            if p >= threshold:
                tag_name = tags_df.iloc[i]['name']
                category = tags_df.iloc[i]['category'] # 0: general, 4: character, 9: rating
                result_tags.append({"label": tag_name, "score": float(p), "category": int(category)})
        
        # Sort by score
        result_tags.sort(key=lambda x: x['score'], reverse=True)
        
        return {"tags": result_tags}
        
    except Exception as e:
        return {"error": str(e)}

@app.post("/rmbg")
async def remove_background(image: UploadFile = File(...)):
    """
    Remove background from image using rembg
    """
    if rembg_session is None:
        return Response(content="Model not loaded", status_code=500)
    
    try:
        contents = await image.read()
        # rembg expects bytes or PIL image
        output = remove(contents, session=rembg_session)
        
        # Return as PNG
        return Response(content=output, media_type="image/png")
    except Exception as e:
        print(f"RMBG Error: {e}")
        return Response(content=str(e), status_code=500)

@app.get("/download-status")
def get_download_status():
    """Return current download progress for UI display"""
    with download_lock:
        return download_status.copy()

@app.get("/health")
def health_check():
    return {"status": "ok", "model_loaded": model_session is not None}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8002)
    args = parser.parse_args()
    
    # Run server
    uvicorn.run(app, host="127.0.0.1", port=args.port)
