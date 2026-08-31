from pydantic import BaseModel
from typing import List, Optional


class PromptRequest(BaseModel):
    prompt: str


class Product(BaseModel):
    id: str
    brand: str
    title: str
    category: str
    color: str
    season: str
    style: List[str]
    price: float
    image_url: str

class OutfitCombination(BaseModel):
    top: Product
    bottom: Product
    shoes: Product

class Preferences(BaseModel):
    styles: List[str]
    colors: List[str]
    season: str
    gender: Optional[str] = None
    occasion: Optional[str] = None


class OutfitResponse(BaseModel):
    preferences: Preferences
    top: List[Product]
    bottom: List[Product]
    shoes: List[Product]
    combinations: List[OutfitCombination]
    
   