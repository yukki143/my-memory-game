# backend/app/routers/memory_sets.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
import json
from .. import models, schemas
from ..dependencies import get_db, get_current_user

router = APIRouter(
    prefix="/api",
    tags=["memory-sets"]
)

# 【重要】ルーム作成時の選択用。他人のセットは絶対に出さない。
@router.get("/sets")
def get_memory_sets(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 公式セット または 自分が作成したセット のみ取得
    db_sets = db.query(models.MemorySet).filter(
        or_(
            models.MemorySet.is_official == True,
            models.MemorySet.owner_id == current_user.id
        )
    ).all()
    
    return [{"id": str(s.id), "name": s.title} for s in db_sets]

# --- 以下、CRUDエンドポイント ---
@router.get("/my-sets", response_model=List[schemas.MemorySetResponse])
def read_my_memory_sets(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    sets = db.query(models.MemorySet).filter(models.MemorySet.owner_id == current_user.id).all()
    results = []
    for s in sets:
        results.append({
            "id": s.id, "title": s.title, "owner_id": s.owner_id,
            "memorize_time": s.memorize_time, "answer_time": s.answer_time,
            "questions_per_round": s.questions_per_round, "win_score": s.win_score,
            "condition_type": s.condition_type, "order_type": s.order_type,
            "is_official": s.is_official,
            "words": json.loads(s.words_json) if s.words_json else []
        })
    return results

@router.post("/my-sets", response_model=schemas.MemorySetResponse)
def create_memory_set(item: schemas.MemorySetCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    words_json_str = json.dumps([w.dict() for w in item.words], ensure_ascii=False)
    new_set = models.MemorySet(
        title=item.title, words_json=words_json_str, owner_id=current_user.id,
        memorize_time=item.memorize_time, answer_time=item.answer_time,
        questions_per_round=item.questions_per_round, win_score=item.win_score,
        condition_type=item.condition_type, order_type=item.order_type,
        is_official=False
    )
    db.add(new_set)
    db.commit()
    db.refresh(new_set)
    return {**new_set.__dict__, "words": json.loads(new_set.words_json)}

@router.get("/my-sets/{set_id}", response_model=schemas.MemorySetResponse)
def read_single_memory_set(set_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    memory_set = db.query(models.MemorySet).filter(
        models.MemorySet.id == set_id
    ).filter(
        or_(models.MemorySet.owner_id == current_user.id, models.MemorySet.is_official == True)
    ).first()
    
    if not memory_set:
        raise HTTPException(status_code=404, detail="Set not found or access denied")
    
    return {**memory_set.__dict__, "words": json.loads(memory_set.words_json)}

@router.delete("/my-sets/{set_id}")
def delete_memory_set(set_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    memory_set = db.query(models.MemorySet).filter(models.MemorySet.id == set_id, models.MemorySet.owner_id == current_user.id).first()
    if not memory_set:
        raise HTTPException(status_code=404, detail="Set not found")
    db.delete(memory_set)
    db.commit()
    return {"message": "Set deleted successfully"}