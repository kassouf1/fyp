import os  # file/path utilities (making directories, checking existence)
import shutil  # used to copy an uploaded file's bytes to disk
from pathlib import Path  # not directly used here but re-exported via APP_DIR import below
from typing import Optional  # marks request fields as "may be missing"

from fastapi import FastAPI, Body, UploadFile, File, Form  # FastAPI building blocks for routes and file/form uploads
from fastapi.responses import FileResponse  # lets an endpoint return a raw file (e.g. the generated try-on image)
from fastapi.staticfiles import StaticFiles  # serves a whole folder of files (garment photos) over HTTP
from fastapi.middleware.cors import CORSMiddleware  # allows the mobile app (a different origin) to call this API
from app.schemas import PromptRequest, OutfitResponse  # request/response data shapes (not all used directly here)
from app.adapters.mock_adapter import get_products, APP_DIR  # loads the catalog; APP_DIR = this app's root folder on disk
from app.services.recommender import extract_preferences  # turns free text into structured style/season/occasion preferences
from app.services.matcher import build_outfit  # scores the catalog and builds ranked outfit combinations
from app.services.catvton_client import run_catvton, download_result  # calls the separate CatVTON try-on service
from app.services.similarity import find_similar_garments  # CLIP-based "find a similar garment to this photo" search

app = FastAPI()  # the FastAPI application instance; every @app.get/@app.post below registers a route on it

# The app fetches the catalog and images directly from the browser/device now
# (Brand Shop), not just server-to-server from the .NET backend.
app.add_middleware(  # register CORS middleware so browser/mobile clients from any origin can call this API
    CORSMiddleware,
    allow_origins=["*"],  # accept requests from any origin
    allow_methods=["*"],  # accept any HTTP method (GET, POST, etc.)
    allow_headers=["*"],  # accept any request headers
)

UPLOAD_DIR = "uploads"  # folder where incoming user photos get saved
os.makedirs(UPLOAD_DIR, exist_ok=True)  # create it on startup if it doesn't already exist

OUTPUT_DIR = "outputs"  # folder where generated results get saved (shared with CatVTON's own output folder)
os.makedirs(OUTPUT_DIR, exist_ok=True)  # create it on startup if it doesn't already exist

# Serves catalog garment photos (e.g. /assets/garments/men/tops/15970.jpg) so
# the app can show real product images for recommendations, not just names.
app.mount("/assets", StaticFiles(directory=str(APP_DIR / "assets")), name="assets")  # expose app/assets/** at the URL path /assets/**

@app.get("/result/{filename}")  # GET /result/<filename> — fetch a previously generated result image by name
def get_result(filename: str):
    file_path = os.path.join(OUTPUT_DIR, filename)  # build the local path to that file

    if not os.path.exists(file_path):  # guard against a filename that doesn't exist
        return {
            "error": "File not found",
            "path": file_path
        }

    return FileResponse(file_path)  # stream the actual image file back as the HTTP response

@app.get("/")  # GET / — simple health-check root route
def home():
    return {"message": "Outfit recommender is running"}


@app.get("/catalog")  # GET /catalog — returns the entire garment catalog
def catalog():
    # Full garment list — Brand Shop uses this so it only ever shows items
    # that are actually in our dataset and guaranteed to work with try-on,
    # instead of pulling random items from unrelated third-party sources.
    return get_products()  # delegates to the adapter that loads/normalizes catalog.json


@app.post("/recommend-outfit")  # POST /recommend-outfit — the main text-prompt recommendation endpoint
def recommend_outfit(request: PromptRequest):
    preferences = extract_preferences(request.prompt)  # parse the free-text prompt into structured preferences
    outfit = build_outfit(preferences)  # score the catalog and build ranked top/bottom combinations

    return {  # shape of the JSON response sent back to the client
        "preferences": preferences,  # echo back what was understood from the prompt, useful for debugging/UI
        "top": outfit["top"],
        "bottom": outfit["bottom"],
        "combinations": outfit["combinations"],
    }


