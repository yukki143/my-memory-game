# backend/app/routers/memory_sets.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import json
from .. import models, schemas
from ..dependencies import get_db, get_current_user

router = APIRouter(
    prefix="/api",
    tags=["memory-sets"]
)

# --- パブリックなセット一覧取得 ---
@router.get("/sets")
def get_memory_sets(db: Session = Depends(get_db)):
    response_sets = [
        {"id": "default", "name": "基本セット (フルーツ)"},
        {"id": "programming", "name": "プログラミング用語"},
        {"id": "animals", "name": "動物の名前"},
        {"id": "english_hard", "name": "超難問英単語"},
    ]
    db_sets = db.query(models.MemorySet).all()
    for s in db_sets:
        response_sets.append({"id": str(s.id), "name": s.title})
    return response_sets

# --- マイセット一覧取得 ---
@router.get("/my-sets", response_model=List[schemas.MemorySetResponse])
def read_my_memory_sets(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    sets = db.query(models.MemorySet).filter(models.MemorySet.owner_id == current_user.id).all()
    results = []
    for s in sets:
        s_dict = {
            "id": s.id,
            "title": s.title,
            "owner_id": s.owner_id,
            "memorize_time": s.memorize_time,
            "answer_time": s.answer_time, # ★追加
            "questions_per_round": s.questions_per_round,
            "win_score": s.win_score,
            "condition_type": s.condition_type,
            "order_type": s.order_type,
            "words": json.loads(s.words_json) if s.words_json else []
        }
        results.append(s_dict)
    return results

# --- 新規作成 ---
@router.post("/my-sets", response_model=schemas.MemorySetResponse)
def create_memory_set(item: schemas.MemorySetCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    words_json_str = json.dumps([w.dict() for w in item.words], ensure_ascii=False)
    
    new_set = models.MemorySet(
        title=item.title, 
        words_json=words_json_str, 
        owner_id=current_user.id,
        memorize_time=item.memorize_time,
        answer_time=item.answer_time, # ★追加
        questions_per_round=item.questions_per_round,
        win_score=item.win_score,
        condition_type=item.condition_type,
        order_type=item.order_type
    )
    db.add(new_set)
    db.commit()
    db.refresh(new_set)
    
    return {
        **new_set.__dict__,
        "words": json.loads(new_set.words_json)
    }

# --- 個別のセットを取得 ---
@router.get("/my-sets/{set_id}", response_model=schemas.MemorySetResponse)
def read_single_memory_set(set_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    memory_set = db.query(models.MemorySet).filter(
        models.MemorySet.id == set_id,
        models.MemorySet.owner_id == current_user.id
    ).first()
    
    if not memory_set:
        raise HTTPException(status_code=404, detail="Set not found or access denied")
    
    return {
        **memory_set.__dict__,
        "words": json.loads(memory_set.words_json)
    }

# --- セットの更新 ---
@router.put("/my-sets/{set_id}", response_model=schemas.MemorySetResponse)
def update_memory_set(set_id: int, item: schemas.MemorySetCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    memory_set = db.query(models.MemorySet).filter(
        models.MemorySet.id == set_id,
        models.MemorySet.owner_id == current_user.id
    ).first()
    
    if not memory_set:
        raise HTTPException(status_code=404, detail="Set not found or access denied")
    
    memory_set.title = item.title
    memory_set.words_json = json.dumps([w.dict() for w in item.words], ensure_ascii=False)
    memory_set.memorize_time = item.memorize_time
    memory_set.answer_time = item.answer_time # ★追加
    memory_set.questions_per_round = item.questions_per_round
    memory_set.win_score = item.win_score
    memory_set.condition_type = item.condition_type
    memory_set.order_type = item.order_type
    
    db.commit()
    db.refresh(memory_set)
    
    return {
        **memory_set.__dict__,
        "words": json.loads(memory_set.words_json)
    }

# --- セットの削除 ---
@router.delete("/my-sets/{set_id}")
def delete_memory_set(set_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    memory_set = db.query(models.MemorySet).filter(
        models.MemorySet.id == set_id,
        models.MemorySet.owner_id == current_user.id
    ).first()
    
    if not memory_set:
        raise HTTPException(status_code=404, detail="Set not found or access denied")
    
    db.delete(memory_set)
    db.commit()
    
    return {"message": "Set deleted successfully"}