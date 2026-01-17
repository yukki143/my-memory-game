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

# ルーム作成時の選択用リスト取得
@router.get("/sets")
def get_memory_sets(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 公式セット、公開セット、または自分が作成したセットを取得
    db_sets = db.query(models.MemorySet).filter(
        or_(
            models.MemorySet.is_official == True,
            models.MemorySet.is_public == True,
            models.MemorySet.owner_id == current_user.id
        )
    ).all()
    
    # 修正：判定に必要な情報をすべて含めて返す
    return [
        {
            "id": str(s.id), 
            "name": s.title,
            "owner_id": s.owner_id,      # フロントエンドの判定に必要
            "is_official": s.is_official, # フロントエンドの判定に必要
            "is_public": s.is_public      # 今後の拡張のために含めておくと安全
        } 
        for s in db_sets
    ]

# 自分のメモリーセット一覧取得
@router.get("/my-sets", response_model=List[schemas.MemorySetResponse])
def read_my_memory_sets(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 自分のセット または 公開されているセット を取得
    sets = db.query(models.MemorySet).filter(
        or_(
            models.MemorySet.owner_id == current_user.id,
            models.MemorySet.is_public == True
        )
    ).all()
    
    results = []
    for s in sets:
        results.append({
            "id": s.id, 
            "title": s.title, 
            "owner_id": s.owner_id,
            "memorize_time": s.memorize_time, 
            "answer_time": s.answer_time,
            "questions_per_round": s.questions_per_round, 
            "win_score": s.win_score,
            "condition_type": s.condition_type, 
            "order_type": s.order_type,
            "is_official": s.is_official,
            "is_public": s.is_public,  # ★ここを追加
            "words": json.loads(s.words_json) if s.words_json else []
        })
    return results

# 新規作成 (POST)
@router.post("/my-sets", response_model=schemas.MemorySetResponse)
def create_memory_set(item: schemas.MemorySetCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 単語リストをJSON文字列に変換
    words_json_str = json.dumps([w.dict() for w in item.words], ensure_ascii=False)
    
    new_set = models.MemorySet(
        title=item.title, 
        words_json=words_json_str, 
        owner_id=current_user.id,
        memorize_time=item.memorize_time, 
        answer_time=item.answer_time,
        questions_per_round=item.questions_per_round, 
        is_public=item.is_public,
        win_score=item.win_score,
        condition_type=item.condition_type, 
        order_type=item.order_type,
        is_official=False
    )
    db.add(new_set)
    db.commit()
    db.refresh(new_set)
    return {**new_set.__dict__, "words": json.loads(new_set.words_json)}

# 単一取得 (GET)
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

# ★追加: 更新処理 (PUT)
@router.put("/my-sets/{set_id}", response_model=schemas.MemorySetResponse)
def update_memory_set(
    set_id: int, 
    item: schemas.MemorySetCreate, 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    # 更新対象を検索（自分の所有物であることを確認）
    db_set = db.query(models.MemorySet).filter(
        models.MemorySet.id == set_id, 
        models.MemorySet.owner_id == current_user.id
    ).first()

    if not db_set:
        raise HTTPException(status_code=404, detail="Set not found or access denied")

    # フィールドの更新
    db_set.title = item.title
    db_set.words_json = json.dumps([w.dict() for w in item.words], ensure_ascii=False)
    db_set.memorize_time = item.memorize_time
    db_set.answer_time = item.answer_time
    db_set.questions_per_round = item.questions_per_round
    db_set.is_public = item.is_public
    db_set.win_score = item.win_score
    db_set.condition_type = item.condition_type
    db_set.order_type = item.order_type

    db.commit()
    db.refresh(db_set)

    # 辞書形式で展開し、words_jsonをパースして返却
    return {**db_set.__dict__, "words": json.loads(db_set.words_json)}

# 削除 (DELETE)
@router.delete("/my-sets/{set_id}")
def delete_memory_set(set_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    memory_set = db.query(models.MemorySet).filter(
        models.MemorySet.id == set_id, 
        models.MemorySet.owner_id == current_user.id
    ).first()
    
    if not memory_set:
        raise HTTPException(status_code=404, detail="Set not found")
    
    db.delete(memory_set)
    db.commit()
    return {"message": "Set deleted successfully"}