@app.post("/find-similar-garment")  # POST /find-similar-garment — image-based search: "find catalog items that look like this photo"
async def find_similar_garment_endpoint(
    image: UploadFile = File(...),  # the uploaded garment photo to search with
    category: Optional[str] = Form(None),  # optional filter: only match "top" or "bottom" items
    gender: Optional[str] = Form(None),  # optional filter: only match "men" or "women" items
    top_k: int = Form(5),  # how many best matches to return
):
    image_bytes = await image.read()  # read the uploaded photo into memory
    try:
        matches = find_similar_garments(image_bytes, category=category, gender=gender, top_k=top_k)  # delegate to the CLIP similarity search
    except Exception as e:  # if the embedding service (CatVTON) is unreachable or anything else goes wrong
        return {"matches": [], "error": str(e)}  # fail gracefully with an empty result instead of crashing the request
    return {"matches": matches}  # ranked list of similar catalog products


@app.post("/select-outfit")  # POST /select-outfit — older/simpler endpoint: send one chosen top straight to CatVTON
def select_outfit(payload: dict = Body(...)):
    selected_outfit = payload["outfit"]  # the outfit object chosen by the client
    person_image_path = payload["person_image_path"]  # path to the user's already-uploaded photo

    top_item = selected_outfit["top"]  # just the top half of the outfit
    cloth_image_path = top_item["image_url"]  # the garment's image file path

    result = run_catvton(person_image_path, cloth_image_path)  # call CatVTON to generate the composite image

    return {
        "message": "Sent to CatVTON",
        "result": result
    }


def _save_upload(image: UploadFile) -> str:  # helper: persist an uploaded file to disk and return its path
    path = os.path.join(UPLOAD_DIR, image.filename)  # destination path inside the uploads folder
    with open(path, "wb") as buffer:  # open the destination file for binary writing
        shutil.copyfileobj(image.file, buffer)  # stream-copy the uploaded file's bytes into it
    return path  # the saved file's local path


def _resolve_garment(image: Optional[UploadFile], catalog_id: Optional[str]):  # turns "either an uploaded photo or a catalog id" into one file path
    """A garment for one slot (top or bottom) can arrive as an uploaded photo
    or as a Brand Shop catalog id — resolve either into a local file path,
    or (None, error) if neither was given / the id doesn't exist."""
    if image is not None:  # the client uploaded their own garment photo
        return _save_upload(image), None  # save it and return its path, no error
    if catalog_id:  # the client instead picked an existing catalog product by id
        matched = next((p for p in get_products() if p["id"] == catalog_id), None)  # look it up in the catalog
        if not matched:  # the id doesn't correspond to any real product
            return None, f"No product found with id {catalog_id}"
        return matched["image_url"], None  # use that catalog product's own image file
    return None, None  # neither an upload nor an id was provided — not necessarily an error at this point


