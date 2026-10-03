import os
import shutil
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Body, UploadFile, File, Form
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import PromptRequest, OutfitResponse
from app.adapters.mock_adapter import get_products, APP_DIR
from app.services.recommender import extract_preferences
from app.services.matcher import build_outfit
from app.services.catvton_client import run_catvton, download_result
from app.services.similarity import find_similar_garments

app = FastAPI()

# The app fetches the catalog and images directly from the browser/device now
# (Brand Shop), not just server-to-server from the .NET backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

OUTPUT_DIR = "outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Serves catalog garment photos (e.g. /assets/garments/men/tops/15970.jpg) so
# the app can show real product images for recommendations, not just names.
app.mount("/assets", StaticFiles(directory=str(APP_DIR / "assets")), name="assets")

@app.get("/result/{filename}")
def get_result(filename: str):
    file_path = os.path.join(OUTPUT_DIR, filename)

    if not os.path.exists(file_path):
        return {
            "error": "File not found",
            "path": file_path
        }

    return FileResponse(file_path)

@app.get("/")
def home():
    return {"message": "Outfit recommender is running"}


@app.get("/catalog")
def catalog():
    # Full garment list — Brand Shop uses this so it only ever shows items
    # that are actually in our dataset and guaranteed to work with try-on,
    # instead of pulling random items from unrelated third-party sources.
    return get_products()


@app.post("/recommend-outfit")
def recommend_outfit(request: PromptRequest):
    preferences = extract_preferences(request.prompt)
    outfit = build_outfit(preferences)

    return {
        "preferences": preferences,
        "top": outfit["top"],
        "bottom": outfit["bottom"],
        "combinations": outfit["combinations"],
    }


@app.post("/find-similar-garment")
async def find_similar_garment_endpoint(
    image: UploadFile = File(...),
    category: Optional[str] = Form(None),
    gender: Optional[str] = Form(None),
    top_k: int = Form(5),
):
    image_bytes = await image.read()
    try:
        matches = find_similar_garments(image_bytes, category=category, gender=gender, top_k=top_k)
    except Exception as e:
        return {"matches": [], "error": str(e)}
    return {"matches": matches}


@app.post("/select-outfit")
def select_outfit(payload: dict = Body(...)):
    selected_outfit = payload["outfit"]
    person_image_path = payload["person_image_path"]

    top_item = selected_outfit["top"]
    cloth_image_path = top_item["image_url"]

    result = run_catvton(person_image_path, cloth_image_path)

    return {
        "message": "Sent to CatVTON",
        "result": result
    }


def _save_upload(image: UploadFile) -> str:
    path = os.path.join(UPLOAD_DIR, image.filename)
    with open(path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)
    return path


def _resolve_garment(image: Optional[UploadFile], catalog_id: Optional[str]):
    """A garment for one slot (top or bottom) can arrive as an uploaded photo
    or as a Brand Shop catalog id — resolve either into a local file path,
    or (None, error) if neither was given / the id doesn't exist."""
    if image is not None:
        return _save_upload(image), None
    if catalog_id:
        matched = next((p for p in get_products() if p["id"] == catalog_id), None)
        if not matched:
            return None, f"No product found with id {catalog_id}"
        return matched["image_url"], None
    return None, None


@app.post("/generate-recommended-tryon")
async def generate_recommended_tryon(
    prompt: str = Form(""),
    person_image: UploadFile = File(...),
    clothes_image: Optional[UploadFile] = File(None),
    top_id: Optional[str] = Form(None),
    bottom_image: Optional[UploadFile] = File(None),
    bottom_id: Optional[str] = Form(None),
    # "top" (default, preserves old behaviour) | "bottom" | "both" — CatVTON
    # only masks one body region per call, so "both" chains two passes:
    # apply the top, then apply the bottom to *that* result.
    garment_mode: str = Form("top"),
):
    try:
        print("TRYON PROMPT:", prompt, "MODE:", garment_mode)
        print("PERSON IMAGE:", person_image.filename)

        person_path = _save_upload(person_image)
        print("PERSON SAVED TO:", person_path)

        top_path, top_err = _resolve_garment(clothes_image, top_id)
        bottom_path, bottom_err = _resolve_garment(bottom_image, bottom_id)

        if garment_mode == "both":
            if top_err or bottom_err:
                return {"message": "Try-on failed", "error": top_err or bottom_err}
            if not top_path or not bottom_path:
                return {"message": "Try-on failed", "error": "Both a top and a bottom garment are required for 'both' mode."}

            print("STEP 1 (top):", top_path)
            step1 = run_catvton(person_path, top_path, cloth_type="upper")
            print("STEP 1 RESULT:", step1)
            step1_url = step1.get("result_url")
            if not step1_url:
                return {"message": "Try-on failed", "error": "First pass (top) did not return a result."}

            chained_person_path = download_result(step1_url)
            print("STEP 2 (bottom) using chained person:", chained_person_path, bottom_path)
            step2 = run_catvton(chained_person_path, bottom_path, cloth_type="lower")
            print("STEP 2 RESULT:", step2)

            return {
                "message": "Try-on generated for top + bottom",
                "prompt": prompt,
                "selected_outfit": None,
                "catvton_result": step2,
            }

        if garment_mode == "bottom":
            if top_err or bottom_err:
                return {"message": "Try-on failed", "error": top_err or bottom_err}
            # Bottom-only garment may arrive via either slot depending on
            # which picker the client used.
            cloth_path = bottom_path or top_path
            if not cloth_path:
                return {"message": "Try-on failed", "error": "A bottom garment is required."}

            result = run_catvton(person_path, cloth_path, cloth_type="lower")
            print("CATVTON RESULT:", result)

            return {
                "message": "Try-on generated for selected garment",
                "prompt": prompt,
                "selected_outfit": None,
                "catvton_result": result,
            }

        # garment_mode == "top" (default) — a specific garment was already
        # chosen on the client (own photo or a Brand Shop product image).
        if top_err:
            return {"message": "Try-on failed", "error": top_err}
        if top_path:
            result = run_catvton(person_path, top_path, cloth_type="upper")
            print("CATVTON RESULT:", result)

            return {
                "message": "Try-on generated for selected garment",
                "prompt": prompt,
                "selected_outfit": None,
                "catvton_result": result,
            }

        # No garment was chosen — fall back to recommending one from the prompt
        preferences = extract_preferences(prompt)
        print("PREFERENCES:", preferences)

        outfit = build_outfit(preferences)
        print("OUTFIT:", outfit)

        if not outfit.get("combinations"):
            return {
                "message": "No outfit combinations found",
                "prompt": prompt,
                "preferences": preferences,
                "selected_outfit": None,
                "catvton_result": None
            }

        # choose best combination
        best_outfit = outfit["combinations"][0]
        print("BEST OUTFIT:", best_outfit)

        # send best top to CatVTON
        top_item = best_outfit["top"]
        cloth_image_path = top_item["image_url"]

        print("CLOTH IMAGE PATH:", cloth_image_path)
        print("CLOTH EXISTS:", os.path.exists(cloth_image_path))
        print("PERSON EXISTS:", os.path.exists(person_path))

        result = run_catvton(person_path, cloth_image_path, cloth_type="upper")

        print("CATVTON RESULT:", result)

        return {
            "message": "Recommended try-on generated",
            "prompt": prompt,
            "preferences": preferences,
            "selected_outfit": best_outfit,
            "catvton_result": result
        }

    except Exception as e:
        print("TRYON ERROR:", str(e))
        import traceback
        traceback.print_exc()

        return {
            "message": "Try-on failed",
            "error": str(e)
        }