@app.post("/generate-recommended-tryon")  # POST /generate-recommended-tryon — the main try-on endpoint used by the app
async def generate_recommended_tryon(
    prompt: str = Form(""),  # optional free-text prompt, used only if no specific garment was chosen
    person_image: UploadFile = File(...),  # required: the user's own photo
    clothes_image: Optional[UploadFile] = File(None),  # optional: an uploaded top/garment photo
    top_id: Optional[str] = Form(None),  # optional: a catalog id for the top instead of an upload
    bottom_image: Optional[UploadFile] = File(None),  # optional: an uploaded bottom photo
    bottom_id: Optional[str] = Form(None),  # optional: a catalog id for the bottom instead of an upload
    # "top" (default, preserves old behaviour) | "bottom" | "both" — CatVTON
    # only masks one body region per call, so "both" chains two passes:
    # apply the top, then apply the bottom to *that* result.
    garment_mode: str = Form("top"),  # which combination of garments to actually generate
):
    try:
        print("TRYON PROMPT:", prompt, "MODE:", garment_mode)  # debug log of the incoming request
        print("PERSON IMAGE:", person_image.filename)

        person_path = _save_upload(person_image)  # persist the user's photo to disk first; every mode below needs this
        print("PERSON SAVED TO:", person_path)

        top_path, top_err = _resolve_garment(clothes_image, top_id)  # resolve the top garment to a file path (or get an error)
        bottom_path, bottom_err = _resolve_garment(bottom_image, bottom_id)  # resolve the bottom garment to a file path (or get an error)

        if garment_mode == "both":  # user wants a full outfit (top AND bottom) tried on
            if top_err or bottom_err:  # either garment failed to resolve
                return {"message": "Try-on failed", "error": top_err or bottom_err}
            if not top_path or not bottom_path:  # one of them was simply never provided
                return {"message": "Try-on failed", "error": "Both a top and a bottom garment are required for 'both' mode."}

            print("STEP 1 (top):", top_path)
            step1 = run_catvton(person_path, top_path, cloth_type="upper")  # first pass: put the top on the original person photo
            print("STEP 1 RESULT:", step1)
            step1_url = step1.get("result_url")  # URL of the first pass's result image
            if not step1_url:  # CatVTON didn't return a usable result
                return {"message": "Try-on failed", "error": "First pass (top) did not return a result."}

            chained_person_path = download_result(step1_url)  # download that result locally so it can be re-uploaded
            print("STEP 2 (bottom) using chained person:", chained_person_path, bottom_path)
            step2 = run_catvton(chained_person_path, bottom_path, cloth_type="lower")  # second pass: put the bottom on the ALREADY-topped person
            print("STEP 2 RESULT:", step2)

            return {  # final response after both chained passes
                "message": "Try-on generated for top + bottom",
                "prompt": prompt,
                "selected_outfit": None,
                "catvton_result": step2,  # the final image has both garments applied
            }

        if garment_mode == "bottom":  # user wants only a bottom garment tried on
            if top_err or bottom_err:  # surface any resolution error from either slot
                return {"message": "Try-on failed", "error": top_err or bottom_err}
            # Bottom-only garment may arrive via either slot depending on
            # which picker the client used.
            cloth_path = bottom_path or top_path  # tolerate the client sending the bottom garment in either field
            if not cloth_path:  # nothing usable was provided
                return {"message": "Try-on failed", "error": "A bottom garment is required."}

            result = run_catvton(person_path, cloth_path, cloth_type="lower")  # single pass, masking the lower body
            print("CATVTON RESULT:", result)

            return {
                "message": "Try-on generated for selected garment",
                "prompt": prompt,
                "selected_outfit": None,
                "catvton_result": result,
            }

        # garment_mode == "top" (default) — a specific garment was already
        # chosen on the client (own photo or a Brand Shop product image).
        if top_err:  # the top garment failed to resolve
            return {"message": "Try-on failed", "error": top_err}
        if top_path:  # a specific top was actually provided
            result = run_catvton(person_path, top_path, cloth_type="upper")  # single pass, masking the upper body
            print("CATVTON RESULT:", result)

            return {
                "message": "Try-on generated for selected garment",
                "prompt": prompt,
                "selected_outfit": None,
                "catvton_result": result,
            }

        # No garment was chosen — fall back to recommending one from the prompt
        preferences = extract_preferences(prompt)  # parse the text prompt since no garment was explicitly picked
        print("PREFERENCES:", preferences)

        outfit = build_outfit(preferences)  # run the full recommendation engine
        print("OUTFIT:", outfit)

        if not outfit.get("combinations"):  # the recommender found nothing suitable
            return {
                "message": "No outfit combinations found",
                "prompt": prompt,
                "preferences": preferences,
                "selected_outfit": None,
                "catvton_result": None
            }

        # choose best combination
        best_outfit = outfit["combinations"][0]  # combinations are already sorted, so index 0 is the top pick
        print("BEST OUTFIT:", best_outfit)

        # send best top to CatVTON
        top_item = best_outfit["top"]  # the top half of the chosen combination
        cloth_image_path = top_item["image_url"]  # its catalog image file

        print("CLOTH IMAGE PATH:", cloth_image_path)
        print("CLOTH EXISTS:", os.path.exists(cloth_image_path))  # sanity-check logging that the file is actually on disk
        print("PERSON EXISTS:", os.path.exists(person_path))

        result = run_catvton(person_path, cloth_image_path, cloth_type="upper")  # generate the try-on using the recommended top

        print("CATVTON RESULT:", result)

        return {  # final response when the system picked the garment itself
            "message": "Recommended try-on generated",
            "prompt": prompt,
            "preferences": preferences,
            "selected_outfit": best_outfit,
            "catvton_result": result
        }

    except Exception as e:  # catch-all so a failure anywhere above returns a clean JSON error instead of a raw 500 crash
        print("TRYON ERROR:", str(e))
        import traceback
        traceback.print_exc()  # print the full stack trace to the server logs for debugging

        return {
            "message": "Try-on failed",
            "error": str(e)
        }
